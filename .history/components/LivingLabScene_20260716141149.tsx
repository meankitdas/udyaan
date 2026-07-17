"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type LabPalette = {
  dark: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  green: THREE.MeshStandardMaterial;
  lightGreen: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  solar: THREE.MeshStandardMaterial;
  terracotta: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  white: THREE.MeshStandardMaterial;
  yellow: THREE.MeshStandardMaterial;
};

function enableShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createPlant(palette: LabPalette, scale = 1) {
  const plant = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025 * scale, 0.035 * scale, 0.34 * scale, 7),
    palette.green,
  );
  stem.position.y = 0.17 * scale;
  plant.add(stem);

  [-1, 1].forEach((side) => {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 * scale, 10, 8),
      side > 0 ? palette.lightGreen : palette.green,
    );
    leaf.scale.set(1.25, 0.32, 0.55);
    leaf.position.set(side * 0.09 * scale, 0.26 * scale, 0);
    leaf.rotation.z = side * 0.48;
    plant.add(leaf);
  });

  const topLeaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.1 * scale, 10, 8),
    palette.lightGreen,
  );
  topLeaf.scale.set(0.7, 1.2, 0.55);
  topLeaf.position.y = 0.4 * scale;
  plant.add(topLeaf);
  return plant;
}

function createCropPlot(palette: LabPalette, rows: number, columns: number) {
  const plot = new THREE.Group();
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(columns * 0.38 + 0.45, 0.18, rows * 0.48 + 0.45),
    palette.earth,
  );
  bed.position.y = 0.09;
  plot.add(bed);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const plant = createPlant(palette, 0.72 + ((row + column) % 2) * 0.08);
      plant.position.set(
        (column - (columns - 1) / 2) * 0.38,
        0.18,
        (row - (rows - 1) / 2) * 0.48,
      );
      plot.add(plant);
    }
  }
  enableShadows(plot);
  return plot;
}

function createGreenhouse(palette: LabPalette) {
  const greenhouse = new THREE.Group();
  const width = 4.2;
  const depth = 3.1;
  const wallHeight = 1.65;
  const roofHeight = 1.05;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth), palette.white);
  floor.position.y = 0.06;
  greenhouse.add(floor);

  const glassWall = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.12, wallHeight, depth - 0.12),
    palette.glass,
  );
  glassWall.position.y = wallHeight / 2 + 0.12;
  greenhouse.add(glassWall);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-width / 2, 0);
  roofShape.lineTo(0, roofHeight);
  roofShape.lineTo(width / 2, 0);
  roofShape.closePath();
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, {
    depth,
    bevelEnabled: false,
  });
  roofGeometry.translate(0, wallHeight + 0.12, -depth / 2);
  const roof = new THREE.Mesh(roofGeometry, palette.glass);
  greenhouse.add(roof);

  const frameMaterial = palette.metal;
  const addBeam = (size: [number, number, number], position: [number, number, number], rotationZ = 0) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(...size), frameMaterial);
    beam.position.set(...position);
    beam.rotation.z = rotationZ;
    greenhouse.add(beam);
  };

  [-width / 2, width / 2].forEach((horizontal) => {
    [-depth / 2, depth / 2].forEach((vertical) => {
      addBeam([0.07, wallHeight, 0.07], [horizontal, wallHeight / 2 + 0.12, vertical]);
    });
  });
  addBeam([width + 0.12, 0.07, 0.07], [0, wallHeight + 0.12, -depth / 2]);
  addBeam([width + 0.12, 0.07, 0.07], [0, wallHeight + 0.12, depth / 2]);
  addBeam([0.07, 0.07, depth + 0.12], [0, wallHeight + roofHeight + 0.1, 0]);

  const roofAngle = Math.atan2(roofHeight, width / 2);
  [-depth / 2, depth / 2].forEach((vertical) => {
    addBeam([Math.hypot(width / 2, roofHeight), 0.07, 0.07], [-width / 4, wallHeight + roofHeight / 2 + 0.12, vertical], roofAngle);
    addBeam([Math.hypot(width / 2, roofHeight), 0.07, 0.07], [width / 4, wallHeight + roofHeight / 2 + 0.12, vertical], -roofAngle);
  });

  const internalPlot = createCropPlot(palette, 3, 7);
  internalPlot.scale.setScalar(0.64);
  internalPlot.position.set(0, 0.13, 0);
  greenhouse.add(internalPlot);
  enableShadows(greenhouse);
  return greenhouse;
}

function createHydroponicRack(palette: LabPalette) {
  const rack = new THREE.Group();
  const shelfWidth = 3.2;
  const shelfDepth = 0.72;

  for (let level = 0; level < 3; level += 1) {
    const shelfY = 0.45 + level * 0.78;
    const waterChannel = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth, 0.16, shelfDepth),
      palette.white,
    );
    waterChannel.position.y = shelfY;
    rack.add(waterChannel);

    const water = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth - 0.18, 0.04, shelfDepth - 0.18),
      palette.water,
    );
    water.position.y = shelfY + 0.1;
    rack.add(water);

    for (let plantIndex = 0; plantIndex < 7; plantIndex += 1) {
      const plant = createPlant(palette, 0.55);
      plant.position.set(-1.35 + plantIndex * 0.45, shelfY + 0.1, 0);
      rack.add(plant);
    }
  }

  [-1.48, 1.48].forEach((horizontal) => {
    [-0.29, 0.29].forEach((vertical) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.45, 0.09), palette.metal);
      leg.position.set(horizontal, 1.22, vertical);
      rack.add(leg);
    });
  });
  enableShadows(rack);
  return rack;
}

function createSolarArray(palette: LabPalette) {
  const array = new THREE.Group();
  for (let panelIndex = 0; panelIndex < 6; panelIndex += 1) {
    const column = panelIndex % 3;
    const row = Math.floor(panelIndex / 3);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.72), palette.solar);
    panel.position.set((column - 1) * 1.15, 0.55, (row - 0.5) * 0.82);
    panel.rotation.x = -0.32;
    array.add(panel);

    const support = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), palette.metal);
    support.position.set(panel.position.x, 0.28, panel.position.z + 0.1);
    array.add(support);
  }
  enableShadows(array);
  return array;
}

function createBioPlant(palette: LabPalette) {
  const bioPlant = new THREE.Group();
  for (let tankIndex = 0; tankIndex < 3; tankIndex += 1) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.52, 1.15 + tankIndex * 0.12, 20),
      tankIndex === 1 ? palette.terracotta : palette.green,
    );
    tank.position.set((tankIndex - 1) * 1.15, 0.65 + tankIndex * 0.06, 0);
    bioPlant.add(tank);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), palette.metal);
    cap.position.set(tank.position.x, 1.22 + tankIndex * 0.12, 0);
    bioPlant.add(cap);
  }

  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.15, 1.1, 0),
    new THREE.Vector3(-0.6, 1.55, 0),
    new THREE.Vector3(0, 1.35, 0),
    new THREE.Vector3(0.6, 1.65, 0),
    new THREE.Vector3(1.15, 1.25, 0),
  ]);
  bioPlant.add(new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 24, 0.06, 8), palette.yellow));
  enableShadows(bioPlant);
  return bioPlant;
}

function createDrone(palette: LabPalette) {
  const drone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.48), palette.terracotta);
  drone.add(body);
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), palette.dark);
  sensor.position.y = -0.17;
  drone.add(sensor);

  const rotorGroups: THREE.Group[] = [];
  [[-0.6, -0.48], [-0.6, 0.48], [0.6, -0.48], [0.6, 0.48]].forEach(([horizontal, vertical]) => {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8),
      palette.dark,
    );
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = Math.atan2(vertical, horizontal);
    arm.position.set(horizontal / 2, 0, vertical / 2);
    drone.add(arm);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(horizontal, 0.04, vertical);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), palette.metal);
    rotorGroup.add(hub);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.025, 0.07), palette.dark);
    blade.position.y = 0.07;
    rotorGroup.add(blade);
    rotorGroups.push(rotorGroup);
    drone.add(rotorGroup);
  });
  enableShadows(drone);
  return { drone, rotorGroups };
}

function createSensor(palette: LabPalette) {
  const sensor = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.85, 8), palette.metal);
  pole.position.y = 0.425;
  sensor.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.22), palette.yellow);
  head.position.y = 0.88;
  sensor.add(head);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), palette.dark);
  lens.position.set(0, 0.88, 0.13);
  sensor.add(lens);
  return sensor;
}

export function LivingLabScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x102d21);
    scene.fog = new THREE.Fog(0x102d21, 18, 34);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    camera.position.set(11.6, 9.2, 14.8);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const palette: LabPalette = {
      dark: new THREE.MeshStandardMaterial({ color: 0x173f2c, roughness: 0.68 }),
      earth: new THREE.MeshStandardMaterial({ color: 0x654331, roughness: 1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe7d3, roughness: 0.1, transmission: 0.48, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
      green: new THREE.MeshStandardMaterial({ color: 0x5f8d4e, roughness: 0.72 }),
      lightGreen: new THREE.MeshStandardMaterial({ color: 0xa7c85e, roughness: 0.65 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x9aa9a2, roughness: 0.38, metalness: 0.72 }),
      solar: new THREE.MeshStandardMaterial({ color: 0x24516a, roughness: 0.28, metalness: 0.45 }),
      terracotta: new THREE.MeshStandardMaterial({ color: 0xc86e49, roughness: 0.7 }),
      water: new THREE.MeshPhysicalMaterial({ color: 0x53b5b5, roughness: 0.12, transmission: 0.25, transparent: true, opacity: 0.8 }),
      white: new THREE.MeshStandardMaterial({ color: 0xecebdd, roughness: 0.62 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xf0c95a, roughness: 0.62 }),
    };

    const campus = new THREE.Group();
    campus.rotation.y = -0.28;
    scene.add(campus);

    const island = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.5, 10.6), palette.dark);
    island.position.y = -0.28;
    island.receiveShadow = true;
    campus.add(island);

    const land = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9dfb8, roughness: 0.96 }),
    );
    land.position.y = 0.05;
    land.receiveShadow = true;
    campus.add(land);

    const path = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 9.2), palette.white);
    path.position.set(0.2, 0.18, 0.2);
    campus.add(path);

    const greenhouse = createGreenhouse(palette);
    greenhouse.position.set(-2.4, 0.18, -1.7);
    campus.add(greenhouse);

    const hydroponics = createHydroponicRack(palette);
    hydroponics.position.set(4.5, 0.18, -1.65);
    hydroponics.rotation.y = -0.06;
    campus.add(hydroponics);

    const cropPlot = createCropPlot(palette, 4, 8);
    cropPlot.position.set(-3.4, 0.18, 3.25);
    campus.add(cropPlot);

    const secondPlot = createCropPlot(palette, 3, 5);
    secondPlot.position.set(1.35, 0.18, 3.52);
    campus.add(secondPlot);

    const solarArray = createSolarArray(palette);
    solarArray.position.set(-5.3, 0.18, -3.7);
    campus.add(solarArray);

    const bioPlant = createBioPlant(palette);
    bioPlant.position.set(5.25, 0.18, 3.25);
    campus.add(bioPlant);

    const animatedDrone = createDrone(palette);
    animatedDrone.drone.position.set(1.15, 4.4, -0.5);
    animatedDrone.drone.rotation.y = 0.35;
    campus.add(animatedDrone.drone);

    const sensors: THREE.Group[] = [];
    [[-5.9, 2.4], [-0.85, 3.8], [3.2, -3.7]].forEach(([horizontal, vertical]) => {
      const sensor = createSensor(palette);
      sensor.position.set(horizontal, 0.18, vertical);
      sensors.push(sensor);
      campus.add(sensor);
    });

    const ambient = new THREE.HemisphereLight(0xe8f2cf, 0x193a2d, 2.7);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff3cf, 4.8);
    key.position.set(-7, 13, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -11;
    key.shadow.camera.right = 11;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    scene.add(key);
    const rim = new THREE.PointLight(0xdbe76e, 18, 24);
    rim.position.set(7, 7, -7);
    scene.add(rim);

    const clock = new THREE.Clock();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let baseRotation = -0.28;
    let pointerHorizontal = 0;
    let pointerVertical = 0;
    let isVisible = true;

    const resize = () => {
      const bounds = mount.getBoundingClientRect();
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / Math.max(bounds.height, 1);
      if (bounds.width < 700) {
        camera.fov = 42;
        camera.position.set(16.5, 13, 22.5);
        baseRotation = -0.16;
        if (scene.fog instanceof THREE.Fog) {
          scene.fog.near = 24;
          scene.fog.far = 48;
        }
      } else {
        camera.fov = 32;
        camera.position.set(11.6, 9.2, 14.8);
        baseRotation = -0.28;
        if (scene.fog instanceof THREE.Fog) {
          scene.fog.near = 18;
          scene.fog.far = 34;
        }
      }
      camera.lookAt(0, 0.8, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = mount.getBoundingClientRect();
      pointerHorizontal = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerVertical = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      if (isVisible) {
        campus.rotation.y += ((baseRotation + pointerHorizontal * 0.08) - campus.rotation.y) * 0.025;
        campus.rotation.x += ((pointerVertical * 0.025) - campus.rotation.x) * 0.025;
        animatedDrone.drone.position.y = 4.4 + Math.sin(elapsed * 1.25) * 0.16;
        animatedDrone.drone.rotation.z = Math.sin(elapsed * 0.9) * 0.035;
        animatedDrone.rotorGroups.forEach((rotorGroup, index) => {
          rotorGroup.rotation.y = elapsed * (index % 2 === 0 ? 18 : -18);
        });
        sensors.forEach((sensor, index) => {
          sensor.rotation.y = Math.sin(elapsed * 0.7 + index) * 0.2;
        });
        renderer.render(scene, camera);
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { rootMargin: "120px" });
    visibilityObserver.observe(mount);
    mount.addEventListener("pointermove", onPointerMove);
    resize();
    setReady(true);
    if (reducedMotion) renderer.render(scene, camera);
    else animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={mountRef} className={`living-lab-scene${ready ? " is-ready" : ""}`}>
      <div className="lab-loader" aria-hidden="true"><span /></div>
    </div>
  );
}