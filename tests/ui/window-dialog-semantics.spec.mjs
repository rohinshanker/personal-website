/**
 * Dialog semantics for Home windows.
 *
 * `applyWindowDialogSemantics` in `scripts/home/core/windows.js` names every
 * top-level window by its own title bar and exposes it as a non-modal dialog.
 * It runs over the static windows at boot and inside the managed random-event
 * open path, which is how dynamic windows receive it. These cases check the
 * resulting inventory, every helper branch on real DOM, and that the shared
 * open, close, focus, keyboard and stacking behaviour is unchanged.
 */

import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORTS, openApp, openHomeDesktop } from "./helpers/rendered-site.mjs";

const DESKTOP = REVIEW_VIEWPORTS[2];

/** Windows whose markup already chose `alertdialog`; the helper must keep it. */
const EXPLICIT_ALERT_DIALOGS = Object.freeze([
  "admin-controls-stand-in-window",
  "debug-system-alert-window",
  "image-tools-coming-soon-window",
  "modeling-launch-window",
  "neko-stream-alert-window",
  "video-editor-launch-window",
]);

/** Title ids the helper derives at boot, pinned so they stay stable across releases. */
const DERIVED_TITLE_IDS = Object.freeze({
  "[data-app-window=\"windows\"]": "windows-window-title",
  "[data-app-window=\"credits\"]": "credits-window-title",
  "#game-stats-window-sudoku": "game-stats-window-sudoku-title",
  "#rohin-note-window": "rohin-note-window-title",
  "#calendar-popout": "calendar-popout-title",
});

/** Reads the dialog role, modality and resolved name of every `.window`. */
const readWindowInventory = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".window")].map((win) => {
      const ids = (win.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      const labels = ids.map((id) =>
        document.querySelectorAll(`#${CSS.escape(id)}`).length === 1
          ? document.getElementById(id)
          : null
      );
      return {
        key: win.id || win.dataset.appWindow || win.className,
        nested: Boolean(win.parentElement?.closest(".window")),
        role: win.getAttribute("role"),
        modal: win.getAttribute("aria-modal"),
        labelledBy: ids,
        name: labels.every(Boolean)
          ? labels.map((label) => label.textContent.trim()).join(" ")
          : null,
        labelsInside: labels.every((label) => label && win.contains(label)),
      };
    })
  );

/** Whether focus currently sits inside a window the visitor cannot see. */
const focusInHiddenWindow = (page) =>
  page.evaluate(() => {
    const win = document.activeElement?.closest?.(".window");
    return Boolean(
      win &&
        (win.classList.contains("is-hidden") ||
          win.closest("[aria-hidden='true']") ||
          getComputedStyle(win).display === "none")
    );
  });

const finishOpening = (win) =>
  win.evaluate((element) => {
    if (!element.classList.contains("is-opening")) return undefined;
    return new Promise((resolve) => {
      element.addEventListener("animationend", resolve, { once: true });
    });
  });

test("every top-level Home window is a uniquely titled non-modal dialog", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const inventory = await readWindowInventory(page);
  const topLevel = inventory.filter((win) => !win.nested);

  expect(topLevel.length).toBeGreaterThan(100);
  for (const win of topLevel) {
    expect(["dialog", "alertdialog"], `${win.key} role`).toContain(win.role);
    expect(win.name, `${win.key} resolves a unique title`).toBeTruthy();
    expect(win.labelsInside, `${win.key} is named by its own content`).toBe(true);
    expect(win.modal, `${win.key} leaves the desktop operable`).not.toBe("true");
  }
  expect(
    topLevel.filter((win) => win.role === "alertdialog").map((win) => win.key).sort()
  ).toEqual([...EXPLICIT_ALERT_DIALOGS]);

  // A nested window is chrome inside its owner's dialog; its markup keeps its own semantics.
  expect(inventory.filter((win) => win.nested)).toEqual([
    expect.objectContaining({ key: "gears-nest-prompt", role: null }),
  ]);

  const titleIds = topLevel.flatMap((win) => win.labelledBy);
  expect(new Set(titleIds).size).toBe(titleIds.length);

  for (const [selector, id] of Object.entries(DERIVED_TITLE_IDS)) {
    await expect(page.locator(selector), selector).toHaveAttribute("aria-labelledby", id);
  }

  // Existing labels, roles and modality are untouched.
  await expect(page.locator("#about-window")).toHaveAttribute("aria-labelledby", "about-window-title");
  await expect(page.locator("#about-window")).toHaveAttribute("aria-modal", "false");
  await expect(page.locator("#lain-alert-window")).toHaveAttribute("aria-labelledby", "lain-alert-title");
  await expect(page.locator("#fate-window")).toHaveAttribute("aria-labelledby", "fate-title");
  await expect(page.locator("#gears-nest-prompt")).toHaveAttribute(
    "aria-labelledby",
    "gears-nest-prompt-title"
  );
  await expect(page.locator("#sudoku-errors-prompt")).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#game-profile-dialog")).toHaveAttribute("aria-modal", "false");
  await expect(page.locator("#administrator-alert-window")).toHaveAttribute("aria-modal", "false");
  await expect(page.locator("#sudoku-solve-popup [role='dialog']")).toHaveAttribute(
    "aria-modal",
    "false"
  );
});

test("the shared helper covers every naming and exclusion branch", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const results = await page.evaluate(() => {
    const { applyWindowDialogSemantics: apply } = window.homeWindows;
    const host = document.createElement("div");
    host.hidden = true;
    document.body.append(host);
    const make = (html) => {
      const template = document.createElement("template");
      template.innerHTML = html.trim();
      const win = template.content.firstElementChild;
      host.append(win);
      return win;
    };
    const attrs = (win) =>
      Object.fromEntries(
        ["role", "aria-labelledby", "aria-label", "aria-modal"].map((name) => [
          name,
          win.getAttribute(name),
        ])
      );
    const titleId = (win) => win.querySelector(".title-bar-text")?.id || "";

    const derived = make(
      '<div class="window" id="semantic-probe"><div class="title-bar"><div class="title-bar-text">Probe</div></div></div>'
    );
    const app = make(
      '<div class="window" data-app-window="semantic-app"><div class="title-bar"><div class="title-bar-text">App</div></div></div>'
    );
    const kept = make(
      '<div class="window"><div class="title-bar"><div class="title-bar-text" id="semantic-kept">Kept</div></div></div>'
    );
    const collision = make(
      '<div class="window" id="windows-window"><div class="title-bar"><div class="title-bar-text">Clash</div></div></div>'
    );
    const anonymous = [0, 1].map(() =>
      make('<div class="window"><div class="title-bar"><div class="title-bar-text">Anon</div></div></div>')
    );
    const labelled = make(
      '<div class="window" aria-label="Named"><div class="title-bar"><div class="title-bar-text">Ignored</div></div></div>'
    );
    const alert = make(
      '<div class="window" role="alertdialog" aria-modal="true"><div class="title-bar"><div class="title-bar-text">Alert</div></div></div>'
    );
    const region = make(
      '<section class="window" role="region" aria-label="Region"><div class="title-bar"><div class="title-bar-text">Region</div></div></section>'
    );
    const untitled = make('<div class="window"><div class="window-body">No title</div></div>');
    const outer = make(
      '<div class="window"><div class="window-body"><div class="window" id="semantic-inner"><div class="title-bar"><div class="title-bar-text">Inner</div></div></div></div></div>'
    );
    const inner = outer.querySelector("#semantic-inner");

    const report = {
      invalid: [apply(null), apply(undefined), apply({})],
      derived: [apply(derived), attrs(derived), titleId(derived)],
      repeat: [apply(derived), attrs(derived)],
      app: [apply(app), attrs(app)],
      kept: [apply(kept), attrs(kept)],
      collision: [apply(collision), titleId(collision)],
      anonymous: anonymous.map((win) => [apply(win), titleId(win)]),
      labelled: [apply(labelled), attrs(labelled), titleId(labelled)],
      alert: [apply(alert), attrs(alert), titleId(alert)],
      region: [apply(region), attrs(region)],
      untitled: [apply(untitled), attrs(untitled)],
      inner: [apply(inner), attrs(inner)],
      outer: [apply(outer), attrs(outer)],
    };
    host.remove();
    return report;
  });

  expect(results.invalid).toEqual([false, false, false]);
  expect(results.derived).toEqual([
    true,
    { role: "dialog", "aria-labelledby": "semantic-probe-title", "aria-label": null, "aria-modal": null },
    "semantic-probe-title",
  ]);
  expect(results.repeat).toEqual([true, results.derived[1]]);
  expect(results.app[1]).toMatchObject({ role: "dialog", "aria-labelledby": "semantic-app-window-title" });
  expect(results.kept[1]).toMatchObject({ role: "dialog", "aria-labelledby": "semantic-kept" });

  // `windows-window-title` already names Projects, so the probe gets a fresh id.
  expect(results.collision[0]).toBe(true);
  expect(results.collision[1]).toMatch(/^window-title-\d+$/);
  const anonymousIds = results.anonymous.map(([, id]) => id);
  expect(results.anonymous.map(([applied]) => applied)).toEqual([true, true]);
  anonymousIds.forEach((id) => expect(id).toMatch(/^window-title-\d+$/));
  expect(new Set([results.collision[1], ...anonymousIds]).size).toBe(3);

  expect(results.labelled).toEqual([
    true,
    { role: "dialog", "aria-labelledby": null, "aria-label": "Named", "aria-modal": null },
    "",
  ]);
  expect(results.alert[0]).toBe(true);
  expect(results.alert[1]).toMatchObject({ role: "alertdialog", "aria-modal": "true" });
  expect(results.alert[1]["aria-labelledby"]).toBe(results.alert[2]);
  expect(results.region).toEqual([
    false,
    { role: "region", "aria-labelledby": null, "aria-label": "Region", "aria-modal": null },
  ]);
  expect(results.untitled).toEqual([
    false,
    { role: null, "aria-labelledby": null, "aria-label": null, "aria-modal": null },
  ]);
  expect(results.inner).toEqual([
    false,
    { role: null, "aria-labelledby": null, "aria-label": null, "aria-modal": null },
  ]);
  // The outer window's only title belongs to the window nested inside it.
  expect(results.outer[0]).toBe(false);
  expect(results.outer[1].role).toBeNull();
});

for (const viewport of REVIEW_VIEWPORTS) {
  test(`app windows open, stack, close and reopen as named dialogs at ${viewport.name}`, async ({
    page,
  }) => {
    await openHomeDesktop(page, viewport);
    const projects = page.getByRole("dialog", { name: "Projects" });
    const credits = page.getByRole("dialog", { name: "Credits" });
    await expect(projects).toHaveCount(0);

    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("Tab");
      expect(await focusInHiddenWindow(page), `Tab ${step} stays out of hidden windows`).toBe(false);
    }

    const projectsWindow = await openApp(page, "windows");
    await expect(projects).toBeVisible();
    await expect(projectsWindow).not.toHaveAttribute("aria-modal", /.+/);
    const titleId = await projectsWindow.getAttribute("aria-labelledby");

    // Non-modal: the desktop behind Projects still launches another window on top.
    const creditsWindow = await openApp(page, "credits");
    await expect(projects).toBeVisible();
    await expect(credits).toBeVisible();
    const [projectsZ, creditsZ] = await Promise.all(
      [projectsWindow, creditsWindow].map((win) => win.evaluate((element) => Number(element.style.zIndex)))
    );
    expect(creditsZ).toBeGreaterThan(projectsZ);

    await creditsWindow.locator('[data-close="credits"]').click();
    await expect(credits).toHaveCount(0);
    await projectsWindow.locator('[data-close="windows"]').click();
    await expect(projects).toHaveCount(0);
    await expect(projectsWindow).toBeHidden();

    await openApp(page, "windows");
    await expect(projects).toBeVisible();
    await expect(projectsWindow).toHaveAttribute("aria-labelledby", titleId);
    await expect(page.locator(`[id="${titleId}"]`)).toHaveCount(1);
    await expect(page.getByRole("dialog", { name: "Credits" })).toHaveCount(0);
  });
}

test("keyboard dismissal and focus restoration are unchanged", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);

  // An app window gains a dialog role, not an Escape shortcut it never had.
  const study = await openApp(page, "study-resources");
  await expect(page.getByRole("dialog", { name: "Study Resources" })).toBeVisible();
  await study.locator('[data-close="study-resources"]').focus();
  await page.keyboard.press("Escape");
  await expect(study).toBeVisible();

  // Focus-return prompts keep their own role, initial focus, Escape and restoration.
  const launcher = page.locator('.taskbar-icon[data-app="image-tools"]');
  await launcher.click();
  const prompt = page.getByRole("alertdialog", { name: "Image Tools" });
  await expect(prompt).toBeVisible();
  await expect(prompt.locator("[data-coming-soon-ok]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(prompt).toHaveCount(0);
  await expect(launcher).toBeFocused();
});

test("random-event windows gain dialog semantics on the shared open path", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const opened = await page.evaluate(() => {
    const { showManagedRandomEventWindow } = window.homeEventRuntime;
    const win = document.createElement("div");
    win.className = "window random-event-window is-hidden";
    win.setAttribute("aria-hidden", "true");
    win.innerHTML =
      '<div class="title-bar"><div class="title-bar-text">Dynamic Probe</div></div>' +
      '<div class="window-body"><button type="button">OK</button></div>';
    document.body.append(win);
    const before = win.getAttribute("role");
    return { accepted: showManagedRandomEventWindow(win), before };
  });
  expect(opened).toEqual({ accepted: true, before: null });

  const dialog = page.getByRole("dialog", { name: "Dynamic Probe" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-labelledby", /^window-title-\d+$/);
  await expect(dialog).not.toHaveAttribute("aria-modal", /.+/);
  await finishOpening(dialog);
  await dialog.evaluate((element) => element.remove());
});

test("newly named windows and the calendar popout pass the WCAG scan", async ({ page }, testInfo) => {
  await openHomeDesktop(page, DESKTOP);
  for (const app of ["study-resources", "cursor", "life-counter"]) {
    await openApp(page, app);
  }
  await page.locator("#taskbar-clock-button").click();
  const calendar = page.getByRole("dialog", { name: "Date & Time" });
  await expect(calendar).toBeVisible();
  expect(await scanForViolations(page, testInfo, "named-app-windows")).toEqual([]);
});
