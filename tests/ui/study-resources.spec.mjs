import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import { expect, test } from "./deterministic.mjs";
import {
  REVIEW_VIEWPORTS,
  openApp,
  openHomeDesktop,
  settleRender,
} from "./helpers/rendered-site.mjs";

const BREAKPOINT_VIEWPORTS = Object.freeze([
  Object.freeze({ name: "compact-below", width: 759, height: 900 }),
  Object.freeze({ name: "compact-above", width: 761, height: 900 }),
]);
const VIEWPORTS = Object.freeze([...REVIEW_VIEWPORTS, ...BREAKPOINT_VIEWPORTS]);
const DIALOG_BLUE = "rgb(0, 0, 128)";
const WHITE = "rgb(255, 255, 255)";
const SAMPLE_PDF_PATH = "assets/writing/MEC-Comment.pdf";

const installStudyResource = async (page) => {
  await page.route(/\/assets\/study(?:%20| )resources\/manifest\.json$/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        root: "Study Resources",
        basePath: "assets/study%20resources",
        files: [
          {
            folderPath: ["Yale"],
            name: "Biomedical Engineering Study Guide.pdf",
            path: SAMPLE_PDF_PATH,
            downloadName: "Biomedical Engineering Study Guide.pdf",
            sizeBytes: 4096,
            thumbnailPages: [1],
          },
        ],
      }),
    })
  );
};

const openStudyResources = async (page, viewport) => {
  await installStudyResource(page);
  await openHomeDesktop(page, viewport);
  const win = await openApp(page, "study-resources");
  await expect(win.locator('[data-study-file="yale"]')).toBeVisible();
  return win;
};

const readPaintAndRect = (locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const { x, y, width, height } = element.getBoundingClientRect();
    return {
      background: style.backgroundColor,
      color: style.color,
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      rect: { x, y, width, height },
    };
  });

const focusFromKeyboard = async (page, locator) => {
  await locator.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(locator).toBeFocused();
};

for (const viewport of VIEWPORTS) {
  test(`clickable rows keep stable blue hover and focus states at ${viewport.name}`, async ({
    page,
  }) => {
    const win = await openStudyResources(page, viewport);
    const folder = win.locator('[data-study-file="yale"]');
    const treeRow = win.locator('.study-tree-row:has([data-study-select="yale"])');
    const treeItem = treeRow.locator('[data-study-select="yale"]');
    const treeToggle = treeRow.locator('[data-study-toggle="yale"]');
    const disabledAction = win.locator("#study-download");

    await expect(disabledAction).toBeDisabled();
    const disabledBackground = await disabledAction.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );

    const folderBefore = await readPaintAndRect(folder);
    await focusFromKeyboard(page, folder);
    await folder.hover();
    const folderHover = await readPaintAndRect(folder);
    expect(folderHover.background).toBe(DIALOG_BLUE);
    expect(folderHover.color).toBe(WHITE);
    expect(folderHover.outlineColor).toBe(WHITE);
    expect(folderHover.rect.width).toBe(folderBefore.rect.width);
    expect(folderHover.rect.height).toBe(folderBefore.rect.height);

    const secondaryText = folder.locator(
      ".study-file-type, .study-file-subitems, .study-file-storage"
    );
    await expect
      .poll(() =>
        secondaryText.evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).color)
        )
      )
      .toEqual([WHITE, WHITE, WHITE]);

    await focusFromKeyboard(page, treeToggle);
    await treeToggle.hover();
    await expect
      .poll(() => treeItem.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe(DIALOG_BLUE);
    await expect
      .poll(() => treeToggle.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe(DIALOG_BLUE);
    expect((await readPaintAndRect(treeToggle)).outlineColor).toBe(WHITE);

    await page.mouse.move(0, 0);
    await treeToggle.focus();
    await page.keyboard.press("Tab");
    await expect(treeItem).toBeFocused();
    const focused = await readPaintAndRect(treeItem);
    expect(focused.outlineStyle).toBe("dotted");
    expect(focused.outlineColor).toBe("rgb(0, 0, 0)");

    await folder.click();
    const selectedFolder = win.locator('[data-study-file="pdf-yale-biomedical-engineering-study-guide-pdf"]');
    await expect(selectedFolder).toBeVisible();
    const selectedTreeItem = win.locator('[data-study-select="yale"]');
    await expect(selectedTreeItem).toHaveClass(/is-selected/);
    await selectedTreeItem.focus();
    const selectedFocus = await readPaintAndRect(selectedTreeItem);
    expect(selectedFocus.background).toBe(DIALOG_BLUE);
    expect(selectedFocus.color).toBe(WHITE);
    expect(selectedFocus.outlineColor).toBe(WHITE);

    await disabledAction.hover();
    expect(await disabledAction.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      disabledBackground
    );
    await expect(disabledAction).toBeDisabled();
    expect(await win.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    );
  });
}

for (const viewport of [REVIEW_VIEWPORTS[0], REVIEW_VIEWPORTS[2]]) {
  test(`PDF rows keep readable hover feedback in list and gallery views at ${viewport.name}`, async ({
    page,
  }) => {
    const win = await openStudyResources(page, viewport);
    await win.locator('[data-study-file="yale"]').click();

    let pdf = win.locator('[data-study-file="pdf-yale-biomedical-engineering-study-guide-pdf"]');
    const listBefore = await readPaintAndRect(pdf);
    await focusFromKeyboard(page, pdf);
    await pdf.hover();
    const listHover = await readPaintAndRect(pdf);
    expect(listHover.background).toBe(DIALOG_BLUE);
    expect(listHover.color).toBe(WHITE);
    expect(listHover.outlineColor).toBe(WHITE);
    expect(listHover.rect.width).toBe(listBefore.rect.width);
    expect(listHover.rect.height).toBe(listBefore.rect.height);

    await win.locator("#study-gallery-view").click();
    pdf = win.locator('[data-study-file="pdf-yale-biomedical-engineering-study-guide-pdf"]');
    await expect(pdf).toBeVisible();
    const galleryBefore = await readPaintAndRect(pdf);
    await focusFromKeyboard(page, pdf);
    await pdf.hover();
    const galleryHover = await readPaintAndRect(pdf);
    expect(galleryHover.background).toBe(DIALOG_BLUE);
    expect(galleryHover.color).toBe(WHITE);
    expect(galleryHover.outlineColor).toBe(WHITE);
    expect(galleryHover.rect.width).toBe(galleryBefore.rect.width);
    expect(galleryHover.rect.height).toBe(galleryBefore.rect.height);
  });
}

test("folder navigation and PDF actions survive the row-state styling", async ({ page }) => {
  const win = await openStudyResources(page, REVIEW_VIEWPORTS[2]);

  await win.locator('[data-study-file="yale"]').dblclick();
  await expect(win.locator("#study-address")).toHaveText("Study Resources\\Yale");

  const pdf = win.locator('[data-study-file="pdf-yale-biomedical-engineering-study-guide-pdf"]');
  await pdf.click();
  await expect(pdf).toHaveClass(/is-selected/);
  await expect(win.locator("#study-open-window")).toBeEnabled();
  await expect(win.locator("#study-open-tab")).toBeEnabled();
  await expect(win.locator("#study-download")).toBeEnabled();

  await win.locator("#study-open-window").click();
  await expect(page.locator('[data-app-window="study-pdf"]')).toBeVisible();
  await page.locator('[data-app-window="study-pdf"] [data-close="study-pdf"]').click();

  await page.evaluate(() => {
    window.__studyOpenedTabs = [];
    window.open = (...args) => {
      window.__studyOpenedTabs.push(args);
      return null;
    };
  });
  await win.locator("#study-open-tab").click();
  expect(await page.evaluate(() => window.__studyOpenedTabs)).toEqual([
    [SAMPLE_PDF_PATH, "_blank", "noopener,noreferrer"],
  ]);

  const downloadPromise = page.waitForEvent("download");
  await win.locator("#study-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Biomedical Engineering Study Guide.pdf");
  await download.cancel();
});

test("populated Study Resources states report no WCAG A/AA violations", async ({
  page,
}, testInfo) => {
  const win = await openStudyResources(page, REVIEW_VIEWPORTS[2]);
  await win.locator('[data-study-file="yale"]').click();
  const pdf = win.locator('[data-study-file="pdf-yale-biomedical-engineering-study-guide-pdf"]');
  await pdf.click();
  await pdf.focus();
  await settleRender(page);

  expect(await scanForViolations(page, testInfo, "home-study-resources-populated")).toEqual([]);
});
