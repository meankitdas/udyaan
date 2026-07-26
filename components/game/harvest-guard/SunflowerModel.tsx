"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { CropMood } from "./Crop";
import { ModelAsset } from "./ModelAsset";

function SunflowerModel({ mood, drop }: { mood: CropMood; drop: number }) {
  const root = useRef<Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state, delta) => {
    const group = root.current;
    if (!group) return;

    const time = state.clock.elapsedTime + phase;
    const alert = mood === "alert";
    const happy = mood === "happy";
    const hurt = mood === "hurt";
    const ease = Math.min(1, delta * 8);
    const sway = hurt ? -0.42 : Math.sin(time * (alert ? 7 : 1.7)) * (alert ? 0.055 : 0.025);
    const targetScaleY = hurt ? 0.82 : happy ? 1.04 : 1;

    group.position.y = drop + (happy ? Math.abs(Math.sin(time * 5.2)) * 0.09 : 0);
    group.rotation.z += (sway - group.rotation.z) * ease;
    group.scale.y += (targetScaleY - group.scale.y) * ease;
  });

  return (
    <group ref={root} position={[0, drop, 0]}>
      <ModelAsset
        url="/models/sunflower-game.glb"
        targetSize={2.15}
        anchor="base"
      />
    </group>
  );
}

export default memo(SunflowerModel);
