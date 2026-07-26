"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
  BufferAttribute,
  IcosahedronGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type PointLight,
} from "three";
import {
  PALETTE,
  SEED_BODY,
  SURFACES,
  hazardBody,
  hazardSize,
  type Block,
  type Hazard,
  type SeedPack,
  type Weather,
  type Zone,
} from "./levels";
import { ModelAsset } from "./ModelAsset";

/* ---------- low-poly hail geometry ---------- */

function hash(x: number, y: number, z: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 43.3) * 43758.5453;
  return value - Math.floor(value);
}

function hailGeometry(radius: number, detail: number, seed: number): BufferGeometry {
  const geometry = new IcosahedronGeometry(radius, detail);
  const position = geometry.attributes.position as BufferAttribute;
  const vertex = new Vector3();
  const cache = new Map<string, number>();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const key = `${vertex.x.toFixed(3)}|${vertex.y.toFixed(3)}|${vertex.z.toFixed(3)}`;
    let scale = cache.get(key);
    if (scale === undefined) {
      scale = 0.84 + hash(vertex.x, vertex.y, vertex.z, seed) * 0.24;
      cache.set(key, scale);
    }
    vertex.multiplyScalar(scale);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function useHail(radius: number, detail: number, seed: number) {
  const geometry = useMemo(
    () => hailGeometry(radius, detail, seed),
    [radius, detail, seed],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/* ---------- static field geometry ---------- */

function BlockMesh({ block }: { block: Block }) {
  const kind = block.kind ?? "soil";
  const color =
    kind === "stone"
      ? PALETTE.stone
      : kind === "wood"
        ? PALETTE.wood
        : kind === "metal"
          ? PALETTE.metal
          : PALETTE.soil;

  return (
    <group position={[block.x, block.y, 0]} rotation={[0, 0, block.rot ?? 0]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[block.w, block.h, 3.4]} />
        <meshStandardMaterial color={color} roughness={0.94} flatShading />
      </mesh>

      {kind === "soil" ? (
        <>
          <mesh position={[0, block.h / 2 - 0.15, 0]} receiveShadow>
            <boxGeometry args={[block.w + 0.02, 0.34, 3.44]} />
            <meshStandardMaterial color={PALETTE.grass} roughness={0.92} flatShading />
          </mesh>
          {Array.from({ length: 7 }, (_, index) => (
            <mesh
              key={index}
              position={[
                -block.w / 2 + ((index + 1) * block.w) / 8,
                block.h / 2 - 0.38,
                1.73,
              ]}
              scale={[0.025, Math.min(0.7, block.h * 0.2), 0.02]}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#5e3923" roughness={1} />
            </mesh>
          ))}
        </>
      ) : null}

      {kind === "stone" ? (
        <group position={[0, 0, 1.73]}>
          {Array.from({ length: Math.max(2, Math.min(8, Math.round(block.w))) }, (_, index) => (
            <mesh
              key={index}
              position={[
                -block.w / 2 + ((index + 0.5) * block.w) / Math.max(2, Math.round(block.w)),
                (index % 2 ? 0.18 : -0.16) * Math.min(1, block.h),
                0,
              ]}
              scale={[0.32, 0.06, 0.025]}
              rotation={[0, 0, index % 2 ? 0.12 : -0.08]}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#66695f" roughness={1} />
            </mesh>
          ))}
        </group>
      ) : null}

      {kind === "wood" ? (
        <group position={[0, 0, 1.73]}>
          {[-0.28, 0.28].map((y) => (
            <mesh key={y} position={[0, y * block.h, 0]} scale={[block.w * 0.86, 0.045, 0.03]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#75431f" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ) : null}

      {kind === "metal" ? (
        <group position={[0, 0, 1.74]}>
          <mesh>
            <boxGeometry args={[block.w * 0.72, block.h * 0.9, 0.08]} />
            <meshStandardMaterial color="#7b8d97" roughness={0.38} metalness={0.5} flatShading />
          </mesh>
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((y) => (
              <mesh
                key={`${x}-${y}`}
                position={[x * block.w * 0.28, y * block.h * 0.36, 0.06]}
              >
                <sphereGeometry args={[0.045, 6, 4]} />
                <meshStandardMaterial color="#c6d0d5" metalness={0.7} roughness={0.25} />
              </mesh>
            )),
          )}
        </group>
      ) : null}
    </group>
  );
}

export const FieldBlocks = memo(function FieldBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <RigidBody type="fixed" colliders={false} name="ground" userData={{ tag: "ground" }}>
      {blocks.map((block, index) => {
        const surface = SURFACES[block.kind ?? "soil"];
        return (
          <CuboidCollider
            key={`collider-${index}`}
            args={[block.w / 2, block.h / 2, 1.7]}
            position={[block.x, block.y, 0]}
            rotation={[0, 0, block.rot ?? 0]}
            friction={surface.friction}
            restitution={surface.restitution}
          />
        );
      })}
      {blocks.map((block, index) => (
        <BlockMesh key={`mesh-${index}`} block={block} />
      ))}
    </RigidBody>
  );
});

/* ---------- animated hazards ---------- */

type HazardProps = {
  hazard: Hazard;
  clock: React.RefObject<number>;
  onBurst: (id: string, x: number, y: number) => void;
};

function HayBale({ radius, faded }: { radius: number; faded: boolean }) {
  return (
    <ModelAsset
      url="/models/haystack-game.glb"
      targetSize={radius * 2}
      faded={faded}
    />
  );
}

function ProduceCrate({ radius, faded }: { radius: number; faded: boolean }) {
  const opacity = faded ? 0.58 : 1;
  const wood = (color: string) => (
    <meshStandardMaterial
      color={color}
      roughness={0.84}
      metalness={0.02}
      transparent={faded}
      opacity={opacity}
    />
  );

  return (
    <group>
      <mesh position={[0, -radius * 0.86, 0]} scale={[radius * 1.9, radius * 0.18, radius * 1.55]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        {wood("#70401f")}
      </mesh>

      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`post-${x}-${z}`}
            position={[x * radius * 0.84, 0, z * radius * 0.69]}
            scale={[radius * 0.18, radius * 1.95, radius * 0.18]}
            castShadow
          >
            <boxGeometry args={[1, 1, 1]} />
            {wood("#70401f")}
          </mesh>
        )),
      )}

      {[-0.62, 0, 0.62].map((y, index) => (
        <mesh
          key={`front-${y}`}
          position={[0, y * radius, radius * 0.75]}
          scale={[radius * 1.72, radius * 0.28, radius * 0.12]}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          {wood(index === 1 ? PALETTE.crate : "#d19855")}
        </mesh>
      ))}

      {[-1, 1].flatMap((side) =>
        [-0.48, 0.15, 0.78].map((y) => (
          <mesh
            key={`side-${side}-${y}`}
            position={[side * radius * 0.91, y * radius, 0]}
            scale={[radius * 0.12, radius * 0.24, radius * 1.3]}
          >
            <boxGeometry args={[1, 1, 1]} />
            {wood("#b87536")}
          </mesh>
        )),
      )}

      {[
        [-0.46, 0.72, 0.12, "#b94332"],
        [0.02, 0.76, 0.28, "#dd8a2d"],
        [0.46, 0.7, -0.08, "#769b42"],
      ].map(([x, y, z, color], index) => (
        <group key={`produce-${index}`} position={[x as number * radius, y as number * radius, z as number * radius]}>
          <mesh castShadow scale={[radius * 0.36, radius * 0.32, radius * 0.34]}>
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial
              color={color as string}
              roughness={0.72}
              transparent={faded}
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, radius * 0.34, 0]} rotation={[0, 0, index % 2 ? -0.3 : 0.3]}>
            <cylinderGeometry args={[radius * 0.035, radius * 0.045, radius * 0.18, 6]} />
            <meshStandardMaterial color="#42652f" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BombModel({ radius, faded }: { radius: number; faded: boolean }) {
  const sparkles = useRef<Group>(null);
  const flame = useRef<Group>(null);
  const points = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2;
        const distance = radius * (0.78 + (index % 3) * 0.1);
        return {
          position: [
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            radius * 0.72,
          ] as [number, number, number],
          phase: index * 0.83,
        };
      }),
    [radius],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    const group = sparkles.current;
    if (group) {
      group.rotation.z = time * 0.34;
      group.children.forEach((child, index) => {
        const pulse = 0.35 + Math.max(0, Math.sin(time * 5.5 + points[index].phase)) * 0.9;
        child.scale.setScalar(pulse);
        child.rotation.z = time * 1.8 + index;
      });
    }

    const fire = flame.current;
    if (fire) {
      // Layered sine terms keep the flicker irregular instead of an obvious pulse.
      const flicker = 0.82 + Math.sin(time * 21) * 0.12 + Math.sin(time * 13.3 + 1.7) * 0.08;
      fire.scale.set(0.94 + Math.sin(time * 17.5) * 0.08, flicker, 1);
      fire.rotation.z = Math.sin(time * 9.2) * 0.14;
    }
  });

  return (
    <group>
      <ModelAsset
        url="/models/bomb-round-game.glb"
        targetSize={radius * 2}
        meshIndex={1}
        faded={faded}
      />

      <group ref={flame} position={[0, radius * 0.82, 0]}>
        <mesh position={[0, radius * 0.34, 0]}>
          <coneGeometry args={[radius * 0.26, radius * 0.78, 10]} />
          <meshBasicMaterial
            color="#ff9226"
            transparent
            opacity={faded ? 0.4 : 0.92}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, radius * 0.26, 0.012]}>
          <coneGeometry args={[radius * 0.14, radius * 0.46, 10]} />
          <meshBasicMaterial
            color="#ffe9a3"
            transparent
            opacity={faded ? 0.45 : 0.98}
            depthWrite={false}
          />
        </mesh>
        {!faded ? (
          <pointLight color="#ffa63c" intensity={5} distance={radius * 7} decay={2} />
        ) : null}
      </group>
      <group ref={sparkles}>
        {points.map((point, index) => (
          <mesh key={index} position={point.position}>
            <octahedronGeometry args={[radius * (index % 2 ? 0.075 : 0.055), 0]} />
            <meshBasicMaterial
              color={index % 2 ? "#fff4bd" : "#ffd95e"}
              transparent
              opacity={faded ? 0.45 : 0.95}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function HazardMesh({ hazard, faded }: { hazard: Hazard; faded: boolean }) {
  const radius = hazardSize(hazard);
  const seed = useMemo(
    () => hazard.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0),
    [hazard.id],
  );

  if (hazard.kind === "hayBale") return <HayBale radius={radius} faded={faded} />;
  if (hazard.kind === "crate") return <ProduceCrate radius={radius} faded={faded} />;

  if (hazard.kind === "stormPod") {
    return <BombModel radius={radius} faded={faded} />;
  }

  return (
    <ModelAsset
      url="/models/rocks-game.glb"
      targetSize={radius * 2}
      meshIndex={0}
      faded={faded}
    />
  );
}

export const FarmHazard = memo(function FarmHazard({ hazard, clock, onBurst }: HazardProps) {
  const delay = hazard.delay ?? 0;
  const [released, setReleased] = useState(delay <= 0);
  const body = useRef<RapierRigidBody>(null);
  const releasedAt = useRef<number | null>(null);
  const spent = useRef(false);
  const shape = useMemo(() => hazardBody(hazard), [hazard]);

  const burst = () => {
    if (spent.current || hazard.kind !== "stormPod") return;
    spent.current = true;
    const translation = body.current?.translation();
    onBurst(hazard.id, translation?.x ?? hazard.x, translation?.y ?? hazard.y);
  };

  // Launch the moment the body becomes dynamic, so the hazard leaves with the
  // velocity the level specifies instead of free-falling for a frame first.
  useEffect(() => {
    if (!released) return;
    releasedAt.current = clock.current;
    if ((hazard.vx || hazard.vy) && body.current) {
      body.current.setLinvel({ x: hazard.vx ?? 0, y: hazard.vy ?? 0, z: 0 }, true);
    }
  }, [released, hazard.vx, hazard.vy, clock]);

  useFrame(() => {
    const now = clock.current;
    if (!released) {
      if (now >= delay) setReleased(true);
      return;
    }
    if (
      hazard.kind === "stormPod" &&
      hazard.fuse &&
      releasedAt.current !== null &&
      now - releasedAt.current >= hazard.fuse
    ) {
      burst();
    }
  });

  return (
    <RigidBody
      ref={body}
      name={`hazard:${hazard.id}`}
      userData={{ tag: "hazard", id: hazard.id, profile: shape.profile }}
      type={released ? "dynamic" : "fixed"}
      position={[hazard.x, hazard.y, 0]}
      colliders={false}
      ccd
      softCcdPrediction={shape.profile.radius}
      canSleep={false}
      enabledTranslations={[true, true, false]}
      enabledRotations={[false, false, true]}
      onCollisionEnter={({ other }) => {
        if (hazard.kind !== "stormPod") return;
        const tag = (other.rigidBody?.userData as { tag?: string } | undefined)?.tag;
        if (tag === "ground" || tag === "crop") burst();
      }}
    >
      {/* Not yet released: shown as a ghost, so it must not block anything. */}
      {shape.shape === "cuboid" ? (
        <CuboidCollider
          args={shape.half}
          sensor={!released}
          friction={shape.material.friction}
          restitution={shape.material.restitution}
          density={shape.material.density}
        />
      ) : shape.shape === "cylinder" ? (
        <CylinderCollider
          args={[shape.halfHeight, shape.radius]}
          rotation={[Math.PI / 2, 0, 0]}
          sensor={!released}
          friction={shape.material.friction}
          restitution={shape.material.restitution}
          density={shape.material.density}
        />
      ) : (
        <BallCollider
          args={[shape.radius]}
          sensor={!released}
          friction={shape.material.friction}
          restitution={shape.material.restitution}
          density={shape.material.density}
        />
      )}
      <HazardMesh hazard={hazard} faded={!released} />
    </RigidBody>
  );
});

/* ---------- seed packets ---------- */

export const SeedPacket = memo(function SeedPacket({
  seed,
  clock,
}: {
  seed: SeedPack;
  clock: React.RefObject<number>;
}) {
  const delay = seed.delay ?? 0;
  const [released, setReleased] = useState(delay <= 0);
  const body = useRef<RapierRigidBody>(null);

  useEffect(() => {
    if (!released) return;
    if (seed.vx && body.current) body.current.setLinvel({ x: seed.vx, y: 0, z: 0 }, true);
  }, [released, seed.vx]);

  useFrame(() => {
    if (!released && clock.current >= delay) setReleased(true);
  });

  return (
    <RigidBody
      ref={body}
      name={`seed:${seed.id}`}
      userData={{ tag: "seed", id: seed.id, profile: SEED_BODY.profile }}
      type={released ? "dynamic" : "fixed"}
      position={[seed.x, seed.y, 0]}
      colliders={false}
      ccd
      canSleep={false}
      enabledTranslations={[true, true, false]}
      enabledRotations={[false, false, true]}
    >
      <CuboidCollider
        args={SEED_BODY.half}
        sensor={!released}
        friction={SEED_BODY.material.friction}
        restitution={SEED_BODY.material.restitution}
        density={SEED_BODY.material.density}
      />
      <group>
        <mesh castShadow>
          <boxGeometry args={[0.54, 0.68, 0.2]} />
          <meshStandardMaterial
            color={PALETTE.seed}
            emissive="#d59a25"
            emissiveIntensity={0.16}
            roughness={0.78}
          />
        </mesh>

        <mesh position={[0, 0.04, 0.115]} scale={[0.4, 0.36, 0.018]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#f5e7bd" roughness={0.88} />
        </mesh>

        {[-0.225, 0.225].map((x) => (
          <mesh key={x} position={[x, 0, 0.118]} scale={[0.018, 0.58, 0.018]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#9c681e" roughness={0.82} />
          </mesh>
        ))}

        {[0.27, -0.27].map((y) => (
          <group key={y} position={[0, y, 0.12]}>
            <mesh scale={[0.46, 0.055, 0.025]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#b77b25" roughness={0.8} />
            </mesh>
            {Array.from({ length: 7 }, (_, index) => (
              <mesh
                key={index}
                position={[-0.2 + index * 0.067, y > 0 ? 0.035 : -0.035, 0.01]}
                rotation={[0, 0, y > 0 ? 0.4 : -0.4]}
                scale={[0.002, 0.055, 0.008]}
              >
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#80551d" roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}

        <mesh position={[0, 0.17, 0.145]} scale={[0.18, 0.025, 0.012]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#80551d" roughness={0.9} />
        </mesh>

        <group position={[0, -0.02, 0.15]} rotation={[0, 0, -0.2]}>
          <mesh position={[-0.08, 0.02, 0]} scale={[0.16, 0.07, 0.025]} rotation={[0, 0, 0.45]}>
            <sphereGeometry args={[1, 8, 5]} />
            <meshStandardMaterial color="#3f944a" roughness={0.76} flatShading />
          </mesh>
          <mesh position={[0.08, 0.07, 0]} scale={[0.16, 0.07, 0.025]} rotation={[0, 0, -0.45]}>
            <sphereGeometry args={[1, 8, 5]} />
            <meshStandardMaterial color="#67b24f" roughness={0.76} flatShading />
          </mesh>
          <mesh position={[0, -0.08, 0]} scale={[0.025, 0.2, 0.02]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#2f773d" roughness={0.8} />
          </mesh>
        </group>

        {[-0.1, 0, 0.1].map((x, index) => (
          <mesh
            key={`packet-seed-${x}`}
            position={[x, -0.17 + Math.abs(x) * 0.14, 0.15]}
            rotation={[0, 0, index * 0.55 - 0.55]}
            scale={[0.026, 0.05, 0.014]}
          >
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color="#704525" roughness={0.88} />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
});

/* ---------- build restrictions and effects ---------- */

export function NoPlantZone({ zone }: { zone: Zone }) {
  return (
    <group position={[zone.x, zone.y, 0.55]}>
      <mesh>
        <planeGeometry args={[zone.w, zone.h]} />
        <meshBasicMaterial color="#efad45" transparent opacity={0.09} depthWrite={false} />
      </mesh>
      {[
        [0, zone.h / 2, zone.w, 0.065],
        [0, -zone.h / 2, zone.w, 0.065],
        [zone.w / 2, 0, 0.065, zone.h],
        [-zone.w / 2, 0, 0.065, zone.h],
      ].map(([x, y, width, height], index) => (
        <mesh key={index} position={[x, y, 0.02]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial color="#dc8b2f" transparent opacity={0.68} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function CropSafeRing({ x, y, radius }: { x: number; y: number; radius: number }) {
  const displayRadius = radius * 1.22;
  return (
    <group position={[x, y + 0.18, 0.5]}>
      <mesh>
        <ringGeometry args={[displayRadius - 0.09, displayRadius, 64]} />
        <meshBasicMaterial color="#7ee66f" transparent opacity={0.88} depthWrite={false} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * displayRadius,
              Math.sin(angle) * displayRadius,
              0.02,
            ]}
            rotation={[0, 0, angle]}
            scale={[0.12, 0.05, 0.025]}
          >
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color="#a6f28f" transparent opacity={0.96} />
          </mesh>
        );
      })}
    </group>
  );
}

export function StormBurst({
  x,
  y,
  radius,
  onDone,
}: {
  x: number;
  y: number;
  radius: number;
  onDone: () => void;
}) {
  const sphere = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const life = useRef(0);

  useFrame((_, delta) => {
    life.current += delta;
    const progress = Math.min(1, life.current / 0.58);
    if (sphere.current) {
      sphere.current.scale.setScalar(0.2 + progress * radius);
      const material = sphere.current.material as MeshStandardMaterial;
      material.opacity = (1 - progress) * 0.78;
    }
    if (ring.current) {
      ring.current.scale.setScalar(0.3 + progress * radius * 1.35);
      const material = ring.current.material as MeshStandardMaterial;
      material.opacity = (1 - progress) * 0.9;
    }
    if (light.current) light.current.intensity = (1 - progress) * 180;
    if (progress >= 1) onDone();
  });

  return (
    <group position={[x, y, 0]}>
      <mesh ref={sphere}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color="#9eb6ff"
          emissive="#705eff"
          emissiveIntensity={2.2}
          transparent
          opacity={0.78}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.12, 7, 24]} />
        <meshStandardMaterial
          color="#d7edff"
          emissive="#95bdff"
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      <pointLight ref={light} color="#93a9ff" distance={14} intensity={180} />
    </group>
  );
}

/* ---------- farm scenery ---------- */

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <group position={[x, y, -9]} scale={scale}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 1.7, 7]} />
        <meshStandardMaterial color="#704526" roughness={0.95} flatShading />
      </mesh>
      {[
        [-0.35, 1.7, 0.72],
        [0.38, 1.65, 0.82],
        [0, 2.15, 0.9],
      ].map(([dx, dy, size], index) => (
        <mesh key={index} position={[dx, dy, 0]} scale={size}>
          <icosahedronGeometry args={[0.72, 1]} />
          <meshStandardMaterial
            color={index === 1 ? "#4d9c50" : "#65b35a"}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function FarmBuildings() {
  return (
    <>
      <group position={[-7.1, -2.25, -10]} scale={0.66}>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[3.6, 2.5, 2.4]} />
          <meshStandardMaterial color="#b94f3f" roughness={0.92} flatShading />
        </mesh>
        <mesh position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[2.62, 1.65, 4]} />
          <meshStandardMaterial color="#72402e" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 0.55, 1.23]}>
          <boxGeometry args={[1.2, 1.8, 0.08]} />
          <meshStandardMaterial color="#f2e0bd" roughness={0.85} />
        </mesh>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} position={[x, 0.55, 1.29]} rotation={[0, 0, x > 0 ? 0.62 : -0.62]}>
            <boxGeometry args={[0.09, 1.6, 0.04]} />
            <meshStandardMaterial color="#8b4b34" roughness={0.9} />
          </mesh>
        ))}
      </group>

      <group position={[6.65, -1.7, -10.5]} scale={0.66}>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[1.05, 1.05, 2.6, 14]} />
          <meshStandardMaterial color="#9caeb3" roughness={0.48} metalness={0.28} flatShading />
        </mesh>
        <mesh position={[0, 2.45, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[1.2, 0.9, 14]} />
          <meshStandardMaterial color="#657982" roughness={0.55} metalness={0.25} flatShading />
        </mesh>
        {[-0.45, 0.05, 0.55, 1.05, 1.55].map((y) => (
          <mesh key={y} position={[0, y, 1.06]}>
            <boxGeometry args={[2.05, 0.035, 0.035]} />
            <meshStandardMaterial color="#657982" metalness={0.5} roughness={0.38} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function FarmScenery({ weather }: { weather: Weather }) {
  const stormy = weather === "stormy";

  const hills = useMemo(
    () => [
      { x: -15, y: -12.4, radius: 9, color: "#a9d59a" },
      { x: -1, y: -13.3, radius: 10.5, color: "#8fc786" },
      { x: 14, y: -12, radius: 8.5, color: "#aad69b" },
    ],
    [],
  );
  return (
    <group position={[0, 0, -14]}>
      {hills.map((hill, index) => (
        <mesh key={index} position={[hill.x, hill.y, index * 0.45]}>
          <sphereGeometry args={[hill.radius, 18, 11]} />
          <meshStandardMaterial
            color={stormy ? "#769585" : hill.color}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}
