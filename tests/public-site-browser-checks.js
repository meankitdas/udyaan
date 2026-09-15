async (page) => {
  const origin = await page.evaluate(() => location.origin);
  const errors = [];
  const onError = error => errors.push(error.message);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const results = [];
  const checkHero = async () => {
    await page.evaluate(() => document.fonts.ready);
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    const bounds = await hero.boundingBox();
    const viewport = page.viewportSize();
    assert(Math.abs(bounds.y + bounds.height - viewport.height) < 2, `Navigation and hero must fill the ${viewport.width}x${viewport.height} viewport`);
    for (const name of ["Explore problems", "Join Udyaan"]) {
      const action = await hero.getByRole("link", { name, exact: true }).boundingBox();
      assert(action.y + action.height <= viewport.height, `${name} must remain in the first viewport`);
    }
  };
  page.on("pageerror", onError);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin);
    assert((await page.getByRole("heading", { level: 1 }).innerText()).replace(/\s+/g, " ") === "Udyaan. A launchpad for real-world solutions.", "The hero must identify Udyaan and its platform category");
    await checkHero();
    await page.getByRole("link", { name: /From problem to possibility/ }).click();
    await page.waitForURL("**/#model");
    assert(await page.locator("#model").evaluate(element => element.getBoundingClientRect().top >= 80), "Model heading must clear the sticky navigation");
    await page.goto(origin);
    const referencePhotos = await page.locator("main figure img").evaluateAll(images => images.map(image => new URL(image.src).searchParams.get("url")));
    for (const asset of ["/builder-team.jpg", "/builder-design.jpg", "/builder-electronics.jpg"]) {
      assert(referencePhotos.includes(asset), `Homepage reference photo is missing: ${asset}`);
    }
    const phases = page.locator("#model section[data-tone]");
    assert(await phases.count() === 3, "The engine must group its stages into three phases");
    assert((await phases.locator("h4").allTextContents()).join(",") === "Problem,People,Team,Build,Validate,Outcome,Venture", "The engine must preserve the seven-stage reading order");
    assert(await page.locator("#model li svg").count() === 7, "Each engine stage must have an icon");
    assert(await page.locator("#model").getByText("When the opportunity is validated", { exact: true }).count() === 1, "Venture continuation must be conditional");
    const faqs = page.locator("#faq details");
    const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faqSchema = schema.map(value => JSON.parse(value)).flatMap(value => value["@graph"] || []).find(value => value["@type"] === "FAQPage");
    assert(faqSchema.mainEntity.length === await faqs.count(), "FAQ structured data must match visible content");
    await faqs.first().locator("summary").click();
    assert(await faqs.first().getAttribute("open") !== null, "FAQ must open");
    await page.getByRole("link", { name: "Explore problems", exact: true }).first().click();
    await page.waitForURL("**/problems");
    assert(await page.getByRole("status").innerText() === "4 problems to explore", "The board must show all four proposed briefs");
    await page.getByLabel("Challenge area").selectOption("Water");
    assert((await page.getByRole("status").innerText()).startsWith("1 problem"), "Water filter must show one brief");
    await page.getByLabel("Your capability").selectOption("Business");
    assert(await page.getByRole("heading", { name: "No problems match just yet." }).isVisible(), "Combined filters must have a useful empty state");
    await page.getByRole("button", { name: "Show all problems" }).click();
    await page.getByRole("searchbox").fill("microgreens");
    await page.getByRole("heading", { name: "Make small-space growing commercially useful." }).waitFor();
    assert(await page.locator("main article").count() === 1, "Search must filter cards");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("link", { name: "View problem: Grow more with every litre of water." }).click();
    await page.waitForURL("**/problems/water-efficient-growing");
    for (const name of ["The context", "Who this is for", "The constraints", "What success looks like", "Who can contribute", "Available support"]) {
      assert(await page.getByRole("heading", { name, exact: true }).count() === 1, `Brief is missing ${name}`);
    }
    await page.getByRole("link", { name: "I am interested", exact: true }).click();
    await page.waitForURL("**/join?problem=water-efficient-growing");
    assert(await page.getByText("Your problem preference: UDY-003").isVisible(), "Selected problem must be retained on joining");
    assert(await page.getByRole("link", { name: "Start student assessment" }).getAttribute("href") === "/survey?problem=water-efficient-growing", "Problem context must reach assessment");
    results.push("Discovery: search, combined filters, empty state, brief, selected-problem handoff");

    await page.goto(`${origin}/submit-problem`);
    await page.getByRole("button", { name: "Review your brief" }).click();
    assert(await page.getByRole("heading", { name: "Your brief is ready to review." }).count() === 0, "Empty form must not prepare a draft");
    await page.getByLabel("Your name", { exact: true }).fill("Website Test");
    await page.getByLabel("Work email").fill("website-test@example.com");
    await page.getByLabel("Organisation", { exact: true }).fill("Test organisation");
    await page.getByLabel("Problem title").fill("Reduce avoidable process waste");
    await page.getByLabel("What is happening, and who is affected?").fill("Operators need a way to measure and reduce avoidable material waste in a small production process.");
    await page.getByLabel("What would a useful outcome look like?").fill("Document a baseline and compare material losses after a small controlled trial.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Review your brief" }).click();
    await page.getByRole("heading", { name: "Your brief is ready to review." }).waitFor();
    assert(await page.getByText(/Nothing has been sent yet/).isVisible(), "Email draft must not imply a completed submission");
    const mail = await page.getByRole("link", { name: "Open email draft" }).evaluate(link => {
      const url = new URL(link.href);
      return { protocol: url.protocol, recipient: url.pathname, body: url.searchParams.get("body") };
    });
    assert(mail.protocol === "mailto:" && mail.recipient === "support@udyaan.org", "Draft must target the published contact");
    assert(mail.body.includes("website-test@example.com"), "Draft must contain the contact details");
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download brief" }).click();
    assert((await downloadEvent).suggestedFilename() === "udyaan-problem-brief.txt", "Brief must be downloadable");
    await page.getByLabel("Problem title").fill("Updated process waste question");
    assert(await page.getByRole("link", { name: "Open email draft" }).count() === 0, "Editing must invalidate an outdated email draft");
    results.push("Company flow: required fields, review, honest email handoff, download, stale-draft invalidation");

    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const route of ["/", "/problems", "/problems/water-efficient-growing", "/how-it-works", "/for-students", "/for-companies", "/ventures", "/about", "/join", "/submit-problem", "/contact"]) {
        const response = await page.goto(`${origin}${route}`);
        assert(response.status() === 200, `${route} must return 200`);
        assert(await page.getByRole("heading", { level: 1 }).count() === 1, `${route} must have one h1`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} must not overflow at ${width}px`);
        if (route === "/") await checkHero();
        if (route === "/" || route === "/how-it-works") {
          const engineLayout = await page.locator("section[data-tone]").evaluateAll(sections => ({
            positions: sections.map(section => ({ left: section.getBoundingClientRect().left, top: section.getBoundingClientRect().top })),
            textFits: sections.every(section => Array.from(section.querySelectorAll("h3, h4, p, li")).every(element => element.scrollWidth <= element.clientWidth)),
          }));
          assert(engineLayout.textFits, `${route} engine text must fit at ${width}px`);
          if (width <= 800) assert(engineLayout.positions.every((position, index, positions) => index === 0 || (Math.abs(position.left - positions[0].left) < 1 && position.top > positions[index - 1].top)), "Mobile engine phases must form a vertical reading path");
          else assert(engineLayout.positions.every(position => Math.abs(position.top - engineLayout.positions[0].top) < 1), "Desktop engine phases must align horizontally");
        }
        for (const image of await page.locator("main img").all()) {
          await image.scrollIntoViewIfNeeded({ timeout: 5000 });
          await page.waitForFunction(
            element => element.complete,
            await image.elementHandle(),
            { timeout: 10000 }
          ).catch(() => { throw new Error(`${route} image did not finish loading at ${width}px within 10 seconds`); });
        }
        assert(await page.locator("main img").evaluateAll(images => images.every(image => image.naturalWidth > 0)), `${route} images must load`);
        assert(await page.locator("main figcaption").evaluateAll(captions => captions.every(caption => caption.scrollWidth <= caption.clientWidth)), `${route} photo captions must fit at ${width}px`);
      }
      await page.goto(origin);
      if (width <= 768) {
        const menu = page.getByRole("button", { name: "Open navigation" });
        await menu.click();
        assert(await page.getByRole("navigation", { name: "Mobile navigation" }).isVisible(), "Mobile menu must open");
        await page.keyboard.press("Escape");
        assert(await menu.getAttribute("aria-expanded") === "false", "Escape must close mobile navigation");
        await menu.click();
        await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "For companies" }).click();
        await page.waitForURL("**/for-companies");
        assert(await page.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded") === "false", "Navigation should dismiss the menu");
        await page.goto(origin);
      }
      await page.screenshot({ path: `/tmp/udyaan-home-${width}.png`, fullPage: true, animations: "disabled" });
      results.push(`Responsive routes and images: ${width}px`);
    }
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 800 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(viewport);
      await page.goto(origin);
      await checkHero();
    }
    results.push("Full-height hero and visible primary actions: large desktop, laptop, tablet and phone");
    const missing = await page.goto(`${origin}/problems/this-brief-does-not-exist`);
    assert(missing.status() === 404, "Unknown problems must return 404");
    await page.goto(origin);
    assert(errors.length === 0, `Runtime errors: ${errors.join("; ")}`);
    return { results, runtimeErrors: errors };
  } finally {
    page.off("pageerror", onError);
  }
}