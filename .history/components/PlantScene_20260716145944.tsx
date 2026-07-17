"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function createLeafGeometry() {
  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0);
  leaf.bezierCurveTo(0.22, 0.1, 0.28, 0.5, 0, 0.78);
  leaf.bezierCurveTo(-0.28, 0.5, -0.22, 0.1, 0, 0);
  return new THREE.ExtrudeGeometry(leaf, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    curveSegments: 8,
  });
}

function createBranch(
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, radius, 7, false),
    material,
  );
}

export function PlantScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xdce4cf);
      scene.fog = new THREE.Fog(0xdce4cf, 13, 25);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(8.8, 7.1, 10.6);
    camera.lookAt(0, 1.65, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const plant = new THREE.Group();
    plant.position.y = -1.9;
    plant.rotation.y = -0.28;
    scene.add(plant);

    const clay = new THREE.MeshStandardMaterial({ color: 0xc76e45, roughness: 0.72, metalness: 0.02 });
    const clayDark = new THREE.MeshStandardMaterial({ color: 0x8f452d, roughness: 0.9 });
    const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2018, roughness: 1 });
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x315e32, roughness: 0.76 });
    const leafMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x5e8d3a, roughness: 0.62, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0x82a94b, roughness: 0.58, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0x3f7536, roughness: 0.68, side: THREE.DoubleSide }),
    ];

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.72, 1.65, 48, 1, false), clay);
    pot.position.y = 0.86;
    pot.castShadow = true;
    pot.receiveShadow = true;
    plant.add(pot);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.13, 12, 48), clayDark);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.69;
    rim.castShadow = true;
    plant.add(rim);

    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.09, 40), soilMaterial);
    soil.position.y = 1.68;
    soil.receiveShadow = true;
    plant.add(soil);

    const trunkPoints = [
      new THREE.Vector3(0, 1.7, 0),
      new THREE.Vector3(-0.08, 2.5, 0.03),
      new THREE.Vector3(0.12, 3.35, -0.02),
      new THREE.Vector3(-0.03, 4.28, 0),
      new THREE.Vector3(0.08, 5.15, 0.04),
    ];
    const trunk = createBranch(trunkPoints, 0.065, stemMaterial);
    trunk.castShadow = true;
    plant.add(trunk);

    const leafGeometry = createLeafGeometry();
    const branchData = [
      { y: 2.35, side: -1, reach: 0.92, z: 0.12 },
      { y: 2.72, side: 1, reach: 1.05, z: -0.08 },
      { y: 3.12, side: -1, reach: 1.15, z: -0.06 },
      { y: 3.48, side: 1, reach: 1.18, z: 0.12 },
      { y: 3.86, side: -1, reach: 1.02, z: 0.14 },
      { y: 4.2, side: 1, reach: 0.92, z: -0.08 },
      { y: 4.52, side: -1, reach: 0.7, z: 0.05 },
      { y: 4.78, side: 1, reach: 0.58, z: 0.02 },
    ];

    branchData.forEach((branch, branchIndex) => {
      const startX = Math.sin(branch.y * 2.1) * 0.08;
      const branchPoints = [
        new THREE.Vector3(startX, branch.y, 0),
        new THREE.Vector3(branch.side * branch.reach * 0.48, branch.y + 0.25, branch.z),
        new THREE.Vector3(branch.side * branch.reach, branch.y + 0.45, branch.z * 1.4),
      ];
      const branchMesh = createBranch(branchPoints, 0.032, stemMaterial);
      branchMesh.castShadow = true;
      plant.add(branchMesh);

      [0.38, 0.68, 0.96].forEach((distance, leafIndex) => {
        const leaf = new THREE.Mesh(leafGeometry, leafMaterials[(branchIndex + leafIndex) % leafMaterials.length]);
        leaf.position.set(
          THREE.MathUtils.lerp(startX, branch.side * branch.reach, distance),
          branch.y + 0.08 + distance * 0.45,
          branch.z * distance,
        );
        leaf.scale.setScalar(0.72 + leafIndex * 0.08);
        leaf.rotation.set(
          -0.35 + leafIndex * 0.2,
          branch.side > 0 ? -0.35 : 0.35,
          branch.side > 0 ? -0.92 : 0.92,
        );
        leaf.castShadow = true;
        plant.add(leaf);
      });
    });

    [
      [0.08, 5.03, -0.2],
      [-0.3, 4.85, 0.05],
      [0.38, 4.68, 0.1],
    ].forEach((position, index) => {
      const leaf = new THREE.Mesh(leafGeometry, leafMaterials[index]);
      leaf.position.set(position[0], position[1], position[2]);
      leaf.scale.setScalar(0.82);
      leaf.rotation.set(-0.25, index - 1, index === 1 ? 0.55 : -0.55);
      leaf.castShadow = true;
      plant.add(leaf);
    });

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 64),
      new THREE.ShadowMaterial({ color: 0x1b2b1b, opacity: 0.16 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.9;
    floor.receiveShadow = true;
    scene.add(floor);

    const ambient = new THREE.HemisphereLight(0xf6f0da, 0x40583d, 2.4);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff5d6, 4.5);
    key.position.set(-3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.PointLight(0xd4e89d, 9, 10);
    fill.position.set(3.8, 2.8, 2.5);
    scene.add(fill);

    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    const clock = new THREE.Clock();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = mount.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      plant.rotation.y += ((-0.28 + pointerX * 0.16) - plant.rotation.y) * 0.035;
      plant.rotation.x += ((pointerY * 0.035 + Math.sin(elapsed * 0.65) * 0.012) - plant.rotation.x) * 0.04;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    mount.addEventListener("pointermove", onPointerMove);
    resize();
    setReady(true);
    if (reducedMotion) renderer.render(scene, camera);
    else animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={mountRef} className={`plant-scene${ready ? " is-ready" : ""}`}>
      <div className="plant-loader" aria-hidden="true"><span /></div>
      <p className="scene-hint"><span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 14L14 6M7 6h7v7" /></svg></span> Move to explore</p>
    </div>
  );
}
