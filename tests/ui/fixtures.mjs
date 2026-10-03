import { expect, test as base } from "@playwright/test";
import { routeProductionDebugFlags } from "./helpers/random-event-debug.mjs";
import { readDeterministicSudokuWorkerSource } from "./helpers/rendered-site.mjs";

export { expect };

export const test = base.extend({
  page: async ({ page }, use) => {
    const [, sudokuWorkerSource] = await Promise.all([
      routeProductionDebugFlags(page),
      readDeterministicSudokuWorkerSource(),
    ]);
    // The generator worker is a realm of its own, so it is pinned here rather
    // than by the page's init script.
    await page.route(/\/scripts\/home\/sudoku-generator\.worker\.js(?:\?.*)?$/, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: sudokuWorkerSource,
      })
    );
    await use(page);
  },
});
