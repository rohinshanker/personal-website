import { expect, test } from "./deterministic.mjs";
import {
  REVIEW_VIEWPORTS,
  installStubbedModelingMedia,
  openHomeDesktop,
  settleRender,
} from "./helpers/rendered-site.mjs";

test.setTimeout(120_000);

const DESKTOP = REVIEW_VIEWPORTS.find((viewport) => viewport.name === "desktop");
const MESSAGE = "Open in separate tab (rohin.shanker.me/modeling)?";
const BLOCKED_MESSAGE =
  "The new tab was blocked. Allow pop-ups for this site, then choose Yes again.";

const modelingWindow = (page) => page.locator('[data-app-window="modeling"]');
const prompt = (page) => page.locator("#modeling-launch-window");
const yes = (page) => page.locator("#modeling-launch-yes");
const no = (page) => page.locator("#modeling-launch-no");

const zIndex = (locator) => locator.evaluate((element) => Number(element.style.zIndex));

const openHome = async (page, viewport) => {
  await installStubbedModelingMedia(page.context());
  await openHomeDesktop(page, viewport);
};

/** Launches Modeling and waits for both windows to finish their opening animation. */
const launchModeling = async (page, launcherSelector) => {
  const launcher = page.locator(launcherSelector);
  await launcher.scrollIntoViewIfNeeded();
  await launcher.focus();
  await launcher.press("Enter");
  await expect(modelingWindow(page)).toBeVisible();
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page)).not.toHaveClass(/is-opening/);
  await expect(modelingWindow(page)).not.toHaveClass(/is-opening/);
  await expect(yes(page)).toBeFocused();
  await settleRender(page);
  return launcher;
};

const expectPromptInsideViewport = async (page, viewport) => {
  const metrics = await prompt(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      taskbarTop,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(viewport.width);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop);
  expect(metrics.overflow).toBe(false);
};

test("opening Modeling shows the new-tab prompt above the window at every review viewport", async ({
  page,
}, testInfo) => {
  for (const viewport of REVIEW_VIEWPORTS) {
    await test.step(viewport.name, async () => {
      await openHome(page, viewport);
      const launcher = await launchModeling(page, '.taskbar-icon[data-app="modeling"]');

      await expect(prompt(page)).toHaveAttribute("role", "alertdialog");
      await expect(prompt(page)).toHaveAttribute("aria-modal", "false");
      await expect(prompt(page)).toHaveAttribute("aria-hidden", "false");
      await expect(prompt(page)).toHaveAccessibleName("Modeling");
      await expect(prompt(page)).toHaveAccessibleDescription(MESSAGE);
      await expect(prompt(page).locator(".random-alert-message img")).toHaveAttribute(
        "src",
        "assets/app-icons/ico/accessibility_window_objs.ico"
      );
      await expect(yes(page)).toHaveAccessibleName("Yes");
      await expect(no(page)).toHaveAccessibleName("No");
      await expect(page.locator("#modeling-launch-error")).toBeHidden();
      expect(await zIndex(prompt(page))).toBeGreaterThan(await zIndex(modelingWindow(page)));
      await expectPromptInsideViewport(page, viewport);
      await page.screenshot({
        path: testInfo.outputPath(`modeling-launch-${viewport.name}.png`),
      });

      await no(page).press("Enter");
      await expect(prompt(page)).toBeHidden();
      await expect(prompt(page)).toHaveAttribute("aria-hidden", "true");
      await expect(modelingWindow(page)).toBeVisible();
      await expect(launcher).toBeFocused();
    });
  }
});

test("Yes opens /modeling/ in a secure new tab and closes only the prompt", async ({ page }) => {
  await openHome(page, DESKTOP);
  const launcher = await launchModeling(page, '.desktop-icon[data-app="modeling"]');

  const popupPromise = page.waitForEvent("popup");
  await yes(page).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");

  expect(new URL(popup.url()).pathname).toBe("/modeling/");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(popup.getByRole("heading", { level: 1 })).toHaveText(
    "Rohin Shanker Modeling Portfolio"
  );
  await popup.close();

  await expect(prompt(page)).toBeHidden();
  await expect(modelingWindow(page)).toBeVisible();
  await expect(launcher).toBeFocused();
});

test("the prompt returns every time Modeling reopens, and Escape or Close dismiss only the prompt", async ({
  page,
}) => {
  await openHome(page, DESKTOP);
  const taskbarLauncher = '.taskbar-icon[data-app="modeling"]';
  await launchModeling(page, taskbarLauncher);

  await page.keyboard.press("Escape");
  await expect(prompt(page)).toBeHidden();
  await expect(modelingWindow(page)).toBeVisible();

  // A second press on the launcher toggles the open window closed and shows no prompt.
  await page.locator(taskbarLauncher).click();
  await expect(modelingWindow(page)).toBeHidden();
  await expect(prompt(page)).toBeHidden();

  await launchModeling(page, taskbarLauncher);
  await prompt(page).locator('[data-close="modeling-launch"]').first().click();
  await expect(prompt(page)).toBeHidden();
  await expect(modelingWindow(page)).toBeVisible();

  await modelingWindow(page).locator('[data-close="modeling"]').click();
  await expect(modelingWindow(page)).toBeHidden();
  await launchModeling(page, '.desktop-icon[data-app="modeling"]');
  await expect(prompt(page)).toBeVisible();
});

test("a blocked popup keeps the prompt open with an actionable error", async ({ page }) => {
  await openHome(page, DESKTOP);
  await page.evaluate(() => {
    window.open = () => null;
  });
  await launchModeling(page, '.taskbar-icon[data-app="modeling"]');

  await yes(page).click();
  const error = page.locator("#modeling-launch-error");
  await expect(error).toBeVisible();
  await expect(error).toHaveText(BLOCKED_MESSAGE);
  await expect(error).toHaveAttribute("role", "alert");
  await expect(prompt(page)).toBeVisible();
  await expect(yes(page)).toBeFocused();

  await no(page).click();
  await expect(prompt(page)).toBeHidden();
  await modelingWindow(page).locator('[data-close="modeling"]').click();
  await expect(modelingWindow(page)).toBeHidden();
  await launchModeling(page, '.taskbar-icon[data-app="modeling"]');
  await expect(error).toBeHidden();
});
