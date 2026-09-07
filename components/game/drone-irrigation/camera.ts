import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Pose } from "./simulation";

export type CameraMode = "fpv" | "gimbal";
export const CAMERA_MOUNT = { x: 0, y: -0.06, z: -0.84 };

export function externalCamera(pose: Pose, aspect: number) {
  const distance = aspect < 0.8 ? 1.55 : 1;
  const target = new Vector3(pose.position.x, pose.position.y + 0.15, pose.position.z - 1.3);
  const position = new Vector3(pose.position.x + 6.6 * distance, pose.position.y + 5.5 * distance, pose.position.z + 8.5 * distance);
  const orientation = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)));
  return { position, target, orientation };
}

export function stabilizeCamera(previous: Quaternion, target: Quaternion, delta: number) {
  const elapsed = Math.max(0, Math.min(delta, 0.1));
  const angle = previous.angleTo(target);
  const movement = Math.min(angle * (1 - Math.exp(-8 * elapsed)), Math.PI * 0.85 * elapsed);
  return previous.clone().rotateTowards(target, movement);
}

export function onboardCamera(pose: Pose, mode: CameraMode, tilt: number) {
  const attitude = new Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w).normalize();
  const position = new Vector3(CAMERA_MOUNT.x, CAMERA_MOUNT.y, CAMERA_MOUNT.z)
    .applyQuaternion(attitude).add(new Vector3(pose.position.x, pose.position.y, pose.position.z));
  const forward = new Vector3(0, 0, -1).applyQuaternion(attitude);
  const yaw = Math.atan2(-forward.x, -forward.z);
  const orientation = mode === "fpv" ? attitude : new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
  orientation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.max(-10, Math.min(90, tilt)) * Math.PI / 180));
  return { position, orientation };
}

export function attitudeReadout(pose: Pose) {
  const attitude = new Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w).normalize();
  const forward = new Vector3(0, 0, -1).applyQuaternion(attitude);
  const rotation = new Euler().setFromQuaternion(attitude, "YXZ");
  const heading = ((Math.atan2(forward.x, -forward.z) * 180 / Math.PI) + 360) % 360;
  return { heading, pitch: rotation.x * 180 / Math.PI, roll: rotation.z * 180 / Math.PI };
}