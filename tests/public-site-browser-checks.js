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
    const trust = page.getByRole("region", { name: "Udyaan initiative and approach" });
    const trustBounds = await trust.boundingBox();
    const viewport = page.viewportSize();
    assert(Math.abs(trustBounds.y + trustBounds.height - viewport.height) < 2, `Navigation, hero and trust strip must fill the ${viewport.width}x${viewport.height} viewport`);
    assert(Math.abs(bounds.y + bounds.height - trustBounds.y) < 2, "The trust strip must sit directly below the hero");
    assert(await hero.getByText("A JAIN university initiative", { exact: true }).count() === 0, "The repeated hero initiative line must be removed");
    assert(await page.getByText("Learning meets real-world enterprise", { exact: true }).count() === 0, "The removed masthead line must not return");
    for (const text of ["A JAIN university initiative", "Cross-disciplinary teams", "Evidence-led building", "Multiple paths forward"]) {
      const item = trust.getByText(text, { exact: true });
      assert(await item.isVisible(), `${text} must be visible`);
      const itemBounds = await item.boundingBox();
      assert(itemBounds.y >= 0 && itemBounds.y + itemBounds.height <= viewport.height + 1, `${text} must fit in the first viewport`);
    }
    const logo = trust.getByRole("img", { name: "JAIN Group" });
    await page.waitForFunction(image => image.complete && image.naturalWidth > 0, await logo.elementHandle(), { timeout: 10000 });
    const logoBounds = await logo.boundingBox();
    assert(logoBounds.y + logoBounds.height <= viewport.height + 1, "JAIN logo must fit in the first viewport");
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
    assert(await page.getByText("Build. Get feedback. Test again.", { exact: true }).count() === 0, "The removed engine feedback line must not return");
    const proof = page.locator("#journey");
    const evidenceGates = proof.getByRole("list", { name: "Validation evidence gates" });
    assert((await evidenceGates.locator("h3").allTextContents()).join(",") === "Technical,User,Market,Commercial", "Validation must preserve all four evidence gates");
    assert(await evidenceGates.locator("li dd").count() === 4, "Every gate must include evidence to gather");
    assert(await proof.getByRole("heading", { name: "Not enough evidence? Iterate." }).count() === 1, "Validation must allow iteration rather than imply automatic success");
    await proof.getByRole("link", { name: "Inside the validation process" }).click();
    await page.waitForURL("**/how-it-works#validation");
    assert(await page.locator("#validation h2").count() === 1, "Validation link must reach the detailed evidence section");
    await page.goto(origin);
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
    assert(await page.getByText(/Nothing has been sent yet/).isVisible(), "Review must not imply a completed submission");
    assert(await page.getByRole("button", { name: "Submit problem", exact: true }).isEnabled(), "Reviewed brief must offer a real submission action");
    assert((await page.locator("pre").innerText()).includes("website-test@example.com"), "Review must contain the contact details");
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download brief" }).click();
    assert((await downloadEvent).suggestedFilename() === "udyaan-problem-brief.txt", "Brief must be downloadable");
    await page.getByLabel("Problem title").fill("Updated process waste question");
    assert(await page.getByRole("button", { name: "Submit problem", exact: true }).count() === 0, "Editing must invalidate an outdated reviewed brief");
    results.push("Company flow: required fields, review, submission action, download, stale-draft invalidation (no live submission)");

    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const route of ["/", "/problems", "/problems/water-efficient-growing", "/how-it-works", "/for-students", "/for-companies", "/ventures", "/about", "/join", "/submit-problem", "/contact"]) {
        const response = await page.goto(`${origin}${route}`);
        assert(response.status() === 200, `${route} must return 200`);
        assert(await page.getByRole("heading", { level: 1 }).count() === 1, `${route} must have one h1`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} must not overflow at ${width}px`);
        if (route === "/") {
          await checkHero();
          assert(await page.locator("#journey").evaluate(section => Array.from(section.querySelectorAll("h2, h3, p, dd, dt, figcaption")).every(element => element.scrollWidth <= element.clientWidth + 1)), `Validation text must fit at ${width}px`);
          const image = await page.locator("#journey figure").boundingBox();
          const gates = await page.getByRole("list", { name: "Validation evidence gates" }).boundingBox();
          if (width <= 800) assert(gates.y >= image.y + image.height, "Validation gates must follow the image on smaller screens");
          else assert(gates.x > image.x + image.width, "Desktop validation must use separate image and evidence columns");
        }
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