import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = Object.freeze(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

/**
 * Solitaire's stock and tableau columns are keyboard controls that contain the
 * individually clickable card buttons, so axe reports nested interactive
 * content. Removing the nesting means redesigning Solitaire's keyboard model,
 * which is outside this change. Recording the exact node set keeps the defect
 * visible and fails the suite if it spreads or is repaired.
 */
export const SOLITAIRE_NESTED_INTERACTIVE = Object.freeze([
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
export const scanForViolations = async (page, testInfo, label) => {
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

