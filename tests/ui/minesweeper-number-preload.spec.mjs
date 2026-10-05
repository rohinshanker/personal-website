import { expect, test } from "./deterministic.mjs";
import { consumeDiagnostics, settleFrames } from "./helpers/rendered-site.mjs";

const CELL_NUMBER_ASSET = /\/assets\/minesweeper_assets\/cell_numbers\/cell_([1-8])\.png$/;

const openMinesweeper = async (page) => {
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Minesweeper" })
    .click();
  const app = page.locator('[data-app-window="minesweeper"]');
  await expect(app).toBeVisible();
  return app;
};

test("opening Minesweeper finishes every number asset before grid input", async ({ page }) => {
  // The fixture already fails the test on any console error, page error, or
  // failed request. Warnings are not errors, so the preload's silence about
  // them is asserted here.
  const consoleWarnings = [];
  const requestedNumbers = [];
  const finishedNumbers = [];

  page.on("console", (message) => {
    if (message.type() === "warning") consoleWarnings.push(message.text());
  });
  page.on("request", (request) => {
    const match = new URL(request.url()).pathname.match(CELL_NUMBER_ASSET);
    if (match) requestedNumbers.push(match[1]);
  });
  page.on("requestfinished", (request) => {
    const match = new URL(request.url()).pathname.match(CELL_NUMBER_ASSET);
    if (match) finishedNumbers.push(match[1]);
  });

  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });

  expect(requestedNumbers).toEqual([]);
  const app = await openMinesweeper(page);
  await expect(app.locator(".ms-cell[data-number]")).toHaveCount(0);
  await expect
    .poll(() => [...new Set(finishedNumbers)].sort())
    .toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  expect([...new Set(requestedNumbers)].sort()).toEqual([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
  ]);
  expect(
    consoleWarnings.filter(
      (message) => !message.includes("Unrecognized feature: 'web-share'.")
    )
  ).toEqual([]);

  await app.getByRole("button", { name: "Close" }).click();
  await expect(app).toBeHidden();
  await openMinesweeper(page);
  // A reopen must reuse the warm cache rather than fetch the set again, so the
  // settled page is the evidence: no request was added.
  await settleFrames(page);
  const requestCountBeforeInput = requestedNumbers.length;
  expect(requestCountBeforeInput).toBe(8);

  await app.locator(".ms-cell").first().click();
  await expect(app.locator(".ms-cell[data-number]").first()).toBeVisible();
  await settleFrames(page);
  expect(requestedNumbers).toHaveLength(requestCountBeforeInput);
});

test("reopening Minesweeper retries a failed number preload", async ({
  diagnostics,
  page,
}) => {
  let cellEightAttempts = 0;

  await page.route("**/assets/minesweeper_assets/cell_numbers/cell_8.png", (route) => {
    cellEightAttempts += 1;
    if (cellEightAttempts === 1) {
      route.abort("failed");
      return;
    }
    route.continue();
  });
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.__cellEightPreloadInsertions = 0;
    const originalAppend = document.head.append.bind(document.head);
    document.head.append = (...nodes) => {
      nodes.forEach((node) => {
        if (
          node instanceof HTMLLinkElement &&
          node.href.endsWith("/cell_numbers/cell_8.png")
        ) {
          window.__cellEightPreloadInsertions += 1;
        }
      });
      return originalAppend(...nodes);
    };
  });

  const app = await openMinesweeper(page);
  await expect.poll(() => cellEightAttempts).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__cellEightPreloadInsertions))
    .toBe(1);
  await expect
    .poll(() => page.locator('link[href$="/cell_numbers/cell_8.png"]').count())
    .toBe(0);

  await app.getByRole("button", { name: "Close" }).click();
  await expect(app).toBeHidden();
  await openMinesweeper(page);
  await expect
    .poll(() => page.evaluate(() => window.__cellEightPreloadInsertions))
    .toBe(2);

  // The aborted first preload is the behaviour under test; the fixture still
  // fails on anything the page reported beyond this exact pair.
  consumeDiagnostics(diagnostics, {
    consoleErrors: ["Failed to load resource: net::ERR_FAILED"],
    requestFailures: [/cell_numbers\/cell_8\.png \(net::ERR_FAILED\)/],
  });
});
