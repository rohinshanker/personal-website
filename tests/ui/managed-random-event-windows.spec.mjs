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

import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORTS } from "./helpers/rendered-site.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";

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
 * `RANDOM_EVENT_TASKBAR_CLEARANCE` in the event runtime: the strip above
 * the taskbar that a clamped event window must not cross.
 */
const TASKBAR_CLEARANCE = 64;

/**
 * The only two durations the shared state rules produce, as the browser
 * serialises them: the default, and the faster Berserk brand windows.
 */
const SHARED_OPEN_DURATIONS = Object.freeze(["0.26s", "0.22s"]);
const SHARED_CLOSE_DURATIONS = Object.freeze(["0.18s", "0.16s"]);

const VIEWPORTS = REVIEW_VIEWPORTS;

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

/**
 * Records each shared animation as it starts, so the assertions read what the
 * window actually ran instead of sampling a computed style that a real 180ms
 * animation may already have finished.
 *
 * @param {import("@playwright/test").Page} page
 */
const recordWindowAnimations = (page) =>
  page.evaluate(() => {
    document.querySelectorAll(".random-event-window").forEach((element) => {
      element.managedAnimations = [];
      element.addEventListener("animationstart", (event) => {
        if (event.target !== element) return;
        const style = getComputedStyle(element);
        element.managedAnimations.push({
          name: event.animationName,
          duration: style.animationDuration,
          pointerEvents: style.pointerEvents,
          zIndex: Number(element.style.zIndex),
        });
      });
    });
  });

const readAnimation = async (win, name, label) => {
  await expect
    .poll(
      () =>
        win.evaluate(
          (element, wanted) =>
            (element.managedAnimations || []).some((entry) => entry.name === wanted),
          name
        ),
      { message: `${label} ran ${name}` }
    )
    .toBe(true);
  return win.evaluate(
    (element, wanted) =>
      (element.managedAnimations || []).find((entry) => entry.name === wanted),
    name
  );
};

/** Measuring geometry mid-animation would read the open animation's scale. */
const settleAnimation = (win, label) =>
  expect
    .poll(() => win.evaluate((element) => getComputedStyle(element).animationName), {
      message: `${label} finished animating`,
    })
    .toBe("none");

for (const viewport of VIEWPORTS) {
  test(`managed event windows open, stack, clamp and close at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await recordWindowAnimations(page);
    const adminWindow = await openAdminEvents(page);
    const eventList = page.locator("#admin-event-list");
    const triggerNow = page.locator("#admin-trigger-now");

    for (const event of EVENTS) {
      const win = page.locator(
        `#${event.windowId}:not([data-admin-event-preview-window])`
      );
      await win.evaluate((element) => {
        element.managedAnimations = [];
      });

      await eventList.selectOption(event.id);
      await triggerNow.click();

      // Opening: the shared helper sets aria-hidden, runs the one open
      // animation, and raises the window above its trigger.
      await expect(win, `${event.id} opens`).toBeVisible();
      await expect(win).toHaveAttribute("aria-hidden", "false");
      const opening = await readAnimation(win, "retro-window-open", event.id);
      expect(
        SHARED_OPEN_DURATIONS,
        `${event.id} keeps a shared open duration`
      ).toContain(opening.duration);
      const adminZ = await adminWindow.evaluate((element) =>
        Number(getComputedStyle(element).zIndex)
      );
      expect(
        opening.zIndex,
        `${event.id} stacks above the window that triggered it`
      ).toBeGreaterThan(adminZ);

      await expect(win).not.toHaveClass(/is-opening/);
      await settleAnimation(win, event.id);

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
      const closing = await readAnimation(win, "retro-window-close", event.id);
      expect(
        SHARED_CLOSE_DURATIONS,
        `${event.id} keeps a shared close duration`
      ).toContain(closing.duration);
      expect(closing.pointerEvents, `${event.id} is inert while closing`).toBe(
        "none"
      );

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


for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
  test(`dynamic Word windows cascade and remove themselves at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await preparePage(page);
    await openAdminEvents(page);
    await page.locator("#admin-event-list").selectOption("microsoft-word-license-stack");
    await page.locator("#admin-trigger-now").click();
    const windows = page.locator("body > .word-error-stack-window");
    await expect(windows).toHaveCount(10);
    await expect(windows.last()).toBeVisible();
    await expect(windows.last()).not.toHaveClass(/is-opening/);
    for (const win of await windows.all()) {
      await expect(win).toHaveClass(/random-event-window/);
      const box = await win.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - TASKBAR_CLEARANCE + 1);
    }
    await windows.last().getByRole("button", { name: "Close", exact: true }).click();
    await expect(windows).toHaveCount(0);
    // A completed removal must release the event so its next trigger works.
    await page.locator("#admin-trigger-now").click();
    await expect(windows).toHaveCount(10);
    await expect(windows.last()).toBeVisible();
    await windows.last().getByRole("button", { name: "Close", exact: true }).click();
    await expect(windows).toHaveCount(0);
  });

  test(`dynamic Brand windows retain custom durations and removal at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // The event starts through the real control. This narrow probe reaches the
    // health-dependent Puck branch and exits combat without waiting for a loss.
    await routeHomeScript(page, "eventBrandBurns", (source) =>
      source.replace(/\}\)\(\);\s*$/, `
        window.__managedWindowProbe = {
          showPuck: showBrandBurnsPuckWindow,
          close: closeBrandBurnsWindow,
        };
      })();`)
    );
    await preparePage(page);
    await openAdminEvents(page);
    await page.locator("#admin-event-list").selectOption("brand-burns");
    await page.locator("#admin-trigger-now").click();
    const main = page.locator("#brand-burns-window:not([data-admin-event-preview-window])");
    await expect(main).toBeVisible();
    const action = main.locator("#brand-burns-fight");
    await expect(action).toBeFocused();
    await action.press("Enter");
    const enemies = page.locator("body > .brand-apostle-window");
    await expect(enemies.first()).toBeVisible();
    await action.press("Enter");
    const block = page.locator("body > .brand-block-window");
    await expect(block).toBeVisible();
    await page.evaluate(() => window.__managedWindowProbe.showPuck());
    const puck = page.locator("body > .brand-puck-window");
    await expect(puck).toBeVisible();
    for (const win of [enemies.first(), block, puck]) {
      await expect(win).toHaveClass(/random-event-window/);
      await expect(win).not.toHaveClass(/is-opening/);
      expect(await win.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--event-window-open-duration").trim()
      )).toBe("220ms");
      const box = await win.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    await page.evaluate(() => window.__managedWindowProbe.close());
    await expect(main).toBeHidden();
    await expect(enemies).toHaveCount(0);
    await expect(block).toHaveCount(0);
    await expect(puck).toHaveCount(0);
  });
}
