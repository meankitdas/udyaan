import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  LEVELS, HOME, STEP, DRY_MASS, GRAVITY, WET_TARGET, IRRIGATION_CHANNEL, clamp, createMission, idleInput,
  flightForces, advanceMission, depositWater, registerImpact, missionStars, parseProgress, windAt,
} from "../components/game/drone-irrigation/simulation.ts";

const require = createRequire(import.meta.url);
const rapierRequire = createRequire(require.resolve("@react-three/rapier"));
const RAPIER = rapierRequire("@dimforge/rapier3d-compat");
await RAPIER.init();

function flight(level = LEVELS[0]) {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = STEP;
  const mission = createMission(level);
  mission.phase = "flying";
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(HOME.x, 3.2, HOME.z).setAdditionalMass(level.tank).setCanSleep(false));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.8, 0.27, 0.65).setMass(DRY_MASS), body);
  world.createCollider(RAPIER.ColliderDesc.cuboid(250, 0.5, 250).setTranslation(0, -0.5, 0));
  for (const obstacle of level.obstacles) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(obstacle.width / 2, obstacle.height / 2, obstacle.depth / 2)
      .setTranslation(obstacle.x, (obstacle.base ?? 0) + obstacle.height / 2, obstacle.z));
  }
  let tankMass = level.tank;
  const pose = () => ({ position: body.translation(), velocity: body.linvel(), rotation: body.rotation(), angular: body.angvel() });
  const step = (input = idleInput(), frames = 1) => {
    for (let frame = 0; frame < frames; frame++) {
      if (Math.abs(tankMass - mission.water) > 0.08) {
        body.setAdditionalMass(mission.water, true);
        body.recomputeMassPropertiesFromColliders();
        tankMass = mission.water;
      }
      const forces = flightForces(mission, level, input, pose(), body.mass());
      body.resetForces(false);
      body.resetTorques(false);
      body.addForce(forces.force, true);
      body.addTorque(forces.torque, true);
      world.step();
      advanceMission(mission, level, input, pose());
    }
  };
  return { world, mission, body, step };
}

test("five missions increase bed count, wind, water demand, and resource pressure", () => {
  assert.equal(LEVELS.length, 5);
  LEVELS.slice(1).forEach((level, index) => {
    const previous = LEVELS[index];
    assert.ok(createMission(level).beds.length > createMission(previous).beds.length);
    assert.ok(level.wind > previous.wind && level.gust > previous.gust);
    assert.ok(level.dose > previous.dose && level.tank < previous.tank);
    assert.ok(level.drain > previous.drain);
  });
});

test("takeoff lifts the aircraft from the service pad without teleporting", () => {
  const run = flight();
  assert.equal(createMission(LEVELS[0]).pose.position.y, HOME.y);
  run.body.setTranslation({ ...HOME }, true);
  run.step(idleInput(), 1);
  assert.ok(run.body.translation().y < HOME.y + 0.05);
  run.step(idleInput(), 240);
  assert.ok(Math.abs(run.body.translation().y - 3.2) < 0.15);
  run.world.free();
});

test("Rapier hover controller balances gravity with a full tank", () => {
  const run = flight();
  run.step(idleInput(), 600);
  assert.ok(Math.abs(run.body.translation().y - 3.2) < 0.15);
  assert.ok(Math.hypot(run.body.linvel().x, run.body.linvel().z) < 0.15);
  assert.ok(run.mission.integrity === 100 && run.mission.phase === "flying");
  run.world.free();
});

test("movement uses tilt and inertia, then brakes to a hover", () => {
  const run = flight();
  run.step({ ...idleInput(), forward: 1 }, 120);
  assert.ok(run.body.translation().z < HOME.z - 3);
  assert.ok(Math.abs(run.body.rotation().x) > 0.005);
  const beforeRelease = run.body.translation().z;
  run.step(idleInput(), 15);
  assert.ok(run.body.translation().z < beforeRelease);
  run.step(idleInput(), 300);
  assert.ok(Math.abs(run.body.linvel().z) < 0.12);
  assert.ok(run.body.translation().y > 2.7 && run.body.translation().y < 3.7);
  run.world.free();
});

test("altitude and yaw respond without teleporting the body", () => {
  const run = flight();
  run.step({ ...idleInput(), lift: 1, yaw: 0.5 }, 100);
  assert.ok(run.body.translation().y > 5 && run.body.translation().y < 8);
  assert.ok(Math.abs(run.body.rotation().y) > 0.2);
  run.step(idleInput(), 180);
  assert.ok(Math.abs(run.body.linvel().y) < 0.1);
  run.world.free();
});

test("full tank requires more hover thrust and gusts remain finite", () => {
  const state = createMission(LEVELS[4]);
  const heavy = flightForces(state, LEVELS[4], idleInput(), state.pose, DRY_MASS + LEVELS[4].tank);
  const empty = createMission(LEVELS[4]);
  empty.thrust = DRY_MASS * GRAVITY;
  const light = flightForces(empty, LEVELS[4], idleInput(), empty.pose, DRY_MASS);
  assert.ok(heavy.force.y > light.force.y);
  const run = flight(LEVELS[4]);
  run.step(idleInput(), 900);
  assert.ok(Math.abs(run.body.translation().y - 3.2) < 0.3);
  assert.ok(Math.abs(run.body.translation().x) < 12);
  assert.notDeepEqual(windAt(LEVELS[4], 0), windAt(LEVELS[4], 5));
  run.world.free();
});

test("yaw follows the stick rate and stops promptly when released", () => {
  const run = flight();
  run.step({ ...idleInput(), yaw: 1 }, 100);
  const before = run.body.rotation();
  const beforeHeading = 2 * Math.atan2(before.y, before.w);
  assert.ok(Math.abs(beforeHeading - run.mission.heading) < 0.14);
  run.step(idleInput(), 120);
  const after = run.body.rotation();
  const afterHeading = 2 * Math.atan2(after.y, after.w);
  assert.ok(Math.abs(afterHeading - beforeHeading) < 0.15);
  assert.ok(Math.abs(run.body.angvel().y) < 0.03);
  run.world.free();
});

test("spray consumes conserved water and only wets beds after droplets land", () => {
  const level = LEVELS[0];
  const state = createMission(level);
  state.phase = "flying";
  const pose = { ...state.pose, position: { x: 0, y: 3.2, z: 0 } };
  const input = { ...idleInput(), spray: true };
  advanceMission(state, level, input, pose);
  assert.equal(state.delivered, 0);
  for (let frame = 0; frame < 180; frame++) advanceMission(state, level, input, pose);
  assert.ok(state.delivered > 0 && state.beds.some((bed) => bed.moisture > 0));
  assert.ok(Math.abs(level.tank - state.water - state.used) < 0.00001);
  assert.ok(state.delivered <= state.used);
  const outside = createMission(level);
  depositWater(outside, level, 100, 100, 4);
  assert.equal(outside.delivered, 0);
});

test("service pad refills only during a slow landing", () => {
  const level = LEVELS[2];
  const state = createMission(level);
  state.phase = "flying"; state.water = 2; state.battery = 20;
  const landed = { ...state.pose, position: { ...HOME } };
  for (let frame = 0; frame < 180; frame++) advanceMission(state, level, idleInput(), landed);
  assert.ok(state.servicing && state.water > 10 && state.battery > 45);
  const water = state.water;
  advanceMission(state, level, idleInput(), { ...landed, position: { ...HOME, y: 3 } });
  assert.equal(state.water, water);
  assert.equal(state.servicing, false);
});

test("spray impacts appear only after landing and expire without adding water", () => {
  const level = LEVELS[0];
  const state = createMission(level); state.phase = "flying";
  const pose = { ...state.pose, position: { x: 0, y: 3.2, z: 0 } };
  advanceMission(state, level, { ...idleInput(), spray: true }, pose);
  assert.equal(state.splashes.length, 0);
  for (let frame = 0; frame < 120; frame++) advanceMission(state, level, { ...idleInput(), spray: true }, pose);
  assert.ok(state.splashes.length > 0 && state.splashes.length <= 96);
  assert.ok(state.splashes.every((splash) => splash.age <= 0.55));
  for (let frame = 0; frame < 420; frame++) advanceMission(state, level, idleInput(), pose);
  assert.equal(state.splashes.length, 0);
  assert.ok(state.delivered <= state.used);
});

test("flying above the channel is safe but landing in water ends the flight", () => {
  const level = LEVELS[0];
  const state = createMission(level); state.phase = "flying";
  advanceMission(state, level, idleInput(), { ...state.pose, position: { x: IRRIGATION_CHANNEL.x, y: 3, z: 0 } });
  assert.equal(state.phase, "flying");
  advanceMission(state, level, idleInput(), { ...state.pose, position: { x: IRRIGATION_CHANNEL.x, y: 0.7, z: 0 } });
  assert.equal(state.reason, "Water contact");
  assert.equal(state.phase, "lost");
});

test("pause freezes timer, resources, and droplets", () => {
  const level = LEVELS[0];
  const state = createMission(level);
  state.phase = "paused";
  const before = JSON.stringify(state);
  for (let frame = 0; frame < 60; frame++) advanceMission(state, level, { ...idleInput(), spray: true }, state.pose);
  assert.equal(JSON.stringify(state), before);
});

test("all five objectives can be completed, capped beds cannot replace dry ones", () => {
  for (const level of LEVELS) {
    const state = createMission(level);
    state.phase = "flying";
    depositWater(state, level, state.beds[0].x, state.beds[0].z, 100);
    advanceMission(state, level, idleInput(), state.pose);
    assert.equal(state.phase, "flying");
    state.beds.slice(0, state.goal).forEach((bed) => depositWater(state, level, bed.x, bed.z, level.dose * WET_TARGET + 0.01));
    state.used = state.delivered;
    advanceMission(state, level, idleInput(), state.pose);
    assert.equal(state.phase, "won");
    assert.equal(missionStars(state, level), 3);
  }
});

test("crashes, battery depletion, and timeout end missions", () => {
  const level = LEVELS[0];
  const crash = createMission(level); crash.phase = "flying";
  registerImpact(crash, 1, true);
  assert.equal(crash.integrity, 100);
  registerImpact(crash, 10, false);
  assert.equal(crash.phase, "lost");
  const battery = createMission(level); battery.phase = "flying"; battery.battery = 0;
  advanceMission(battery, level, idleInput(), battery.pose);
  assert.equal(battery.reason, "Battery depleted");
  const time = createMission(level); time.phase = "flying"; time.elapsed = level.duration;
  advanceMission(time, level, idleInput(), time.pose);
  assert.equal(time.reason, "Mission time elapsed");
});

test("saved scores reject malformed and out-of-range progress", () => {
  assert.deepEqual(parseProgress("broken"), {});
  assert.deepEqual(parseProgress('[1,2,3]'), {});
  assert.deepEqual(parseProgress('{"1":3,"2":-1,"3":"2","4":2,"6":3}'), { 1: 3, 4: 2 });
});

for (const level of LEVELS) {
  test(`mission ${level.id} is achievable through real flight, spray, and service stops`, () => {
    const run = flight(level);
    let target = run.mission.beds[0];
    let stage = "climb";
    let servicing = false;
    let anchor = { x: HOME.x, z: HOME.z };
    let serviceVisits = 0;
    while (run.mission.phase === "flying") {
      const state = run.mission;
      const position = run.body.translation();
      if (!servicing && (state.water < 0.3 || state.battery < 23)) {
        servicing = true; stage = "climb"; anchor = { x: position.x, z: position.z }; serviceVisits++;
      }
      const destination = servicing ? HOME : { x: target.x - state.wind.x * 0.16, z: target.z - state.wind.z * 0.16 };
      let horizontal = destination.x;
      let depth = destination.z;
      let altitude = servicing ? HOME.y : 3.2;
      let spray = false;
      if (stage === "climb") {
        horizontal = anchor.x; depth = anchor.z; altitude = 7;
        if (position.y > 6.7) stage = "cruise";
      } else if (stage === "cruise") {
        altitude = 7;
        if (Math.hypot(destination.x - position.x, destination.z - position.z) < 0.6) stage = "descend";
      } else if (stage === "descend") {
        if (Math.abs(position.y - altitude) < 0.3) stage = servicing ? "service" : "water";
      } else if (stage === "service") {
        if (state.water >= level.tank - 0.02 && state.battery >= 99) {
          servicing = false; stage = "climb"; anchor = { x: HOME.x, z: HOME.z };
        }
      } else {
        spray = Math.hypot(destination.x - position.x, destination.z - position.z) < 1;
        if (target.moisture >= WET_TARGET) {
          const next = state.beds.filter((bed) => bed.moisture < WET_TARGET)
            .sort((first, second) => Math.hypot(first.x - position.x, first.z - position.z) - Math.hypot(second.x - position.x, second.z - position.z))[0];
          if (next) {
            const sameField = level.fields.some((field) => [target, next].every((bed) => Math.abs(field.x - bed.x) < field.columns * 1.2 && Math.abs(field.z - bed.z) < field.rows * 1.2));
            if (!sameField) { stage = "climb"; anchor = { x: position.x, z: position.z }; }
            target = next;
          }
        }
      }
      run.step({ ...idleInput(), sideways: clamp((horizontal - position.x) * 0.32, -1, 1), forward: clamp((position.z - depth) * 0.32, -1, 1),
        lift: clamp((altitude - state.altitudeTarget) * 2, -1, 1), spray });
    }
    const evidence = { level: level.id, elapsed: Math.round(run.mission.elapsed), completed: run.mission.completed, goal: run.mission.goal,
      waterUsed: Math.round(run.mission.used), serviceVisits, reason: run.mission.reason, stage, position: run.body.translation() };
    assert.equal(run.mission.phase, "won", JSON.stringify(evidence));
    assert.ok(run.mission.delivered > 0 && run.mission.used > run.mission.delivered);
    run.world.free();
  });
}