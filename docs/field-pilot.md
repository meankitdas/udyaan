# Field Pilot

Open `/drone-irrigation`. Field Pilot is an onboard drone-camera simulator that runs entirely in the browser; no account or backend is required. The display is marked SIM: it is not connected to real aircraft, GPS, or a live video feed.

## Controls

| Action | Keyboard | Touch / pointer |
| --- | --- | --- |
| Fly forward, back, sideways | W/A/S/D or arrow keys | Right stick |
| Climb / descend | R / F | Left stick vertically, or up / down buttons |
| Rotate left / right | Q / E | Left stick horizontally |
| Irrigate | Hold Space | Hold the water button |
| Brake to hover | Release movement, or hold Shift | Release joystick |
| Pause | P or Escape | Pause button |
| Camera tilt | [ / ] | Camera tilt slider |
| Level / downward camera | Camera preset buttons | Crosshair / downward-view buttons |

The aircraft starts powered off on the service pad with stopped rotors, shown from an external camera. Drag the scene to orbit around it and use the wheel or pinch to adjust distance. Take off switches immediately to the onboard camera, applies thrust, and climbs to a hover. Resetting a flight returns to the external view. Pausing holds the onboard view.

The default stabilized view follows actual aircraft heading with frame-rate-independent easing and limited gimbal rotation speed while maintaining a level horizon. The camera remains attached to the aircraft rather than trailing behind it. The optional FPV mode follows the rigid body's actual orientation, so banking tilts the horizon. The lens tilts from 10 degrees upward to 90 degrees downward; the downward preset selects stabilization for crop inspection. No artificial shake is added. The flight controller holds the requested altitude and stabilizes attitude; turn the aircraft to change its forward direction.

The display shows actual simulated heading, attitude, battery, water, coverage, flight time, home distance, ground speed, and vertical speed. Height is relative to the service-pad starting position. The map and two-stick controls can be toggled; the sticks are shown automatically on phones. Reduced-motion settings use a stabilized camera even when FPV is selected.

Fly approximately 2-4 meters above the beds and spray in slow passes. Pale green beds on the moisture map have reached the target. Excess water on a completed bed does not count toward dry beds. High flight or strong winds spread the droplets farther from the nozzles.

The blue H on the map marks the service pad. Descend below 1.15 meters, slow below 0.8 m/s, and stop spraying to refill, recharge, and repair. The mission timer continues during servicing. Battery depletion, excessive impact damage, water contact, or a timeout ends the mission. Pause, tab hiding, and window focus loss stop the simulation.

## Missions

| Mission | Beds required | Nominal wind | Tank | Time |
| --- | --- | --- | --- | --- |
| First Flight | 11 / 12 | 0.3 m/s | 22 L | 3:00 |
| Across the Wind | 22 / 24 | 2.2 m/s | 20 L | 3:30 |
| Orchard Run | 34 / 36 | 3.2 m/s | 18 L | 4:00 |
| Narrow Margins | 46 / 48 | 4.1 m/s | 16 L | 4:30 |
| Gust Front | 61 / 64 | 5.4 m/s | 14 L | 7:00 |

Gust strength, irrigation demand, and battery drain also increase. All five assignments are selectable from Field plans. The interface records completed operations and shows a flight report instead of a game-style star screen. Existing progress is retained in local storage under `udyaan.field-pilot.v1`.

## Simulation

- Three.js and React Three Fiber render the farm, foliage, drone, shadows, sky, and water.
- A photographic HDR sky lights the scene and supplies environment reflections. Optimized PBR tree models, textured ground, normal maps, short instanced grass, and distant terrain replace the original flat vegetation and horizon. The distant hills do not change the collision geometry in the playable area.
- Trees, crops, and grass animate in the wind; crop and grass shadow geometry follows the same deformation. Low-altitude rotor wash disturbs foliage and produces a subtle dust effect.
- The irrigation channel uses a 512-pixel planar reflection of the scene with wind and rotor ripples. Soil darkens and becomes glossier as actual moisture accumulates. Metal surfaces reflect the HDR environment.
- Rapier integrates a dynamic rigid body at a fixed 1/60-second timestep, with gravity, collision detection, inertia, thrust, and attitude torque. Flight never teleports the aircraft or directly overwrites its velocity.
- A simplified cascaded controller converts pilot velocity requests into a desired thrust vector and quaternion attitude. Yaw-rate feed-forward reduces lag when turning and stopping. Motor thrust has a response lag; aerodynamic drag depends on velocity relative to the wind.
- Water contributes to rigid-body mass and changes battery demand as the tank empties. Service stops restore payload mass.
- Droplets inherit nozzle position, drone orientation, and aircraft velocity. Gravity and air resistance move them until they intersect a crop bed or an obstacle. Only actual ground deposition adds moisture; out-of-bounds and already-saturated water is wasted.
- Ground impacts create short-lived splash rings and secondary droplets without adding to the delivered-water total. Spray particles represent groups of droplets, not a fluid-dynamics solver.
- Render resolution is capped at 1.5 device pixel ratio. Crops and distant trees are instanced, and paused or finished scenes use on-demand rendering. Reduced-motion settings stabilize the camera and remove decorative loading motion.

This is an independent, DJI-inspired, physics-informed browser simulator, not official DJI software, a hardware-calibrated flight trainer, or an agronomic prescription. Water dose, tank capacity, field size, and mission time are scaled for the browser experience. Rotor mixing, fluid dynamics, and real crop water requirements are simplified. Rendering quality and frame rate depend on the device and browser GPU.

## Research and Assets

- [Rapier forces and impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/): force-based integration and persistent-force resets.
- [React Three Rapier](https://pmndrs.github.io/react-three-rapier/): fixed timesteps, physics hooks, colliders, and collision callbacks.
- [PX4 multicopter controller diagrams](https://docs.px4.io/main/en/flight_stack/controller_diagrams.html): cascaded velocity, attitude, and thrust control concepts.
- [DJI gimbal guidance](https://developer.dji.com/doc/payload-sdk-tutorial/en/function-set/basic-function/gimbal-function.html): yaw-follow behavior, smoothness, and rotation-speed limits. These concepts inform the camera; no DJI firmware is used.
- [Evaluation of spray drift in agricultural UAV spraying](https://ijiaar.penpublishing.net/makale/8210): wind, operating height, and droplet distribution.
- Local terrain, tree, and HDR assets: [asset credits](../public/drone-irrigation/CREDITS.md), licensed CC0 by Poly Haven. All runtime assets are local; the browser does not need Poly Haven access.

To regenerate the optimized tree from its source without adding application dependencies:

```sh
node scripts/prepare-drone-assets.mjs
npx --yes @gltf-transform/cli@4.3.0 optimize /tmp/udyaan-tree-source/tree.gltf public/drone-irrigation/tree.glb --compress false --texture-size 512 --texture-compress webp --simplify-ratio 0.04 --simplify-error 0.01 --instance false
```

## Validation

Node.js 22.18+ (native TypeScript stripping) is required for the simulation tests:

```sh
npm run typecheck -- --incremental false
npm run test:drone
```

The 28 simulation and camera tests cover pad takeoff, hover stability, momentum, braking, altitude, yaw tracking and stopping, payload, wind, water conservation, service conditions, splash lifecycle, water contact, pause, completion, failures, saved data, complete flown solutions to all five assignments, external-camera framing, camera damping, terrain alignment, FPV orientation, stabilization, nadir view, and compass heading.

`tests/drone-browser-checks.js` is a self-contained async Playwright page function. With the site running and a Playwright MCP page open on its origin, execute it using `browser_run_code` with the file's absolute path as `filename`. It checks graphics readiness, keyboard and pointer flight, irrigation, pause/resume, retries, cameras, all missions, and desktop/mobile screenshot pixels. Screenshots are written to `/tmp/field-pilot-*.png`.

`tests/drone-completion-check.js` flies the first assignment using the on-screen joystick and spray key without changing simulation state. It verifies actual completion, the flight report, saved progress, next-assignment navigation, and persistence after a reload.