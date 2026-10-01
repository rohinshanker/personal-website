import {
  SOLITAIRE_NESTED_INTERACTIVE,
  scanForViolations,
} from "./helpers/accessibility-contracts.mjs";

import { expect, test } from "./deterministic.mjs";
import {
  installStubbedModelingMedia,
  openApp,
  openDeterministicRoute,
  openHomeDesktop,
  openSudokuBoard,
  settleRender,
} from "./helpers/rendered-site.mjs";

/**
 * Automated WCAG 2.1 A/AA scanning for the routes, dialogs, and application
 * windows a visitor reaches without signing in.
 *
 * Every scan runs against the whole rendered document with no rule disabled and
 * no selector excluded. States assert an exact violation list, so a new defect
 * fails the suite and a repaired one fails it too until the record is updated.
 */

const MOBILE = Object.freeze({ width: 375, height: 812 });
const DESKTOP = Object.freeze({ width: 1280, height: 800 });

/**
 * Reads the accessible-name source of every progress bar in the document,
 * including the ones that only appear during a transient loading state.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
const readProgressBarNames = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="progressbar"]')].map((element) => {
      const labelledBy = element.getAttribute("aria-labelledby");
      const referenced = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .join(" ")
            .trim()
        : "";
      return {
        id: element.id || element.className,
        name: (element.getAttribute("aria-label") ?? "").trim() || referenced,
      };
    })
  );

test.describe("entry route accessibility", () => {
  for (const [name, viewport] of Object.entries({ mobile: MOBILE, desktop: DESKTOP })) {
    test(`index.html is free of WCAG A/AA violations while loading and when ready at ${name}`, async ({
      page,
    }, testInfo) => {
      await openDeterministicRoute(page, "/", viewport);
      await expect(page.locator("#progress-bar")).toBeVisible();
      expect(await scanForViolations(page, testInfo, `index-loading-${name}`)).toEqual([]);

      await expect(page.locator("#proceed-button")).toBeEnabled({ timeout: 20_000 });
      await settleRender(page);
      expect(await scanForViolations(page, testInfo, `index-ready-${name}`)).toEqual([]);
    });
  }

  test("the entry alert dialog is free of WCAG A/AA violations", async ({
    page,
  }, testInfo) => {
    await openDeterministicRoute(page, "/", DESKTOP);
    await page.locator("#cancel-button").click();
    await expect(page.locator("#alert-overlay")).toHaveAttribute("aria-hidden", "false");
    await settleRender(page);

    expect(await scanForViolations(page, testInfo, "index-alert")).toEqual([]);
  });

  test("the entry progress bar has an accessible name", async ({ page }) => {
    await openDeterministicRoute(page, "/", DESKTOP);

    expect(await readProgressBarNames(page)).toEqual([
      { id: "progress-indicator segmented", name: "Rohin OS download progress" },
    ]);
  });
});

test.describe("home route accessibility", () => {
  test("the About window that greets every visitor is free of WCAG A/AA violations", async ({
    page,
  }, testInfo) => {
    await openDeterministicRoute(page, "/home.html", DESKTOP);
    await expect(page.locator("#about-window")).toBeVisible();

    expect(await scanForViolations(page, testInfo, "home-about")).toEqual([]);
  });

  test("every Home progress bar has an accessible name, including hidden loading states", async ({
    page,
  }) => {
    await openHomeDesktop(page, DESKTOP);

    const named = await readProgressBarNames(page);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((bar) => !bar.name)).toEqual([]);
  });

  for (const [name, viewport] of Object.entries({ mobile: MOBILE, desktop: DESKTOP })) {
    test(`the Home desktop is free of WCAG A/AA violations at ${name}`, async ({
      page,
    }, testInfo) => {
      await openHomeDesktop(page, viewport);

      expect(await scanForViolations(page, testInfo, `home-desktop-${name}`)).toEqual([]);
    });
  }

  /**
   * Application windows reachable from the taskbar without authentication, each
   * paired with the wait that proves its content finished rendering.
   */
  const APP_WINDOWS = Object.freeze([
    {
      app: "minesweeper",
      settle: (page) =>
        expect(page.locator('#ms-grid [role="row"] .ms-cell').first()).toBeVisible(),
    },
    {
      app: "sudoku",
      // Sudoku boots through a loading screen; the board only renders after Play.
      open: openSudokuBoard,
      settle: (page) => expect(page.locator(".sudoku-game-content")).toBeVisible(),
    },
    {
      app: "solitaire",
      settle: (page) =>
        expect(page.locator("#sol-tableau .sol-card").first()).toBeVisible(),
      expected: SOLITAIRE_NESTED_INTERACTIVE,
    },
    {
      app: "snake",
      settle: (page) => expect(page.locator("#snake-canvas")).toBeVisible(),
    },
    { app: "game-progress" },
    { app: "credits" },
    { app: "socials" },
    { app: "windows" },
  ]);

  for (const { app, open, settle, expected = [] } of APP_WINDOWS) {
    test(`the ${app} window reports only its recorded WCAG A/AA violations`, async ({
      page,
    }, testInfo) => {
      await openHomeDesktop(page, DESKTOP);
      await (open ? open(page) : openApp(page, app));
      if (settle) await settle(page);
      await settleRender(page);

      expect(await scanForViolations(page, testInfo, `home-${app}`)).toEqual(expected);
    });
  }
});

test.describe("modeling portfolio route accessibility", () => {
  for (const [name, viewport] of Object.entries({ mobile: MOBILE, desktop: DESKTOP })) {
    test(`/modeling/ is free of WCAG A/AA violations at ${name}, including the fullscreen viewer`, async ({
      page,
    }, testInfo) => {
      await installStubbedModelingMedia(page);
      await openDeterministicRoute(page, "/modeling/", viewport);
      await expect(page.locator("section.shoot")).toHaveCount(22);
      expect(await scanForViolations(page, testInfo, `modeling-${name}`)).toEqual([]);

      const shoot = page.locator("#garb-cirque-du-moi-runway-show");
      await shoot.locator("summary").click();
      await shoot.locator(".carousel__photo").first().click();
      await expect(page.locator("[data-lightbox]")).toBeVisible();
      await settleRender(page);
      expect(await scanForViolations(page, testInfo, `modeling-viewer-${name}`)).toEqual([]);
    });
  }

  test("the Home Modeling window and its new-tab prompt are free of WCAG A/AA violations", async ({
    page,
  }, testInfo) => {
    await installStubbedModelingMedia(page);
    await openHomeDesktop(page, DESKTOP);
    await page.locator('.taskbar-icon[data-app="modeling"]').click();
    const prompt = page.locator("#modeling-launch-window");
    await expect(prompt).toBeVisible();
    await expect(prompt).not.toHaveClass(/is-opening/);
    await settleRender(page);

    expect(await scanForViolations(page, testInfo, "home-modeling-launch")).toEqual([]);
  });
});
