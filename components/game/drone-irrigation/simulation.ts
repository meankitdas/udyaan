import { Quaternion, Vector3 } from "three";

export const STEP = 1 / 60;
export const GRAVITY = 9.81;
export const DRY_MASS = 14;
export const MAX_DROPS = 480;
export const BED_SIZE = 2.4;
export const HOME = { x: 0, y: 0.72, z: 15 };
export const WET_TARGET = 0.72;
export const IRRIGATION_CHANNEL = { x: 16, z: 0, width: 2.2, length: 42, surface: 0.065 };

export type Vector = { x: number; y: number; z: number };
export type FlightInput = { sideways: number; forward: number; lift: number; yaw: number; spray: boolean; brake: boolean };
export type Obstacle = { x: number; z: number; width: number; depth: number; height: number; base?: number; kind: "tree" | "tank" | "gantry" };
export type Field = { x: number; z: number; columns: number; rows: number };
export type Level = {
  id: number;
  name: string;
  location: string;
  difficulty: string;
  wind: number;
  gust: number;
  direction: number;
  duration: number;
  tank: number;
  dose: number;
  goal: number;
  drain: number;
  light: "morning" | "day" | "late" | "overcast";
  fields: Field[];
  obstacles: Obstacle[];
};

export const LEVELS: Level[] = [
  {
    id: 1, name: "First Flight", location: "The nursery", difficulty: "Gentle",
    wind: 0.3, gust: 0.1, direction: 0.1, duration: 180, tank: 22, dose: 0.32, goal: 0.88, drain: 0.27, light: "morning",
    fields: [{ x: 0, z: 0, columns: 3, rows: 4 }], obstacles: [],
  },
  {
    id: 2, name: "Across the Wind", location: "East paddock", difficulty: "Moderate",
    wind: 2.2, gust: 0.8, direction: 0.25, duration: 210, tank: 20, dose: 0.38, goal: 0.9, drain: 0.3, light: "day",
    fields: [{ x: -5.5, z: 0, columns: 3, rows: 4 }, { x: 5.5, z: 0, columns: 3, rows: 4 }],
    obstacles: [{ x: 0, z: -4, width: 1.8, depth: 1.8, height: 3.1, kind: "tank" }],
  },
  {
    id: 3, name: "Orchard Run", location: "The western grove", difficulty: "Challenging",
    wind: 3.2, gust: 1.2, direction: -0.65, duration: 240, tank: 18, dose: 0.44, goal: 0.92, drain: 0.34, light: "day",
    fields: [{ x: -7, z: 1, columns: 3, rows: 4 }, { x: 7, z: 1, columns: 3, rows: 4 }, { x: 0, z: -10.5, columns: 3, rows: 4 }],
    obstacles: [
      { x: 0, z: 1, width: 2.8, depth: 2.8, height: 5.5, kind: "tree" },
      { x: -12.5, z: -5, width: 2.5, depth: 2.5, height: 5, kind: "tree" },
      { x: 12.5, z: -5, width: 2.5, depth: 2.5, height: 5, kind: "tree" },
    ],
  },
  {
    id: 4, name: "Narrow Margins", location: "The irrigation terraces", difficulty: "Demanding",
    wind: 4.1, gust: 1.9, direction: 0.8, duration: 270, tank: 16, dose: 0.5, goal: 0.94, drain: 0.37, light: "late",
    fields: [-6, 6].flatMap((x) => [-7, 5].map((z) => ({ x, z, columns: 3, rows: 4 }))),
    obstacles: [
      { x: -6, z: -1, width: 9.2, depth: 0.4, height: 0.45, base: 5.2, kind: "gantry" },
      { x: 6, z: -1, width: 9.2, depth: 0.4, height: 0.45, base: 5.2, kind: "gantry" },
      { x: 0, z: -9, width: 2, depth: 2, height: 3.3, kind: "tank" },
      { x: 0, z: 5, width: 2, depth: 2, height: 3.3, kind: "tank" },
    ],
  },
  {
    id: 5, name: "Gust Front", location: "The north farm", difficulty: "Expert",
    wind: 5.4, gust: 2.5, direction: -0.3, duration: 420, tank: 14, dose: 0.56, goal: 0.95, drain: 0.4, light: "overcast",
    fields: [-7, 7].flatMap((x) => [-7, 5].map((z) => ({ x, z, columns: 4, rows: 4 }))),
    obstacles: [
      { x: -7, z: -1, width: 10.8, depth: 0.4, height: 0.45, base: 5, kind: "gantry" },
      { x: 7, z: -1, width: 10.8, depth: 0.4, height: 0.45, base: 5, kind: "gantry" },
      { x: 0, z: 5, width: 2.6, depth: 2.6, height: 5.5, kind: "tree" },
      { x: 0, z: -8, width: 2.6, depth: 2.6, height: 5.5, kind: "tree" },
      { x: -14, z: 0, width: 2, depth: 2, height: 3.5, kind: "tank" },
    ],
  },
];

export type Bed = { x: number; z: number; moisture: number };
export type Droplet = Vector & { velocity: Vector; liters: number; age: number };
export type Splash = Vector & { age: number; strength: number };
export type Pose = { position: Vector; velocity: Vector; rotation: { x: number; y: number; z: number; w: number }; angular: Vector };
export type Phase = "ready" | "flying" | "paused" | "won" | "lost";
export type Mission = {
  phase: Phase;
  reason: string;
  elapsed: number;
  water: number;
  battery: number;
  integrity: number;
  used: number;
  delivered: number;
  beds: Bed[];
  goal: number;
  completed: number;
  drops: Droplet[];
  splashes: Splash[];
  emission: number;
  sequence: number;
  altitudeTarget: number;
  heading: number;
  thrust: number;
  spraying: boolean;
  servicing: boolean;
  serviceTime: number;
  lastImpact: number;
  pose: Pose;
  wind: Vector;
};

export const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
export const idleInput = (): FlightInput => ({ sideways: 0, forward: 0, lift: 0, yaw: 0, spray: false, brake: false });
export const randomUnit = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };

export function createMission(level: Level): Mission {
  const beds = level.fields.flatMap((field) => Array.from({ length: field.columns * field.rows }, (_, index) => ({
    x: field.x + (index % field.columns - (field.columns - 1) / 2) * BED_SIZE,
    z: field.z + (Math.floor(index / field.columns) - (field.rows - 1) / 2) * BED_SIZE,
    moisture: 0,
  })));
  return {
    phase: "ready", reason: "", elapsed: 0, water: level.tank, battery: 100, integrity: 100,
    used: 0, delivered: 0, beds, goal: Math.ceil(beds.length * level.goal), completed: 0,
    drops: [], splashes: [], emission: 0, sequence: 0, altitudeTarget: 3.2, heading: 0,
    thrust: (DRY_MASS + level.tank) * GRAVITY, spraying: false, servicing: false, serviceTime: 0, lastImpact: -10,
    pose: { position: { ...HOME }, velocity: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, angular: { x: 0, y: 0, z: 0 } },
    wind: { x: level.wind, y: 0, z: 0 },
  };
}

export function windAt(level: Level, elapsed: number): Vector {
  const strength = level.wind + level.gust * (Math.sin(elapsed * 0.73) * 0.65 + Math.sin(elapsed * 1.39 + 0.8) * 0.35);
  const direction = level.direction + Math.sin(elapsed * 0.24) * 0.22;
  return { x: Math.cos(direction) * strength, y: 0, z: Math.sin(direction) * strength };
}

export function flightForces(mission: Mission, level: Level, input: FlightInput, pose: Pose, mass: number, delta = STEP) {
  mission.heading += input.yaw * 1.25 * delta;
  mission.altitudeTarget = clamp(mission.altitudeTarget + input.lift * 2.6 * delta, HOME.y, 12);
  mission.wind = windAt(level, mission.elapsed);
  const rotation = new Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
  const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
  const speed = input.brake ? 0 : 4.8;
  const length = Math.max(1, Math.hypot(input.sideways, input.forward));
  const side = input.sideways / length * speed;
  const forward = input.forward / length * speed;
  let targetX = side * Math.cos(mission.heading) - forward * Math.sin(mission.heading);
  let targetZ = -forward * Math.cos(mission.heading) - side * Math.sin(mission.heading);
  if (Math.abs(pose.position.x) > 25) targetX = -Math.sign(pose.position.x) * 3;
  if (pose.position.z < -22 || pose.position.z > 24) targetZ = pose.position.z < -22 ? 3 : -3;
  const accelerationX = clamp((targetX - pose.velocity.x) * 1.8, -5.5, 5.5);
  const accelerationZ = clamp((targetZ - pose.velocity.z) * 1.8, -5.5, 5.5);
  const accelerationY = clamp((mission.altitudeTarget - pose.position.y) * 4 - pose.velocity.y * 3.4, -5, 6);
  const desiredUp = new Vector3(accelerationX, GRAVITY + accelerationY, accelerationZ).normalize();
  const desired = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), desiredUp)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), mission.heading));
  const error = desired.multiply(rotation.clone().invert());
  const sign = error.w < 0 ? -1 : 1;
  const inertia = mass * 0.34;
  const torque = {
    x: inertia * (error.x * sign * 24 - pose.angular.x * 6),
    y: inertia * (error.y * sign * 18 + (input.yaw * 1.25 - pose.angular.y) * 5),
    z: inertia * (error.z * sign * 24 - pose.angular.z * 6),
  };
  const requestedThrust = clamp(mass * (GRAVITY + accelerationY) / Math.max(0.5, up.y), 0, 650);
  mission.thrust += (requestedThrust - mission.thrust) * (1 - Math.exp(-delta / 0.13));
  const relative = new Vector3(pose.velocity.x - mission.wind.x, pose.velocity.y, pose.velocity.z - mission.wind.z);
  const drag = relative.clone().multiplyScalar(-0.5 * 1.225 * 0.38 * relative.length());
  const force = up.multiplyScalar(mission.thrust).add(drag);
  return { force: { x: force.x, y: force.y, z: force.z }, torque };
}

export function depositWater(mission: Mission, level: Level, x: number, z: number, liters: number) {
  const bed = mission.beds.find((candidate) => Math.abs(candidate.x - x) <= BED_SIZE / 2 && Math.abs(candidate.z - z) <= BED_SIZE / 2);
  if (!bed) return;
  const absorbed = Math.min(liters, Math.max(0, 1 - bed.moisture) * level.dose);
  bed.moisture = clamp(bed.moisture + absorbed / level.dose, 0, 1);
  mission.delivered += absorbed;
}

function blocked(drop: Droplet, obstacles: Obstacle[]) {
  return obstacles.some((obstacle) => drop.y >= (obstacle.base ?? 0) && drop.y <= (obstacle.base ?? 0) + obstacle.height &&
    Math.abs(drop.x - obstacle.x) < obstacle.width / 2 && Math.abs(drop.z - obstacle.z) < obstacle.depth / 2);
}

function emitWater(mission: Mission, delta: number) {
  mission.emission += delta * 120;
  const rotation = new Quaternion(mission.pose.rotation.x, mission.pose.rotation.y, mission.pose.rotation.z, mission.pose.rotation.w);
  while (mission.emission >= 1 && mission.water > 0 && mission.drops.length < MAX_DROPS) {
    mission.emission -= 1;
    const sequence = mission.sequence++;
    const nozzle = sequence % 2 ? 0.95 : -0.95;
    const offset = new Vector3(nozzle, -0.4, 0).applyQuaternion(rotation);
    const velocity = new Vector3((randomUnit(sequence) - 0.5) * 5.5, -3.8, (randomUnit(sequence + 800) - 0.5) * 3.8).applyQuaternion(rotation);
    const liters = Math.min(mission.water, 1.6 / 120);
    mission.water = Math.max(0, mission.water - liters);
    mission.used += liters;
    mission.drops.push({
      x: mission.pose.position.x + offset.x, y: mission.pose.position.y + offset.y, z: mission.pose.position.z + offset.z,
      velocity: { x: velocity.x + mission.pose.velocity.x, y: velocity.y + mission.pose.velocity.y, z: velocity.z + mission.pose.velocity.z },
      liters, age: 0,
    });
  }
}

export function advanceMission(mission: Mission, level: Level, input: FlightInput, pose: Pose, delta = STEP) {
  if (mission.phase !== "flying") return;
  mission.pose = pose;
  mission.elapsed += delta;
  mission.wind = windAt(level, mission.elapsed);
  const speed = Math.hypot(pose.velocity.x, pose.velocity.y, pose.velocity.z);
  const atHome = Math.hypot(pose.position.x - HOME.x, pose.position.z - HOME.z) < 2.5 && pose.position.y < 1.15 && speed < 0.8;
  mission.serviceTime = atHome && !input.spray && input.lift <= 0 ? mission.serviceTime + delta : 0;
  mission.servicing = mission.serviceTime > 0.4;
  if (mission.servicing) {
    mission.water = Math.min(level.tank, mission.water + 4.5 * delta);
    mission.battery = Math.min(100, mission.battery + 13 * delta);
    mission.integrity = Math.min(100, mission.integrity + 5 * delta);
  } else {
    const load = Math.pow(mission.thrust / (DRY_MASS * GRAVITY), 1.5);
    mission.battery = Math.max(0, mission.battery - level.drain * (0.5 + load * 0.3) * delta);
  }
  mission.spraying = input.spray && mission.water > 0 && pose.position.y > 1.3 && pose.position.y < 10 && !mission.servicing;
  if (mission.spraying) emitWater(mission, delta);
  else mission.emission = 0;

  for (let index = mission.splashes.length - 1; index >= 0; index--) {
    const splash = mission.splashes[index];
    splash.age += delta;
    if (splash.age > 0.55) {
      mission.splashes[index] = mission.splashes[mission.splashes.length - 1];
      mission.splashes.pop();
    }
  }

  for (let index = mission.drops.length - 1; index >= 0; index--) {
    const drop = mission.drops[index];
    drop.velocity.x += (mission.wind.x - drop.velocity.x) * 0.9 * delta;
    drop.velocity.z += (mission.wind.z - drop.velocity.z) * 0.9 * delta;
    drop.velocity.y += (-GRAVITY - 0.12 * drop.velocity.y * Math.abs(drop.velocity.y)) * delta;
    drop.x += drop.velocity.x * delta;
    drop.y += drop.velocity.y * delta;
    drop.z += drop.velocity.z * delta;
    drop.age += delta;
    const hitObstacle = blocked(drop, level.obstacles);
    if (drop.y <= 0.25 || hitObstacle || drop.age > 6) {
      if (drop.y <= 0.25 && !hitObstacle) {
        depositWater(mission, level, drop.x, drop.z, drop.liters);
        if (mission.splashes.length < 96) mission.splashes.push({ x: drop.x, y: 0.09, z: drop.z, age: 0, strength: Math.min(1, Math.abs(drop.velocity.y) / 7) });
      }
      mission.drops[index] = mission.drops[mission.drops.length - 1];
      mission.drops.pop();
    }
  }
  mission.completed = mission.beds.filter((bed) => bed.moisture >= WET_TARGET).length;
  const touchedWater = Math.abs(pose.position.x - IRRIGATION_CHANNEL.x) < IRRIGATION_CHANNEL.width / 2 + 0.4 &&
    Math.abs(pose.position.z - IRRIGATION_CHANNEL.z) < IRRIGATION_CHANNEL.length / 2 && pose.position.y < 0.8;
  if (touchedWater) { mission.phase = "lost"; mission.reason = "Water contact"; }
  else if (mission.integrity <= 0) { mission.phase = "lost"; mission.reason = "Airframe damaged"; }
  else if (mission.battery <= 0) { mission.phase = "lost"; mission.reason = "Battery depleted"; }
  else if (mission.elapsed >= level.duration) { mission.phase = "lost"; mission.reason = "Mission time elapsed"; }
  else if (mission.completed >= mission.goal) { mission.phase = "won"; mission.reason = "Irrigation complete"; }
  if (mission.phase !== "flying") mission.spraying = false;
}

export function registerImpact(mission: Mission, speed: number, ground: boolean) {
  if (mission.phase !== "flying" || mission.elapsed - mission.lastImpact < 0.7 || (ground && speed < 1.8)) return;
  mission.lastImpact = mission.elapsed;
  mission.integrity = Math.max(0, mission.integrity - Math.max(8, (speed - 0.7) * 15));
  if (mission.integrity === 0) { mission.phase = "lost"; mission.reason = "Airframe damaged"; mission.spraying = false; }
}

export function missionStars(mission: Mission, level: Level) {
  if (mission.phase !== "won") return 0;
  return 1 + Number(mission.integrity >= 75) + Number(mission.delivered / Math.max(0.01, mission.used) >= 0.32 && mission.elapsed < level.duration * 0.85);
}

export type Progress = Record<string, number>;
export const SAVE_KEY = "udyaan.field-pilot.v1";
export function parseProgress(raw: string | null): Progress {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, stars]) => LEVELS.some((level) => String(level.id) === key) && Number.isInteger(stars) && stars >= 1 && stars <= 3));
  } catch { return {}; }
}