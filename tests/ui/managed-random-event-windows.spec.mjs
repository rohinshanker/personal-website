/**
 * Behavioural cover for the shared random-event window lifecycle.
 *
 * Every event opens through `showManagedRandomEventWindow`, closes through
 * `closeManagedRandomEventWindow`, and gets its DOM wiring from the `bind()`
 * field on its `registerRandomEvent` definition. These cases drive real events
 * from the Administrator event finder and assert what the shared code is
 * responsible for: the open and close animations and their durations, the
 * aria-hidden and `is-hidden` bookkeeping, stacking above the window that
 * triggered them, viewport clamping, focus, and that each event's own buttons
 * are wired.
 */

import { expect, test } from "./fixtures.mjs";

test.setTimeout(180_000);

const homeUrl = process.env.PLAYWRIGHT_HOME_URL || "/home.html";
const profileStorageKey = "personalSitePlayerProfileV1";
const administratorProofStorageKey = "personalSiteAdministratorProofV1";
const administratorProfile = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});

/**
 * `RANDOM_EVENT_TASKBAR_CLEARANCE` in `scripts/home/main.js`: the strip above
 * the taskbar that a clamped event window must not cross.
 */
const TASKBAR_CLEARANCE = 64;

/**
 * The only two durations the shared state rules produce, as the browser
 * serialises them: the default, and the faster Berserk brand windows.
 */
const SHARED_OPEN_DURATIONS = Object.freeze(["0.26s", "0.22s"]);
const SHARED_CLOSE_DURATIONS = Object.freeze(["0.18s", "0.16s"]);

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

/**
 * One case per migrated lifecycle shape:
 *  - `plain`      a note-style window closed by its own OK button
 *  - `clamped`    opens with `clampAfterMediaLoad`, so a late image must not
 *                 push it out of the viewport
 *  - `focused`    the event's `afterShow` hook moves focus into the window
 *  - `widened`    carries a `--event-window-width` override
 *  - `stateful`   runs teardown through `beforeClose` / `afterClose`
 */
const EVENTS = [
  { id: "rohin-os-note", windowId: "rohin-note-window", close: "#rohin-note-ok" },
  { id: "earth-proverb-note", windowId: "earth-note-window", close: "#earth-note-ok" },
  { id: "no-smoking-alert", windowId: "no-smoking-window", close: "#no-smoking-ok" },
  { id: "nazar-evil-eye", windowId: "nazar-window", close: "#nazar-no" },
  { id: "stalker-zone", windowId: "stalker-window", close: "#stalker-no" },
  { id: "behelit-found", windowId: "behelit-window", close: "#behelit-ok" },
  { id: "john-pork", windowId: "john-pork-window", close: "#john-pork-decline" },
  { id: "walter-white", windowId: "walter-white-window", close: "#walter-white-ok" },
  { id: "mcafee-antivirus-update", windowId: "mcafee-prompt-window", close: "#mcafee-update-later" },
  { id: "self-love-system-alert", windowId: "self-love-alert-window", close: "#self-love-alert-yes" },
  { id: "red-tool", windowId: "red-tool-window", close: "#red-tool-close", focus: "#red-tool-input" },
  { id: "resist-your-fate", windowId: "fate-window", close: "#fate-title-close", focus: "#fate-start" },
  { id: "sudden-skill-check", windowId: "skill-check-window", close: "#skill-check-ignore", focus: "#skill-check-roll" },
  { id: "pokemon-starter-selection", windowId: "pokemon-starter-window", close: "#pokemon-starter-close" },
  { id: "infinity-blade-armory", windowId: "infinity-armory-window", close: "#infinity-armory-close" },
];

const preparePage = async (page) => {
  await page.addInitScript(({ profile, profileKey, proof, proofKey }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(profileKey, JSON.stringify(profile));
    sessionStorage.setItem(
      proofKey,
      JSON.stringify({
        proof,
        expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      })
    );
    // No event may fire on its own while the finder is driving them one by one.
    Math.random = () => 0.999999;
  }, {
    profile: administratorProfile,
    profileKey: profileStorageKey,
    proof: `${"a".repeat(32)}.${"b".repeat(32)}`,
    proofKey: administratorProofStorageKey,
  });
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });',
    })
  );
  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#about-window").evaluate((element) => {
    element.classList.remove("is-opening", "is-closing");
    element.classList.add("is-hidden");
    element.setAttribute("aria-hidden", "true");
  });
};

const openAdminEvents = async (page) => {
  const adminWindow = page.locator("#admin-controls-window");
  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  await launcher.scrollIntoViewIfNeeded();
  await launcher.click();
  await expect(adminWindow).toBeVisible();
  await adminWindow.dispatchEvent("animationend", { animationName: "retro-window-open" });
  await page.locator('[data-admin-tab="events"]').click();
  await expect(page.locator('[data-admin-panel="events"]')).toBeVisible();
  return adminWindow;
};

/** The managed close path only reaches `is-hidden` once the animation ends. */
const finishAnimation = (win, animationName) =>
  win.dispatchEvent("animationend", { animationName });

for (const viewport of VIEWPORTS) {
  test(`managed event windows open, stack, clamp and close at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    const adminWindow = await openAdminEvents(page);
    const eventList = page.locator("#admin-event-list");
    const triggerNow = page.locator("#admin-trigger-now");

    for (const event of EVENTS) {
      await eventList.selectOption(event.id);
      await triggerNow.click();

      const win = page.locator(
        `#${event.windowId}:not([data-admin-event-preview-window])`
      );

      // Opening: the shared helper sets aria-hidden, the opening class and the
      // one open animation, and raises the window above its trigger.
      await expect(win, `${event.id} opens`).toBeVisible();
      await expect(win).toHaveAttribute("aria-hidden", "false");
      await expect(win).toHaveClass(/is-opening/);
      const opening = await win.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          animationName: style.animationName,
          animationDuration: style.animationDuration,
          zIndex: Number(element.style.zIndex),
        };
      });
      expect(opening.animationName, `${event.id} open animation`).toBe(
        "retro-window-open"
      );
      expect(
        SHARED_OPEN_DURATIONS,
        `${event.id} keeps a shared open duration`
      ).toContain(opening.animationDuration);
      const adminZ = await adminWindow.evaluate((element) =>
        Number(getComputedStyle(element).zIndex)
      );
      expect(
        opening.zIndex,
        `${event.id} stacks above the window that triggered it`
      ).toBeGreaterThan(adminZ);

      await finishAnimation(win, "retro-window-open");
      await expect(win).not.toHaveClass(/is-opening/);

      // Clamping: the window has to sit inside the desktop, above the taskbar.
      const box = await win.boundingBox();
      expect(box, `${event.id} has a box`).not.toBeNull();
      expect(box.x, `${event.id} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${event.id} top edge`).toBeGreaterThanOrEqual(0);
      expect(
        box.x + box.width,
        `${event.id} right edge stays in the viewport`
      ).toBeLessThanOrEqual(viewport.width + 1);
      expect(
        box.y + box.height,
        `${event.id} bottom edge clears the taskbar`
      ).toBeLessThanOrEqual(viewport.height - TASKBAR_CLEARANCE + 1);

      if (event.focus) {
        // Scope to the live window: the Administrator preview renders a clone
        // of the same markup, ids included.
        await expect(
          win.locator(event.focus),
          `${event.id} moves focus into the window`
        ).toBeFocused();
      }

      // Closing: the event's own button is wired by its definition's bind(),
      // and the shared close path hides the window after the animation.
      await win.locator(event.close).click();
      await expect(win).toHaveAttribute("aria-hidden", "true");
      await expect(win).toHaveClass(/is-closing/);
      const closing = await win.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          animationName: style.animationName,
          animationDuration: style.animationDuration,
          pointerEvents: style.pointerEvents,
        };
      });
      expect(closing.animationName, `${event.id} close animation`).toBe(
        "retro-window-close"
      );
      expect(
        SHARED_CLOSE_DURATIONS,
        `${event.id} keeps a shared close duration`
      ).toContain(closing.animationDuration);
      expect(closing.pointerEvents, `${event.id} is inert while closing`).toBe(
        "none"
      );

      await finishAnimation(win, "retro-window-close");
      await expect(win, `${event.id} closes`).toBeHidden();
      await expect(win).toHaveClass(/is-hidden/);
    }
  });
}

test("open events stack in trigger order and refuse a second trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparePage(page);
  await openAdminEvents(page);
  const eventList = page.locator("#admin-event-list");
  const triggerNow = page.locator("#admin-trigger-now");
  const status = page.locator("#admin-controls-status");

  await eventList.selectOption("rohin-os-note");
  await triggerNow.click();
  const note = page.locator("#rohin-note-window:not([data-admin-event-preview-window])");
  await expect(note).toBeVisible();
  await finishAnimation(note, "retro-window-open");
  const noteZ = await note.evaluate((element) => Number(element.style.zIndex));

  await eventList.selectOption("no-smoking-alert");
  await triggerNow.click();
  const noSmoking = page.locator(
    "#no-smoking-window:not([data-admin-event-preview-window])"
  );
  await expect(noSmoking).toBeVisible();
  await finishAnimation(noSmoking, "retro-window-open");
  expect(
    await noSmoking.evaluate((element) => Number(element.style.zIndex)),
    "the second event opens above the first"
  ).toBeGreaterThan(noteZ);

  // The migrated visibility predicates still report an open window, so the
  // finder declines rather than reopening it.
  await eventList.selectOption("rohin-os-note");
  await triggerNow.click();
  await expect(status).toContainText("already open");
  await expect(note).toBeVisible();
  await expect(note).not.toHaveClass(/is-opening/);
  expect(
    await note.evaluate((element) => Number(element.style.zIndex)),
    "a declined trigger leaves the stacking order alone"
  ).toBe(noteZ);

  await note.locator("#rohin-note-ok").click();
  await finishAnimation(note, "retro-window-close");
  await expect(note).toBeHidden();
  await noSmoking.locator("#no-smoking-ok").click();
  await finishAnimation(noSmoking, "retro-window-close");
  await expect(noSmoking).toBeHidden();
});

test("a chained event hands its position to the window that replaces it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparePage(page);
  await openAdminEvents(page);
  await page.locator("#admin-event-list").selectOption("nana-random-encounter");
  await page.locator("#admin-trigger-now").click();

  const encounter = page.locator(
    "#nana-encounter-window:not([data-admin-event-preview-window])"
  );
  await expect(encounter).toBeVisible();
  await finishAnimation(encounter, "retro-window-open");
  const anchor = await encounter.evaluate((element) => ({
    left: element.style.left,
    top: element.style.top,
  }));

  await encounter.locator("#nana-encounter-yes").click();
  const accept = page.locator(
    "#nana-accept-window:not([data-admin-event-preview-window])"
  );
  await expect(accept).toBeVisible();
  await finishAnimation(accept, "retro-window-open");
  expect(
    await accept.evaluate((element) => ({
      left: element.style.left,
      top: element.style.top,
    })),
    "the follow-up window opens where the encounter sat"
  ).toEqual(anchor);

  await accept.locator("#nana-accept-ok").click();
  await finishAnimation(accept, "retro-window-close");
  await expect(accept).toBeHidden();
});
