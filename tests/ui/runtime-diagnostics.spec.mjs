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

test("an unknown remote image is blocked rather than quietly stubbed", async ({
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  // The fixture stubs the remote media the shipped source embeds. An address
  // the source never names is a new outbound request, and stubbing it by
  // resource type would hide that.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const image = new Image();
        image.addEventListener("error", resolve, { once: true });
        image.addEventListener("load", resolve, { once: true });
        image.src = "https://images.example.invalid/unlisted.png";
      })
  );
  await expect.poll(() => diagnostics.requestFailures.length).toBe(1);
  expect(diagnostics.requestFailures[0]).toContain("images.example.invalid/unlisted.png");
  expect(diagnostics.requestFailures[0]).toContain("BLOCKED_BY_CLIENT");
  diagnostics.consoleErrors.length = 0;
  test.fail(true, "The fixture must reject the unlisted remote image.");
});

test("an unknown remote document is blocked rather than quietly stubbed", async ({
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.addEventListener("load", resolve, { once: true });
        frame.addEventListener("error", resolve, { once: true });
        frame.src = "https://embeds.example.invalid/player";
        document.body.append(frame);
      })
  );
  await expect.poll(() => diagnostics.requestFailures.length).toBe(1);
  expect(diagnostics.requestFailures[0]).toContain("embeds.example.invalid/player");
  diagnostics.consoleErrors.length = 0;
  test.fail(true, "The fixture must reject the unlisted remote document.");
});

test("a popup page reports into the same diagnostics record", async ({
  context,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  const popup = await context.newPage();
  await popup.goto("/home.html", { waitUntil: "domcontentloaded" });
  await popup.evaluate(() => console.error("injected popup failure"));
  await expect.poll(() => diagnostics.consoleErrors).toEqual(["injected popup failure"]);
  test.fail(true, "The fixture must reject a console error raised in a popup.");
});

test("a popup page is held to the same hermetic boundary", async ({
  context,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  const popup = await context.newPage();
  await popup.goto("/home.html", { waitUntil: "domcontentloaded" });
  await popup.evaluate(() => fetch("https://api.example.invalid/stats").catch(() => undefined));
  await expect.poll(() => diagnostics.requestFailures.length).toBe(1);
  expect(diagnostics.requestFailures[0]).toContain("api.example.invalid/stats");
  diagnostics.consoleErrors.length = 0;
  test.fail(true, "A popup must not be able to reach the network either.");
});

test("repeated navigation attaches diagnostic listeners only once", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await openHomeDesktop(page, DESKTOP);
  await page.evaluate(() => console.error("counted once"));
  await expect.poll(() => diagnostics.consoleErrors).toEqual(["counted once"]);
  diagnostics.consoleErrors.length = 0;
});
