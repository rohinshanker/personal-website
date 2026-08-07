import { expect, test } from "./fixtures.mjs";

const MONTH_NAMES = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

const VIEWPORTS = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "below-calendar-breakpoint", width: 680, height: 800 },
  { name: "above-calendar-breakpoint", width: 681, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const QUOTES = Object.freeze([
  {
    attribution: "—Robert A. Heinlein",
    beginning: "A human being should be able to change a diaper",
    ending: "Specialization is for insects.",
    month: 8,
    monthName: "September",
  },
  {
    attribution: "—Albert Einstein",
    beginning: "“I have no special talents.",
    ending: "I am only passionately curious.”",
    month: 9,
    monthName: "October",
  },
]);

const preparePage = async (page, viewport) => {
  const diagnostics = {
    consoleErrors: [],
    runtimeErrors: [],
    requestFailures: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.runtimeErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push(request.method() + " " + request.url());
  });
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });',
    })
  );
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await page.goto("/home.html", { waitUntil: "load" });
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  return diagnostics;
};

const navigateForwardToMonth = async (page, month) => {
  const header = page.locator("#calendar-header");
  const currentName = (await header.textContent()).trim().split(/\s+/)[0];
  const currentMonth = MONTH_NAMES.indexOf(currentName);
  expect(currentMonth).toBeGreaterThanOrEqual(0);
  const steps = (month - currentMonth + 12) % 12;
  for (let index = 0; index < steps; index += 1) {
    await page.locator("#calendar-next").click();
  }
};

const measureCalendarQuote = (page) =>
  page.evaluate(() => {
    const bounds = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    };
    const body = document.querySelector("#calendar-popout .window-body");
    const clockSection = document.querySelector("#calendar-popout .clock-section");
    const quote = document.querySelector("#clock-quote");
    const popout = bounds("#calendar-popout");
    const quoteBounds = bounds("#clock-quote");
    const sectionBounds = bounds("#calendar-popout .clock-section");
    return {
      bodyOverflowsHorizontally: body.scrollWidth > body.clientWidth + 1,
      clockSectionClips: clockSection.scrollHeight > clockSection.clientHeight + 1,
      documentOverflowsHorizontally:
        document.documentElement.scrollWidth > window.innerWidth + 1,
      popoutContained:
        popout.left >= 0 &&
        popout.top >= 0 &&
        popout.right <= window.innerWidth &&
        popout.bottom <= window.innerHeight,
      quoteContained:
        quoteBounds.left >= sectionBounds.left &&
        quoteBounds.top >= sectionBounds.top &&
        quoteBounds.right <= sectionBounds.right + 1 &&
        quoteBounds.bottom <= sectionBounds.bottom + 1,
      quoteFontSize: Number.parseFloat(getComputedStyle(quote).fontSize),
      quoteOverflowsHorizontally: quote.scrollWidth > quote.clientWidth + 1,
    };
  });

for (const viewport of VIEWPORTS) {
  test("September and October quotes remain readable at " + viewport.name, async ({
    page,
  }, testInfo) => {
    const diagnostics = await preparePage(page, viewport);
    const calendar = page.locator("#calendar-popout");
    const quote = page.locator("#clock-quote");
    const close = page.locator("#calendar-close");

    await page.getByRole("button", { name: "Date and time" }).click();
    await expect(calendar).toHaveClass(/is-open/);
    await expect(calendar).toHaveAttribute("aria-hidden", "false");
    await expect(quote).toBeVisible();
    await expect(page.locator("#calendar-prev")).toHaveAccessibleName("Previous month");
    await expect(page.locator("#calendar-next")).toHaveAccessibleName("Next month");
    await expect(close).toHaveAccessibleName("Close");

    for (const expected of QUOTES) {
      await navigateForwardToMonth(page, expected.month);
      await expect(page.locator("#calendar-header")).toContainText(expected.monthName);
      await expect(quote).toContainText(expected.beginning);
      await expect(quote).toContainText(expected.ending);
      await expect(quote).toContainText(expected.attribution);
      await expect(quote.locator("br")).toHaveCount(1);
      const quoteHtml = await quote.evaluate((element) => element.innerHTML);
      expect(quoteHtml.endsWith("<br>" + expected.attribution)).toBe(true);
      await quote.scrollIntoViewIfNeeded();
      await expect(page.locator("#calendar-clock")).toContainText(":");

      const metrics = await measureCalendarQuote(page);
      expect(metrics.bodyOverflowsHorizontally).toBe(false);
      expect(metrics.clockSectionClips).toBe(false);
      expect(metrics.documentOverflowsHorizontally).toBe(false);
      expect(metrics.popoutContained).toBe(true);
      expect(metrics.quoteContained).toBe(true);
      expect(metrics.quoteFontSize).toBeCloseTo(11, 1);
      expect(metrics.quoteOverflowsHorizontally).toBe(false);

      await page.screenshot({
        path: testInfo.outputPath(
          "calendar-" + expected.monthName.toLowerCase() + "-" + viewport.width + "x" + viewport.height + ".png"
        ),
        fullPage: true,
      });
    }

    await close.focus();
    await expect(close).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(calendar).toHaveAttribute("aria-hidden", "true");
    await expect(calendar).toBeHidden();

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.runtimeErrors).toEqual([]);
    expect(diagnostics.requestFailures).toEqual([]);
  });
}
