import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORTS } from "./helpers/rendered-site.mjs";

const viewports = REVIEW_VIEWPORTS;

const digitSources = async (total) =>
  total.locator("img").evaluateAll((images) =>
    images.map((image) => new URL(image.src).pathname)
  );

const expectedSources = (digits) =>
  digits.split("").map(
    (digit) =>
      `/assets/minesweeper_assets/digital_digits/digital_${
        digit === " " ? "unlit" : digit === "-" ? "minus" : digit
      }.png`
  );

for (const viewport of viewports) {
  test(`Counter uses unlit leading digits at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await page.goto("/home.html");
    await page.locator('.taskbar-icon[data-app="life-counter"]').click();

    const app = page.locator('[data-app-window="life-counter"]');
    const total = app.locator(".life-counter-total");
    const valueInput = app.getByRole("spinbutton", { name: "Set value for Player 1" });
    const submit = app.getByRole("button", { name: "Submit value for Player 1" });
    await expect(app).toBeVisible();
    await expect(total).toHaveAttribute("aria-label", "20");
    await expect(total).toHaveAttribute("role", "img");
    await expect(digitSources(total)).resolves.toEqual(expectedSources("   20"));

    await valueInput.fill("-20");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(total).toHaveAttribute("aria-label", "-20");
    await expect(digitSources(total)).resolves.toEqual(expectedSources("-  20"));

    await valueInput.fill("99999");
    await submit.click();
    await expect(total).toHaveAttribute("aria-label", "99999");
    await expect(digitSources(total)).resolves.toEqual(expectedSources("99999"));

    const layout = await app.evaluate((appElement) => {
      const rect = appElement.getBoundingClientRect();
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        right: rect.right,
        visibleDigitCount: appElement.querySelectorAll(".life-counter-total img").length,
      };
    });
    expect(layout.documentOverflows).toBe(false);
    expect(layout.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.visibleDigitCount).toBe(5);
  });
}
