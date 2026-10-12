import { writeFile } from "node:fs/promises";

import { expect, test } from "./deterministic.mjs";
import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import { REVIEW_VIEWPORTS } from "./helpers/rendered-site.mjs";

/**
 * With every draw pinned to 0.999999 the event's hidden target lands at
 * frequency 80 and phase 100, so these dial positions lock the signal.
 */
const LOCKED_FREQUENCY = "80";
const LOCKED_PHASE = "100";

const showDistressSignal = (page) => page.evaluate(async () => {
  const definition = window.homeEventRuntime.randomEventDefinitions.find(
    ({ id }) => id === "distress-signal"
  );
  await window.homeEventRuntime.preloadRandomEventAssets(definition, {});
  definition.run();
});

/** The progressbar's announced value and the bar's rendered fill, in percent. */
const readPowerProgress = (page) => page.evaluate(() => {
  const track = document.querySelector("#distress-power-progress");
  const bar = document.querySelector("#distress-power-progress-bar");
  const { paddingLeft, paddingRight } = getComputedStyle(track);
  const fillableWidth =
    track.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
  return {
    value: Number(track.getAttribute("aria-valuenow")),
    fill: (bar.getBoundingClientRect().width / fillableWidth) * 100,
  };
});

/** Records the rendered and semantic state for review beside the axe report. */
const captureState = async (page, win, testInfo, label) => {
  await page.screenshot({ path: testInfo.outputPath(`${label}.png`), fullPage: true });
  await writeFile(testInfo.outputPath(`${label}.aria.yml`), await win.ariaSnapshot(), "utf8");
  expect(await scanForViolations(page, testInfo, label)).toEqual([]);
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth
  )).toBe(false);
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`Distress Signal exposes synchronized receiver power and a labelled minimap at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      Math.random = () => 0.999999;
    });
    await page.goto("/home.html");
    await page.locator('#about-window [data-close="about"]').click();
    await expect(page.locator("#about-window")).toBeHidden();

    await showDistressSignal(page);
    const win = page.locator("#distress-signal-window");
    const power = win.getByRole("progressbar", { name: "Receiver power" });
    const minimap = win.getByRole("img", { name: "Signal direction minimap" });
    const powerButton = win.getByRole("button", { name: "Power" });
    const status = win.locator("#distress-lock-status-text");
    await expect(win).toBeVisible();
    await expect(win).not.toHaveClass(/is-opening/);

    await expect(power).toHaveAttribute("aria-valuemin", "0");
    await expect(power).toHaveAttribute("aria-valuemax", "100");
    await expect(power).toHaveAttribute("aria-valuenow", "0");
    await expect(minimap).toBeVisible();
    await expect(status).toHaveText("Receiver offline");
    await expect(win.locator("#distress-nav-state")).toHaveText("Map offline");
    await captureState(page, win, testInfo, `distress-off-${viewport.name}`);

    await powerButton.click();
    await expect(powerButton).toBeDisabled();
    await expect(status).toHaveText("Receiver warming up");
    let charging;
    await expect.poll(async () => {
      charging = await readPowerProgress(page);
      return charging.value > 0 && charging.value < 100;
    }).toBe(true);
    expect(Math.abs(charging.fill - charging.value)).toBeLessThanOrEqual(1);
    await captureState(page, win, testInfo, `distress-charging-${viewport.name}`);

    await expect(power).toHaveAttribute("aria-valuenow", "100", { timeout: 6_000 });
    await expect(status).toHaveText("Signal drifting");
    await expect(win.getByRole("slider", { name: "Frequency" })).toBeFocused();
    const on = await readPowerProgress(page);
    expect(Math.abs(on.fill - 100)).toBeLessThanOrEqual(1);
    await captureState(page, win, testInfo, `distress-on-${viewport.name}`);

    await win.getByRole("slider", { name: "Frequency" }).fill(LOCKED_FREQUENCY);
    await win.getByRole("slider", { name: "Phase" }).fill(LOCKED_PHASE);
    await expect(status).toHaveText("Signal locked");
    await expect(win.locator("#distress-nav-state")).toHaveText("Signal acquired");
    await expect(power).toHaveAttribute("aria-valuenow", "100");
    const upload = page.locator("#distress-upload-window");
    await expect(upload).toBeVisible();
    await expect(upload.getByRole("button", { name: "OK" })).toBeFocused();
    await captureState(page, win, testInfo, `distress-locked-${viewport.name}`);

    await upload.getByRole("button", { name: "OK" }).click();
    await expect(win).toBeHidden();
    await expect(upload).toBeHidden();

    await showDistressSignal(page);
    await expect(win).toBeVisible();
    await expect(power).toHaveAttribute("aria-valuenow", "0");
    await expect(powerButton).toBeEnabled();
    await expect(status).toHaveText("Receiver offline");
    expect((await readPowerProgress(page)).fill).toBe(0);
  });
}
