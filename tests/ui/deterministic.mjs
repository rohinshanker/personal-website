import { expect, test as base } from "@playwright/test";

import { routeProductionDebugFlags } from "./helpers/random-event-debug.mjs";
import {
  assertNoRuntimeDiagnostics,
  collectRuntimeDiagnostics,
  installGameStatsBackend,
  installHermeticNetwork,
  installSkyNameGenerator,
  readDeterministicSudokuWorkerSource,
} from "./helpers/rendered-site.mjs";

export { expect };

/**
 * The single fixture every browser spec imports.
 *
 * It owns the hermetic boundary so no spec has to rebuild it: the browser
 * context can reach nothing but the local test server, Game Stats is offline,
 * production debug popups are suppressed, and the Sudoku generator worker
 * draws the same number every run. Everything is installed on the context
 * rather than the page, so a popup the page opens is held to the same rules.
 *
 * It also enforces the result: listeners attach once per page, and the test
 * fails afterwards if any page in the context logged a console error, threw,
 * or had a request fail. Collecting diagnostics without asserting on them lets
 * a silent page error pass, so the assertion lives here rather than in each
 * spec. A spec that intentionally provokes a failure consumes exactly the
 * entries it expects with `consumeDiagnostics`.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    // First, so every route registered after it — fixture or spec, context or
    // page — answers ahead of the block.
    await installHermeticNetwork(context);
    const sudokuWorkerSource = await readDeterministicSudokuWorkerSource();
    // The generator worker is a realm of its own, so it is pinned here rather
    // than by the page's init script.
    await context.route(/\/scripts\/home\/sudoku-generator\.worker\.js(?:\?.*)?$/, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: sudokuWorkerSource,
      })
    );
    await routeProductionDebugFlags(context);
    await installGameStatsBackend(context);
    await installSkyNameGenerator(context);
    await use(context);
  },
  diagnostics: [
    async ({ context, page }, use) => {
      const diagnostics = collectRuntimeDiagnostics(page);
      context.on("page", (opened) => {
        if (opened !== page) collectRuntimeDiagnostics(opened, diagnostics);
      });
      await use(diagnostics);
      assertNoRuntimeDiagnostics(diagnostics);
    },
    { auto: true },
  ],
});
