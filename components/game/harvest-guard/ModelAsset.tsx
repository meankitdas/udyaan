"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Box3, Mesh, Vector3, type Material, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type ModelAssetProps = {
  url: string;
  targetSize: number;
  anchor?: "center" | "base";
  meshIndex?: number;
  faded?: boolean;
  rotation?: [number, number, number];
};

const modelCache = new Map<string, Promise<Object3D>>();

function loadModel(url: string) {
  let request = modelCache.get(url);
  if (!request) {
    request = new Promise<Object3D>((resolve, reject) => {
      new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    modelCache.set(url, request);
  }
  return request;
}

function cloneMaterial(material: Material, faded: boolean) {
  const clone = material.clone();
  if (faded) {
    clone.transparent = true;
    clone.opacity = 0.58;
    clone.depthWrite = false;
  }
  return clone;
}

export const ModelAsset = memo(function ModelAsset({
  url,
  targetSize,
  anchor = "center",
  meshIndex,
  faded = false,
  rotation = [0, 0, 0],
}: ModelAssetProps) {
  const [source, setSource] = useState<Object3D | null>(null);

  useEffect(() => {
    let active = true;
    loadModel(url)
      .then((object) => {
        if (active) setSource(object);
      })
      .catch((error) => {
        console.error(`Unable to load 3D model: ${url}`, error);
      });
    return () => {
      active = false;
    };
  }, [url]);

  const prepared = useMemo(() => {
    if (!source) return null;
    const object = source.clone(true);
    const meshes: Mesh[] = [];

    object.traverse((child) => {
      if (child instanceof Mesh) meshes.push(child);
    });

    if (meshIndex != null) {
      meshes.forEach((mesh, index) => {
        if (index !== meshIndex) mesh.parent?.remove(mesh);
      });
    }

    const materials: Material[] = [];
    object.traverse((child: Object3D) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => {
          const clone = cloneMaterial(material, faded);
          materials.push(clone);
          return clone;
        });
      } else {
        const clone = cloneMaterial(child.material, faded);
        materials.push(clone);
        child.material = clone;
      }
    });

    object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(object);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const sourceSize = anchor === "base" ? size.y : Math.max(size.x, size.y, size.z);
    const scale = sourceSize > 1e-5 ? targetSize / sourceSize : 1;
    const offset = new Vector3(-center.x, anchor === "base" ? -bounds.min.y : -center.y, -center.z);

    return { object, materials, offset, scale };
  }, [anchor, faded, meshIndex, source, targetSize]);

  useEffect(
    () => () => {
      prepared?.materials.forEach((material) => material.dispose());
    },
    [prepared],
  );

  if (!prepared) return null;

  return (
    <group rotation={rotation} scale={prepared.scale}>
      <primitive object={prepared.object} position={prepared.offset} dispose={null} />
    </group>
  );
});

