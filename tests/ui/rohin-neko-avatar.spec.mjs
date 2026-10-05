import { expect, test } from "./deterministic.mjs";
import { FROZEN_INSTANT } from "./helpers/rendered-site.mjs";

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const ROHIN_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});

/**
 * `NEKO_NAP_FRAME_SWITCH_FRAMES * NEKO_FRAME_INTERVAL_MS` in
 * `scripts/home/features/neko.js`: the interval a napping avatar swaps sprites
 * on. The cases below drive the page clock to the boundary and over it, so the
 * cadence is asserted exactly instead of slept through.
 */
const NAP_FRAME_SWITCH_MS = 800;

/**
 * An installed clock still ticks with real time, so it is paused once the page
 * has booted. Every avatar in these cases is therefore created at a known
 * instant, and the sprite schedule is driven entirely by `runFor`.
 */
const prepareRohinProfilePage = async (page) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await page.addInitScript(
    ({ profileStorageKey, profile }) => {
      Math.random = () => 0.999999;
      localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    },
    { profileStorageKey: PROFILE_STORAGE_KEY, profile: ROHIN_PROFILE }
  );
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  const booted = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(booted + 1_000));
};

const spriteOf = (locator) =>
  locator.evaluate((element) => element.getAttribute("src")?.split("/").pop());

test("Game Progress opens a sleeping Rohin Neko avatar at the roaming Neko nap cadence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await prepareRohinProfilePage(page);

  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Game Progress" })
    .click();

  const avatar = page.locator("#game-progress-window img[data-rohin-neko-avatar]");
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute("src", /assets\/neko-assets\/sprites\/sleep1\.png$/);

  await page.clock.runFor(NAP_FRAME_SWITCH_MS - 1);
  expect(await spriteOf(avatar), "the nap frame holds until its interval ends").toBe(
    "sleep1.png"
  );
  await page.clock.runFor(1);
  expect(await spriteOf(avatar)).toBe("sleep2.png");
  await page.clock.runFor(NAP_FRAME_SWITCH_MS);
  expect(await spriteOf(avatar), "the nap alternates rather than advancing").toBe(
    "sleep1.png"
  );
});

test("visible Rohin Neko icons animate independently with the canonical scratch frames", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await prepareRohinProfilePage(page);

  await page.evaluate(() => {
    const rolls = [0, 0.3, 0, 0];
    let rollIndex = 0;
    Math.random = () => rolls[Math.min(rollIndex++, rolls.length - 1)];
    for (const id of ["sleeping-rohin-neko", "awake-rohin-neko"]) {
      const image = document.createElement("img");
      image.id = id;
      image.dataset.rohinNekoAvatar = "true";
      image.alt = "";
      document.body.append(image);
    }
  });

  const sleepingAvatar = page.locator("#sleeping-rohin-neko");
  const awakeAvatar = page.locator("#awake-rohin-neko");
  await expect(sleepingAvatar).toHaveAttribute(
    "src",
    /assets\/neko-assets\/sprites\/sleep1\.png$/
  );
  await expect(awakeAvatar).toHaveAttribute(
    "src",
    /assets\/neko-assets\/sprites\/yawn1\.png$/
  );

  // The awake avatar waits out its initial action delay; the sleeping one is
  // already napping. One run past both boundaries separates the two schedules.
  await page.clock.runFor(1_025);
  expect(await spriteOf(sleepingAvatar)).toBe("sleep2.png");
  expect(await spriteOf(awakeAvatar)).toBe("scratch1.png");
});
