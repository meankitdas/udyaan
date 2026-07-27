"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import {
  CatmullRomCurve3,
  Plane,
  Raycaster,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";
import {
  CROP_SAFE_RADIUS,
  PALETTE,
  MATERIALS,
  SURFACES,
  VINE_RADIUS,
  VINE_SAMPLE,
  canPlantAt,
  type Level,
  type Vec2,
} from "./levels";

const DRAFT_COLOR = "#80e27e";
const BOUNDARY_GAP = 0.015;

type BoundarySide = "top" | "right" | "bottom" | "left";

/** Keep the centreline outside protected geometry and return any corners needed. */
function constrainPlantPath(level: Level, point: Vec2, previous: Vec2): Vec2[] | null {
  for (const zone of level.noPlant ?? []) {
    const left = zone.x - zone.w / 2 - VINE_RADIUS;
    const right = zone.x + zone.w / 2 + VINE_RADIUS;
    const bottom = zone.y - zone.h / 2 - VINE_RADIUS;
    const top = zone.y + zone.h / 2 + VINE_RADIUS;
    if (point[0] < left || point[0] > right || point[1] < bottom || point[1] > top) continue;

    const clampX = (value: number) => Math.min(right, Math.max(left, value));
    const clampY = (value: number) => Math.min(top, Math.max(bottom, value));
    const distances = (value: Vec2): Record<BoundarySide, number> => ({
      top: Math.abs(value[1] - top),
      right: Math.abs(value[0] - right),
      bottom: Math.abs(value[1] - bottom),
      left: Math.abs(value[0] - left),
    });
    const nearest = (value: Vec2): BoundarySide => {
      const entries = Object.entries(distances(value)) as [BoundarySide, number][];
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
    };
    const project = (side: BoundarySide): Vec2 => {
      if (side === "top") return [clampX(point[0]), top + BOUNDARY_GAP];
      if (side === "right") return [right + BOUNDARY_GAP, clampY(point[1])];
      if (side === "bottom") return [clampX(point[0]), bottom - BOUNDARY_GAP];
      return [left - BOUNDARY_GAP, clampY(point[1])];
    };
    const corner = (first: BoundarySide, second: BoundarySide): Vec2 => {
      const x = first === "left" || second === "left" ? left - BOUNDARY_GAP : right + BOUNDARY_GAP;
      const y = first === "bottom" || second === "bottom" ? bottom - BOUNDARY_GAP : top + BOUNDARY_GAP;
      return [x, y];
    };

    const previousSide = nearest(previous);
    const pointDistances = distances(point);
    let targetSide = nearest(point);
    // Small hysteresis prevents noisy touch samples from alternating sides at
    // a diagonal and repeatedly walking around the same corner.
    if (pointDistances[previousSide] <= pointDistances[targetSide] + VINE_SAMPLE * 0.55) {
      targetSide = previousSide;
    }

    const projected = project(targetSide);
    if (targetSide === previousSide) return [projected];

    const opposite =
      (previousSide === "left" && targetSide === "right") ||
      (previousSide === "right" && targetSide === "left") ||
      (previousSide === "top" && targetSide === "bottom") ||
      (previousSide === "bottom" && targetSide === "top");
    if (!opposite) return [corner(previousSide, targetSide), projected];

    const via: BoundarySide =
      previousSide === "left" || previousSide === "right"
        ? point[1] >= zone.y
          ? "top"
          : "bottom"
        : point[0] >= zone.x
          ? "right"
          : "left";
    return [corner(previousSide, via), corner(via, targetSide), projected];
  }

  const cropDx = point[0] - level.crop[0];
  const cropDy = point[1] - level.crop[1];
  if (Math.hypot(cropDx, cropDy) < CROP_SAFE_RADIUS) {
    let directionX = cropDx;
    let directionY = cropDy;
    if (Math.hypot(directionX, directionY) < 1e-5) {
      directionX = previous[0] - level.crop[0];
      directionY = previous[1] - level.crop[1];
    }
    const length = Math.max(1e-5, Math.hypot(directionX, directionY));
    const radius = CROP_SAFE_RADIUS + BOUNDARY_GAP;
    return [[
      level.crop[0] + (directionX / length) * radius,
      level.crop[1] + (directionY / length) * radius,
    ]];
  }

  return canPlantAt(level, point[0], point[1]) ? [point] : null;
}

function centreline(points: Vec2[]): CatmullRomCurve3 {
  return new CatmullRomCurve3(
    points.map(([x, y]) => new Vector3(x, y, 0)),
    false,
    "catmullrom",
    0.12,
  );
}

function buildTube(points: Vec2[], radius: number, quality: number): TubeGeometry | null {
  if (points.length < 2) return null;
  const segments = Math.min(700, Math.max(12, Math.round(points.length * quality)));
  return new TubeGeometry(centreline(points), segments, radius, quality > 1.5 ? 8 : 5, false);
}

/**
 * Samples the same spline the tube is built from, so the collider follows the
 * curve the player actually sees. Fitting the raw pointer samples instead left
 * hard concave kinks where the rendered tube bends smoothly, and anything
 * sliding along the vine slammed into a corner that was not on screen.
 */
function curvePoints(points: Vec2[]): Vec2[] {
  if (points.length < 3) return points;
  const curve = centreline(points);
  const divisions = Math.min(600, Math.max(points.length, Math.ceil(curve.getLength() / (VINE_RADIUS * 0.5))));
  return curve.getSpacedPoints(divisions).map((p) => [p.x, p.y] as Vec2);
}

function useTube(points: Vec2[], radius: number, quality = 2): BufferGeometry | null {
  const geometry = useMemo(
    () => buildTube(points, radius, quality),
    [points, radius, quality],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

type Segment = {
  position: [number, number, number];
  rotation: [number, number, number];
  halfHeight: number;
};

/**
 * Fits the drawn polyline with the fewest capsules that stay within `tol` of
 * it. A capsule is the exact solid swept by the rendered tube, so the surface
 * the solver tests is the surface the player sees — and merging collinear
 * samples avoids stacking four overlapping colliders under every contact,
 * which previously multiplied the normal impulse on anything that landed.
 */
function fitCapsules(points: Vec2[], tol = VINE_RADIUS * 0.1): Segment[] {
  const result: Segment[] = [];
  if (points.length < 2) return result;

  const deviates = (start: number, end: number) => {
    const [x0, y0] = points[start];
    const [x1, y1] = points[end];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return true;
    for (let i = start + 1; i < end; i += 1) {
      const [px, py] = points[i];
      if (Math.abs((px - x0) * dy - (py - y0) * dx) / len > tol) return true;
    }
    return false;
  };

  let start = 0;
  while (start < points.length - 1) {
    let end = start + 1;
    while (end + 1 < points.length && !deviates(start, end + 1)) end += 1;

    const [x0, y0] = points[start];
    const [x1, y1] = points[end];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    if (length > 1e-4) {
      result.push({
        position: [(x0 + x1) / 2, (y0 + y1) / 2, 0],
        // A capsule's axis is +Y, so turn it onto the segment direction.
        rotation: [0, 0, Math.atan2(dy, dx) - Math.PI / 2],
        halfHeight: length / 2,
      });
    }
    start = end;
  }
  return result;
}

type VineLeaf = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export const VineStroke = memo(function VineStroke({ points }: { points: Vec2[] }) {
  const geometry = useTube(points, VINE_RADIUS);

  const segments = useMemo(() => fitCapsules(curvePoints(points)), [points]);

  const leaves = useMemo<VineLeaf[]>(() => {
    const result: VineLeaf[] = [];
    for (let index = 5; index < points.length - 3; index += 8) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      const angle = Math.atan2(next[1] - previous[1], next[0] - previous[0]);
      const side = result.length % 2 ? -1 : 1;
      result.push({
        position: [
          current[0] - Math.sin(angle) * side * 0.14,
          current[1] + Math.cos(angle) * side * 0.14,
          0.22,
        ],
        rotation: [0, 0, angle + side * 0.72],
        scale: [0.24, 0.09, 0.045],
      });
    }
    return result;
  }, [points]);

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <RigidBody
      type="dynamic"
      colliders={false}
      userData={{ tag: "vine" }}
      name="vine"
      ccd
      enabledTranslations={[true, true, false]}
      enabledRotations={[false, false, true]}
    >
      {segments.map((segment, index) => (
        <CapsuleCollider
          key={index}
          args={[segment.halfHeight, VINE_RADIUS]}
          position={segment.position}
          rotation={segment.rotation}
          friction={SURFACES.vine.friction}
          restitution={SURFACES.vine.restitution}
          density={MATERIALS.plant.density}
        />
      ))}
      {geometry ? (
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial color={PALETTE.vine} roughness={0.58} metalness={0.02} />
        </mesh>
      ) : null}
      {leaves.map((leaf, index) => (
        <mesh
          key={`leaf-${index}`}
          position={leaf.position}
          rotation={leaf.rotation}
          scale={leaf.scale}
          castShadow
        >
          <sphereGeometry args={[1, 8, 5]} />
          <meshStandardMaterial
            color={index % 2 ? PALETTE.leaf : PALETTE.leafLight}
            roughness={0.78}
            flatShading
          />
        </mesh>
      ))}
      {[first, last].map((point, index) =>
        point ? (
          <mesh key={`cap-${index}`} position={[point[0], point[1], 0]} castShadow>
            <sphereGeometry args={[VINE_RADIUS, 10, 8]} />
            <meshStandardMaterial color={PALETTE.vine} roughness={0.58} />
          </mesh>
        ) : null,
      )}
    </RigidBody>
  );
});

function DraftVine({ points, over }: { points: Vec2[]; over: boolean }) {
  const geometry = useTube(points, VINE_RADIUS * 0.96, 1.2);
  const color = over ? "#df6b4f" : DRAFT_COLOR;

  if (!geometry) {
    const point = points[0];
    if (!point) return null;
    return (
      <mesh position={[point[0], point[1], 0]}>
        <sphereGeometry args={[VINE_RADIUS, 10, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>
    );
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.45}
        roughness={0.45}
      />
    </mesh>
  );
}

type PlantLayerProps = {
  level: Level;
  enabled: boolean;
  /** How much vine length is still available. */
  budgetLeft: number;
  onCommit: (points: Vec2[]) => void;
  onLiveVine: (draftLength: number) => void;
  onBlocked: () => void;
  onStart: () => void;
};

export function PlantLayer({
  level,
  enabled,
  budgetLeft,
  onCommit,
  onLiveVine,
  onBlocked,
  onStart,
}: PlantLayerProps) {
  const { camera, gl } = useThree();
  const [draft, setDraft] = useState<Vec2[]>([]);
  const draftRef = useRef<Vec2[]>([]);
  const lengthRef = useRef(0);
  const drawingRef = useRef(false);
  const nearLimit = budgetLeft - lengthRef.current < 0.8;

  const live = useRef({
    level,
    enabled,
    budgetLeft,
    onCommit,
    onLiveVine,
    onBlocked,
    onStart,
  });
  live.current = {
    level,
    enabled,
    budgetLeft,
    onCommit,
    onLiveVine,
    onBlocked,
    onStart,
  };

  useEffect(() => {
    const element = gl.domElement;
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const hit = new Vector3();

    const toWorld = (event: PointerEvent): Vec2 | null => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, hit) ? [hit.x, hit.y] : null;
    };

    const finish = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const points = draftRef.current;
      draftRef.current = [];
      lengthRef.current = 0;
      setDraft([]);
      if (points.length >= 2) live.current.onCommit(points);
      live.current.onLiveVine(0);
    };

    const pointerDown = (event: PointerEvent) => {
      const state = live.current;
      if (!state.enabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (state.budgetLeft <= 0.15) {
        state.onBlocked();
        return;
      }
      const point = toWorld(event);
      if (!point) return;
      if (!canPlantAt(state.level, point[0], point[1])) {
        state.onBlocked();
        return;
      }
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        /* Pointer capture is best-effort on embedded browsers. */
      }
      drawingRef.current = true;
      if (draftRef.current.length) {
        // A browser may cancel a touch stream during a brief interruption.
        // Resume the same continuous stroke instead of starting the game.
        draftRef.current.push(point);
        setDraft(draftRef.current.slice());
      } else {
        draftRef.current = [point];
        lengthRef.current = 0;
        setDraft([point]);
        state.onStart();
      }
      event.preventDefault();
    };

    const appendPoint = (point: Vec2) => {
      if (!drawingRef.current) return;
      const state = live.current;
      const points = draftRef.current;
      const last = points[points.length - 1];
      const distance = Math.hypot(point[0] - last[0], point[1] - last[1]);
      if (distance < VINE_SAMPLE) return;

      const steps = Math.min(80, Math.ceil(distance / VINE_SAMPLE));
      for (let index = 1; index <= steps; index += 1) {
        const progress = index / steps;
        const rawSample: Vec2 = [
          last[0] + (point[0] - last[0]) * progress,
          last[1] + (point[1] - last[1]) * progress,
        ];
        const constrained = constrainPlantPath(state.level, rawSample, points[points.length - 1]);
        if (!constrained) continue;
        for (const sample of constrained) {
          const previous = points[points.length - 1];
          const sampleDistance = Math.hypot(sample[0] - previous[0], sample[1] - previous[1]);
          if (sampleDistance < VINE_SAMPLE * 0.18) continue;
          if (lengthRef.current + sampleDistance > state.budgetLeft) {
            finish();
            return;
          }
          lengthRef.current += sampleDistance;
          points.push(sample);
        }
      }
      setDraft(points.slice());
      state.onLiveVine(lengthRef.current);
    };

    const pointerMove = (event: PointerEvent) => {
      if (!drawingRef.current) return;
      const events = event.getCoalescedEvents?.() ?? [event];
      for (const sampleEvent of events) {
        const point = toWorld(sampleEvent);
        if (point) appendPoint(point);
      }
      event.preventDefault();
    };

    const pointerUp = (event: PointerEvent) => {
      const point = toWorld(event);
      if (point) appendPoint(point);
      finish();
    };

    const pointerCancel = () => {
      // Do not commit or launch on browser-generated touch cancellation. A new
      // pointerdown resumes the existing draft.
      drawingRef.current = false;
    };

    const preventMenu = (event: MouseEvent) => event.preventDefault();
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointermove", pointerMove);
    element.addEventListener("pointerup", pointerUp);
    element.addEventListener("pointercancel", pointerCancel);
    element.addEventListener("contextmenu", preventMenu);
    window.addEventListener("blur", finish);
    return () => {
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("pointermove", pointerMove);
      element.removeEventListener("pointerup", pointerUp);
      element.removeEventListener("pointercancel", pointerCancel);
      element.removeEventListener("contextmenu", preventMenu);
      window.removeEventListener("blur", finish);
    };
  }, [camera, gl]);

  useEffect(() => {
    if (enabled) return;
    drawingRef.current = false;
    draftRef.current = [];
    lengthRef.current = 0;
    setDraft([]);
  }, [enabled]);

  if (!draft.length) return null;
  return <DraftVine points={draft} over={nearLimit} />;
}
