"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { BED_SIZE, HOME, randomUnit, type Level, type Mission, type Obstacle } from "./simulation";
import { Beam, Box } from "./DroneModel";
import { FieldGrass, TreeGrove } from "./Vegetation";
import { IrrigationWater, RotorWash, SprayImpacts } from "./WaterEffects";
import { terrainHeight } from "./terrain";

export function FarmLight({ level }: { level: Level }) {
  const { gl, scene } = useThree();
  const sky = useLoader(RGBELoader, "/drone-irrigation/daylight.hdr");
  const overcast = level.light === "overcast";
  const late = level.light === "late";

  useLayoutEffect(() => {
    sky.mapping = THREE.EquirectangularReflectionMapping;
    const generator = new THREE.PMREMGenerator(gl);
    const environment = generator.fromEquirectangular(sky);
    scene.background = sky;
    scene.backgroundIntensity = overcast ? 0.65 : 0.85;
    scene.backgroundRotation.set(0, 0.8, 0);
    scene.environment = environment.texture;
    scene.environmentRotation.set(0, 0.8, 0);
    scene.environmentIntensity = overcast ? 0.5 : 0.7;
    generator.dispose();
    return () => { scene.background = null; scene.environment = null; environment.dispose(); };
  }, [gl, scene, sky, overcast, late]);

  return (
    <>
      <fog attach="fog" args={[overcast ? "#afbfbe" : "#d2dfdc", 95, 260]} />
      <hemisphereLight args={[overcast ? "#c4d5dc" : "#e6f3ff", "#716b49", overcast ? 0.65 : 0.45]} />
      <directionalLight position={[-25, late ? 20 : 38, 15]} color={late ? "#ffe0b1" : "#fff5df"}
        intensity={overcast ? 1.1 : 2.35} castShadow shadow-mapSize={[2048, 2048]} shadow-radius={2}
        shadow-camera-left={-29} shadow-camera-right={29} shadow-camera-top={29} shadow-camera-bottom={-29}
        shadow-camera-near={1} shadow-camera-far={120} shadow-normalBias={0.025} shadow-bias={-0.00006} />
    </>
  );
}

function leafGeometry() {
  const positions: number[] = [];
  const coordinates: number[] = [];
  const indices: number[] = [];
  for (let segment = 0; segment <= 7; segment++) {
    const progress = segment / 7;
    const width = Math.sin(progress * Math.PI) * 0.055 + 0.003;
    const height = progress * 0.5 - progress ** 3 * 0.12;
    const depth = progress * progress * 0.37;
    positions.push(-width, height, depth, 0, height + Math.sin(progress * Math.PI) * 0.015, depth - 0.008, width, height, depth);
    coordinates.push(0, progress, 0.5, progress, 1, progress);
    if (segment < 7) {
      const start = segment * 3;
      indices.push(start, start + 1, start + 3, start + 1, start + 4, start + 3, start + 1, start + 2, start + 4, start + 2, start + 5, start + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function leafSurface() {
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, "#c0c8b0"); gradient.addColorStop(0.45, "#f1f0e3"); gradient.addColorStop(0.53, "#e2e8d7"); gradient.addColorStop(1, "#aebca1");
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 256);
  context.strokeStyle = "#c9d5ba"; context.lineWidth = 1;
  for (let index = 0; index < 18; index++) {
    context.beginPath(); context.moveTo(64, index * 15 + 20); context.quadraticCurveTo(35, index * 15 + 1, 0, index * 15 - 5); context.stroke();
    context.beginPath(); context.moveTo(64, index * 15 + 20); context.quadraticCurveTo(95, index * 15 + 1, 128, index * 15 - 5); context.stroke();
  }
  context.strokeStyle = "#f1ead4"; context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(64, 0); context.lineTo(64, 256); context.stroke();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function CropBeds({ mission, soil, normal }: { mission: RefObject<Mission>; soil: THREE.Texture; normal: THREE.Texture }) {
  const leaves = useRef<THREE.InstancedMesh>(null);
  const earth = useRef<THREE.InstancedMesh>(null);
  const [resources] = useState(() => {
    const windTime = { value: 0 };
    const windStrength = { value: 1 };
    const aircraft = { value: new THREE.Vector3(0, 100, 0) };
    const material = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: leafSurface(), roughness: 0.74, clearcoat: 0.18, clearcoatRoughness: 0.4, side: THREE.DoubleSide });
    const deform: THREE.MeshStandardMaterial["onBeforeCompile"] = (shader) => {
      shader.uniforms.windTime = windTime;
      shader.uniforms.windStrength = windStrength;
      shader.uniforms.aircraftPosition = aircraft;
      shader.vertexShader = "uniform float windTime;\nuniform float windStrength;\nuniform vec3 aircraftPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed.x += sin(windTime * 1.65 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4) * position.y * position.y * 0.16 * windStrength;
        vec2 rotorOffset = instanceMatrix[3].xz - aircraftPosition.xz;
        float wash = exp(-dot(rotorOffset, rotorOffset) * 0.17) * max(0.0, 1.0 - aircraftPosition.y / 6.0);
        transformed.xz += normalize(rotorOffset + vec2(0.001)) * wash * position.y * 0.55;`);
    };
    material.onBeforeCompile = deform;
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    depth.onBeforeCompile = deform;
    const wetSoil: THREE.MeshPhysicalMaterial["onBeforeCompile"] = (shader) => {
      shader.vertexShader = "attribute float moisture;\nvarying float bedWetness;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nbedWetness = moisture;");
      shader.fragmentShader = "varying float bedWetness;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, bedWetness);");
      shader.fragmentShader = shader.fragmentShader.replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\nmaterial.clearcoat *= bedWetness;");
    };
    return { geometry: leafGeometry(), material, depth, wetSoil, wetness: new Float32Array(mission.current.beds.length), aircraft, windTime, windStrength, dummy: new THREE.Object3D(), color: new THREE.Color(), update: 0 };
  });

  useLayoutEffect(() => {
    if (!leaves.current || !earth.current) return;
    mission.current.beds.forEach((bed, bedIndex) => {
      resources.dummy.position.set(bed.x, 0.015, bed.z);
      resources.dummy.rotation.set(0, 0, 0);
      resources.dummy.scale.set(1, 1, 1);
      resources.dummy.updateMatrix();
      earth.current!.setMatrixAt(bedIndex, resources.dummy.matrix);
      earth.current!.setColorAt(bedIndex, resources.color.set("#c1b293"));
      for (let plant = 0; plant < 16; plant++) {
        const seed = bedIndex * 16 + plant;
        const horizontal = bed.x + ((plant % 4) - 1.5) * 0.54;
        const depth = bed.z + (Math.floor(plant / 4) - 1.5) * 0.55;
        for (let leaf = 0; leaf < 5; leaf++) {
          resources.dummy.position.set(horizontal + randomUnit(seed) * 0.06, 0.11 + leaf * 0.035, depth);
          resources.dummy.rotation.set(0.25 + leaf * 0.18, leaf * 2.4 + seed, 0);
          const size = 0.85 + randomUnit(seed + 200) * 0.4;
          resources.dummy.scale.set(size, size, size);
          resources.dummy.updateMatrix();
          const instance = seed * 5 + leaf;
          leaves.current!.setMatrixAt(instance, resources.dummy.matrix);
          leaves.current!.setColorAt(instance, resources.color.setHSL(0.19 + randomUnit(seed) * 0.035, 0.36, 0.28 + randomUnit(leaf + seed) * 0.11, THREE.SRGBColorSpace));
        }
      }
    });
    leaves.current.instanceMatrix.needsUpdate = true;
    earth.current.instanceMatrix.needsUpdate = true;
    if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true;
    if (earth.current.instanceColor) earth.current.instanceColor.needsUpdate = true;
  }, [mission, resources]);

  useFrame((_, delta) => {
    const current = mission.current;
    if (current.phase !== "paused" && current.phase !== "won" && current.phase !== "lost") resources.windTime.value += Math.min(delta, 0.05);
    resources.windStrength.value = 0.6 + Math.hypot(current.wind.x, current.wind.z) * 0.12;
    resources.aircraft.value.set(current.pose.position.x, current.phase === "flying" ? current.pose.position.y : 100, current.pose.position.z);
    resources.update += delta;
    if (resources.update < 0.16 || !leaves.current || !earth.current) return;
    resources.update = 0;
    current.beds.forEach((bed, bedIndex) => {
      earth.current!.setColorAt(bedIndex, resources.color.set("#c1b293").lerp(new THREE.Color("#665e49"), bed.moisture));
      resources.wetness[bedIndex] = bed.moisture;
      for (let plant = 0; plant < 16; plant++) {
        const seed = bedIndex * 16 + plant;
        for (let leaf = 0; leaf < 5; leaf++) {
          resources.color.setHSL(0.19 + randomUnit(seed) * 0.035 + bed.moisture * 0.07, 0.36 + bed.moisture * 0.1, 0.28 + randomUnit(leaf + seed) * 0.11 - bed.moisture * 0.035, THREE.SRGBColorSpace);
          leaves.current!.setColorAt(seed * 5 + leaf, resources.color);
        }
      }
    });
    if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true;
    if (earth.current.instanceColor) earth.current.instanceColor.needsUpdate = true;
    earth.current.geometry.attributes.moisture.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={earth} args={[undefined, undefined, mission.current.beds.length]} receiveShadow>
        <boxGeometry args={[BED_SIZE - 0.05, 0.12, BED_SIZE - 0.05]}><instancedBufferAttribute attach="attributes-moisture" args={[resources.wetness, 1]} /></boxGeometry>
        <meshPhysicalMaterial map={soil} normalMap={normal} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={0.98} clearcoat={0.08} clearcoatRoughness={0.5} envMapIntensity={0.55} onBeforeCompile={resources.wetSoil} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[resources.geometry, resources.material, mission.current.beds.length * 80]} customDepthMaterial={resources.depth} castShadow receiveShadow frustumCulled={false} />
    </>
  );
}

function Tank({ position, radius = 0.9, height = 3 }: { position: [number, number, number]; radius?: number; height?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 48]} /><meshPhysicalMaterial color="#cad2ce" roughness={0.25} metalness={0.83} clearcoat={0.25} envMapIntensity={1.2} />
      </mesh>
      {[0.12, 0.35, 0.58, 0.81, 0.98].map((fraction) => (
        <mesh key={fraction} position={[0, fraction * height, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius + 0.007, 0.025, 6, 32]} /><meshStandardMaterial color="#778980" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.23, 0.23, 0.12, 16]} /><meshStandardMaterial color="#778c84" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Hazard({ obstacle }: { obstacle: Obstacle }) {
  const base = obstacle.base ?? 0;
  return (
    <RigidBody type="fixed" colliders={false} name="obstacle">
      <CuboidCollider position={[obstacle.x, base + obstacle.height / 2, obstacle.z]} args={[obstacle.width / 2, obstacle.height / 2, obstacle.depth / 2]} />
      {obstacle.kind === "tank" && <Tank position={[obstacle.x, 0, obstacle.z]} radius={obstacle.width / 2} height={obstacle.height} />}
      {obstacle.kind === "gantry" && (
        <group position={[obstacle.x, 0, obstacle.z]}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <CuboidCollider position={[side * obstacle.width / 2, base / 2, 0]} args={[0.13, base / 2, 0.13]} />
              <Beam start={[side * obstacle.width / 2, 0, 0]} end={[side * obstacle.width / 2, base + obstacle.height, 0]} radius={0.1} />
            </group>
          ))}
          <Beam start={[-obstacle.width / 2, base + 0.1, 0]} end={[obstacle.width / 2, base + 0.1, 0]} radius={0.085} />
          <Beam start={[-obstacle.width / 2, base + obstacle.height, 0]} end={[obstacle.width / 2, base + obstacle.height, 0]} radius={0.055} />
          {Array.from({ length: 10 }, (_, index) => (
            <Beam key={index} start={[-obstacle.width / 2 + index * obstacle.width / 10, base + 0.1, 0]}
              end={[-obstacle.width / 2 + (index + 1) * obstacle.width / 10, base + obstacle.height, 0]} radius={0.022} />
          ))}
        </group>
      )}
    </RigidBody>
  );
}

function ServicePad({ mission }: { mission: RefObject<Mission> }) {
  const windsock = useRef<THREE.Group>(null);
  useFrame(() => { if (windsock.current) windsock.current.rotation.y = -Math.atan2(mission.current.wind.z, mission.current.wind.x); });
  return (
    <group position={[HOME.x, 0, HOME.z]}>
      <Box position={[0, 0.045, 0]} size={[6.2, 0.09, 6.2]} color="#8a9790" />
      <Box position={[0, 0.095, 0]} size={[5.5, 0.01, 5.5]} color="#445d57" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box position={[side * 2.6, 0.11, 0]} size={[0.08, 0.01, 5.3]} color="#d1e8b5" />
          <Box position={[0, 0.11, side * 2.6]} size={[5.3, 0.01, 0.08]} color="#d1e8b5" />
          <Box position={[side * 0.6, 0.12, 0]} size={[0.22, 0.01, 1.8]} color="#eef2d6" />
        </group>
      ))}
      <Box position={[0, 0.12, 0]} size={[1.2, 0.01, 0.22]} color="#eef2d6" />
      <RigidBody type="fixed" colliders={false} name="obstacle">
        <CuboidCollider position={[4.5, 1.1, 0]} args={[0.75, 1.1, 0.75]} />
        <Tank position={[4.5, 0, 0]} radius={0.75} height={2.2} />
        <Box position={[3.8, 0.35, 1.2]} size={[0.8, 0.7, 0.7]} color="#597f70" metalness={0.4} />
      </RigidBody>
      <Beam start={[3.8, 0.25, 1.2]} end={[2.9, 0.1, 1.2]} radius={0.04} color="#2b3c38" />
      <Beam start={[-4, 0, -2]} end={[-4, 4.4, -2]} radius={0.04} />
      <group ref={windsock} position={[-4, 4.3, -2]}>
        {[0, 1, 2, 3, 4].map((segment) => (
          <mesh key={segment} position={[segment * 0.24 + 0.12, -segment * 0.023, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.21 - segment * 0.027, 0.235 - segment * 0.027, 0.24, 12, 1, true]} />
            <meshStandardMaterial color={segment % 2 ? "#e8e8d5" : "#c7754d"} side={THREE.DoubleSide} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Barn() {
  return (
    <RigidBody type="fixed" colliders={false} name="obstacle" position={[-20, 0, -13]}>
      <CuboidCollider position={[0, 2.9, 0]} args={[3.7, 2.9, 4.5]} />
      <Box position={[0, 2.1, 0]} size={[7.4, 4.2, 9]} color="#b3b7a4" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box position={[side * 1.95, 4.86, 0]} size={[4.24, 0.12, 9.7]} rotation={[0, 0, side * -0.34]} color="#607975" metalness={0.65} roughness={0.6} />
          <Box position={[side * 1.1, 1.5, 4.52]} size={[2.12, 2.95, 0.12]} color="#7a6550" />
          <Box position={[side * 3.5, 2.1, 4.57]} size={[0.13, 4.2, 0.1]} color="#d7d8c7" />
        </group>
      ))}
      {Array.from({ length: 20 }, (_, index) => <Box key={index} position={[-3.55 + index * 0.375, 2.1, 4.53]} size={[0.03, 4.2, 0.02]} color="#7b8c7b" />)}
      <Box position={[0, 3.25, 4.59]} size={[4.5, 0.13, 0.08]} color="#d7d8c7" />
    </RigidBody>
  );
}

function Fence() {
  const posts = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!posts.current) return;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 64; index++) {
      const edge = Math.floor(index / 16);
      const along = -23 + (index % 16) * (46 / 15);
      dummy.position.set(edge < 2 ? along : edge === 2 ? -23 : 23, 0.7, edge < 2 ? edge === 0 ? -23 : 23 : along);
      dummy.updateMatrix(); posts.current.setMatrixAt(index, dummy.matrix);
    }
    posts.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <RigidBody type="fixed" colliders={false} name="obstacle">
      <instancedMesh ref={posts} args={[undefined, undefined, 64]} castShadow>
        <boxGeometry args={[0.12, 1.4, 0.12]} /><meshStandardMaterial color="#827660" roughness={1} />
      </instancedMesh>
      {[-23, 23].map((edge) => (
        <group key={edge}>
          <CuboidCollider position={[0, 0.65, edge]} args={[23, 0.65, 0.06]} />
          <CuboidCollider position={[edge, 0.65, 0]} args={[0.06, 0.65, 23]} />
          {[0.55, 1.15].map((height) => (
            <group key={height}>
              <Beam start={[-23, height, edge]} end={[23, height, edge]} radius={0.012} color="#7f8980" />
              <Beam start={[edge, height, -23]} end={[edge, height, 23]} radius={0.012} color="#7f8980" />
            </group>
          ))}
        </group>
      ))}
    </RigidBody>
  );
}

function FarmPaths({ soil, normal }: { soil: THREE.Texture; normal: THREE.Texture }) {
  const [textures] = useState(() => {
    const across = soil.clone(); const acrossNormal = normal.clone();
    const along = soil.clone(); const alongNormal = normal.clone();
    for (const texture of [across, acrossNormal, along, alongNormal]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
    }
    across.colorSpace = along.colorSpace = THREE.SRGBColorSpace;
    across.repeat.set(23, 2.75); acrossNormal.repeat.copy(across.repeat);
    along.repeat.set(1.8, 22); alongNormal.repeat.copy(along.repeat);
    return { across, acrossNormal, along, alongNormal };
  });
  return <group>
    <mesh position={[0, 0.012, 15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[46, 5.5]} /><meshStandardMaterial map={textures.across} normalMap={textures.acrossNormal} normalScale={new THREE.Vector2(0.35, 0.35)} color="#b1ac97" roughness={0.94} />
    </mesh>
    <mesh position={[-16.3, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[3.6, 44]} /><meshStandardMaterial map={textures.along} normalMap={textures.alongNormal} normalScale={new THREE.Vector2(0.35, 0.35)} color="#b1ac97" roughness={0.94} />
    </mesh>
  </group>;
}

function Ground({ grass, normal, roughness }: { grass: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture }) {
  const [geometry] = useState(() => {
    const terrain = new THREE.PlaneGeometry(500, 500, 128, 128);
    terrain.rotateX(-Math.PI / 2);
    const positions = terrain.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index); const z = positions.getZ(index);
      positions.setY(index, terrainHeight(x, z));
      const variation = 0.91 + (Math.sin(x * 0.07 + z * 0.05) * 0.5 + Math.sin(x * 0.21 - z * 0.11) * 0.5) * 0.09;
      color.setRGB(variation * 0.91, variation, variation * 0.83);
      color.toArray(colors, index * 3);
    }
    terrain.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    terrain.computeVertexNormals();
    return terrain;
  });
  return <mesh geometry={geometry} receiveShadow>
    <meshStandardMaterial map={grass} normalMap={normal} normalScale={new THREE.Vector2(0.48, 0.48)} roughnessMap={roughness} color="#b2c6a4" roughness={0.94} vertexColors />
  </mesh>;
}

export default function FarmWorld({ level, mission }: { level: Level; mission: RefObject<Mission> }) {
  const [soil, normal, grass, grassNormal, grassRoughness] = useLoader(THREE.TextureLoader, ["/drone-irrigation/soil.jpg", "/drone-irrigation/soil-normal.jpg", "/drone-irrigation/grass.jpg", "/drone-irrigation/grass-normal.jpg", "/drone-irrigation/grass-roughness.jpg"]);
  useEffect(() => {
    [soil, normal, grass, grassNormal, grassRoughness].forEach((texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    });
    soil.colorSpace = grass.colorSpace = THREE.SRGBColorSpace;
    [grass, grassNormal, grassRoughness].forEach((texture) => texture.repeat.set(70, 70));
  }, [soil, normal, grass, grassNormal, grassRoughness]);
  return (
    <>
      <RigidBody type="fixed" colliders={false} name="ground">
        <CuboidCollider position={[0, -1, 0]} args={[250, 1, 250]} friction={0.8} />
        <Ground grass={grass} normal={grassNormal} roughness={grassRoughness} />
      </RigidBody>
      <FarmPaths soil={soil} normal={normal} />
      <CropBeds mission={mission} soil={soil} normal={normal} />
      {level.fields.map((field, index) => (
        <group key={index}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Beam start={[field.x - field.columns * BED_SIZE / 2, 0.07, field.z + side * field.rows * BED_SIZE / 2]}
                end={[field.x + field.columns * BED_SIZE / 2, 0.07, field.z + side * field.rows * BED_SIZE / 2]} radius={0.025} color="#d0b36e" />
              <Box position={[field.x + side * field.columns * BED_SIZE / 2, 0.45, field.z + field.rows * BED_SIZE / 2]} size={[0.04, 0.9, 0.04]} color="#cbb484" />
            </group>
          ))}
        </group>
      ))}
      {level.obstacles.map((obstacle, index) => <Hazard key={index} obstacle={obstacle} />)}
      <ServicePad mission={mission} />
      <Barn />
      <Fence />
      <TreeGrove level={level} mission={mission} />
      <FieldGrass level={level} mission={mission} />
      <IrrigationWater mission={mission} />
      <SprayImpacts mission={mission} />
      <RotorWash mission={mission} />
    </>
  );
}