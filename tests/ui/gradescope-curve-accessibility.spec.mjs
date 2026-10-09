import { expect, test } from "./deterministic.mjs";
import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import { REVIEW_VIEWPORTS } from "./helpers/rendered-site.mjs";

const showCurve = (page) => page.evaluate(async () => {
  const definition = window.homeEventRuntime.randomEventDefinitions.find(
    ({ id }) => id === "gradescope-curve"
  );
  await window.homeEventRuntime.preloadRandomEventAssets(definition, {});
  definition.run();
});

for (const viewport of REVIEW_VIEWPORTS) {
  test(`Gradescope graph keeps its accessible group and slider at ${viewport.name}`, async ({
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
    await showCurve(page);
    const win = page.locator("#gradescope-curve-window");
    const group = win.getByRole("group", { name: "Grade distribution graph" });
    const slider = group.getByRole("slider", { name: "Curve peak" });
    await expect(win).toBeVisible();
    await expect(win).not.toHaveClass(/is-opening/);
    expect(await scanForViolations(page, testInfo, `gradescope-prompt-${viewport.name}`))
      .toEqual([]);
    await expect(group).toBeVisible();
    await expect(slider).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("prompt.png"), fullPage: true });
    await win.locator("#gradescope-curve-no").click();
    await expect(win).toBeHidden();

    await showCurve(page);
    await win.locator("#gradescope-curve-yes").click();
    await expect(slider).toBeFocused();
    await expect(slider).toHaveValue("72");
    const initialPath = await win.locator("#gradescope-curve-path").getAttribute("d");
    await slider.press("ArrowRight");
    await expect(slider).toHaveValue("73");
    await expect(win.locator("#gradescope-curve-path")).not.toHaveAttribute("d", initialPath);
    expect(await scanForViolations(page, testInfo, `gradescope-adjust-${viewport.name}`))
      .toEqual([]);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    )).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("adjust.png"), fullPage: true });
    await win.locator("#gradescope-curve-set").click();
    await expect(win).toBeHidden();
    await showCurve(page);
    await win.locator("#gradescope-curve-yes").click();
    await expect(slider).toHaveValue("72");
    await win.locator("#gradescope-curve-set").click();
    await expect(win).toBeHidden();
    await expect(group).toBeHidden();
  });
}
