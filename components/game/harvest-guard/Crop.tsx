"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Shape, type Group, type Mesh } from "three";

export type CropMood = "idle" | "alert" | "happy" | "hurt";

const STEM = "#36874b";
const STEM_DARK = "#22683a";
const LEAF = "#4da653";
const LEAF_LIGHT = "#76c95c";
const PETAL = "#f5be37";
const PETAL_LIGHT = "#ffd75a";
const CENTER = "#714522";
const SOIL = "#6f4629";
const DARK = "#2c241c";

const LEAF_SHAPE = new Shape();
LEAF_SHAPE.moveTo(-0.42, 0);
LEAF_SHAPE.bezierCurveTo(-0.18, 0.23, 0.24, 0.24, 0.5, 0);
LEAF_SHAPE.bezierCurveTo(0.22, -0.24, -0.2, -0.22, -0.42, 0);

const PETAL_SHAPE = new Shape();
PETAL_SHAPE.moveTo(0.05, 0);
PETAL_SHAPE.bezierCurveTo(0.2, 0.12, 0.48, 0.13, 0.62, 0);
PETAL_SHAPE.bezierCurveTo(0.48, -0.13, 0.2, -0.12, 0.05, 0);

const ORGANIC_EXTRUDE = {
  depth: 0.045,
  bevelEnabled: true,
  bevelSegments: 2,
  bevelSize: 0.018,
  bevelThickness: 0.018,
  curveSegments: 8,
} as const;

type Props = {
  mood: CropMood;
  /** Vertical offset that places the soil mound at the collider's base. */
  drop: number;
};

function Leaf({
  position,
  rotation,
  flip = false,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  flip?: boolean;
}) {
  return (
    <group position={position} rotation={rotation} scale={[flip ? -1 : 1, 1, 1]}>
      <mesh castShadow rotation={[0.08, 0, 0]}>
        <extrudeGeometry args={[LEAF_SHAPE, ORGANIC_EXTRUDE]} />
        <meshStandardMaterial color={LEAF} roughness={0.76} />
      </mesh>
      <mesh position={[0.02, 0, 0.075]} scale={[0.72, 0.018, 0.012]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={LEAF_LIGHT} roughness={0.8} />
      </mesh>
      {[-0.18, 0.04, 0.25].map((x, index) => (
        <mesh
          key={x}
          position={[x, 0, 0.07]}
          rotation={[0, 0, index % 2 ? -0.5 : 0.5]}
          scale={[0.18, 0.012, 0.01]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={LEAF_LIGHT} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function CropModel({ mood, drop }: Props) {
  const root = useRef<Group>(null);
  const stem = useRef<Group>(null);
  const flower = useRef<Group>(null);
  const petals = useRef<Group>(null);
  const leaves = useRef<Group>(null);
  const eyeLeft = useRef<Mesh>(null);
  const eyeRight = useRef<Mesh>(null);
  const mouth = useRef<Mesh>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + phase;
    const g = root.current;
    if (!g) return;

    const ease = Math.min(1, delta * 8);
    const hurt = mood === "hurt";
    const alert = mood === "alert";
    const happy = mood === "happy";
    const sway = hurt ? -0.46 : Math.sin(t * (alert ? 8 : 1.8)) * (alert ? 0.055 : 0.035);

    g.position.y = drop + (happy ? Math.abs(Math.sin(t * 5.5)) * 0.1 : 0);
    g.rotation.z += (sway - g.rotation.z) * ease;
    g.scale.y += ((hurt ? 0.8 : happy ? 1.05 : 1) - g.scale.y) * ease;

    if (stem.current) stem.current.rotation.z = Math.sin(t * 2.2) * (alert ? 0.035 : 0.018);
    if (flower.current) {
      const target = hurt ? -0.72 : alert ? Math.sin(t * 12) * 0.08 : Math.sin(t * 1.6) * 0.045;
      flower.current.rotation.z += (target - flower.current.rotation.z) * ease;
      flower.current.position.y = hurt ? 1.32 : 1.48;
    }
    if (petals.current) {
      petals.current.rotation.z += happy ? delta * 0.7 : delta * 0.025;
      const scale = hurt ? 0.82 : happy ? 1.06 + Math.sin(t * 5) * 0.025 : 1;
      petals.current.scale.setScalar(scale);
    }
    if (leaves.current) {
      leaves.current.rotation.z = hurt ? -0.25 : Math.sin(t * 2.5) * 0.025;
    }

    const blink = Math.sin(t * 1.25) > 0.985 ? 0.12 : 1;
    const eyeOpen = hurt ? 0.12 : happy ? 0.55 : blink;
    eyeLeft.current?.scale.set(1, eyeOpen, 1);
    eyeRight.current?.scale.set(1, eyeOpen, 1);
    if (mouth.current) {
      mouth.current.rotation.z = happy ? 0 : hurt ? Math.PI : 0;
      mouth.current.scale.x = happy ? 0.125 : 0.08;
    }
  });

  return (
    <group ref={root} position={[0, drop, 0]}>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow scale={[1, 0.38, 0.68]}>
        <sphereGeometry args={[0.72, 14, 8]} />
        <meshStandardMaterial color={SOIL} roughness={1} flatShading />
      </mesh>
      {[-0.35, -0.12, 0.18, 0.38].map((x, i) => (
        <mesh
          key={x}
          position={[x, 0.2 + (i % 2) * 0.02, 0.35]}
          rotation={[0, 0, (i - 1.5) * 0.1]}
          scale={[0.12, 0.05, 0.05]}
        >
          <sphereGeometry args={[1, 6, 4]} />
          <meshStandardMaterial color={i % 2 ? "#9b6a3e" : "#5d3822"} roughness={1} flatShading />
        </mesh>
      ))}

      <group ref={stem}>
        <mesh position={[0, 0.82, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.14, 1.35, 12, 3]} />
          <meshStandardMaterial color={STEM} roughness={0.76} />
        </mesh>
        <mesh position={[0.03, 0.82, 0.095]} scale={[0.018, 0.57, 0.018]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={LEAF_LIGHT} roughness={0.8} />
        </mesh>

        <group ref={leaves}>
          <mesh position={[-0.22, 0.72, 0]} rotation={[0, 0, -0.82]} castShadow>
            <cylinderGeometry args={[0.035, 0.045, 0.52, 6]} />
            <meshStandardMaterial color={STEM_DARK} roughness={0.85} flatShading />
          </mesh>
          <Leaf position={[-0.42, 0.88, 0.02]} rotation={[0, 0, 0.28]} flip />

          <mesh position={[0.2, 1.02, -0.02]} rotation={[0, 0, 0.88]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 0.46, 6]} />
            <meshStandardMaterial color={STEM_DARK} roughness={0.85} flatShading />
          </mesh>
          <Leaf position={[0.4, 1.16, -0.01]} rotation={[0, 0, -0.22]} />
        </group>
      </group>

      <group ref={flower} position={[0, 1.48, 0]}>
        <group ref={petals}>
          {Array.from({ length: 18 }, (_, index) => {
            const angle = (index / 18) * Math.PI * 2;
            return (
              <mesh
                key={index}
                rotation={[0, 0, angle]}
                castShadow
              >
                <extrudeGeometry args={[PETAL_SHAPE, ORGANIC_EXTRUDE]} />
                <meshStandardMaterial
                  color={index % 2 ? PETAL : PETAL_LIGHT}
                  roughness={0.68}
                />
              </mesh>
            );
          })}
        </group>

        <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.36, 0.22, 18]} />
          <meshStandardMaterial color={CENTER} roughness={0.9} flatShading />
        </mesh>
        {Array.from({ length: 24 }, (_, index) => {
          const angle = index * 2.399963;
          const distance = 0.08 + (index / 24) * 0.2;
          return (
            <mesh
              key={`seed-${index}`}
              position={[Math.cos(angle) * distance, Math.sin(angle) * distance, 0.16]}
              rotation={[0, 0, angle + 0.5]}
              scale={[0.027, 0.045, 0.022]}
            >
              <sphereGeometry args={[1, 7, 5]} />
              <meshStandardMaterial
                color={index % 3 === 0 ? "#c18a3b" : "#8a592a"}
                roughness={0.88}
              />
            </mesh>
          );
        })}

        <mesh ref={eyeLeft} position={[-0.115, 0.065, 0.19]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color={DARK} roughness={0.35} />
        </mesh>
        <mesh ref={eyeRight} position={[0.115, 0.065, 0.19]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color={DARK} roughness={0.35} />
        </mesh>
        <mesh ref={mouth} position={[0, -0.09, 0.2]} scale={[0.1, 0.025, 0.025]}>
          <sphereGeometry args={[1, 8, 5]} />
          <meshStandardMaterial color={DARK} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

export default memo(CropModel);
