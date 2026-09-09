import { writeFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./deterministic.mjs";
import {
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

const WCAG_TAGS = Object.freeze(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

const MOBILE = Object.freeze({ width: 375, height: 812 });
const DESKTOP = Object.freeze({ width: 1280, height: 800 });

/**
 * Solitaire's stock and tableau columns are keyboard controls that contain the
 * individually clickable card buttons, so axe reports nested interactive
 * content. Removing the nesting means redesigning Solitaire's keyboard model,
 * which is outside this change. Recording the exact node set keeps the defect
 * visible and fails the suite if it spreads or is repaired.
 */
const SOLITAIRE_NESTED_INTERACTIVE = Object.freeze([
  Object.freeze({
    id: "nested-interactive",
    impact: "serious",
    nodes: Object.freeze([
      "#sol-stock",
      'div[data-sol-col="0"]',
      'div[data-sol-col="1"]',
      'div[data-sol-col="2"]',
      'div[data-sol-col="3"]',
      'div[data-sol-col="4"]',
      'div[data-sol-col="5"]',
      'div[data-sol-col="6"]',
    ]),
  }),
]);

/**
 * Runs axe over the current page and writes the full violation report beside
 * the test's other artifacts.
 *
 * @param {import("@playwright/test").Page} page
 * @param {import("@playwright/test").TestInfo} testInfo
 * @param {string} label state name used for the report file.
 * @returns {Promise<Array<{id: string, impact: string | undefined, nodes: string[]}>>}
 *   one compact record per violated rule, empty when the state is clean.
 */
const scanForViolations = async (page, testInfo, label) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const reportPath = testInfo.outputPath(`axe-${label}.json`);
  await writeFile(reportPath, JSON.stringify(results.violations, null, 2), "utf8");
  await testInfo.attach(`axe-${label}.json`, {
    path: reportPath,
    contentType: "application/json",
  });
  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
};

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
