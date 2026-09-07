import assert from "node:assert/strict";
import { test } from "node:test";
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { CAMERA_MOUNT, externalCamera, onboardCamera, attitudeReadout, stabilizeCamera } from "../components/game/drone-irrigation/camera.ts";
import { terrainHeight } from "../components/game/drone-irrigation/terrain.ts";

const pose = (rotation = new Quaternion()) => ({
  position: { x: 8, y: 4, z: -6 }, velocity: { x: 0, y: 0, z: 0 }, rotation, angular: { x: 0, y: 0, z: 0 },
});

test("distant terrain varies without changing the physical flight area", () => {
  for (let horizontal = -30; horizontal <= 30; horizontal += 3) for (let depth = -30; depth <= 30; depth += 3) assert.equal(terrainHeight(horizontal, depth), 0);
  assert.notEqual(terrainHeight(140, 90), terrainHeight(-140, 90));
  assert.ok(Number.isFinite(terrainHeight(220, 200)));
});

test("powered-off external view frames the whole drone on desktop and phone", () => {
  const aircraft = pose();
  for (const aspect of [1440 / 900, 390 / 844, 320 / 640]) {
    const view = externalCamera(aircraft, aspect);
    assert.ok(view.position.distanceTo(new Vector3(8, 4, -6)) > 9);
    const camera = new PerspectiveCamera(50, aspect, 0.06, 700);
    camera.position.copy(view.position); camera.quaternion.copy(view.orientation); camera.updateMatrixWorld();
    for (const horizontal of [-1.95, 1.95]) for (const vertical of [-0.6, 0.7]) for (const depth of [-1.7, 1.7]) {
      const projected = new Vector3(8 + horizontal, 4 + vertical, -6 + depth).project(camera);
      assert.ok(Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.85);
    }
  }
});

test("gimbal response is smooth, bounded, and independent of frame rate", () => {
  const target = new Quaternion().setFromEuler(new Euler(-0.2, 0.6, 0));
  const first = stabilizeCamera(new Quaternion(), target, 1 / 60);
  assert.ok(first.angleTo(new Quaternion()) < Math.PI * 0.85 / 60 + 0.0001);
  let fast = new Quaternion(); let slow = new Quaternion();
  for (let frame = 0; frame < 120; frame++) fast = stabilizeCamera(fast, target, 1 / 60);
  for (let frame = 0; frame < 60; frame++) slow = stabilizeCamera(slow, target, 1 / 30);
  assert.ok(fast.angleTo(slow) < 0.002);
  assert.ok(fast.angleTo(target) < 0.001);
  assert.ok(stabilizeCamera(first, target, 0).angleTo(first) < 0.0001);
});

test("the camera stays at the aircraft nose rather than trailing behind", () => {
  const aircraft = pose();
  const camera = onboardCamera(aircraft, "fpv", 0);
  assert.ok(camera.position.distanceTo(new Vector3(8, 4, -6)) < 0.9);
  assert.ok(Math.abs(camera.position.z - (-6 + CAMERA_MOUNT.z)) < 0.0001);
  const moved = onboardCamera({ ...aircraft, position: { x: 12, y: 7, z: 3 } }, "fpv", 0);
  assert.deepEqual(moved.position.clone().sub(camera.position).toArray().map((value) => Math.round(value)), [4, 3, 9]);
});

test("FPV follows actual pitch, roll, and yaw", () => {
  const rotation = new Quaternion().setFromEuler(new Euler(0.2, 0.8, -0.3, "YXZ"));
  const camera = onboardCamera(pose(rotation), "fpv", 0);
  assert.ok(camera.orientation.angleTo(rotation) < 0.0001);
  const expectedMount = new Vector3(CAMERA_MOUNT.x, CAMERA_MOUNT.y, CAMERA_MOUNT.z).applyQuaternion(rotation).add(new Vector3(8, 4, -6));
  assert.ok(camera.position.distanceTo(expectedMount) < 0.0001);
});

test("stabilized camera removes banking without changing aircraft heading", () => {
  const rotation = new Quaternion().setFromEuler(new Euler(0.2, 0.8, -0.3, "YXZ"));
  const camera = onboardCamera(pose(rotation), "gimbal", 0);
  const up = new Vector3(0, 1, 0).applyQuaternion(camera.orientation);
  assert.ok(up.distanceTo(new Vector3(0, 1, 0)) < 0.0001);
  const cameraForward = new Vector3(0, 0, -1).applyQuaternion(camera.orientation).setY(0).normalize();
  const aircraftForward = new Vector3(0, 0, -1).applyQuaternion(rotation).setY(0).normalize();
  assert.ok(cameraForward.distanceTo(aircraftForward) < 0.0001);
});

test("gimbal tilts to nadir for inspection directly below the aircraft", () => {
  const rotation = new Quaternion().setFromEuler(new Euler(0.15, 1.7, 0.4, "YXZ"));
  const camera = onboardCamera(pose(rotation), "gimbal", 90);
  const direction = new Vector3(0, 0, -1).applyQuaternion(camera.orientation);
  assert.ok(direction.distanceTo(new Vector3(0, -1, 0)) < 0.0001);
  assert.ok(camera.position.distanceTo(new Vector3(8, 4, -6)) < 0.9);
});

test("heading readout uses actual orientation and wraps through north", () => {
  assert.equal(attitudeReadout(pose()).heading, 0);
  assert.ok(Math.abs(attitudeReadout(pose(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2))).heading - 90) < 0.0001);
  assert.ok(attitudeReadout(pose(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.02))).heading > 358);
});