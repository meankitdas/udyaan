"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { BED_SIZE, randomUnit, type Level, type Mission } from "./simulation";

type TreePlacement = { x: number; z: number; height: number; width: number; angle: number };

export function TreeGrove({ level, mission }: { level: Level; mission: RefObject<Mission> }) {
  const model = useLoader(GLTFLoader, "/drone-irrigation/tree.glb");
  const meshes = useRef<THREE.InstancedMesh[]>([]);
  const [resources] = useState(() => {
    model.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model.scene);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const time = { value: 0 };
    const wind = { value: 0.5 };
    const parts: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial }[] = [];
    model.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      geometry.translate(-center.x, -bounds.min.y, -center.z);
      geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
      const material = (object.material as THREE.MeshStandardMaterial).clone();
      const isLeaf = material.name.includes("leaves");
      material.transparent = false;
      material.alphaTest = isLeaf ? 0.35 : 0;
      material.roughness = isLeaf ? 0.78 : 0.95;
      material.metalness = 0;
      material.side = THREE.DoubleSide;
      for (const texture of [material.map, material.normalMap, material.roughnessMap, material.aoMap]) {
        if (texture) texture.anisotropy = 4;
      }
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map, alphaTest: material.alphaTest, side: THREE.DoubleSide });
      if (isLeaf) {
        const deform: THREE.MeshStandardMaterial["onBeforeCompile"] = (shader) => {
          shader.uniforms.groveTime = time;
          shader.uniforms.groveWind = wind;
          shader.vertexShader = "uniform float groveTime;\nuniform float groveWind;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
            float gustPhase = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.4;
            transformed.x += sin(groveTime * 1.2 + gustPhase + position.y * 3.0) * position.y * position.y * 0.009 * groveWind;
            transformed.z += sin(groveTime * 2.7 + gustPhase + position.x * 8.0) * position.y * 0.003 * groveWind;`);
        };
        material.onBeforeCompile = deform;
        depth.onBeforeCompile = deform;
      }
      parts.push({ geometry, material, depth });
    });
    const trees: TreePlacement[] = Array.from({ length: 24 }, (_, index) => {
      const angle = index * Math.PI * 2 / 24;
      const distance = 34 + randomUnit(index + 400) * 23;
      const height = 7 + randomUnit(index + 700) * 7;
      return { x: Math.sin(angle) * distance, z: Math.cos(angle) * distance, height, width: height * (0.83 + randomUnit(index) * 0.3), angle: randomUnit(index + 300) * Math.PI * 2 };
    });
    for (const obstacle of level.obstacles) {
      if (obstacle.kind === "tree") trees.push({ x: obstacle.x, z: obstacle.z, height: obstacle.height, width: obstacle.width, angle: obstacle.x * 0.3 });
    }
    return { parts, trees, time, wind };
  });

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    meshes.current.forEach((mesh) => {
      resources.trees.forEach((tree, index) => {
        dummy.position.set(tree.x, 0, tree.z);
        dummy.rotation.set(0, tree.angle, 0);
        dummy.scale.set(tree.width, tree.height, tree.width);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, color.setRGB(0.86 + randomUnit(index) * 0.14, 0.92 + randomUnit(index + 12) * 0.08, 0.82 + randomUnit(index + 54) * 0.12));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [resources]);

  useFrame((_, delta) => {
    const current = mission.current;
    if (current.phase === "ready" || current.phase === "flying") resources.time.value += Math.min(delta, 0.05);
    resources.wind.value = 0.5 + Math.hypot(current.wind.x, current.wind.z) * 0.22;
  });

  return <group name="photographic-tree-grove">
    {resources.parts.map((part, index) => <instancedMesh key={index} ref={(mesh) => { if (mesh) meshes.current[index] = mesh; }}
      args={[part.geometry, part.material, resources.trees.length]} customDepthMaterial={part.depth} castShadow receiveShadow />)}
  </group>;
}

export function FieldGrass({ level, mission }: { level: Level; mission: RefObject<Mission> }) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const [resources] = useState(() => {
    const positions: { x: number; z: number; seed: number }[] = [];
    for (let index = 0; index < 28000; index++) {
      const x = (randomUnit(index + 20000) - 0.5) * 64;
      const z = (randomUnit(index + 80000) - 0.5) * 64;
      if (Math.abs(z - 15) < 3.3 || Math.abs(x + 16.3) < 2.1 || Math.abs(x - 16) < 1.65) continue;
      if (Math.abs(x + 20) < 4.3 && Math.abs(z + 13) < 5.1) continue;
      if (level.fields.some((field) => Math.abs(x - field.x) < field.columns * BED_SIZE / 2 + 0.4 && Math.abs(z - field.z) < field.rows * BED_SIZE / 2 + 0.4)) continue;
      positions.push({ x, z, seed: index });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.008, 0, 0, 0.008, 0, 0, -0.006, 0.1, 0.012, 0.006, 0.1, 0.012, 0, 0.19, 0.035], 3));
    geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    geometry.computeVertexNormals();
    const time = { value: 0 };
    const wind = { value: 1 };
    const aircraft = { value: new THREE.Vector3(0, 100, 0) };
    const material = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
    const deform: THREE.MeshStandardMaterial["onBeforeCompile"] = (shader) => {
      shader.uniforms.grassTime = time;
      shader.uniforms.grassWind = wind;
      shader.uniforms.aircraftPosition = aircraft;
      shader.vertexShader = "uniform float grassTime;\nuniform float grassWind;\nuniform vec3 aircraftPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vec2 bladePosition = instanceMatrix[3].xz;
        vec2 rotorOffset = bladePosition - aircraftPosition.xz;
        float wash = exp(-dot(rotorOffset, rotorOffset) * 0.2) * max(0.0, 1.0 - aircraftPosition.y / 6.0);
        transformed.x += sin(grassTime * 1.8 + bladePosition.x * 0.55 + bladePosition.y) * position.y * position.y * grassWind;
        transformed.xz += normalize(rotorOffset + vec2(0.001)) * wash * position.y * 0.9;`);
    };
    material.onBeforeCompile = deform;
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    depth.onBeforeCompile = deform;
    return { positions, geometry, material, depth, time, wind, aircraft };
  });
  useLayoutEffect(() => {
    if (!grass.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    resources.positions.forEach((blade, index) => {
      dummy.position.set(blade.x, 0.01, blade.z);
      dummy.rotation.set(0, randomUnit(blade.seed + 2) * Math.PI * 2, 0);
      const size = 0.45 + randomUnit(blade.seed + 14) * 0.65;
      dummy.scale.set(size, size, size);
      dummy.updateMatrix();
      grass.current!.setMatrixAt(index, dummy.matrix);
      grass.current!.setColorAt(index, color.setHSL(0.21 + randomUnit(blade.seed) * 0.08, 0.26 + randomUnit(blade.seed + 51) * 0.15, 0.27 + randomUnit(blade.seed + 21) * 0.1, THREE.SRGBColorSpace));
    });
    grass.current.instanceMatrix.needsUpdate = true;
    if (grass.current.instanceColor) grass.current.instanceColor.needsUpdate = true;
    grass.current.computeBoundingSphere();
  }, [resources]);
  useFrame((_, delta) => {
    const current = mission.current;
    if (current.phase === "ready" || current.phase === "flying") resources.time.value += Math.min(delta, 0.05);
    resources.wind.value = 0.5 + Math.hypot(current.wind.x, current.wind.z) * 0.1;
    resources.aircraft.value.set(current.pose.position.x, current.phase === "flying" ? current.pose.position.y : 100, current.pose.position.z);
  });
  return <instancedMesh ref={grass} args={[resources.geometry, resources.material, resources.positions.length]} customDepthMaterial={resources.depth} castShadow receiveShadow />;
}