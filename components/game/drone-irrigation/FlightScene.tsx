"use client";

import { memo, Suspense, useEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BallCollider, CuboidCollider, Physics, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import FarmWorld, { FarmLight } from "./FarmWorld";
import { DroneModel, WaterParticles } from "./DroneModel";
import { externalCamera, onboardCamera, stabilizeCamera, type CameraMode } from "./camera";
import { STEP, DRY_MASS, advanceMission, flightForces, registerImpact, type FlightInput, type Level, type Mission, type Phase, type Pose } from "./simulation";

export type { CameraMode } from "./camera";
type SceneProps = {
  level: Level;
  mission: RefObject<Mission>;
  input: RefObject<FlightInput>;
  phase: Phase;
  cameraMode: CameraMode;
  cameraTilt?: number;
  attempt: number;
  onReady: (ready: boolean) => void;
  onError: (failed: boolean) => void;
  onPhase: (phase: Phase) => void;
};

function CameraRig({ mission, mode, tilt, attempt, phase }: { mission: RefObject<Mission>; mode: CameraMode; tilt: number; attempt: number; phase: Phase }) {
  const { camera, gl, size, invalidate } = useThree();
  const orbit = useRef<OrbitControls | null>(null);
  const onboard = useRef(false);
  const reduced = useRef(false);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 26;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.addEventListener("change", () => invalidate());
    orbit.current = controls;
    return () => { controls.dispose(); orbit.current = null; };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reduced.current = media.matches; invalidate(); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [invalidate]);
  useEffect(() => {
    const isExternal = phase === "ready";
    if (orbit.current) orbit.current.enabled = isExternal;
    gl.domElement.style.cursor = isExternal ? "grab" : "default";
    const lens = camera as THREE.PerspectiveCamera;
    lens.fov = isExternal ? 50 : 66;
    lens.updateProjectionMatrix();
    if (isExternal) {
      const view = externalCamera(mission.current.pose, size.width / size.height);
      camera.position.copy(view.position);
      camera.quaternion.copy(view.orientation);
      orbit.current?.target.copy(view.target);
      orbit.current?.update();
      onboard.current = false;
    }
    invalidate();
  }, [camera, gl, size.width, size.height, phase, attempt, mission, invalidate]);
  useEffect(() => { invalidate(); }, [mode, tilt, invalidate]);
  useFrame((_, delta) => {
    if (mission.current.phase === "ready") { orbit.current?.update(); return; }
    const view = onboardCamera(mission.current.pose, reduced.current ? "gimbal" : mode, tilt);
    camera.position.copy(view.position);
    if (!onboard.current || mode === "fpv" || reduced.current) camera.quaternion.copy(view.orientation);
    else camera.quaternion.copy(stabilizeCamera(camera.quaternion, view.orientation, delta));
    onboard.current = true;
    if (phase !== "flying" && camera.quaternion.angleTo(view.orientation) > 0.0001) invalidate();
  });
  return null;
}

function Simulation({ level, mission, input, onPhase, onReady }: Pick<SceneProps, "level" | "mission" | "input" | "onPhase" | "onReady">) {
  const body = useRef<RapierRigidBody>(null);
  const notified = useRef(false);
  const mass = useRef(-1);
  const speedBeforeStep = useRef(0);
  const pose = (): Pose => ({ position: body.current!.translation(), velocity: body.current!.linvel(), rotation: body.current!.rotation(), angular: body.current!.angvel() });

  useBeforePhysicsStep(() => {
    if (!body.current || mission.current.phase !== "flying") return;
    const current = mission.current;
    if (Math.abs(current.water - mass.current) > 0.08) {
      body.current.setAdditionalMass(current.water, true);
      body.current.recomputeMassPropertiesFromColliders();
      mass.current = current.water;
    }
    const state = pose();
    speedBeforeStep.current = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z);
    const forces = flightForces(current, level, input.current, state, body.current.mass());
    body.current.resetForces(false);
    body.current.resetTorques(false);
    body.current.addForce(forces.force, true);
    body.current.addTorque(forces.torque, true);
  });

  useAfterPhysicsStep(() => {
    if (!body.current || mission.current.phase !== "flying") return;
    advanceMission(mission.current, level, input.current, pose());
    if (mission.current.phase !== "flying") onPhase(mission.current.phase);
  });

  useFrame(() => {
    if (!notified.current && body.current) { notified.current = true; onReady(true); }
  });

  return (
    <>
      <RigidBody ref={body} colliders={false} position={[mission.current.pose.position.x, mission.current.pose.position.y, mission.current.pose.position.z]}
        canSleep={false} ccd angularDamping={0.12} friction={0.6} restitution={0.05}
        onCollisionEnter={({ other }) => {
          registerImpact(mission.current, speedBeforeStep.current, other.rigidBodyObject?.name === "ground");
          if (mission.current.phase === "lost") onPhase("lost");
        }}>
        <CuboidCollider args={[0.8, 0.27, 0.65]} mass={DRY_MASS} />
        {[-1, 1].flatMap((horizontal) => [-1, 1].map((depth) => (
          <BallCollider key={`${horizontal}-${depth}`} args={[0.3]} position={[horizontal * 1.23, 0.17, depth * 1.02]} mass={0.05} />
        )))}
        {[-1, 1].map((side) => <CuboidCollider key={side} position={[side * 0.62, -0.55, 0]} args={[0.04, 0.04, 0.7]} mass={0.01} />)}
        <DroneModel mission={mission} />
      </RigidBody>
      <WaterParticles mission={mission} />
    </>
  );
}

function ContextGuard({ onError }: Pick<SceneProps, "onError">) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onError(true); };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onError]);
  return null;
}

function FlightScene(props: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 66, near: 0.06, far: 700, position: [0, 3.14, 14.16] }}
      frameloop={props.phase === "paused" || props.phase === "won" || props.phase === "lost" ? "demand" : "always"}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 0.95; }}
      fallback={<span>This game requires WebGL.</span>}
      aria-label="Drone irrigation flight simulation" data-testid="flight-canvas">
      <ContextGuard onError={props.onError} />
      <CameraRig mission={props.mission} mode={props.cameraMode} tilt={props.cameraTilt ?? 15} attempt={props.attempt} phase={props.phase} />
      <Suspense fallback={null}>
        <FarmLight level={props.level} />
        <Physics key={props.attempt} gravity={[0, -9.81, 0]} timeStep={STEP} paused={props.phase !== "flying"} colliders={false} interpolate>
          <FarmWorld level={props.level} mission={props.mission} />
          <Simulation level={props.level} mission={props.mission} input={props.input} onPhase={props.onPhase} onReady={props.onReady} />
        </Physics>
      </Suspense>
    </Canvas>
  );
}

export default memo(FlightScene);