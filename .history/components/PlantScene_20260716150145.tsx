"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type ScenePalette = {
  charcoal: THREE.MeshStandardMaterial;
  clay: THREE.MeshStandardMaterial;
  crop: THREE.MeshStandardMaterial;
  cropLight: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  grass: THREE.MeshStandardMaterial;
  lime: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  path: THREE.MeshStandardMaterial;
  solar: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  white: THREE.MeshStandardMaterial;
};

function enableShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createCrop(palette: ScenePalette, scale = 1) {
  const crop = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018 * scale, 0.026 * scale, 0.28 * scale, 7),
    palette.crop,
  );
  stem.position.y = 0.14 * scale;
  crop.add(stem);

  [-1, 1].forEach((side) => {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.085 * scale, 9, 6),
      side > 0 ? palette.cropLight : palette.crop,
    );
    leaf.scale.set(1.25, 0.25, 0.5);
    leaf.position.set(side * 0.065 * scale, 0.2 * scale, 0);
    leaf.rotation.z = side * 0.5;
    crop.add(leaf);
  });
  return crop;
}

function createField(palette: ScenePalette) {
  const field = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.16, 1.85), palette.earth);
  bed.position.y = 0.08;
  field.add(bed);

  for (let row = 0; row < 4; row += 1) {
    const irrigationLine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 2.25, 7),
      palette.water,
    );
    irrigationLine.rotation.z = Math.PI / 2;
    irrigationLine.position.set(0, 0.18, -0.67 + row * 0.45);
    field.add(irrigationLine);

    for (let column = 0; column < 6; column += 1) {
      const crop = createCrop(palette, 0.82 + ((row + column) % 2) * 0.08);
      crop.position.set(-1.05 + column * 0.42, 0.17, -0.67 + row * 0.45);
      field.add(crop);
    }
  }

  const sensorPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.82, 8),
    palette.metal,
  );
  sensorPole.position.set(-1.05, 0.57, -0.58);
  field.add(sensorPole);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.2), palette.lime);
  sensor.position.set(-1.05, 1, -0.58);
  field.add(sensor);
  enableShadows(field);
  return field;
}

function createGreenhouse(palette: ScenePalette) {
  const greenhouse = new THREE.Group();
  const width = 2.45;
  const depth = 1.65;
  const wallHeight = 0.9;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), palette.white);
  floor.position.y = 0.05;
  greenhouse.add(floor);

  const glassHouse = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.08, wallHeight, depth - 0.08),
    palette.glass,
  );
  glassHouse.position.y = wallHeight / 2 + 0.1;
  greenhouse.add(glassHouse);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-width / 2, 0);
  roofShape.lineTo(0, 0.6);
  roofShape.lineTo(width / 2, 0);
  roofShape.closePath();
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth, bevelEnabled: false });
  roofGeometry.translate(0, wallHeight + 0.1, -depth / 2);
  greenhouse.add(new THREE.Mesh(roofGeometry, palette.glass));

  const addBeam = (
    size: [number, number, number],
    position: [number, number, number],
    rotationZ = 0,
  ) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(...size), palette.metal);
    beam.position.set(...position);
    beam.rotation.z = rotationZ;
    greenhouse.add(beam);
  };

  [-width / 2, width / 2].forEach((horizontal) => {
    [-depth / 2, depth / 2].forEach((vertical) => {
      addBeam([0.045, wallHeight, 0.045], [horizontal, wallHeight / 2 + 0.1, vertical]);
    });
  });
  const roofAngle = Math.atan2(0.6, width / 2);
  [-depth / 2, depth / 2].forEach((vertical) => {
    addBeam([1.4, 0.045, 0.045], [-width / 4, 1.3, vertical], roofAngle);
    addBeam([1.4, 0.045, 0.045], [width / 4, 1.3, vertical], -roofAngle);
  });
  addBeam([0.045, 0.045, depth + 0.08], [0, 1.5, 0]);

  for (let cropIndex = 0; cropIndex < 8; cropIndex += 1) {
    const crop = createCrop(palette, 0.7);
    crop.position.set(
      -0.88 + (cropIndex % 4) * 0.58,
      0.12,
      -0.42 + Math.floor(cropIndex / 4) * 0.76,
    );
    greenhouse.add(crop);
  }
  enableShadows(greenhouse);
  return greenhouse;
}

function createSolarArray(palette: ScenePalette) {
  const solarArray = new THREE.Group();
  for (let panelIndex = 0; panelIndex < 4; panelIndex += 1) {
    const column = panelIndex % 2;
    const row = Math.floor(panelIndex / 2);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.05, 0.62), palette.solar);
    panel.position.set((column - 0.5) * 1.02, 0.48, (row - 0.5) * 0.72);
    panel.rotation.x = -0.28;
    solarArray.add(panel);

    const grid = new THREE.LineSegments(
      new THREE.EdgesGeometry(panel.geometry),
      new THREE.LineBasicMaterial({ color: 0x79a5b8, transparent: true, opacity: 0.75 }),
    );
    grid.position.copy(panel.position);
    grid.rotation.copy(panel.rotation);
    solarArray.add(grid);

    const support = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.46, 0.045), palette.metal);
    support.position.set(panel.position.x, 0.24, panel.position.z + 0.08);
    solarArray.add(support);
  }
  enableShadows(solarArray);
  return solarArray;
}

function createStudent(
  palette: ScenePalette,
  shirtMaterial: THREE.MeshStandardMaterial,
  skinColor: number,
) {
  const student = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.82 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x243c36, roughness: 0.9 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 9), skin);
  head.position.y = 0.83;
  student.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    palette.charcoal,
  );
  hair.position.y = 0.87;
  student.add(hair);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.145, 0.36, 9), shirtMaterial);
  torso.position.y = 0.57;
  student.add(torso);

  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 7), trousers);
    leg.position.set(side * 0.06, 0.25, 0);
    student.add(leg);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.032, 0.32, 7), skin);
    arm.position.set(side * 0.145, 0.56, 0.02);
    arm.rotation.z = side * 0.42;
    student.add(arm);
  });

  enableShadows(student);
  return student;
}

function createPrototypeStudio(palette: ScenePalette) {
  const studio = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.46, 1.55, 0.18, 48), palette.white);
  pad.position.y = 0.09;
  studio.add(pad);

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 32), palette.clay);
  tableTop.position.y = 0.72;
  studio.add(tableTop);
  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.62, 12), palette.charcoal);
  tableBase.position.y = 0.38;
  studio.add(tableBase);

  const shirtMaterials = [palette.clay, palette.crop, palette.lime];
  const skinColors = [0x8b593c, 0xc88662, 0x6c432f];
  const studentPositions: Array<[number, number, number]> = [
    [-0.92, 0.18, 0.18],
    [0.64, 0.18, 0.72],
    [0.62, 0.18, -0.72],
  ];
  studentPositions.forEach((position, index) => {
    const student = createStudent(palette, shirtMaterials[index], skinColors[index]);
    student.position.set(...position);
    student.rotation.y = Math.atan2(-position[0], -position[2]);
    studio.add(student);
  });

  const prototypeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.26, 0.16, 20),
    palette.charcoal,
  );
  prototypeBase.position.y = 0.87;
  studio.add(prototypeBase);

  const ideaCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2, 2),
    new THREE.MeshStandardMaterial({
      color: 0xf5e970,
      emissive: 0xdbe76e,
      emissiveIntensity: 2.2,
      roughness: 0.28,
    }),
  );
  ideaCore.position.y = 1.24;
  studio.add(ideaCore);

  const ideaHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.39, 0.016, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xdbe76e, transparent: true, opacity: 0.78 }),
  );
  ideaHalo.position.y = 1.24;
  ideaHalo.rotation.x = Math.PI / 2;
  studio.add(ideaHalo);

  const ideaLight = new THREE.PointLight(0xe9f18e, 7, 4.5, 2);
  ideaLight.position.y = 1.35;
  studio.add(ideaLight);
  enableShadows(studio);
  return { studio, ideaCore, ideaHalo };
}

function createVenturePavilion(palette: ScenePalette) {
  const pavilion = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.16, 28), palette.path);
  base.position.y = 0.08;
  pavilion.add(base);

  [-0.68, 0.68].forEach((horizontal) => {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.2, 0.11), palette.clay);
    column.position.set(horizontal, 0.78, 0);
    pavilion.add(column);
  });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.08), palette.clay);
  canopy.position.y = 1.42;
  pavilion.add(canopy);

  const display = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.08), palette.charcoal);
  display.position.set(0, 0.87, 0.18);
  pavilion.add(display);
  const displayGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.38),
    new THREE.MeshBasicMaterial({ color: 0xdbe76e }),
  );
  displayGlow.position.set(0, 0.87, 0.225);
  pavilion.add(displayGlow);

  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1.45, 8),
    palette.charcoal,
  );
  flagPole.position.set(0.9, 0.82, -0.35);
  pavilion.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28), palette.lime);
  flag.position.set(1.14, 1.35, -0.35);
  pavilion.add(flag);
  enableShadows(pavilion);
  return pavilion;
}

function createDrone(palette: ScenePalette) {
  const drone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.34), palette.clay);
  drone.add(body);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), palette.charcoal);
  lens.position.set(0, -0.12, 0.14);
  drone.add(lens);

  const rotors: THREE.Group[] = [];
  [[-0.43, -0.35], [-0.43, 0.35], [0.43, -0.35], [0.43, 0.35]].forEach(
    ([horizontal, vertical]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.035), palette.charcoal);
      arm.position.set(horizontal / 2, 0, vertical / 2);
      arm.rotation.y = Math.atan2(vertical, horizontal);
      drone.add(arm);

      const rotor = new THREE.Group();
      rotor.position.set(horizontal, 0.06, vertical);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10),
        palette.metal,
      );
      rotor.add(hub);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.016, 0.045), palette.charcoal);
      blade.position.y = 0.05;
      rotor.add(blade);
      rotors.push(rotor);
      drone.add(rotor);
    },
  );
  enableShadows(drone);
  return { drone, rotors };
}

function createConnection(points: THREE.Vector3[], material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, 0.022, 7, false), material);
  return { curve, line };
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

    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60);
    camera.position.set(8.8, 7.1, 10.6);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const palette: ScenePalette = {
      charcoal: new THREE.MeshStandardMaterial({ color: 0x173f2c, roughness: 0.7 }),
      clay: new THREE.MeshStandardMaterial({ color: 0xc76643, roughness: 0.68 }),
      crop: new THREE.MeshStandardMaterial({ color: 0x4e7d43, roughness: 0.78 }),
      cropLight: new THREE.MeshStandardMaterial({ color: 0x9fbd58, roughness: 0.68 }),
      earth: new THREE.MeshStandardMaterial({ color: 0x70503a, roughness: 1 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xb9e1d2,
        roughness: 0.08,
        transmission: 0.58,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
      }),
      grass: new THREE.MeshStandardMaterial({ color: 0xb9ca8e, roughness: 0.92 }),
      lime: new THREE.MeshStandardMaterial({ color: 0xdbe76e, roughness: 0.58 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x94a49d, roughness: 0.38, metalness: 0.68 }),
      path: new THREE.MeshStandardMaterial({ color: 0xe7e0c9, roughness: 0.9 }),
      solar: new THREE.MeshStandardMaterial({ color: 0x285b72, roughness: 0.28, metalness: 0.45 }),
      water: new THREE.MeshPhysicalMaterial({
        color: 0x4fa8a9,
        roughness: 0.12,
        transparent: true,
        opacity: 0.82,
      }),
      white: new THREE.MeshStandardMaterial({ color: 0xf1efe4, roughness: 0.72 }),
    };

    const world = new THREE.Group();
    world.rotation.y = -0.3;
    world.position.y = -0.8;
    scene.add(world);

    const islandSide = new THREE.Mesh(
      new THREE.CylinderGeometry(4.65, 4.85, 0.62, 64),
      new THREE.MeshStandardMaterial({ color: 0x76533c, roughness: 1 }),
    );
    islandSide.position.y = -0.31;
    islandSide.receiveShadow = true;
    world.add(islandSide);
    const islandTop = new THREE.Mesh(
      new THREE.CylinderGeometry(4.58, 4.62, 0.18, 64),
      palette.grass,
    );
    islandTop.position.y = 0.05;
    islandTop.receiveShadow = true;
    world.add(islandTop);

    const innerPath = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.17, 10, 64), palette.path);
    innerPath.rotation.x = Math.PI / 2;
    innerPath.position.y = 0.18;
    innerPath.receiveShadow = true;
    world.add(innerPath);

    const field = createField(palette);
    field.position.set(-2.45, 0.16, 1.7);
    field.rotation.y = 0.12;
    world.add(field);

    const greenhouse = createGreenhouse(palette);
    greenhouse.position.set(-1.95, 0.16, -2.15);
    greenhouse.rotation.y = 0.18;
    world.add(greenhouse);

    const solarArray = createSolarArray(palette);
    solarArray.position.set(1.7, 0.16, -2.9);
    solarArray.rotation.y = -0.08;
    world.add(solarArray);

    const prototypeStudio = createPrototypeStudio(palette);
    prototypeStudio.studio.position.set(0.05, 0.16, 0.15);
    world.add(prototypeStudio.studio);

    const venturePavilion = createVenturePavilion(palette);
    venturePavilion.position.set(3.25, 0.16, 1.2);
    venturePavilion.rotation.y = -0.65;
    world.add(venturePavilion);

    const animatedDrone = createDrone(palette);
    animatedDrone.drone.position.set(-0.9, 3.7, 0);
    world.add(animatedDrone.drone);

    const connectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xf2e96f,
      transparent: true,
      opacity: 0.78,
    });
    const fieldConnection = createConnection([
      new THREE.Vector3(-2.45, 0.42, 1.35),
      new THREE.Vector3(-1.35, 0.5, 0.85),
      new THREE.Vector3(-0.6, 0.5, 0.45),
    ], connectionMaterial);
    world.add(fieldConnection.line);
    const ventureConnection = createConnection([
      new THREE.Vector3(0.7, 0.5, 0.38),
      new THREE.Vector3(1.75, 0.55, 0.65),
      new THREE.Vector3(2.75, 0.48, 1.05),
    ], connectionMaterial);
    world.add(ventureConnection.line);

    const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xffffbd });
    const fieldPulse = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), pulseMaterial);
    const venturePulse = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), pulseMaterial);
    world.add(fieldPulse, venturePulse);

    const particlePositions: number[] = [];
    for (let particleIndex = 0; particleIndex < 70; particleIndex += 1) {
      const angle = (particleIndex / 70) * Math.PI * 2;
      const radius = 4.9 + (particleIndex % 6) * 0.22;
      particlePositions.push(
        Math.cos(angle) * radius,
        0.5 + (particleIndex % 9) * 0.34,
        Math.sin(angle) * radius,
      );
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(particlePositions, 3),
    );
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0xf2f0d8,
        size: 0.035,
        transparent: true,
        opacity: 0.72,
      }),
    );
    world.add(particles);

    const hemisphere = new THREE.HemisphereLight(0xfff8dc, 0x405d49, 2.8);
    scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight(0xfff1c9, 4.8);
    keyLight.position.set(-6, 11, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1536, 1536);
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xdbe76e, 12, 18);
    rimLight.position.set(6, 5, -5);
    scene.add(rimLight);

    const clock = new THREE.Clock();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let pointerHorizontal = 0;
    let pointerVertical = 0;
    let isVisible = true;
    let baseRotation = -0.3;

    const renderFrame = () => {
      renderer.render(scene, camera);
    };

    const resize = () => {
      const bounds = mount.getBoundingClientRect();
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / Math.max(bounds.height, 1);
      if (bounds.width < 720) {
        camera.fov = 39;
        camera.position.set(9.5, 8.8, 14.2);
        world.position.set(0.5, -0.85, 0);
        baseRotation = -0.18;
      } else {
        camera.fov = 33;
        camera.position.set(8.8, 7.1, 10.6);
        world.position.set(0, -0.8, 0);
        baseRotation = -0.3;
      }
      camera.lookAt(0, 0.8, 0);
      camera.updateProjectionMatrix();
      renderFrame();
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = mount.getBoundingClientRect();
      pointerHorizontal = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerVertical = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      if (isVisible) {
        world.rotation.y += ((baseRotation + pointerHorizontal * 0.1) - world.rotation.y) * 0.025;
        world.rotation.x += ((pointerVertical * 0.025) - world.rotation.x) * 0.025;
        prototypeStudio.ideaCore.position.y = 1.24 + Math.sin(elapsed * 1.7) * 0.055;
        prototypeStudio.ideaCore.rotation.y = elapsed * 0.7;
        prototypeStudio.ideaHalo.rotation.z = elapsed * 0.42;
        prototypeStudio.ideaHalo.scale.setScalar(1 + Math.sin(elapsed * 1.7) * 0.05);
        particles.rotation.y = elapsed * 0.018;

        const droneAngle = elapsed * 0.26;
        animatedDrone.drone.position.set(
          Math.cos(droneAngle) * 2.15 - 0.45,
          3.55 + Math.sin(elapsed * 1.35) * 0.16,
          Math.sin(droneAngle) * 1.45,
        );
        animatedDrone.drone.rotation.y = -droneAngle + Math.PI / 2;
        animatedDrone.drone.rotation.z = Math.sin(elapsed * 0.9) * 0.04;
        animatedDrone.rotors.forEach((rotor, index) => {
          rotor.rotation.y = elapsed * (index % 2 === 0 ? 19 : -19);
        });

        fieldPulse.position.copy(fieldConnection.curve.getPoint((elapsed * 0.18) % 1));
        venturePulse.position.copy(
          ventureConnection.curve.getPoint((elapsed * 0.16 + 0.38) % 1),
        );
        renderFrame();
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { rootMargin: "100px" });
    visibilityObserver.observe(mount);
    mount.addEventListener("pointermove", onPointerMove);
    resize();
    setReady(true);
    if (reducedMotion) renderFrame();
    else animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh
          || object instanceof THREE.Points
          || object instanceof THREE.Line
        ) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
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
    <div ref={mountRef} className={`plant-scene${ready ? " is-ready" : ""}`}>
      <div className="plant-loader" aria-hidden="true"><span /></div>
      <div className="scene-story" aria-hidden="true">
        <div className="scene-stage stage-observe">
          <span>01</span><strong>Observe</strong><small>Field intelligence</small>
        </div>
        <div className="scene-stage stage-build">
          <span>02</span><strong>Build</strong><small>Student prototype</small>
        </div>
        <div className="scene-stage stage-launch">
          <span>03</span><strong>Launch</strong><small>Market pilot</small>
        </div>
      </div>
      <p className="scene-hint">
        <span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 14L14 6M7 6h7v7" /></svg></span>
        Move to explore
      </p>
    </div>
  );
}