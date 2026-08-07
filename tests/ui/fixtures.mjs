import { expect, test as base } from "@playwright/test";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

export { expect };

export const test = base.extend({
  page: async ({ page }, use) => {
    const mainSource = await readIsolatedMainSource();
    await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: mainSource,
      })
    );
    await use(page);
  },
});
