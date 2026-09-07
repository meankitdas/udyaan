async (page) => {
  const origin = await page.evaluate(() => location.origin);
  const checks = [];
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => { if (message.type() === "error") errors.push(message.text()); };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  const verify = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
  const ready = () => page.locator('[data-testid="drone-game"][data-ready="true"]').waitFor({ timeout: 60000 });
  const chooseMission = async (index) => {
    await page.getByRole("button", { name: "Select mission", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`^Mission ${index}:`) }).click();
    await ready();
  };
  const metrics = () => page.locator('[data-testid="flight-telemetry"]').evaluate((element) => ({ ...element.dataset }));
  const waitMetric = (name, comparison, value) => page.waitForFunction(({ name, comparison, value }) => {
    const element = document.querySelector('[data-testid="flight-telemetry"]');
    if (!element) return false;
    const actual = Number(element.getAttribute(`data-${name}`));
    return comparison === "less" ? actual < value : actual > value;
  }, { name, comparison, value }, { timeout: 20000 });
  const screenshot = async (name) => {
    await page.bringToFront();
    await page.screenshot({ path: `/tmp/field-pilot-${name}.png`, timeout: 15000 });
    const frame = await page.locator("canvas").screenshot({ timeout: 15000 });
    return await page.evaluate(async (encoded) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${encoded}`)).blob());
      const sample = document.createElement("canvas"); sample.width = 96; sample.height = 96;
      const context = sample.getContext("2d");
      context.drawImage(bitmap, 0, bitmap.height * 0.25, bitmap.width, bitmap.height * 0.45, 0, 0, 96, 96);
      const pixels = context.getImageData(0, 0, 96, 96).data;
      const colors = new Set(); let lit = 0;
      for (let offset = 0; offset < pixels.length; offset += 16) {
        if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] > 30) lit++;
        colors.add(`${pixels[offset] >> 3},${pixels[offset + 1] >> 3},${pixels[offset + 2] >> 3}`);
      }
      bitmap.close();
      return { colors: colors.size, lit, overflow: document.documentElement.scrollWidth > innerWidth };
    }, frame.toString("base64"));
  };

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/drone-irrigation`);
    await page.bringToFront();
    await ready();
    const desktop = await screenshot("desktop");
    verify(desktop.colors > 80 && desktop.lit > 1000 && !desktop.overflow, "Desktop canvas is nonblank and fits the viewport");
    verify(await page.getByRole("button", { name: "Take off", exact: true }).isEnabled(), "Takeoff waits for graphics and physics readiness");
    verify(Number((await metrics()).y) < 1, "Aircraft begins powered off on the service pad");
    verify(await page.locator('[data-testid="drone-game"]').getAttribute("data-view") === "external", "Powered-off aircraft is shown from the external camera");
    verify(await page.getByRole("button", { name: "Stabilized camera", exact: true }).getAttribute("aria-pressed") === "true", "Stabilized gimbal is the default flight camera");
    const parked = await metrics();
    await page.mouse.move(820, 400); await page.mouse.down(); await page.mouse.move(990, 450, { steps: 15 }); await page.mouse.up();
    await screenshot("external-orbit");
    verify((await metrics()).elapsed === parked.elapsed && (await metrics()).y === parked.y, "External orbit does not start the aircraft or advance physics");
    await chooseMission(1);
    await page.getByRole("button", { name: "Take off", exact: true }).click();
    await waitMetric("y", "greater", 3);
    verify(await page.locator('[data-testid="drone-game"]').getAttribute("data-view") === "onboard", "Starting the aircraft automatically switches to onboard POV");
    await page.keyboard.down("w");
    await waitMetric("z", "less", 5);
    await page.keyboard.up("w");
    await waitMetric("speed", "less", 0.25);
    await page.keyboard.down("Space");
    await waitMetric("completed", "greater", 0);
    await page.keyboard.up("Space");
    const irrigated = await metrics();
    verify(Number(irrigated.z) < 7 && Number(irrigated.water) < 22 && Number(irrigated.completed) > 0, "Keyboard flight irrigates beds and consumes tank water");
    await page.getByRole("button", { name: "Stabilized camera", exact: true }).click();
    verify(await page.getByRole("button", { name: "Stabilized camera", exact: true }).getAttribute("aria-pressed") === "true", "Stabilized onboard camera can be selected during flight");
    await page.getByRole("button", { name: "Look down", exact: true }).click();
    verify(await page.getByRole("slider", { name: "Camera tilt", exact: true }).inputValue() === "90", "Camera tilts down from the aircraft for irrigation inspection");
    await waitMetric("elapsed", "greater", Number((await metrics()).elapsed) + 1.6);
    const nadir = await screenshot("onboard-down");
    verify(nadir.colors > 50 && nadir.lit > 1000, "Downward camera renders the field below the drone");
    await page.getByRole("button", { name: "Look ahead", exact: true }).click();
    await page.keyboard.press("]");
    verify(await page.getByRole("slider", { name: "Camera tilt", exact: true }).inputValue() === "5", "Keyboard gimbal adjustment changes camera pitch");
    await page.getByRole("button", { name: "FPV camera", exact: true }).click();
    await page.keyboard.down("e");
    await waitMetric("heading", "greater", 20);
    await page.keyboard.up("e");
    verify(Number((await metrics()).heading) > 20, "Compass responds to actual aircraft yaw");
    const pauseBefore = await metrics();
    await page.getByRole("button", { name: "Pause flight", exact: true }).click();
    await screenshot("paused");
    await page.evaluate(() => new Promise((resolve) => {
      let frames = 0;
      const tick = () => { if (++frames >= 80) resolve(true); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    await page.getByRole("button", { name: "Resume flight", exact: true }).last().click();
    const pauseAfter = await metrics();
    verify(Number(pauseAfter.elapsed) - Number(pauseBefore.elapsed) < 1, "Pause freezes the simulation clock");
    verify(Math.abs(Number(pauseAfter.water) - Number(pauseBefore.water)) < 0.1, "Released spray stays off after resuming");
    await page.getByRole("button", { name: "Pause flight", exact: true }).click();
    await page.getByRole("button", { name: "Retry mission", exact: true }).click();
    await ready();
    verify(await page.getByRole("progressbar", { name: "Water tank" }).getAttribute("value") === "22", "Retry resets resources");
    verify(await page.locator('[data-testid="drone-game"]').getAttribute("data-view") === "external", "Resetting the flight restores the powered-off external view");

    const objectives = [];
    for (let index = 1; index <= 5; index++) {
      await chooseMission(index);
      objectives.push(Number(await page.getByRole("progressbar", { name: "Irrigation objective" }).getAttribute("max")));
    }
    verify(objectives.join(",") === "11,22,34,46,61", "All five missions load with increasingly demanding objectives");
    await screenshot("expert");
    await chooseMission(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector("canvas")?.width === 390);
    const mobile = await screenshot("mobile");
    verify(mobile.colors > 80 && mobile.lit > 1000 && !mobile.overflow, "Phone canvas is nonblank and fits the viewport");
    verify(await page.locator('[data-testid="drone-game"]').getAttribute("data-view") === "external", "Phone also starts in external view");
    await page.getByRole("button", { name: "Take off", exact: true }).click();
    await waitMetric("y", "greater", 3);
    verify(await page.getByRole("group", { name: "Throttle and yaw stick", exact: true }).isVisible(), "Phone provides a separate throttle and yaw stick");
    const joystick = await page.getByRole("group", { name: "Flight joystick", exact: true }).boundingBox();
    await page.mouse.move(joystick.x + joystick.width / 2, joystick.y + joystick.height / 2);
    await page.mouse.down();
    await page.mouse.move(joystick.x + joystick.width / 2, joystick.y + 17);
    await waitMetric("z", "less", 13);
    await page.mouse.up();
    await waitMetric("speed", "less", 0.3);
    const moved = await metrics();
    verify(Number(moved.z) < 13, "On-screen joystick moves the drone and releases cleanly");
    const ascend = await page.getByRole("button", { name: "Ascend", exact: true }).boundingBox();
    await page.mouse.move(ascend.x + ascend.width / 2, ascend.y + ascend.height / 2);
    await page.mouse.down(); await waitMetric("y", "greater", 4.2); await page.mouse.up();
    const spray = await page.getByRole("button", { name: "Spray water", exact: true }).boundingBox();
    await page.mouse.move(spray.x + spray.width / 2, spray.y + spray.height / 2);
    await page.mouse.down(); await waitMetric("water", "less", 21); await page.mouse.up();
    verify(Number((await metrics()).y) > 4.2, "Touch altitude and spray controls operate independently");
    await screenshot("mobile-flight");
    await page.getByRole("button", { name: "Pause flight", exact: true }).click();
    await page.setViewportSize({ width: 844, height: 390 });
    const landscape = await screenshot("landscape");
    verify(!landscape.overflow, "Landscape layout fits without horizontal overflow");
    await page.getByRole("button", { name: "Retry mission", exact: true }).click();
    await ready();
    await page.setViewportSize({ width: 320, height: 640 });
    await screenshot("small-phone");
    const bounds = await page.getByRole("button", { name: "Take off", exact: true }).boundingBox();
    verify(bounds.x >= 0 && bounds.x + bounds.width <= 320 && bounds.y + bounds.height <= 640, "Small-phone launch control remains accessible");
    verify(errors.length === 0, `No browser runtime errors: ${errors.join("; ")}`);
    return { checks, desktop, mobile, objectives, irrigated };
  } finally {
    await page.keyboard.up("w"); await page.keyboard.up("Space"); await page.mouse.up();
    page.off("pageerror", onError);
    page.off("console", onConsole);
  }
}