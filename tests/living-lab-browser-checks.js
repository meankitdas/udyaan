async (page) => {
  const origin = await page.evaluate(() => location.origin);
  const results = [];
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const labels = ["01 Sense", "02 Grow", "03 Power", "04 Return"];
  const titles = ["Precision sensing", "Controlled cultivation", "Renewable operations", "Circular bioeconomy"];
  try {
    await page.goto(`${origin}/living-lab#lab`);
    await page.bringToFront();
    const section = page.locator("#lab");
    const tabs = page.getByRole("tablist", { name: "Living lab systems" });
    assert(await tabs.getByRole("tab").count() === 4, "Four system tabs are required");
    for (const viewport of [{ width: 1440, height: 1100 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(viewport);
      const heights = [];
      for (let index = 0; index < labels.length; index++) {
        const tab = page.getByRole("tab", { name: labels[index], exact: true });
        await tab.click();
        const panel = page.getByRole("tabpanel");
        assert(await panel.count() === 1, "Only one panel should be visible");
        assert(await tab.getAttribute("aria-selected") === "true", "Active tab must be marked selected");
        assert(await panel.getByRole("heading", { name: titles[index], exact: true }).isVisible(), "Selected system heading must be visible");
        assert(await panel.getAttribute("aria-labelledby") === await tab.getAttribute("id"), "Panel and tab labels must be linked");
        await panel.locator("img").evaluate((image) => image.decode());
        const layout = await panel.evaluate((element) => {
          const image = element.querySelector("img");
          return { height: element.getBoundingClientRect().height, overflow: element.scrollWidth > element.clientWidth, loaded: image.naturalWidth > 0 };
        });
        assert(layout.loaded && !layout.overflow, "Panel image and layout must render correctly");
        heights.push(layout.height);
      }
      assert(Math.max(...heights) - Math.min(...heights) < 3, "Changing tabs must not shift the section height");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "The page must not overflow horizontally");
      await page.getByRole("tab", { name: viewport.width >= 900 ? labels[0] : labels[1], exact: true }).click();
      await section.screenshot({ path: `/tmp/living-lab-${viewport.width}.png`, animations: "disabled", timeout: 15000 });
      results.push({ viewport: viewport.width, fourPanels: true, images: true, stableHeight: true, noOverflow: true });
    }

    await page.getByRole("tab", { name: labels[0], exact: true }).focus();
    for (const [key, expected] of [["ArrowRight", labels[1]], ["End", labels[3]], ["ArrowRight", labels[0]], ["ArrowLeft", labels[3]], ["Home", labels[0]]]) {
      await page.keyboard.press(key);
      const active = page.getByRole("tab", { name: expected, exact: true });
      assert(await active.getAttribute("aria-selected") === "true", `${key} must select the expected tab`);
      assert(await active.evaluate((element) => element === document.activeElement), "Keyboard focus must follow the selected tab");
    }
    assert(await page.getByRole("link", { name: "Enter the drone simulator", exact: true }).getAttribute("href") === "/drone-irrigation", "Sense must link to the separate simulator");
    assert(await section.locator("canvas").count() === 0, "Homepage must not mount the drone scene");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("tab", { name: labels[2], exact: true }).click();
    assert(await page.getByRole("tabpanel").evaluate((element) => getComputedStyle(element).animationName === "none"), "Reduced motion must disable panel animation");
    await page.getByRole("link", { name: "Explore current problems", exact: true }).click();
    await page.waitForURL("**/problems");
    assert(await page.evaluate(() => location.pathname === "/problems"), "Lab links must navigate to problem discovery");
    assert(errors.length === 0, `Runtime errors: ${errors.join("; ")}`);
    return { results, keyboard: true, reducedMotion: true, links: true, noHomepage3D: true, runtimeErrors: errors };
  } finally {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    page.off("pageerror", onError);
  }
}