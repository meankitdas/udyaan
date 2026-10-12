async (page) => {
  const origin = await page.evaluate(() => location.origin);
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw new Error("Run this check on the local frontend only.");
  const localApi = "http://127.0.0.1:8093";
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const marker = String(Date.now());
  const title = `Browser check ${marker}: reduce process waste`;
  const submittedIds = [];
  let attempts = 0;
  const errors = [];
  const capture = error => errors.push(error.message);
  const proxy = async route => {
    const request = route.request();
    const response = await route.fetch({ url: request.url().replace(/^https?:\/\/[^/]+/, localApi), timeout: 10000 });
    await route.fulfill({ response });
  };
  const intake = async route => {
    if (route.request().method() !== "POST") return proxy(route);
    submittedIds.push(route.request().postDataJSON().requestId);
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Submission storage is temporarily unavailable. Please try again later." }) });
    if (attempts === 2) {
      const response = await route.fetch({ url: route.request().url().replace(/^https?:\/\/[^/]+/, localApi), timeout: 10000 });
      assert(response.status() === 201, "The isolated API must save the brief before simulating a lost response");
      return route.abort("failed");
    }
    return proxy(route);
  };
  await page.route("**/problem-submissions**", intake);
  await page.route("**/auth/login", proxy);
  await page.route("**/forms/active", proxy);
  page.on("pageerror", capture);
  try {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto(`${origin}/submit-problem`, { timeout: 15000 });
    await page.getByRole("button", { name: "Review your brief" }).click();
    assert(await page.getByRole("button", { name: "Submit problem", exact: true }).count() === 0, "Empty forms must not submit");
    await page.getByLabel("Your name", { exact: true }).fill("Website Test");
    await page.getByLabel("Work email").fill(`website-test+${marker}@example.com`);
    await page.getByLabel("Organisation", { exact: true }).fill("Isolated test organisation");
    await page.getByLabel("Problem title").fill(title);
    await page.getByLabel("What is happening, and who is affected?").fill("Operators need a repeatable way to measure and reduce avoidable material waste.");
    await page.getByLabel("What would a useful outcome look like?").fill("Compare material losses before and after a controlled trial.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Review your brief" }).click();
    await page.getByRole("button", { name: "Submit problem", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "temporarily unavailable" }).waitFor({ timeout: 10000 });
    assert(await page.getByLabel("Problem title").inputValue() === title, "Failed submission must preserve the brief");
    await page.getByRole("button", { name: "Submit problem", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "could not confirm" }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Submit problem", exact: true }).click();
    await page.getByRole("heading", { name: "Problem submitted.", exact: true }).waitFor({ timeout: 10000 });
    assert(new Set(submittedIds).size === 1, "Retries must keep one idempotency key");
    assert(await page.getByText(/has not been published/).isVisible(), "Receipt must be clear that the brief remains private");
    const reference = await page.locator("dt").filter({ hasText: /^Submission reference$/ }).locator("+ dd").innerText();
    await page.setViewportSize({ width: 320, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Receipt must fit a small phone");
    await page.screenshot({ path: "/tmp/udyaan-problem-receipt-mobile.png", fullPage: true, animations: "disabled" });

    await page.goto(`${origin}/admin`, { timeout: 15000 });
    await page.evaluate(() => sessionStorage.removeItem("udyaan_admin_token"));
    await page.reload();
    await page.getByLabel("Email", { exact: true }).fill("intake-admin@example.com");
    await page.getByLabel("Password", { exact: true }).fill("intake-local-test");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Problems", exact: true }).click({ timeout: 10000 });
    await page.getByRole("heading", { name: "Problem submissions", exact: true }).waitFor();
    await page.getByLabel("Search submissions").fill(marker);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "1 submission matching" }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: title, exact: true }).click();
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    assert(await page.getByText(`Reference: ${reference}`, { exact: true }).isVisible(), "Admin must see the saved reference");
    await page.getByLabel("Status", { exact: true }).selectOption("contacted");
    await page.getByLabel("Private notes").fill("Scoping call requested. Local automated test only.");
    await page.getByRole("button", { name: "Save review" }).click();
    await page.getByRole("status").filter({ hasText: "Review saved." }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Reload latest" }).click();
    await page.getByRole("button", { name: "Reload latest" }).waitFor({ state: "visible" });
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    assert(await page.getByLabel("Status", { exact: true }).inputValue() === "contacted", "Status must survive reload");
    assert(await page.getByLabel("Private notes").inputValue() === "Scoping call requested. Local automated test only.", "Review notes must persist");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Admin review must fit a small phone");
    await page.screenshot({ path: "/tmp/udyaan-problem-review-mobile.png", fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.screenshot({ path: "/tmp/udyaan-problem-review-desktop.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "All submissions" }).click();
    await page.getByLabel("Review status").selectOption("contacted");
    await page.getByRole("button", { name: title, exact: true }).waitFor({ timeout: 10000 });
    await page.screenshot({ path: "/tmp/udyaan-problem-inbox-desktop.png", fullPage: true, animations: "disabled" });
    assert(errors.length === 0, `Runtime errors: ${errors.join("; ")}`);
    return { passed: ["required fields", "failed request retains brief", "lost response retry creates one record", "private receipt", "admin login and search", "persisted status and notes", "responsive review"], reference, runtimeErrors: errors };
  } finally {
    page.off("pageerror", capture);
    await page.unroute("**/problem-submissions**", intake);
    await page.unroute("**/auth/login", proxy);
    await page.unroute("**/forms/active", proxy);
    await page.evaluate(() => sessionStorage.removeItem("udyaan_admin_token"));
  }
}