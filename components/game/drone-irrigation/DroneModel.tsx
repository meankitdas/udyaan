"use client";

import { useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MAX_DROPS, type Mission } from "./simulation";

export function Beam({ start, end, radius = 0.035, color = "#84948c" }: {
  start: [number, number, number]; end: [number, number, number]; radius?: number; color?: string;
}) {
  const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
  return (
    <mesh position={new THREE.Vector3(...start).add(new THREE.Vector3(...end)).multiplyScalar(0.5)}
      quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())} castShadow>
      <cylinderGeometry args={[radius, radius, direction.length(), 8]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.65} />
    </mesh>
  );
}

export function Box({ position, size, color, metalness = 0, roughness = 0.85, rotation }: {
  position: [number, number, number]; size: [number, number, number]; color: string;
  metalness?: number; roughness?: number; rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} scale={size} rotation={rotation} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

export function DroneModel({ mission }: { mission: RefObject<Mission> }) {
  const rotors = useRef<THREE.Group>(null);
  const liquid = useRef<THREE.Mesh>(null);
  const [shell] = useState(() => new RoundedBoxGeometry(1.02, 0.26, 1.18, 3, 0.12));
  const [tank] = useState(() => new RoundedBoxGeometry(0.86, 0.52, 0.86, 3, 0.13));
  const [carbon] = useState(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#242b2b"; context.fillRect(0, 0, 64, 64);
    for (let row = 0; row < 16; row++) {
      for (let column = 0; column < 16; column++) {
        context.fillStyle = (row + column) % 2 ? "#414746" : "#1d2222";
        context.fillRect(column * 4, row * 4, 3, 3);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });

  useFrame((_, delta) => {
    const current = mission.current;
    if (current.phase === "paused" || current.phase === "won" || current.phase === "lost") return;
    const rate = current.phase === "flying" ? 85 + current.thrust * 0.1 : 0;
    rotors.current?.children.forEach((rotor, index) => { rotor.rotation.y += Math.min(delta, 0.05) * rate * (index % 2 ? 1 : -1); });
    if (liquid.current) {
      liquid.current.scale.y = Math.max(0.01, current.water / 22) * 0.38;
      liquid.current.position.y = -0.44 + liquid.current.scale.y / 2;
    }
  });

  return (
    <group>
      <mesh geometry={shell} position={[0, 0.18, 0]} castShadow>
        <meshPhysicalMaterial color="#f2f2e9" roughness={0.28} metalness={0.16} clearcoat={0.7} />
      </mesh>
      <mesh position={[0, 0.035, 0]} scale={[0.98, 0.13, 1.16]} castShadow>
        <boxGeometry /><meshStandardMaterial map={carbon} metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh geometry={tank} position={[0, -0.23, 0.06]} castShadow>
        <meshPhysicalMaterial color="#e0e8d7" roughness={0.26} metalness={0.05} transparent opacity={0.86} />
      </mesh>
      <mesh ref={liquid} position={[0, -0.3, 0.06]} scale={[0.79, 0.4, 0.8]}>
        <boxGeometry /><meshStandardMaterial color="#a0c9bd" roughness={0.2} />
      </mesh>
      <Box position={[0, 0.34, 0.08]} size={[0.55, 0.09, 0.61]} color="#293936" metalness={0.4} roughness={0.3} />
      <Box position={[0, 0.397, 0.08]} size={[0.24, 0.035, 0.3]} color="#d2994f" metalness={0.2} roughness={0.3} />
      {[-1, 1].flatMap((horizontal) => [-1, 1].map((depth) => (
        <group key={`${horizontal}-${depth}`}>
          <Beam start={[horizontal * 0.32, 0.06, depth * 0.3]} end={[horizontal * 1.23, 0.16, depth * 1.02]} radius={0.072} color="#252d2b" />
          <Beam start={[horizontal * 0.32, -0.06, depth * 0.3]} end={[horizontal * 1.13, 0.13, depth * 0.92]} radius={0.026} color="#78837b" />
          <mesh position={[horizontal * 1.23, 0.19, depth * 1.02]} castShadow>
            <cylinderGeometry args={[0.115, 0.13, 0.21, 20]} />
            <meshStandardMaterial color="#3d4946" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[horizontal * 1.23, 0.32, depth * 1.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.68, 40]} />
            <meshStandardMaterial color="#495e57" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[horizontal * 1.3, 0.13, depth * 1.05]}>
            <sphereGeometry args={[0.036, 8, 8]} />
            <meshStandardMaterial color={depth < 0 ? "#cb5a41" : "#b4e69c"} emissive={depth < 0 ? "#db5333" : "#9dd572"} emissiveIntensity={2} />
          </mesh>
        </group>
      )))}
      <group ref={rotors}>
        {[-1, 1].flatMap((horizontal) => [-1, 1].map((depth) => (
          <group key={`${horizontal}-${depth}`} position={[horizontal * 1.23, 0.33, depth * 1.02]}>
            <mesh scale={[0.69, 0.015, 0.06]} castShadow>
              <sphereGeometry args={[1, 12, 6]} /><meshStandardMaterial color="#273b33" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        )))}
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Beam start={[side * 0.36, -0.05, -0.36]} end={[side * 0.62, -0.58, -0.46]} radius={0.028} color="#293a32" />
          <Beam start={[side * 0.36, -0.05, 0.36]} end={[side * 0.62, -0.58, 0.46]} radius={0.028} color="#293a32" />
          <Beam start={[side * 0.62, -0.58, -0.7]} end={[side * 0.62, -0.58, 0.7]} radius={0.035} color="#26332e" />
          <Beam start={[0, -0.36, 0]} end={[side * 1.04, -0.36, 0]} radius={0.028} color="#737f7c" />
          <mesh position={[side * 0.95, -0.4, 0]}>
            <cylinderGeometry args={[0.042, 0.025, 0.1, 10]} /><meshStandardMaterial color="#d29449" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <Box position={[0, -0.02, -0.62]} size={[0.23, 0.17, 0.17]} color="#293d39" metalness={0.5} roughness={0.3} />
      <mesh position={[0, -0.02, -0.715]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.02, 16]} /><meshPhysicalMaterial color="#152829" metalness={0.8} roughness={0.07} clearcoat={1} />
      </mesh>
      <Beam start={[0.25, 0.3, 0.25]} end={[0.25, 0.59, 0.25]} radius={0.011} color="#333f39" />
      <mesh position={[0.25, 0.6, 0.25]}>
        <cylinderGeometry args={[0.045, 0.045, 0.025, 12]} /><meshStandardMaterial color="#e4e9de" />
      </mesh>
    </group>
  );
}

export function WaterParticles({ mission }: { mission: RefObject<Mission> }) {
  const points = useRef<THREE.Points>(null);
  const [positions] = useState(() => new Float32Array(MAX_DROPS * 3));
  const [droplet] = useState(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 15);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.3, "rgba(225,245,255,0.7)");
    gradient.addColorStop(1, "rgba(200,235,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  });
  useFrame(() => {
    if (!points.current) return;
    const drops = mission.current.drops;
    drops.forEach((drop, index) => { positions[index * 3] = drop.x; positions[index * 3 + 1] = drop.y; positions[index * 3 + 2] = drop.z; });
    points.current.geometry.setDrawRange(0, drops.length);
    points.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial map={droplet} color="#d1f5ff" size={0.045} transparent opacity={0.65} alphaTest={0.015} depthWrite={false} sizeAttenuation />
    </points>
  );
}