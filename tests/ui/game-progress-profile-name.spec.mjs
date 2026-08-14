import { expect, test } from "./fixtures.mjs";

test.setTimeout(120_000);

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const PROFILE = Object.freeze({
  id: "profile-long-name-01",
  name: "Sparrow Starlight Wayfinder Luna",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const viewports = Object.freeze([
  { name: "compact mobile", width: 320, height: 568 },
  { name: "mobile", width: 375, height: 812 },
  { name: "below icon-picker breakpoint", width: 559, height: 900 },
  { name: "above icon-picker breakpoint", width: 561, height: 900 },
  { name: "narrow breakpoint", width: 639, height: 900 },
  { name: "wide breakpoint", width: 641, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

for (const viewport of viewports) {
  test(`Game Progress shows a full saved profile name at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ({ profile, storageKey }) => {
        Math.random = () => 0.999999;
        localStorage.setItem(storageKey, JSON.stringify(profile));
      },
      { profile: PROFILE, storageKey: PROFILE_STORAGE_KEY }
    );
    await page.goto("/home.html");
    await page.locator('.taskbar-icon[data-app="game-progress"]').click();

    const app = page.locator("#game-progress-window");
    const row = app.locator(".game-progress-profile-row");
    const icon = row.locator(".game-stats-player-icon");
    const name = row.locator(".game-progress-profile-name");
    const saved = row.locator(".game-progress-profile-saved");

    await expect(app.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(app).not.toHaveClass(/is-opening/);
    await expect(app.getByRole("list", { name: "Game Progress tabs" })).toBeVisible();
    await expect(name).toHaveText(PROFILE.name);
    await expect(saved).toHaveText("Saved");
    await expect(saved).toBeVisible();
    await expect(icon).toHaveAttribute("alt", "");

    const layout = await row.evaluate((rowElement) => {
      const getRect = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      };
      const iconElement = rowElement.querySelector(".game-stats-player-icon");
      const nameElement = rowElement.querySelector(".game-progress-profile-name");
      const savedElement = rowElement.querySelector(".game-progress-profile-saved");
      const range = document.createRange();
      range.selectNodeContents(nameElement);
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        icon: getRect(iconElement),
        name: {
          ...getRect(nameElement),
          clientHeight: nameElement.clientHeight,
          clientWidth: nameElement.clientWidth,
          lineCount: range.getClientRects().length,
          scrollHeight: nameElement.scrollHeight,
          scrollWidth: nameElement.scrollWidth,
        },
        row: getRect(rowElement),
        saved: getRect(savedElement),
      };
    });

    expect(layout.documentOverflows).toBe(false);
    expect(layout.name.left).toBeGreaterThan(layout.icon.right);
    expect(layout.name.right).toBeLessThanOrEqual(layout.row.right);
    expect(layout.name.width).toBeGreaterThanOrEqual(Math.max(120, layout.row.width * 0.5));
    expect(layout.name.lineCount).toBeLessThanOrEqual(2);
    expect(layout.name.scrollWidth).toBeLessThanOrEqual(layout.name.clientWidth);
    expect(layout.name.scrollHeight).toBeLessThanOrEqual(layout.name.clientHeight);
    expect(layout.saved.right).toBeLessThanOrEqual(layout.row.right);
    expect(layout.name.right).toBeLessThanOrEqual(layout.saved.left);
    expect(layout.saved.top).toBeLessThanOrEqual(layout.name.bottom);
    expect(layout.saved.bottom).toBeGreaterThanOrEqual(layout.name.top);
  });
}

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const readIconPickerScrollState = (page) =>
  page.evaluate(() => {
    const gallery = document.querySelector("#game-profile-icon-gallery");
    const prompt = document.querySelector("#game-profile-prompt");
    const dialog = document.querySelector("#game-profile-dialog");
    const dialogBody = dialog.querySelector(".window-body");
    const dialogRect = dialog.getBoundingClientRect();
    return {
      bodyScrollTop: document.body.scrollTop,
      dialogBodyScrollTop: dialogBody.scrollTop,
      dialogLeft: dialogRect.left,
      dialogTop: dialogRect.top,
      documentScrollTop: document.documentElement.scrollTop,
      galleryScrollLeft: gallery.scrollLeft,
      galleryScrollTop: gallery.scrollTop,
      promptScrollTop: prompt.scrollTop,
      windowScrollX: window.scrollX,
      windowScrollY: window.scrollY,
    };
  });

const expectIconPickerScrollStateUnchanged = (before, after) => {
  expect(after.galleryScrollLeft).toBe(before.galleryScrollLeft);
  expect(after.galleryScrollTop).toBe(before.galleryScrollTop);
  expect(after.promptScrollTop).toBe(before.promptScrollTop);
  expect(after.dialogBodyScrollTop).toBe(before.dialogBodyScrollTop);
  expect(after.documentScrollTop).toBe(before.documentScrollTop);
  expect(after.bodyScrollTop).toBe(before.bodyScrollTop);
  expect(after.windowScrollX).toBe(before.windowScrollX);
  expect(after.windowScrollY).toBe(before.windowScrollY);
  expect(after.dialogLeft).toBeCloseTo(before.dialogLeft, 1);
  expect(after.dialogTop).toBeCloseTo(before.dialogTop, 1);
};

for (const viewport of viewports) {
  test(`Game Progress changes only the icon at ${viewport.name}`, async ({ page }, testInfo) => {
    const consoleErrors = [];
    const runtimeErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ({ profile, storageKey }) => {
        Math.random = () => 0.999999;
        localStorage.setItem(storageKey, JSON.stringify(profile));
      },
      { profile: PROFILE, storageKey: PROFILE_STORAGE_KEY }
    );
    await disableRemoteGameStats(page);
    await page.goto("/home.html");
    await page.locator('.taskbar-icon[data-app="game-progress"]').click();

    const app = page.locator("#game-progress-window");
    const changeIcon = app.getByRole("button", { name: "Change Icon" });
    await expect(changeIcon).toBeVisible();
    await expect(app.getByRole("button", { name: "Create Profile" })).toHaveCount(0);

    await changeIcon.click();
    const dialog = page.getByRole("dialog", { name: "Change Profile Icon" });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toHaveClass(/is-opening/);
    await expect(dialog.locator("#game-profile-name-controls")).toBeHidden();
    await expect(dialog.locator("#game-profile-name-credit")).toBeHidden();
    await expect(dialog.locator("#game-profile-name")).toBeHidden();
    await expect(dialog.locator("#game-profile-reroll")).toBeHidden();
    await expect(dialog.locator("#game-profile-icon-search")).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`game-progress-icon-picker-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(changeIcon).toBeFocused();

    await changeIcon.click();
    await expect(dialog).not.toHaveClass(/is-opening/);
    const frame = dialog.locator(".game-profile-icon-gallery-frame");
    const gallery = dialog.locator("#game-profile-icon-gallery");
    const iconOptions = dialog.locator(".game-profile-icon-option");
    await expect(gallery).toHaveJSProperty("scrollTop", 0);

    const initialGeometry = await gallery.evaluate((element) => {
      const frameElement = element.parentElement;
      const firstOption = element.querySelector(".game-profile-icon-option");
      const frameRect = frameElement.getBoundingClientRect();
      const galleryRect = element.getBoundingClientRect();
      const firstRect = firstOption.getBoundingClientRect();
      const frameStyle = getComputedStyle(frameElement);
      const galleryStyle = getComputedStyle(element);
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        firstToGalleryTop: firstRect.top - galleryRect.top,
        frameOverflow: frameStyle.overflow,
        framePaddingTop: Number.parseFloat(frameStyle.paddingTop),
        galleryPaddingTop: Number.parseFloat(galleryStyle.paddingTop),
        galleryToFrameTop: galleryRect.top - frameRect.top,
      };
    });
    expect(initialGeometry.documentOverflows).toBe(false);
    expect(initialGeometry.frameOverflow).toBe("hidden");
    expect(initialGeometry.framePaddingTop).toBeCloseTo(2, 1);
    expect(initialGeometry.galleryPaddingTop).toBeCloseTo(4, 1);
    expect(initialGeometry.galleryToFrameTop).toBeCloseTo(2, 1);
    expect(initialGeometry.firstToGalleryTop).toBeCloseTo(4, 1);

    const targetIndexes = await iconOptions.evaluateAll((options) => {
      const galleryElement = options[0].parentElement;
      const columns = getComputedStyle(galleryElement)
        .gridTemplateColumns.split(/\s+/)
        .filter(Boolean).length;
      let pointerIndex = Math.min(options.length - 2, Math.max(columns * 6, columns));
      while (
        pointerIndex < options.length - 2 &&
        options[pointerIndex].getAttribute("aria-selected") === "true"
      ) {
        pointerIndex += 1;
      }
      let keyboardIndex = pointerIndex + 1;
      while (
        keyboardIndex < options.length - 1 &&
        options[keyboardIndex].getAttribute("aria-selected") === "true"
      ) {
        keyboardIndex += 1;
      }
      return { keyboardIndex, pointerIndex };
    });
    const pointerOption = iconOptions.nth(targetIndexes.pointerIndex);
    const keyboardOption = iconOptions.nth(targetIndexes.keyboardIndex);

    await pointerOption.evaluate((element) => {
      const galleryElement = element.parentElement;
      galleryElement.scrollTop +=
        element.getBoundingClientRect().top -
        galleryElement.getBoundingClientRect().top;
      window.__profileIconSelectionNode = element;
    });
    await expect
      .poll(() =>
        pointerOption.evaluate(
          (element) =>
            element.getBoundingClientRect().top -
            element.parentElement.getBoundingClientRect().top
        )
      )
      .toBeCloseTo(0, 1);

    const flushGeometry = await pointerOption.evaluate((element) => {
      const galleryElement = element.parentElement;
      const frameElement = galleryElement.parentElement;
      const frameRect = frameElement.getBoundingClientRect();
      const galleryRect = galleryElement.getBoundingClientRect();
      const optionRect = element.getBoundingClientRect();
      const sampleX = optionRect.left + optionRect.width / 2;
      return {
        borderHitIsOption: Boolean(
          document
            .elementFromPoint(sampleX, frameRect.top + 1)
            ?.closest(".game-profile-icon-option")
        ),
        innerHitIsTarget:
          document
            .elementFromPoint(sampleX, galleryRect.top + 0.5)
            ?.closest(".game-profile-icon-option") === element,
        optionToFrameTop: optionRect.top - frameRect.top,
        optionToGalleryTop: optionRect.top - galleryRect.top,
      };
    });
    expect(flushGeometry.borderHitIsOption).toBe(false);
    expect(flushGeometry.innerHitIsTarget).toBe(true);
    expect(flushGeometry.optionToFrameTop).toBeCloseTo(2, 1);
    expect(flushGeometry.optionToGalleryTop).toBeCloseTo(0, 1);

    await gallery.evaluate((element) => {
      element.scrollTop += 3;
    });
    const clippedHitTest = await pointerOption.evaluate((element) => {
      const galleryElement = element.parentElement;
      const frameRect = galleryElement.parentElement.getBoundingClientRect();
      const galleryRect = galleryElement.getBoundingClientRect();
      const optionRect = element.getBoundingClientRect();
      const sampleX = optionRect.left + optionRect.width / 2;
      return {
        borderHitIsOption: Boolean(
          document
            .elementFromPoint(sampleX, frameRect.top + 1)
            ?.closest(".game-profile-icon-option")
        ),
        innerHitIsTarget:
          document
            .elementFromPoint(sampleX, galleryRect.top + 0.5)
            ?.closest(".game-profile-icon-option") === element,
      };
    });
    expect(clippedHitTest.borderHitIsOption).toBe(false);
    expect(clippedHitTest.innerHitIsTarget).toBe(true);
    await pointerOption.evaluate((element) => {
      const galleryElement = element.parentElement;
      galleryElement.scrollTop +=
        element.getBoundingClientRect().top -
        galleryElement.getBoundingClientRect().top;
      window.__profileIconSelectionNode = element;
    });

    await page.screenshot({
      path: testInfo.outputPath(
        `game-progress-icon-picker-scrolled-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });

    const beforePointerSelection = await readIconPickerScrollState(page);
    const pointerBounds = await pointerOption.boundingBox();
    expect(pointerBounds).not.toBeNull();
    await page.mouse.click(
      pointerBounds.x + pointerBounds.width / 2,
      pointerBounds.y + pointerBounds.height / 2
    );
    await expect(pointerOption).toHaveAttribute("aria-selected", "true");
    await expect(pointerOption).toHaveClass(/is-selected/);
    await expect(pointerOption).toBeFocused();
    await expect(gallery.locator('[aria-selected="true"]')).toHaveCount(1);
    await expect(gallery.locator(".game-profile-icon-option.is-selected")).toHaveCount(1);
    expect(
      await page.evaluate(
        () =>
          window.__profileIconSelectionNode?.isConnected &&
          window.__profileIconSelectionNode === document.activeElement
      )
    ).toBe(true);
    expectIconPickerScrollStateUnchanged(
      beforePointerSelection,
      await readIconPickerScrollState(page)
    );

    const nextIcon = await keyboardOption.locator("img").getAttribute("src");
    await keyboardOption.evaluate((element) => element.focus({ preventScroll: true }));
    const beforeKeyboardSelection = await readIconPickerScrollState(page);
    await page.keyboard.press("Enter");
    await expect(keyboardOption).toHaveAttribute("aria-selected", "true");
    await expect(keyboardOption).toHaveClass(/is-selected/);
    await expect(keyboardOption).toBeFocused();
    await expect(pointerOption).toHaveAttribute("aria-selected", "false");
    await expect(gallery.locator('[aria-selected="true"]')).toHaveCount(1);
    expectIconPickerScrollStateUnchanged(
      beforeKeyboardSelection,
      await readIconPickerScrollState(page)
    );

    await dialog.getByRole("button", { name: "Save Icon" }).click();

    await expect(dialog).toBeHidden();
    await expect(app.locator(".game-progress-profile-name")).toHaveText(PROFILE.name);
    await expect(app.locator(".game-progress-profile-row .game-stats-player-icon")).toHaveAttribute(
      "src",
      nextIcon
    );
    const storedProfile = await page.evaluate((storageKey) =>
      JSON.parse(localStorage.getItem(storageKey) || "null"),
      PROFILE_STORAGE_KEY
    );
    expect(storedProfile).toMatchObject({ id: PROFILE.id, name: PROFILE.name, icon: nextIcon });
    expect(consoleErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}
