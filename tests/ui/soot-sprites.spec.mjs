import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";

/**
 * The soot-sprite swarm is built across animation frames while the alert holds,
 * from one pixel-art sheet per swarm plus shared candy and smoke sheets. These
 * checks drive the real event through the runtime's run callback and verify the
 * rendered swarm's structure at both sprite counts and under reduced motion.
 */
const viewports = [
  { name: "mobile", width: 375, height: 812, sprites: 20 },
  { name: "desktop", width: 1280, height: 800, sprites: 32 },
];

const exposeRuntime = (page) =>
  routeHomeScript(page, "eventRuntime", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__sootSpritesTest = Object.freeze({
  show: () => randomEventDefinitions.find((definition) => definition.id === "soot-sprites").run({
    triggerName: "adminControls", detail: { source: "soot-test" }, admin: true,
  }),
});
})();`,
    ),
  );

const releaseSwarm = async (page) => {
  await page.evaluate(() => window.__sootSpritesTest.show());
  const alert = page.locator("#soot-sprites-window");
  await expect(alert).toBeVisible();
  await alert.locator("#soot-sprites-yes").click();
  const overlay = page.locator(".soot-sprites-swarm");
  await expect(overlay).toHaveCount(1);
  await expect(overlay).not.toHaveClass(/is-staged/, { timeout: 10_000 });
  // Candies and smoke keep arriving in batches after the release.
  await page.evaluate(() => document.querySelector(".soot-sprites-swarm").sootEffectsReady);
  return overlay;
};

const readSwarm = (page) =>
  page.evaluate(() => {
    const overlay = document.querySelector(".soot-sprites-swarm");
    const sprites = [...overlay.querySelectorAll(".soot-sprite")];
    const frames = sprites.map((sprite) =>
      sprite.querySelector(".soot-sprite-body > .soot-sprite-frame"),
    );
    const candies = [...overlay.querySelectorAll(".soot-star-candy")];
    const puffs = [...overlay.querySelectorAll(".soot-puff")];
    const sheet = frames[0]?.style.backgroundImage ?? "";
    return {
      sprites: sprites.length,
      framesWithSheet: frames.filter(
        (frame) =>
          frame && getComputedStyle(frame).backgroundImage.startsWith('url("data:image/png'),
      ).length,
      pixelated: frames.filter((frame) => getComputedStyle(frame).imageRendering === "pixelated")
        .length,
      eyes: overlay.querySelectorAll(".soot-sprite-eye").length,
      sheetIsPng: sheet.startsWith('url("data:image/png'),
      candies: candies.length,
      candiesWithSlot: candies.filter(
        (candy) => candy.style.getPropertyValue("--soot-candy-slot") !== "",
      ).length,
      candyBackgrounds: candies.filter((candy) =>
        getComputedStyle(candy).backgroundImage.startsWith('url("data:image/png'),
      ).length,
      puffs: puffs.length,
      puffsWithShape: puffs.filter(
        (puff) => puff.style.getPropertyValue("--soot-puff-shape") !== "",
      ).length,
      animationsPerSprite: sprites.map(
        (sprite) =>
          sprite.getAnimations().length +
          sprite.querySelector(".soot-sprite-body").getAnimations().length +
          sprite.querySelector(".soot-sprite-frame").getAnimations().length,
      ),
      runningMotion: sprites.filter((sprite) =>
        sprite.getAnimations().some((animation) => animation.playState === "running"),
      ).length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

for (const viewport of viewports) {
  test(`the swarm builds ${viewport.sprites} pixel-art sprites with shared sheets at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await exposeRuntime(page);
    await page.goto("/home.html");
    await releaseSwarm(page);
    const swarm = await readSwarm(page);
    expect(swarm.sprites).toBe(viewport.sprites);
    expect(swarm.framesWithSheet).toBe(viewport.sprites);
    expect(swarm.pixelated).toBe(viewport.sprites);
    expect(swarm.eyes).toBe(0);
    expect(swarm.sheetIsPng).toBe(true);
    expect(swarm.candies).toBeGreaterThan(0);
    expect(swarm.candiesWithSlot).toBe(swarm.candies);
    expect(swarm.candyBackgrounds).toBe(swarm.candies);
    expect(swarm.puffs).toBeGreaterThan(0);
    expect(swarm.puffsWithShape).toBe(swarm.puffs);
    // Motion on the sprite, boil on the frame, and the CSS wobble plus the tremble on the body.
    expect(new Set(swarm.animationsPerSprite)).toEqual(new Set([4]));
    expect(swarm.runningMotion).toBe(viewport.sprites);
    expect(swarm.overflow).toBe(false);
  });
}

test("reduced motion keeps the sprites still apart from their path", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await exposeRuntime(page);
  await page.goto("/home.html");
  await releaseSwarm(page);
  const swarm = await readSwarm(page);
  expect(swarm.sprites).toBe(32);
  expect(swarm.framesWithSheet).toBe(32);
  expect(new Set(swarm.animationsPerSprite)).toEqual(new Set([1]));
  expect(swarm.runningMotion).toBe(32);
});
