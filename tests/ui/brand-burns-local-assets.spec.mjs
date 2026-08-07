import { expect, test } from "./fixtures.mjs";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]);
const apostleSources = Object.freeze([
  "assets/random%20events/brand-burns/femto.webp",
  "assets/random%20events/brand-burns/zodd.webp",
  "assets/random%20events/brand-burns/grunbeld.webp",
  "assets/random%20events/brand-burns/borkoff.webp",
  "assets/random%20events/brand-burns/locus.webp",
  "assets/random%20events/brand-burns/irvine.webp",
  "assets/random%20events/brand-burns/ganishka.webp",
  "assets/random%20events/brand-burns/wyald.webp",
  "assets/random%20events/brand-burns/snake-lord.webp",
  "assets/random%20events/brand-burns/rakshas.webp",
]);

for (const viewport of viewports) {
  test(`Brand Burns Apostle art loads locally at ${viewport.name}`, async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.setViewportSize(viewport);
    await page.route(
      /https:\/\/personal-site-game-stats\.rohinshankerme\.workers\.dev\/stats(?:\?|$)/,
      (route) => route.fulfill({ body: "{}", contentType: "application/json" })
    );
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await page.goto("/home.html");

    const aboutClose = page.locator('#about-window [data-close="about"]');
    if (await aboutClose.isVisible()) await aboutClose.click();

    const imageResults = await page.evaluate((sources) =>
      Promise.all(
        sources.map(
          (src) =>
            new Promise((resolve) => {
              const image = new Image();
              image.addEventListener(
                "load",
                () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight }),
                { once: true }
              );
              image.addEventListener(
                "error",
                () => resolve({ src, width: 0, height: 0 }),
                { once: true }
              );
              image.src = src;
            })
        )
      ),
      apostleSources
    );
    expect(imageResults).toHaveLength(apostleSources.length);
    expect(imageResults.every((image) => image.width > 0 && image.height > 0)).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
}
