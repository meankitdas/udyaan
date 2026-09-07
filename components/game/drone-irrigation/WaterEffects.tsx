"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import * as THREE from "three";
import { IRRIGATION_CHANNEL, randomUnit, type Mission } from "./simulation";
import { Beam, Box } from "./DroneModel";

const waterShader = {
  name: "IrrigationWater",
  uniforms: { color: { value: new THREE.Color("#365649") }, tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() }, waterTime: { value: 0 }, windStrength: { value: 1 }, rotor: { value: new THREE.Vector3(0, 100, 0) } },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 reflectionUv;
    varying vec3 worldPosition;
    void main() {
      reflectionUv = textureMatrix * vec4(position, 1.0);
      worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float waterTime;
    uniform float windStrength;
    uniform vec3 rotor;
    varying vec4 reflectionUv;
    varying vec3 worldPosition;
    void main() {
      vec2 world = worldPosition.xz;
      float rotorDistance = length(world - rotor.xz);
      float wash = exp(-rotorDistance * 0.5) * max(0.0, 1.0 - rotor.y / 7.0);
      vec2 ripples = vec2(sin(world.x * 5.7 + world.y * 2.1 + waterTime * 1.2), cos(world.y * 6.2 - world.x * 1.8 - waterTime * 1.5));
      ripples += sin(rotorDistance * 14.0 - waterTime * 18.0) * wash * normalize(world - rotor.xz + vec2(0.001));
      vec4 distorted = reflectionUv;
      distorted.xy += ripples * 0.0017 * windStrength * reflectionUv.w;
      vec3 reflected = texture2DProj(tDiffuse, distorted).rgb;
      vec3 eye = normalize(cameraPosition - worldPosition);
      float fresnel = 0.12 + 0.76 * pow(1.0 - max(0.0, eye.y), 3.0);
      vec3 normal = normalize(vec3(ripples.x * 0.025, 1.0, ripples.y * 0.025));
      vec3 sun = normalize(vec3(-25.0, 38.0, 15.0));
      float glint = pow(max(0.0, dot(reflect(-sun, normal), eye)), 180.0) * 0.8;
      gl_FragColor = vec4(mix(color, reflected, fresnel) + vec3(glint), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function IrrigationWater({ mission }: { mission: RefObject<Mission> }) {
  const [water] = useState(() => {
    const reflector = new Reflector(new THREE.PlaneGeometry(IRRIGATION_CHANNEL.width, IRRIGATION_CHANNEL.length), {
      color: "#365649", textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0, shader: waterShader,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(IRRIGATION_CHANNEL.x, IRRIGATION_CHANNEL.surface, IRRIGATION_CHANNEL.z);
    reflector.name = "reflective-irrigation-channel";
    return reflector;
  });
  useEffect(() => () => { water.dispose(); water.geometry.dispose(); }, [water]);
  useFrame((_, delta) => {
    const current = mission.current;
    const uniforms = (water.material as THREE.ShaderMaterial).uniforms;
    if (current.phase === "flying" || current.phase === "ready") uniforms.waterTime.value += Math.min(delta, 0.05);
    uniforms.windStrength.value = 0.7 + Math.hypot(current.wind.x, current.wind.z) * 0.1;
    uniforms.rotor.value.set(current.pose.position.x, current.phase === "flying" ? current.pose.position.y : 100, current.pose.position.z);
  });
  return <group>
    <primitive object={water} />
    <RigidBody type="fixed" colliders={false} name="channel-bank">
      {[-1, 1].map((side) => <group key={side}>
        <CuboidCollider position={[IRRIGATION_CHANNEL.x + side * 1.3, 0.12, 0]} args={[0.18, 0.12, 21.2]} />
        <Box position={[IRRIGATION_CHANNEL.x + side * 1.3, 0.07, 0]} size={[0.36, 0.23, 42.4]} color="#8e9783" roughness={0.95} />
      </group>)}
      <Box position={[IRRIGATION_CHANNEL.x, 0.07, -21.15]} size={[2.3, 0.23, 0.3]} color="#8e9783" />
      <Box position={[IRRIGATION_CHANNEL.x, 0.07, 21.15]} size={[2.3, 0.23, 0.3]} color="#8e9783" />
    </RigidBody>
    <Beam start={[14.8, 0.22, 13]} end={[13.8, 0.22, 13]} radius={0.065} color="#788b7f" />
  </group>;
}

export function SprayImpacts({ mission }: { mission: RefObject<Mission> }) {
  const rings = useRef<THREE.InstancedMesh>(null);
  const droplets = useRef<THREE.InstancedMesh>(null);
  const [dummy] = useState(() => new THREE.Object3D());
  useFrame(() => {
    if (!rings.current || !droplets.current) return;
    mission.current.splashes.forEach((splash, index) => {
      const progress = splash.age / 0.55;
      const spread = (0.045 + progress * 0.15) * splash.strength;
      dummy.position.set(splash.x, splash.y, splash.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(spread, spread, Math.max(0.001, 1 - progress));
      dummy.updateMatrix();
      rings.current!.setMatrixAt(index, dummy.matrix);
      for (let particle = 0; particle < 3; particle++) {
        const angle = particle * 2.399 + splash.x;
        const radius = progress * 0.21;
        dummy.position.set(splash.x + Math.cos(angle) * radius, splash.y + Math.max(0, splash.age * 0.8 - 2.6 * splash.age * splash.age), splash.z + Math.sin(angle) * radius);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.max(0.001, 0.012 * (1 - progress)));
        dummy.updateMatrix(); droplets.current!.setMatrixAt(index * 3 + particle, dummy.matrix);
      }
    });
    rings.current.count = mission.current.splashes.length;
    droplets.current.count = mission.current.splashes.length * 3;
    rings.current.instanceMatrix.needsUpdate = true;
    droplets.current.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <instancedMesh ref={rings} args={[undefined, undefined, 96]} frustumCulled={false}>
      <ringGeometry args={[0.91, 1, 16]} /><meshBasicMaterial color="#a8c8c3" transparent opacity={0.2} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={droplets} args={[undefined, undefined, 288]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} /><meshPhysicalMaterial color="#b9d8db" roughness={0.05} metalness={0.08} clearcoat={1} transparent opacity={0.65} />
    </instancedMesh>
  </group>;
}

export function RotorWash({ mission }: { mission: RefObject<Mission> }) {
  const dust = useRef<THREE.Points>(null);
  const [resources] = useState(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,0.6)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient; context.fillRect(0, 0, 32, 32);
    return { texture: new THREE.CanvasTexture(canvas), positions: new Float32Array(160 * 3) };
  });
  useFrame(() => {
    if (!dust.current) return;
    const current = mission.current;
    const active = (current.phase === "flying" || current.phase === "paused") && current.pose.position.y < 3 && current.elapsed > 0.1;
    dust.current.visible = active;
    if (!active) return;
    for (let index = 0; index < 160; index++) {
      const age = (current.elapsed * 0.6 + randomUnit(index)) % 1;
      const angle = index * 2.399;
      const radius = 0.4 + age * 3;
      resources.positions[index * 3] = current.pose.position.x + Math.cos(angle) * radius + current.wind.x * age * 0.2;
      resources.positions[index * 3 + 1] = 0.12 + Math.sin(age * Math.PI) * 0.35;
      resources.positions[index * 3 + 2] = current.pose.position.z + Math.sin(angle) * radius + current.wind.z * age * 0.2;
    }
    dust.current.geometry.attributes.position.needsUpdate = true;
    (dust.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - current.pose.position.y / 3) * 0.13;
  });
  return <points ref={dust} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[resources.positions, 3]} /></bufferGeometry>
    <pointsMaterial map={resources.texture} color="#bdc5ae" size={0.3} transparent opacity={0.1} depthWrite={false} />
  </points>;
}