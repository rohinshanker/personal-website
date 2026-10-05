import { expect, test as base } from "@playwright/test";

import { routeProductionDebugFlags } from "./helpers/random-event-debug.mjs";
import {
  assertNoRuntimeDiagnostics,
  collectRuntimeDiagnostics,
  installDeterministicSudokuWorker,
  installGameStatsBackend,
  installHermeticNetwork,
  installSkyNameGenerator,
} from "./helpers/rendered-site.mjs";

export { expect };

/**
 * The single fixture every browser spec imports.
 *
 * It owns the hermetic boundary so no spec has to rebuild it: the browser
 * context can reach nothing but the configured test server, Game Stats is
 * offline, production debug popups are suppressed, and the Sudoku generator
 * worker draws the same number every run. Each local mock answers only for the
 * test server's own file, and everything is installed on the context rather
 * than the page, so a popup the page opens is held to the same rules.
 *
 * It also enforces the result: the context is watched from before any page
 * navigates, and the test fails afterwards if any page in it — a popup's first
 * navigation included — logged a console error, threw, or had a request fail.
 * Collecting diagnostics without asserting on them lets a silent page error
 * pass, so the assertion lives here rather than in each spec. A spec that
 * intentionally provokes a failure consumes exactly the entries it expects
 * with `consumeDiagnostics`.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    // First, so every route registered after it — fixture or spec, context or
    // page — answers ahead of the block.
    await installHermeticNetwork(context);
    // The generator worker is a realm of its own, so it is pinned here rather
    // than by the page's init script.
    await installDeterministicSudokuWorker(context);
    await routeProductionDebugFlags(context);
    await installGameStatsBackend(context);
    await installSkyNameGenerator(context);
    await use(context);
  },
  diagnostics: [
    async ({ context }, use) => {
      const diagnostics = collectRuntimeDiagnostics(context);
      await use(diagnostics);
      assertNoRuntimeDiagnostics(diagnostics);
    },
    { auto: true },
  ],
});
