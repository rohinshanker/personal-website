import { expect, test as base } from "./fixtures.mjs";
import {
  assertNoRuntimeDiagnostics,
  collectRuntimeDiagnostics,
} from "./helpers/rendered-site.mjs";

export { expect };

/**
 * The fixture every deterministic spec uses.
 *
 * It layers automatic runtime-diagnostic enforcement over the shared debug
 * isolator: listeners attach once per page, and the test fails afterwards if
 * the page logged a console error, threw, or had a request fail. Collecting
 * diagnostics without asserting on them lets a silent page error pass, so the
 * assertion lives here rather than in each spec.
 *
 * A spec that intentionally provokes a failure should read `diagnostics` and
 * clear the entries it expects.
 */
export const test = base.extend({
  diagnostics: [
    async ({ page }, use) => {
      const diagnostics = collectRuntimeDiagnostics(page);
      await use(diagnostics);
      assertNoRuntimeDiagnostics(diagnostics);
    },
    { auto: true },
  ],
});
