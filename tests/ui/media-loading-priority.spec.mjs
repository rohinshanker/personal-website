import { expect, test } from "./fixtures.mjs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+q0g9QAAAAABJRU5ErkJggg==",
  "base64"
);

const pathfinderSources = [
  "/assets/creative-work/pathfinder-logo.png",
  "/assets/creative-work/pathfinder-cad.png",
  "/assets/creative-work/pathfinder-new-trash.png",
  "/assets/creative-work/pathfinder-perso%20n.png",
];

const standStillSources = [
  "/assets/modeling/stand-still-mar26/1.mp4",
  "/assets/modeling/stand-still-mar26/2.jpg",
  "/assets/modeling/stand-still-mar26/3.jpg",
  "/assets/modeling/stand-still-mar26/4.jpg",
  "/assets/modeling/stand-still-mar26/5.jpg",
  "/assets/modeling/stand-still-mar26/6.jpg",
];

const deferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const disableRandomEvents = () => {
  Math.random = () => 0.999999;
};

const openPathfinder = async (page) => {
  await page.locator('.taskbar-icon[data-app="paint"]').click();
  const app = page.locator('[data-app-window="paint"]');
  await app.getByRole("button", { name: /^Pathfinder - Wear it Your Way/ }).click();
  return app;
};

test("Pathfinder warms every later carousel image in display order while the first remains selected", async ({
  page,
}) => {
  const requests = [];
  const gates = new Map();

  await page.addInitScript(disableRandomEvents);
  await page.route("**/assets/creative-work/pathfinder-*.png", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const gate = deferred();
    gates.set(path, gate);
    await gate.promise;
    await route.fulfill({ body: ONE_PIXEL_PNG, contentType: "image/png" });
  });

  await page.goto("/home.html");
  const app = await openPathfinder(page);

  await expect.poll(() => requests).toEqual([pathfinderSources[0]]);
  await expect(app.locator("#pathfinder-counter")).toHaveText("1 of 4");
  await page.waitForTimeout(100);
  expect(requests).toEqual([pathfinderSources[0]]);

  for (let index = 0; index < pathfinderSources.length; index += 1) {
    gates.get(pathfinderSources[index]).resolve();
    if (index + 1 < pathfinderSources.length) {
      await expect.poll(() => requests).toEqual(pathfinderSources.slice(0, index + 2));
    }
  }

  await expect(app.locator("#pathfinder-counter")).toHaveText("1 of 4");
  expect(requests).toEqual(pathfinderSources);
});

test("hidden Creative Work media waits until the selected carousel has warmed", async ({ page }) => {
  const pathfinderRequests = [];
  const pathfinderGates = new Map();
  let berserkRequest = null;
  const berserkGate = deferred();

  await page.addInitScript(disableRandomEvents);
  await page.route("**/assets/creative-work/pathfinder-*.png", async (route) => {
    const path = new URL(route.request().url()).pathname;
    pathfinderRequests.push(path);
    const gate = deferred();
    pathfinderGates.set(path, gate);
    await gate.promise;
    await route.fulfill({ body: ONE_PIXEL_PNG, contentType: "image/png" });
  });
  await page.route("**/assets/creative-work/berserk-poster-redesign/magazine%20cover.png", async (route) => {
    berserkRequest = new URL(route.request().url()).pathname;
    await berserkGate.promise;
    await route.fulfill({ body: ONE_PIXEL_PNG, contentType: "image/png" });
  });

  await page.goto("/home.html");
  await openPathfinder(page);

  await expect.poll(() => pathfinderRequests).toEqual([pathfinderSources[0]]);
  for (let index = 0; index < pathfinderSources.length - 1; index += 1) {
    pathfinderGates.get(pathfinderSources[index]).resolve();
    await expect.poll(() => pathfinderRequests).toEqual(pathfinderSources.slice(0, index + 2));
    expect(berserkRequest).toBeNull();
  }

  pathfinderGates.get(pathfinderSources.at(-1)).resolve();
  await expect.poll(() => berserkRequest).toBe(
    "/assets/creative-work/berserk-poster-redesign/magazine%20cover.png"
  );
  berserkGate.resolve();
});

test("Modeling warms mixed video and image carousel media in display order", async ({ page }) => {
  const requests = [];
  const gates = new Map();

  await page.addInitScript(disableRandomEvents);
  await page.route("**/assets/modeling/stand-still-mar26/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const gate = deferred();
    gates.set(path, gate);
    await gate.promise;
    await route.fulfill({
      body: ONE_PIXEL_PNG,
      contentType: path.endsWith(".mp4") ? "video/mp4" : "image/png",
    });
  });

  await page.goto("/home.html");
  await page.locator('.taskbar-icon[data-app="modeling"]').click();

  await expect.poll(() => requests).toEqual([standStillSources[0]]);
  await page.waitForTimeout(100);
  expect(requests).toEqual([standStillSources[0]]);

  for (let index = 0; index < standStillSources.length; index += 1) {
    gates.get(standStillSources[index]).resolve();
    if (index + 1 < standStillSources.length) {
      await expect.poll(() => requests).toEqual(standStillSources.slice(0, index + 2));
    }
  }

  await expect(
    page.locator('[data-app-window="modeling"] .gallery-counter').first()
  ).toHaveText("1 of 6");
  expect(requests).toEqual(standStillSources);
});
