import { expect, test } from "./deterministic.mjs";
import { openHomeDesktop } from "./helpers/rendered-site.mjs";

const DESKTOP = Object.freeze({ width: 1280, height: 800 });

// Each negative probe must fail in automatic fixture teardown. If enforcement
// is removed, Playwright reports an unexpected pass and fails the suite.
test("automatic diagnostics reject an uncaught page exception", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  const reported = page.waitForEvent("pageerror", { timeout: 5_000 });
  await page.evaluate(() => {
    queueMicrotask(() => { throw new Error("injected runtime failure"); });
  });
  await reported;
  expect(diagnostics.runtimeErrors).toEqual(["injected runtime failure"]);
  test.fail(true, "The fixture must reject the observed page exception.");
});

test("automatic diagnostics reject console errors", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await page.evaluate(() => console.error("injected console failure"));
  await expect.poll(() => diagnostics.consoleErrors).toEqual(["injected console failure"]);
  test.fail(true, "The fixture must reject the observed console error.");
});

test("automatic diagnostics reject failed resource delivery", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await page.route("**/unreachable-asset.png", (route) => route.abort("connectionrefused"));
  await page.evaluate(() => fetch("/unreachable-asset.png").catch(() => undefined));
  await expect.poll(() => diagnostics.requestFailures.length).toBe(1);
  expect(diagnostics.requestFailures[0]).toContain("unreachable-asset.png");
  // Isolate the delivery check from Chromium's accompanying console message.
  diagnostics.consoleErrors.length = 0;
  test.fail(true, "The fixture must reject the failed resource delivery.");
});

test("automatic diagnostics reject HTTP error responses", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await page.route("**/missing-fixture.png", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.evaluate(() => fetch("/missing-fixture.png"));
  await expect.poll(() => diagnostics.errorResponses.length).toBe(1);
  expect(diagnostics.errorResponses[0]).toContain("404");
  diagnostics.consoleErrors.length = 0;
  test.fail(true, "The fixture must reject the HTTP error response independently of console output.");
});

test("intentional request cancellation does not fail a healthy render", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await page.evaluate(async () => {
    const controller = new AbortController();
    const pending = fetch("/assets/mountain-and-sky.png", { signal: controller.signal }).catch(() => undefined);
    controller.abort();
    await pending;
  });
  expect(diagnostics.requestFailures).toEqual([]);
});

test("repeated navigation attaches diagnostic listeners only once", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await openHomeDesktop(page, DESKTOP);
  await page.evaluate(() => console.error("counted once"));
  await expect.poll(() => diagnostics.consoleErrors).toEqual(["counted once"]);
  diagnostics.consoleErrors.length = 0;
});
