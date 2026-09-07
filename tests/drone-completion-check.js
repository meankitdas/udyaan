async (page) => {
  const origin = await page.evaluate(() => location.origin);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/drone-irrigation`);
  await page.bringToFront();
  await page.locator('[data-testid="drone-game"][data-ready="true"]').waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Take off", exact: true }).click();
  await page.getByRole("button", { name: "Flight sticks", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="flight-telemetry"]')?.getAttribute("data-y")) > 3);
  const joystick = await page.getByRole("group", { name: "Flight joystick", exact: true }).boundingBox();
  const center = { x: joystick.x + joystick.width / 2, y: joystick.y + joystick.height / 2 };
  const radius = joystick.width * 0.34;
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  let spraying = false;
  let targetIndex = null;
  let finalState = null;
  let lastTelemetry = null;
  let previousSample = null;
  const clamp = (value) => Math.max(-1, Math.min(1, value));

  try {
    for (let step = 0; step < 1200; step++) {
      const state = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="flight-telemetry"]');
        const game = document.querySelector('[data-testid="drone-game"]');
        const beds = [...document.querySelectorAll('svg[aria-label^="Field moisture map"] rect')]
          .filter((rect) => Number(rect.getAttribute("width")) < 15)
          .map((rect) => ({
            x: (Number(rect.getAttribute("x")) + (Number(rect.getAttribute("width")) + 1) / 2 - 10) / (220 / 52) - 26,
            z: (Number(rect.getAttribute("y")) + (Number(rect.getAttribute("height")) + 1) / 2 - 10) / (220 / 52) - 26,
            wet: rect.getAttribute("fill") === "#99d6a2",
          }));
        return { phase: game.dataset.phase, telemetry: element ? { ...element.dataset } : null, beds };
      });
      finalState = state;
      if (state.phase !== "flying") break;
      if (!state.telemetry) continue;
      lastTelemetry = state.telemetry;
      const horizontal = Number(state.telemetry.x);
      const depth = Number(state.telemetry.z);
      if (targetIndex === null || state.beds[targetIndex].wet) {
        targetIndex = state.beds.map((bed, index) => ({ index, wet: bed.wet, distance: Math.hypot(bed.x - horizontal, bed.z - depth) }))
          .filter((bed) => !bed.wet).sort((first, second) => first.distance - second.distance)[0]?.index ?? null;
      }
      if (targetIndex === null) break;
      const target = state.beds[targetIndex];
      const sampleTime = Number(state.telemetry.elapsed);
      const sampleDelta = previousSample ? Math.max(0.1, sampleTime - previousSample.time) : 1;
      const velocityX = previousSample ? (horizontal - previousSample.x) / sampleDelta : 0;
      const velocityZ = previousSample ? (depth - previousSample.z) / sampleDelta : 0;
      previousSample = { x: horizontal, z: depth, time: sampleTime };
      const sideways = clamp((target.x - horizontal) * 0.2 - velocityX * 0.24) * 0.75;
      const forward = clamp((depth - target.z) * 0.2 + velocityZ * 0.24) * 0.75;
      const length = Math.max(1, Math.hypot(sideways, forward));
      await page.mouse.up();
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.mouse.move(center.x + sideways / length * radius, center.y - forward / length * radius);
      const shouldSpray = Math.hypot(target.x - horizontal, target.z - depth) < 1;
      if (shouldSpray !== spraying) {
        if (shouldSpray) await page.keyboard.down("Space");
        else await page.keyboard.up("Space");
        spraying = shouldSpray;
      }
      await page.waitForFunction((elapsed) => {
        const game = document.querySelector('[data-testid="drone-game"]');
        const element = document.querySelector('[data-testid="flight-telemetry"]');
        return game.dataset.phase !== "flying" || (element && Number(element.dataset.elapsed) > elapsed + 0.12);
      }, Number(state.telemetry.elapsed), { timeout: 15000 });
    }
  } finally {
    await page.keyboard.up("Space");
    await page.mouse.up();
  }

  if (finalState?.phase !== "won") throw new Error(`Mission was not completed: ${JSON.stringify({ finalState, lastTelemetry })}`);
  await page.getByRole("heading", { name: "Operation complete", exact: true }).waitFor();
  const result = await page.getByRole("dialog").innerText();
  await page.screenshot({ path: "/tmp/field-pilot-completed.png", timeout: 15000 });
  await page.waitForFunction(() => Number(JSON.parse(localStorage.getItem("udyaan.field-pilot.v1") ?? "{}")[1]) >= 1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("udyaan.field-pilot.v1")));
  await page.getByRole("button", { name: "Next mission", exact: true }).click();
  await page.locator('[data-testid="drone-game"][data-level="2"][data-ready="true"]').waitFor();
  if (!(await page.getByRole("heading", { name: "Across the Wind", exact: true }).isVisible())) throw new Error("Next mission did not load");
  await page.reload();
  await page.locator('[data-testid="drone-game"][data-ready="true"]').waitFor();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("udyaan.field-pilot.v1")));
  if (persisted[1] < saved[1]) throw new Error("Best score was not persisted after reload");
  return { completed: true, result, savedStars: saved[1], nextMission: true, scorePersists: true };
}