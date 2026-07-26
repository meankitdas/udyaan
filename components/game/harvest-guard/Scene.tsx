"use client";

import { Suspense, memo, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { PerspectiveCamera } from "three";
import type { CropMood } from "./Crop";
import SunflowerModel from "./SunflowerModel";
import { PlantLayer, VineStroke } from "./Vine";
import {
  CropSafeRing,
  FarmHazard,
  FarmScenery,
  FieldBlocks,
  NoPlantZone,
  SeedPacket,
  StormBurst,
} from "./FarmWorld";
import {
  CROP_SAFE_RADIUS,
  GRAVITY,
  KILL_Y,
  MATERIALS,
  PHYSICS,
  SEED_REACH,
  SOIL_TOP,
  STORM_RADIUS,
  VIEW,
  VIEW_FLOOR,
  WIND,
  type BodyProfile,
  type Level,
  type Vec2,
  type Weather,
} from "./levels";

export type Outcome =
  | { result: "win" }
  | { result: "lose"; reason: "impact" | "storm" | "fell" };
export type Phase = "plan" | "running" | "paused" | "over";

function FitCamera() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;
    const aspect = Math.max(0.25, size.width / Math.max(1, size.height));
    const verticalFov = (cam.fov * Math.PI) / 180;
    const distanceForHeight = VIEW.h / 2 / Math.tan(verticalFov / 2);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const distanceForWidth = VIEW.w / 2 / Math.tan(horizontalFov / 2);
    const distance =
      Math.min(Math.max(distanceForHeight, distanceForWidth), distanceForHeight * 1.85) * 1.02;
    const halfSeen = Math.tan(verticalFov / 2) * distance;
    const centerY = Math.max(VIEW.cy, VIEW_FLOOR + halfSeen);

    cam.position.set(VIEW.cx, centerY + distance * 0.055, distance);
    cam.lookAt(VIEW.cx, centerY, 0);
    cam.near = Math.max(1, distance * 0.2);
    cam.far = distance * 4;
    cam.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

function WeatherLighting({ weather }: { weather: Weather }) {
  const stormy = weather === "stormy";
  const cloudy = weather === "cloudy";
  return (
    <>
      <hemisphereLight
        args={[stormy ? "#b9d1e1" : "#e4f7ff", stormy ? "#526755" : "#718257", stormy ? 0.85 : 1.2]}
      />
      <ambientLight intensity={stormy ? 0.24 : cloudy ? 0.32 : 0.4} />
      <directionalLight
        castShadow
        position={[8, 16, 14]}
        intensity={stormy ? 1.2 : cloudy ? 1.65 : 2.25}
        color={stormy ? "#c4d4ea" : "#fff4d4"}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0012}
      />
      <directionalLight
        position={[-10, 5, -8]}
        intensity={stormy ? 0.55 : 0.38}
        color={stormy ? "#849dca" : "#9ecbff"}
      />
    </>
  );
}

/**
 * The forces Rapier does not integrate on its own, applied once per fixed
 * step so the impulse each body receives is exact regardless of frame rate:
 *
 *  - quadratic aerodynamic drag, taken against the prevailing wind, so a
 *    straw bale is pushed around by weather that dense hail simply ignores;
 *  - skin-friction drag on a spinning body;
 *  - rolling resistance while a body is genuinely touching a surface, which
 *    is what stops a bale rolling forever across a ploughed field.
 */
function Aerodynamics({ wind, clock }: { wind: number; clock: React.RefObject<number> }) {
  const { world } = useRapier();

  const touchingSurface = useCallback(
    (body: RapierRigidBody) => {
      for (let index = 0; index < body.numColliders(); index += 1) {
        const collider = body.collider(index);
        let touching = false;
        world.contactPairsWith(collider, (other) => {
          if (touching) return;
          world.contactPair(collider, other, (manifold) => {
            if (manifold.numSolverContacts() > 0) touching = true;
          });
        });
        if (touching) return true;
      }
      return false;
    },
    [world],
  );

  useBeforePhysicsStep(() => {
    clock.current += PHYSICS.timeStep;

    world.forEachRigidBody((body) => {
      if (!body.isDynamic()) return;
      const profile = (body.userData as { profile?: BodyProfile } | undefined)?.profile;
      if (!profile) return;

      // Rapier keeps user forces until they are cleared, so start each step
      // from zero — otherwise every force below would compound step on step.
      body.resetForces(false);
      body.resetTorques(false);

      const velocity = body.linvel();
      const relativeX = velocity.x - wind;
      const relativeY = velocity.y;
      const speed = Math.hypot(relativeX, relativeY);
      if (speed > 1e-4) {
        // F = 1/2 * rho * Cd * A * |v| * v, opposing the airflow.
        const drag = 0.5 * PHYSICS.airDensity * profile.drag * profile.area * speed;
        body.addForce({ x: -drag * relativeX, y: -drag * relativeY, z: 0 }, true);
      }

      const spin = body.angvel().z;
      if (Math.abs(spin) > 1e-4) {
        // Rotational skin friction scales with the fifth power of the radius.
        const airTorque =
          0.5 *
          PHYSICS.airDensity *
          profile.drag *
          profile.radius ** 5 *
          Math.abs(spin) *
          spin;
        body.addTorque({ x: 0, y: 0, z: -airTorque }, true);
      }

      // Rolling resistance. The contact patch deforms ahead of a rolling body,
      // which retards it by Crr * N * r. Applying that as torque alone would
      // break the rolling constraint and let the solver dissipate energy at
      // the full sliding-friction rate, so the matching linear force is
      // applied too: the body stays rolling and decelerates at exactly
      // Crr * g / (1 + I/mr^2), the textbook result.
      if (
        profile.rolling > 0 &&
        Math.abs(spin) > PHYSICS.rollingCutoff &&
        touchingSurface(body)
      ) {
        // Rolling resistance opposes travel over the ground, not the airflow.
        const ground = Math.hypot(velocity.x, velocity.y);
        if (ground > PHYSICS.rollingCutoff) {
          const mass = body.mass();
          const decel = Math.min(
            (profile.rolling * Math.abs(GRAVITY)) / (1 + profile.inertia),
            // Never enough to reverse the body inside a single step.
            ground / PHYSICS.timeStep,
          );
          body.addForce(
            {
              x: (-decel * mass * velocity.x) / ground,
              y: (-decel * mass * velocity.y) / ground,
              z: 0,
            },
            true,
          );
          const inertia = profile.inertia * mass * profile.radius * profile.radius;
          body.addTorque(
            { x: 0, y: 0, z: (-Math.sign(spin) * inertia * decel) / profile.radius },
            true,
          );
        }
      }
    });
  });

  return null;
}

const CropBody = memo(function CropBody({  level,
  mood,
  bodyRef,
  onHazard,
  onSeed,
}: {
  level: Level;
  mood: CropMood;
  bodyRef: React.RefObject<RapierRigidBody | null>;
  onHazard: () => void;
  onSeed: (id: string) => void;
}) {
  return (
    <RigidBody
      ref={bodyRef}
      name="crop"
      userData={{ tag: "crop" }}
      type="dynamic"
      position={[level.crop[0], level.crop[1], 0]}
      colliders={false}
      ccd
      canSleep={false}
      enabledTranslations={[true, true, false]}
      enabledRotations={[false, false, false]}
      onCollisionEnter={({ other }) => {
        const data = other.rigidBody?.userData as { tag?: string; id?: string } | undefined;
        if (data?.tag === "hazard") onHazard();
        else if (data?.tag === "seed" && data.id) onSeed(data.id);
      }}
    >
      <CuboidCollider
        args={[0.62, 0.9, 0.38]}
        friction={MATERIALS.plant.friction}
        restitution={MATERIALS.plant.restitution}
        density={MATERIALS.plant.density}
      />
      <BallCollider
        args={[SEED_REACH]}
        sensor
        density={0}
        onIntersectionEnter={({ other }) => {
          const data = other.rigidBody?.userData as { tag?: string; id?: string } | undefined;
          if (data?.tag === "seed" && data.id) onSeed(data.id);
        }}
      />
      <SunflowerModel mood={mood} drop={-0.9} />
    </RigidBody>
  );
});

type WorldProps = {
  level: Level;
  active: boolean;
  strokes: Vec2[][];
  collected: string[];
  mood: CropMood;
  onOutcome: (outcome: Outcome) => void;
  onSeed: (id: string) => void;
  onStormBurst: () => void;
  onReady: () => void;
  onTick: (elapsed: number) => void;
};

function World({
  level,
  active,
  strokes,
  collected,
  mood,
  onOutcome,
  onSeed,
  onStormBurst,
  onReady,
  onTick,
}: WorldProps) {
  const { world } = useRapier();
  const crop = useRef<RapierRigidBody>(null);
  const clock = useRef(0);
  const settled = useRef(false);
  const [bursts, setBursts] = useState<{ key: number; x: number; y: number }[]>([]);
  const [destroyed, setDestroyed] = useState<string[]>([]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  const finish = useCallback(
    (outcome: Outcome) => {
      if (settled.current) return;
      settled.current = true;
      onOutcome(outcome);
    },
    [onOutcome],
  );

  const burst = useCallback(
    (id: string, x: number, y: number) => {
      setDestroyed((previous) => (previous.includes(id) ? previous : [...previous, id]));
      setBursts((previous) => [
        ...previous,
        { key: Date.now() + Math.random(), x, y },
      ]);
      onStormBurst();

      const cropPosition = crop.current?.translation();
      if (
        cropPosition &&
        Math.hypot(cropPosition.x - x, cropPosition.y - y) < STORM_RADIUS
      ) {
        finish({ result: "lose", reason: "storm" });
      }

      const reach = STORM_RADIUS * 1.7;
      // A blast over solid ground is reflected by it. Modelling the reflection
      // as a mirror source below the soil reproduces the real behaviour -
      // debris is thrown upward and outward when a pod bursts on the field,
      // and purely outward when one bursts high in the air - without needing
      // an invented upward fudge factor.
      const sources = [
        { x, y },
        { x, y: 2 * SOIL_TOP - y },
      ];

      world.forEachRigidBody((body) => {
        if (!body.isDynamic()) return;
        const data = body.userData as { tag?: string; profile?: BodyProfile } | undefined;
        if (data?.tag === "crop") return;
        const position = body.translation();
        if (Math.hypot(position.x - x, position.y - y) > reach) return;

        // Overpressure falls off with the square of the distance and acts on
        // the body's frontal area, so light debris flies and dense hail does
        // not - the impulse is not simply proportional to mass any more.
        const area = data?.profile?.area ?? 0.5;
        let ix = 0;
        let iy = 0;
        for (const source of sources) {
          const dx = position.x - source.x;
          const dy = position.y - source.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 1e-3) continue;
          // Clamp the near field so the singularity at the origin is finite.
          const range = Math.max(distance, STORM_RADIUS * 0.35);
          const impulse = (PHYSICS.blastPressure * area) / (range * range);
          ix += (dx / distance) * impulse;
          iy += (dy / distance) * impulse;
        }
        if (ix || iy) body.applyImpulse({ x: ix, y: iy, z: 0 }, true);
      });
    },
    [finish, onStormBurst, world],
  );

  useFrame(() => {
    if (!active || settled.current) return;
    onTick(clock.current);
    const position = crop.current?.translation();
    if (position && position.y < KILL_Y) {
      finish({ result: "lose", reason: "fell" });
      return;
    }
    if (clock.current >= level.duration) finish({ result: "win" });
  });

  return (
    <>
      {/* Advances `clock` by one fixed step per simulated step, so hazard
          release times and the survival timer track the simulation exactly
          instead of drifting with the frame rate. */}
      <Aerodynamics wind={WIND[level.weather]} clock={clock} />
      <FieldBlocks blocks={level.blocks} />
      <CropBody
        level={level}
        mood={mood}
        bodyRef={crop}
        onHazard={() => finish({ result: "lose", reason: "impact" })}
        onSeed={onSeed}
      />
      {level.hazards
        .filter((hazard) => !destroyed.includes(hazard.id))
        .map((hazard) => (
          <FarmHazard key={hazard.id} hazard={hazard} clock={clock} onBurst={burst} />
        ))}
      {(level.seeds ?? [])
        .filter((seed) => !collected.includes(seed.id))
        .map((seed) => (
          <SeedPacket key={seed.id} seed={seed} clock={clock} />
        ))}
      {strokes.map((points, index) => (
        <VineStroke key={index} points={points} />
      ))}
      {bursts.map((effect) => (
        <StormBurst
          key={effect.key}
          x={effect.x}
          y={effect.y}
          radius={STORM_RADIUS}
          onDone={() =>
            setBursts((previous) => previous.filter((item) => item.key !== effect.key))
          }
        />
      ))}
    </>
  );
}

export type SceneProps = {
  level: Level;
  runId: number;
  phase: Phase;
  canDraw: boolean;
  strokes: Vec2[][];
  collected: string[];
  budgetLeft: number;
  mood: CropMood;
  onCommit: (points: Vec2[]) => void;
  onLiveVine: (length: number) => void;
  onBlocked: () => void;
  onDrawStart: () => void;
  onOutcome: (outcome: Outcome) => void;
  onSeed: (id: string) => void;
  onStormBurst: () => void;
  onReady: () => void;
  onTick: (elapsed: number) => void;
};

export default function Scene({
  level,
  runId,
  phase,
  canDraw,
  strokes,
  collected,
  budgetLeft,
  mood,
  onCommit,
  onLiveVine,
  onBlocked,
  onDrawStart,
  onOutcome,
  onSeed,
  onStormBurst,
  onReady,
  onTick,
}: SceneProps) {
  const sky =
    level.weather === "stormy"
      ? "#70889b"
      : level.weather === "cloudy"
        ? "#a8cbd4"
        : level.weather === "breezy"
          ? "#91cde0"
          : "#82cef0";

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: 42, position: [0, 0, 30], near: 1, far: 140 }}
    >
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 30, 68]} />
      <FitCamera />
      <WeatherLighting weather={level.weather} />
      <FarmScenery weather={level.weather} />

      {level.noPlant?.map((zone, index) => (
        <NoPlantZone key={index} zone={zone} />
      ))}
      {phase === "plan" ? (
        <CropSafeRing x={level.crop[0]} y={level.crop[1]} radius={CROP_SAFE_RADIUS} />
      ) : null}

      <Suspense fallback={null}>
        <Physics
          key={runId}
          gravity={[0, GRAVITY, 0]}
          paused={phase !== "running"}
          timeStep={PHYSICS.timeStep}
          numSolverIterations={PHYSICS.solverIterations}
          numInternalPgsIterations={PHYSICS.pgsIterations}
          interpolate
        >
          <World
            level={level}
            active={phase === "running"}
            strokes={strokes}
            collected={collected}
            mood={mood}
            onOutcome={onOutcome}
            onSeed={onSeed}
            onStormBurst={onStormBurst}
            onReady={onReady}
            onTick={onTick}
          />
        </Physics>
      </Suspense>

      <PlantLayer
        level={level}
        enabled={canDraw}
        budgetLeft={budgetLeft}
        onCommit={onCommit}
        onLiveVine={onLiveVine}
        onBlocked={onBlocked}
        onStart={onDrawStart}
      />
    </Canvas>
  );
}
