import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const adminScriptPath = "scripts/home/admin-controls.js";
const adminStylePath = "styles/home/admin-controls.css";

const countMatches = (source, pattern) => Array.from(source.matchAll(pattern)).length;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tagWithAttribute = (source, attribute, value) => {
  const escapedAttribute = escapeRegExp(attribute);
  const escapedValue = escapeRegExp(value);
  return source.match(
    new RegExp(`<[^>]+\\b${escapedAttribute}="${escapedValue}"[^>]*>`, "i")
  )?.[0] || "";
};

const attributeValue = (tag, attribute) =>
  tag.match(new RegExp(`\\b${escapeRegExp(attribute)}="([^"]*)"`, "i"))?.[1] ?? null;

const sourceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source boundary: ${endMarker}`);
  return source.slice(start, end);
};

const readAdminSources = async () => {
  const [home, main, admin, styles, validation] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL(adminScriptPath, root), "utf8"),
    readFile(new URL(adminStylePath, root), "utf8"),
    readFile(new URL("docs/validation/admin-controls.md", root), "utf8"),
  ]);
  return { admin, home, main, styles, validation };
};

const loadAdminNamespace = (source) => {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const document = {
    addEventListener: (name, listener) => documentListeners.set(name, listener),
    documentElement: { classList: { add() {}, remove() {}, toggle() {} } },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    readyState: "loading",
  };
  const window = {
    addEventListener: (name, listener) => windowListeners.set(name, listener),
    clearInterval() {},
    clearTimeout() {},
    document,
    localStorage: {
      getItem: () => null,
      removeItem() {},
      setItem() {},
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => callback(0),
    sessionStorage: {
      getItem: () => null,
      removeItem() {},
      setItem() {},
    },
    setInterval: () => 1,
    setTimeout: (callback) => {
      callback();
      return 1;
    },
  };
  const context = vm.createContext({
    AbortController,
    Array,
    Boolean,
    console,
    Date,
    document,
    Element: class Element {},
    Event: class Event {},
    Intl,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    queueMicrotask,
    Set,
    String,
    URL,
    window,
  });
  vm.runInContext(source, context, { filename: adminScriptPath });
  return window.rohinAdminControls;
};

test("Admin is available on the desktop and immediately before GitHub in the dock", async () => {
  const { home } = await readAdminSources();
  const desktop = sourceBetween(home, '<div class="desktop"', '<div class="window-stack"');
  const taskbar = sourceBetween(home, '<div class="taskbar-apps"', "</div>");
  const desktopLauncher = tagWithAttribute(desktop, "data-app", "admin-controls");
  const dockLauncher = tagWithAttribute(taskbar, "data-app", "admin-controls");

  assert.equal(countMatches(desktop, /data-app="admin-controls"/g), 1);
  assert.equal(countMatches(taskbar, /data-app="admin-controls"/g), 1);
  assert.ok(desktopLauncher, "Admin must have a desktop launcher.");
  assert.ok(dockLauncher, "Admin must have a dock launcher.");
  assert.equal(attributeValue(desktopLauncher, "class"), "desktop-icon");
  assert.equal(attributeValue(dockLauncher, "class"), "taskbar-icon");

  for (const launcher of [desktopLauncher, dockLauncher]) {
    assert.equal(attributeValue(launcher, "aria-label"), "Admin");
    assert.equal(attributeValue(launcher, "aria-haspopup"), "dialog");
    assert.equal(
      attributeValue(launcher, "aria-controls"),
      "admin-controls-window admin-controls-stand-in-window"
    );
  }

  for (const [surface, launcher] of [
    [desktop, desktopLauncher],
    [taskbar, dockLauncher],
  ]) {
    const launcherStart = surface.indexOf(launcher);
    const launcherEnd = surface.indexOf("</button>", launcherStart);
    const launcherMarkup = surface.slice(launcherStart, launcherEnd);
    const followingMarkup = surface.slice(launcherEnd + "</button>".length).trimStart();
    assert.match(launcherMarkup, /src="assets\/app-icons\/ico\/program_manager\.ico"/);
    assert.match(
      followingMarkup,
      /^<button class="(?:desktop-icon|taskbar-icon)" data-github-shortcut /,
      "Admin must be immediately before GitHub on each launcher surface."
    );
  }

  const icon = await stat(new URL("assets/app-icons/ico/program_manager.ico", root));
  const script = await stat(new URL(adminScriptPath, root));
  const styles = await stat(new URL(adminStylePath, root));
  assert.ok(icon.isFile() && icon.size > 0);
  assert.ok(script.isFile() && script.size > 0);
  assert.ok(styles.isFile() && styles.size > 0);

  assert.match(
    home,
    /styles\/home\/admin-controls\.css\?v=admin-seed-sequences-20260906/
  );
  assert.match(
    home,
    /scripts\/home\/admin-controls\.js\?v=admin-seed-sequences-20260906/
  );
  assert.ok(
    home.indexOf("scripts/home/admin-controls.js") >
      home.indexOf("scripts/home/main.js"),
    "The controller must load after the runtime orchestrator."
  );
});

test("Admin launch access requires an active Administrator session proof", async () => {
  const { home, main } = await readAdminSources();
  const standInTag = tagWithAttribute(home, "id", "admin-controls-stand-in-window");
  assert.ok(standInTag, "Missing unauthenticated Admin stand-in window.");
  assert.equal(attributeValue(standInTag, "data-app-window"), "admin-controls-stand-in");
  assert.match(standInTag, /\bdata-coming-soon-window\b/);
  assert.equal(attributeValue(standInTag, "role"), "alertdialog");
  assert.equal(attributeValue(standInTag, "aria-modal"), "false");
  assert.equal(attributeValue(standInTag, "aria-hidden"), "true");
  assert.equal(
    attributeValue(standInTag, "aria-labelledby"),
    "admin-controls-stand-in-title"
  );
  assert.equal(
    attributeValue(standInTag, "aria-describedby"),
    "admin-controls-stand-in-message"
  );

  const standInMarkup = sourceBetween(
    home,
    standInTag,
    '<div\n        class="window home-window app-window app-window--center admin-controls-window is-hidden"'
  );
  assert.match(standInMarkup, /id="admin-controls-stand-in-title">Admin Controls<\/div>/);
  assert.match(
    standInMarkup,
    /<img src="assets\/app-icons\/ico\/program_manager\.ico" alt="" \/>/
  );
  assert.match(
    standInMarkup,
    /id="admin-controls-stand-in-message">nothing to see here\.\.\.<\/p>/
  );
  assert.match(
    standInMarkup,
    /<button\s+type="button"\s+id="admin-controls-stand-in-ok"\s+data-coming-soon-ok\s+data-close="admin-controls-stand-in"\s*>OK<\/button>/
  );
  assert.doesNotMatch(
    tagWithAttribute(standInMarkup, "id", "admin-controls-stand-in-ok"),
    /\bclass=/,
    "The stand-in must retain native 98.css button styling."
  );

  const normalizeProofSource = sourceBetween(
    main,
    "const normalizeAdministratorProof =",
    "\n\nconst isGameStatsAdministratorProfile"
  );
  const profileCheckSource = sourceBetween(
    main,
    "const isGameStatsAdministratorProfile =",
    "\n\nconst normalizeAdministratorSignInResponse"
  );
  const clearProofSource = sourceBetween(
    main,
    "const clearGameStatsAdministratorProof =",
    "\n\nlet gameStatsAdministratorProof"
  );
  const activeProofSource = sourceBetween(
    main,
    "const hasActiveGameStatsAdministratorProof =",
    "\n\nconst getAdministratorEventHeaders"
  );
  const accessSource = sourceBetween(
    main,
    'const ADMIN_CONTROLS_APP_ID = "admin-controls";',
    "\nlet gameStatsProfilePromptResolve"
  );
  const administratorProfile = {
    id: "player-rohin-neko",
    name: "rohin ^.^",
    icon: "assets/neko-assets/sprites/yawn1.png",
  };
  const validProof = {
    proof: `${"a".repeat(32)}.${"b".repeat(32)}`,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const runAccessCase = ({ profile, proof }) => {
    let removals = 0;
    const context = vm.createContext({
      Date,
      GAME_STATS_ROHIN_NEKO_AVATAR_ICON: administratorProfile.icon,
      GAME_STATS_ROHIN_NEKO_PROFILE: administratorProfile,
      sessionStorage: {
        removeItem(key) {
          assert.equal(key, "personalSiteAdministratorProofV1");
          removals += 1;
        },
      },
      GAME_STATS_ADMINISTRATOR_PROOF_STORAGE_KEY: "personalSiteAdministratorProofV1",
    });
    vm.runInContext(
      `${normalizeProofSource}\n${profileCheckSource}\n` +
        `let gameStatsAdministratorProof = ${JSON.stringify(proof)};\n` +
        `${clearProofSource}\n${activeProofSource}\n` +
        `let gameStatsProfile = ${JSON.stringify(profile)};\n` +
        `${accessSource}\n` +
        `const adminTarget = resolveAdminControlsLaunchAppId("admin-controls");\n` +
        `globalThis.result = {\n` +
        `  access: adminTarget === ADMIN_CONTROLS_APP_ID,\n` +
        `  adminTarget,\n` +
        `  otherTarget: resolveAdminControlsLaunchAppId("solitaire"),\n` +
        `  proof: gameStatsAdministratorProof,\n` +
        `};`,
      context
    );
    return { ...structuredClone(context.result), removals };
  };

  assert.deepEqual(
    runAccessCase({ profile: administratorProfile, proof: validProof }),
    {
      access: true,
      adminTarget: "admin-controls",
      otherTarget: "solitaire",
      proof: validProof,
      removals: 0,
    }
  );
  assert.equal(
    runAccessCase({ profile: null, proof: validProof }).adminTarget,
    "admin-controls"
  );
  assert.equal(
    runAccessCase({ profile: administratorProfile, proof: null }).adminTarget,
    "admin-controls-stand-in"
  );
  for (const invalidProof of [
    { proof: "too-short", expiresAt: validProof.expiresAt },
    { proof: validProof.proof, expiresAt: "not-a-date" },
    { proof: `${"a".repeat(16)}!`, expiresAt: validProof.expiresAt },
  ]) {
    const invalid = runAccessCase({ profile: administratorProfile, proof: invalidProof });
    assert.equal(invalid.access, false);
    assert.equal(invalid.adminTarget, "admin-controls-stand-in");
    assert.equal(invalid.proof, null);
    assert.equal(invalid.removals, 1);
  }
  const expired = runAccessCase({
    profile: administratorProfile,
    proof: { ...validProof, expiresAt: new Date(Date.now() - 60_000).toISOString() },
  });
  assert.equal(expired.access, false);
  assert.equal(expired.adminTarget, "admin-controls-stand-in");
  assert.equal(expired.proof, null);
  assert.equal(expired.removals, 1);

  assert.match(
    main,
    /if \(open && appId === ADMIN_CONTROLS_APP_ID\) \{[\s\S]*?resolveAdminControlsLaunchAppId\(appId\)/
  );
  assert.match(
    main,
    /const launchAppId = resolveAdminControlsLaunchAppId\(appId\);[\s\S]*?toggleWindow\(launchAppId\);/
  );
  assert.match(
    main,
    /inactiveAppId === ADMIN_CONTROLS_STAND_IN_APP_ID[\s\S]*?comingSoonFocusReturns\.delete\(inactiveWindow\)/
  );
  assert.equal(
    countMatches(main, /if \(!isAdminControlsAppId\(appId\)\) \{/g),
    2,
    "Neither Admin window may emit natural window-open or window-close triggers."
  );
  assert.match(
    main,
    /isAdminControlsAppId\(win\.getAttribute\("data-app-window"\)\) \|\|[\s\S]*?!isWindowVisible\(win\)/
  );
  assert.match(
    main,
    /didDragWindow &&\s*!isAdminControlsAppId\(win\.getAttribute\("data-app-window"\)\)/
  );
});

test("Admin Controls exposes the complete accessible capture workflow", async () => {
  const { admin, home, styles } = await readAdminSources();
  const windowTag = tagWithAttribute(home, "id", "admin-controls-window");

  assert.ok(windowTag, "Missing Admin Controls window.");
  assert.equal(attributeValue(windowTag, "data-app-window"), "admin-controls");
  assert.equal(attributeValue(windowTag, "role"), "dialog");
  assert.equal(attributeValue(windowTag, "aria-modal"), "false");
  assert.equal(attributeValue(windowTag, "aria-hidden"), "true");
  assert.equal(attributeValue(windowTag, "aria-labelledby"), "admin-controls-title");

  const windowStart = home.indexOf(windowTag);
  const windowPreview = home.slice(windowStart, windowStart + 1_400);
  assert.match(
    windowPreview,
    /id="admin-controls-title"[\s\S]*?<span>Admin Controls<\/span>/
  );
  assert.match(windowPreview, /program_manager\.ico/);
  assert.match(windowPreview, /aria-label="Close"[^>]*data-close="admin-controls"/);

  const requiredIds = [
    "admin-controls-body",
    "admin-controls-status",
    "admin-seed-count",
    "admin-countdown",
    "admin-hide-before-trigger",
    "admin-show-countdown",
    "admin-start-take",
    "admin-stop-take",
    "admin-reset-scene",
    "admin-event-search",
    "admin-event-kind",
    "admin-event-list",
    "admin-event-preview",
    "admin-trigger-now",
    "admin-run-sequence-next",
    "admin-add-cue",
    "admin-target-search",
    "admin-binding-target",
    "admin-pick-target",
    "admin-binding-event",
    "admin-binding-once",
    "admin-binding-repeat",
    "admin-save-binding",
    "admin-clear-bindings",
    "admin-binding-list",
    "admin-seed-picker",
    "admin-sequence-seed",
    "admin-seed-menu",
    "admin-seed-list",
    "admin-generate-sequence",
    "admin-replay-sequence",
    "admin-sequence-preview",
    "admin-frequency",
    "admin-duration",
    "admin-intensity",
    "admin-shot-list",
    "admin-cue-current",
    "admin-cue-prev",
    "admin-cue-next",
    "admin-show-cue",
    "admin-guide",
    "admin-safe-area",
    "admin-audio",
    "admin-vfx",
    "admin-privacy",
    "admin-pause-natural",
    "admin-clear-data",
    "admin-countdown-overlay",
    "admin-cue-overlay",
    "admin-safe-area-guide",
    "admin-controls-announcer",
  ];
  requiredIds.forEach((id) => {
    assert.equal(
      countMatches(home, new RegExp(`\\bid="${escapeRegExp(id)}"`, "g")),
      1,
      `${id} must be unique.`
    );
  });

  for (const tab of ["run", "events", "bindings", "capture"]) {
    assert.equal(
      countMatches(home, new RegExp(`\\bdata-admin-tab="${tab}"`, "g")),
      1,
      `Missing ${tab} tab.`
    );
    assert.equal(
      countMatches(home, new RegExp(`\\bdata-admin-panel="${tab}"`, "g")),
      1,
      `Missing ${tab} panel.`
    );
  }

  for (const preset of ["game-win", "dialog", "notification", "desktop-activity"]) {
    assert.equal(
      countMatches(home, new RegExp(`\\bdata-admin-preset="${preset}"`, "g")),
      1,
      `Missing ${preset} scene preset.`
    );
  }

  const status = tagWithAttribute(home, "id", "admin-controls-status");
  const announcer = tagWithAttribute(home, "id", "admin-controls-announcer");
  const eventPreview = tagWithAttribute(home, "id", "admin-event-preview");
  assert.equal(attributeValue(status, "role"), "status");
  assert.equal(attributeValue(status, "aria-live"), "polite");
  assert.match(home.slice(home.indexOf(status), home.indexOf(status) + 300), /Local only/);
  assert.equal(attributeValue(announcer, "role"), "status");
  assert.equal(attributeValue(announcer, "aria-live"), "polite");
  assert.equal(attributeValue(eventPreview, "role"), "img");
  assert.equal(attributeValue(eventPreview, "aria-live"), "polite");
  const sequenceSeed = tagWithAttribute(home, "id", "admin-sequence-seed");
  const seedMenu = tagWithAttribute(home, "id", "admin-seed-menu");
  assert.equal(attributeValue(sequenceSeed, "aria-controls"), "admin-seed-menu");
  assert.equal(attributeValue(sequenceSeed, "aria-expanded"), "false");
  assert.equal(attributeValue(sequenceSeed, "aria-haspopup"), "dialog");
  assert.equal(attributeValue(seedMenu, "role"), "dialog");
  assert.equal(attributeValue(seedMenu, "aria-label"), "Saved sequence seeds");
  assert.match(seedMenu, /\bhidden\b/);

  const taskbarStart = home.indexOf('<div class="taskbar"');
  for (const overlayId of [
    "admin-countdown-overlay",
    "admin-cue-overlay",
    "admin-safe-area-guide",
  ]) {
    const overlay = tagWithAttribute(home, "id", overlayId);
    assert.equal(attributeValue(overlay, "aria-hidden"), "true");
    assert.ok(home.indexOf(overlay) < taskbarStart, `${overlayId} must precede the taskbar.`);
    assert.doesNotMatch(overlay, /\bwindow\b|data-app-window/);
    assert.match(styles, new RegExp(`#${overlayId}`));
  }
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /body\.is-admin-controls-open/);
  assert.match(styles, /body\.is-admin-picking-target/);
  assert.match(styles, /body\.is-admin-privacy-mode/);
  assert.match(styles, /\[data-admin-seeded\]/);
  assert.match(styles, /\.admin-seed-badge::before\s*\{[^}]*content:\s*"SEED"/s);
  assert.match(
    styles,
    /\.admin-controls-tabs\s*\{[^}]*margin:\s*0 0 -8px;/s,
    "The outside tabs must share the panel's left and right edges."
  );
  assert.match(
    styles,
    /\.admin-controls-panel\s*\{[^}]*box-shadow:\s*var\(--border-raised-outer\),\s*var\(--border-raised-inner\);/s,
    "The controlled panel and its tabs must both use a raised surface."
  );
  assert.match(styles, /\.admin-event-preview-viewport/);
  assert.match(admin, /\.admin-event-preview-stage/);
});

test("Admin settings use strict versioned local state with a deterministic public helper", async () => {
  const { admin } = await readAdminSources();
  const api = loadAdminNamespace(admin);

  assert.ok(api, "admin-controls.js must expose window.rohinAdminControls.");
  for (const key of [
    "STORAGE_KEY",
    "RESET_PENDING_KEY",
    "RANDOM_EVENT_VALUE",
    "DEFAULT_STATE",
    "normalizeSeedNames",
    "normalizeState",
    "createSeededSequence",
    "create",
  ]) {
    assert.ok(key in api, `Missing public Admin helper: ${key}`);
  }
  assert.equal(api.STORAGE_KEY, "personalSiteAdminControlsV1");
  assert.equal(api.RESET_PENDING_KEY, "personalSiteAdminControlsResetPendingV1");
  assert.equal(api.RANDOM_EVENT_VALUE, "__random__");
  assert.equal(typeof api.normalizeSeedNames, "function");
  assert.equal(typeof api.normalizeState, "function");
  assert.equal(typeof api.createSeededSequence, "function");
  assert.equal(typeof api.create, "function");

  const eventIds = ["zeta-event", "alpha-event", "beta-event", "alpha-event"];
  const firstSequence = api.createSeededSequence("promo-take-7", eventIds);
  const repeatedSequence = api.createSeededSequence(
    "promo-take-7",
    [{ id: "beta-event" }, { id: "alpha-event" }, { id: "zeta-event" }]
  );
  const differentSequence = api.createSeededSequence("promo-take-8", eventIds);
  assert.equal(firstSequence.length, 24);
  assert.deepEqual(
    JSON.parse(JSON.stringify(firstSequence)),
    JSON.parse(JSON.stringify(repeatedSequence)),
    "Equivalent event sets must yield the same take regardless of input order or duplicates."
  );
  assert.notDeepEqual(
    JSON.parse(JSON.stringify(firstSequence)),
    JSON.parse(JSON.stringify(differentSequence))
  );
  firstSequence.forEach((eventId) => {
    assert.ok(["alpha-event", "beta-event", "zeta-event"].includes(eventId));
    assert.notEqual(eventId, api.RANDOM_EVENT_VALUE);
    assert.notEqual(eventId, "__sequence__");
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.createSeededSequence("empty", [], 8))),
    []
  );

  const defaults = JSON.parse(JSON.stringify(api.DEFAULT_STATE));
  assert.deepEqual(defaults, {
    version: 1,
    activeTab: "run",
    countdown: 3,
    hideBeforeTrigger: true,
    showCountdown: true,
    bindings: [],
    sequenceSeed: "promo-001",
    seedNames: ["promo-001"],
    sequence: [],
    sequenceCursor: 0,
    frequency: 15,
    duration: 30,
    intensity: "medium",
    shotList: [],
    cueCursor: -1,
    guide: "off",
    safeArea: false,
    audio: true,
    visualEffects: true,
    privacy: false,
    pauseNatural: true,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(api.normalizeState(null))), defaults);
  assert.deepEqual(JSON.parse(JSON.stringify(api.normalizeState([]))), defaults);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        api.normalizeState({
          credentials: { password: "must-not-survive" },
          selector: "body *",
          server: "https://example.test",
          unexpected: true,
        })
      )
    ),
    defaults,
    "Unknown and sensitive fields must be discarded."
  );

  const normalized = JSON.parse(JSON.stringify(api.normalizeState({
    version: 1,
    activeTab: "capture",
    countdown: "5",
    hideBeforeTrigger: false,
    showCountdown: false,
    bindings: [
      {
        target: "app:video-editor:taskbar",
        label: "  Video   Editor  ",
        eventId: "behelit-found",
        mode: "repeat",
      },
      { target: "body *", label: "Unsafe selector", eventId: "behelit-found" },
      { target: "start", label: "Start", eventId: "__random__", mode: "unknown" },
    ],
    sequenceSeed: "  promo   take 42  ",
    seedNames: [
      "  promo   take 42  ",
      "alternate-take",
      "alternate-take",
      "",
      "x".repeat(70),
    ],
    sequence: ["zeta-event", "__random__", "body *", "alpha-event"],
    sequenceCursor: "2",
    frequency: "5",
    duration: 60,
    intensity: "high",
    shotList: [
      "  Opening   beat  ",
      { label: "  Win   shot  ", eventId: "behelit-found" },
    ],
    cueCursor: "1",
    guide: "vertical",
    safeArea: true,
    audio: false,
    visualEffects: false,
    privacy: true,
    pauseNatural: false,
    credentials: { password: "discard-me" },
  })));
  assert.deepEqual(normalized, {
    version: 1,
    activeTab: "capture",
    countdown: 5,
    hideBeforeTrigger: false,
    showCountdown: false,
    bindings: [
      {
        target: "app:video-editor:taskbar",
        label: "Video Editor",
        eventId: "behelit-found",
        mode: "repeat",
      },
      { target: "start", label: "Start", eventId: "__random__", mode: "once" },
    ],
    sequenceSeed: "promo take 42",
    seedNames: ["promo take 42", "alternate-take", "x".repeat(64)],
    sequence: ["zeta-event", "alpha-event"],
    sequenceCursor: 2,
    frequency: 5,
    duration: 60,
    intensity: "high",
    shotList: [
      { label: "Opening beat", eventId: "" },
      { label: "Win shot", eventId: "behelit-found" },
    ],
    cueCursor: 1,
    guide: "vertical",
    safeArea: true,
    audio: false,
    visualEffects: false,
    privacy: true,
    pauseNatural: false,
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(api.normalizeSeedNames([
      " first   take ",
      null,
      "first take",
      ...Array.from({ length: 60 }, (_, index) => `take-${index}`),
    ]))),
    ["first take", ...Array.from({ length: 49 }, (_, index) => `take-${index}`)]
  );
  const migrated = JSON.parse(JSON.stringify(api.normalizeState({
    ...defaults,
    seedNames: undefined,
    sequenceSeed: "legacy-take",
    sequence: ["alpha-event"],
  })));
  assert.deepEqual(migrated.seedNames, ["legacy-take"]);
  const intentionallyEmpty = JSON.parse(JSON.stringify(api.normalizeState({
    ...defaults,
    seedNames: [],
  })));
  assert.deepEqual(intentionallyEmpty.seedNames, []);

  assert.match(admin, /const localStateStorage = storage \|\| pageWindow\.localStorage/);
  assert.match(admin, /localStateStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(admin, /localStateStorage\.setItem\(STORAGE_KEY,/);
  assert.match(admin, /const transientStorage = resetStorage \|\| pageWindow\.sessionStorage/);
  assert.match(admin, /transientStorage\.getItem\(RESET_PENDING_KEY\)/);
  assert.doesNotMatch(
    admin,
    /transientStorage\.(?:getItem|setItem|removeItem)\(STORAGE_KEY/,
    "Durable Admin state must not be stored in sessionStorage."
  );
  assert.doesNotMatch(admin, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.doesNotMatch(admin, /password|credential|authorization|bearer/i);
  assert.match(admin, /try\s*\{/);
  assert.match(admin, /catch\s*(?:\([^)]*\))?\s*\{/);
});

test("runtime orchestration integrates the complete event registry without publishing wins", async () => {
  const { main } = await readAdminSources();
  const eventRuntime = sourceBetween(
    main,
    "const listAdminRandomEvents = () =>",
    "const ADMIN_DESKTOP_ACTIVITY_APPS"
  );
  const presetRuntime = sourceBetween(
    main,
    "const runAdminScenePreset = async",
    "window.rohinAdminOrchestrator"
  );
  const gameWinRuntime = sourceBetween(
    presetRuntime,
    'if (presetId === "game-win")',
    'if (presetId === "dialog")'
  );

  assert.match(eventRuntime, /randomEventDefinitions\.map/);
  assert.match(eventRuntime, /id:\s*"feliz-jueves"/);
  assert.match(eventRuntime, /createAdminRandomEventPreview/);
  assert.match(eventRuntime, /ADMIN_RANDOM_EVENT_PREVIEW_TEMPLATES/);
  assert.match(eventRuntime, /configureRelicRecoveryPreview/);
  assert.match(eventRuntime, /configureInfinityArmoryPreview/);
  assert.match(eventRuntime, /configureGradescopeCurvePreview/);
  assert.match(eventRuntime, /configureGearsNestPreview/);
  assert.match(eventRuntime, /drawDistressSignalPreview/);
  assert.match(eventRuntime, /setAttribute\("aria-hidden", "true"\)/);
  assert.match(eventRuntime, /data-admin-event-preview-window/);
  assert.match(
    main,
    /"dodging-popup-alert":\s*"Annoying Dodging Popup Alert"/
  );
  assert.match(
    main,
    /"vanishing-popup-alert":\s*"Annoying Vanishing Popup Alert"/
  );
  assert.match(eventRuntime, /randomEventDefinitions\.find/);
  assert.match(eventRuntime, /preloadRandomEventAssets/);
  assert.match(eventRuntime, /definition\.run/);
  assert.match(eventRuntime, /const runAdminRandomEventChoice = async/);
  assert.match(eventRuntime, /chooseRandomEventOutsideLockdown\(eligibleEvents\)/);
  assert.match(eventRuntime, /recordRandomEventSelection\(selected\.definition\)/);
  assert.match(eventRuntime, /triggerProbability:\s*1/);
  assert.doesNotMatch(eventRuntime, /scheduleRandomEventRun|triggerRandomEvents/);

  for (const preset of ["game-win", "dialog", "notification", "desktop-activity"]) {
    assert.match(presetRuntime, new RegExp(`presetId === "${preset}"`));
  }
  assert.match(gameWinRuntime, /setWindowOpen\("solitaire", true\)/);
  assert.match(gameWinRuntime, /solStartFireworks\(\)/);
  assert.match(gameWinRuntime, /solShowAchievement\(\)/);
  assert.match(gameWinRuntime, /solPlayVictoryVideo\(\)/);
  assert.doesNotMatch(
    gameWinRuntime,
    /recordGame|publish|queue|sync|submit|triggerRandomEvents|fetch/i,
    "The promotional win must remain visual-only."
  );

  const publicRuntime = sourceBetween(
    main,
    "window.rohinAdminOrchestrator = Object.freeze({",
    "runAfterHomeActivation(scheduleCalendarRefresh)"
  );
  for (const method of [
    "closeWindow",
    "createEventPreview",
    "listEvents",
    "resetScene",
    "runEvent",
    "runRandomEvent",
    "runPreset",
  ]) {
    assert.match(publicRuntime, new RegExp(`\\b${method}:`));
  }
  assert.match(main, /shouldPauseNaturalRandomEvents\(\)/);
  assert.match(main, /!isAdminControlsAppId\(appId\)/);
  assert.match(main, /window\.rohinAdminControlsController\?\.handleDocumentClick/);
  assert.match(
    main,
    /target\?\.closest\("#admin-controls-window, #admin-controls-stand-in-window"\)/
  );
});

test("bindings, timing, capture aids, and reset are implemented as real controller state", async () => {
  const { admin } = await readAdminSources();

  for (const stableTargetPattern of [
    /`id:\$\{[^}]+\}`/,
    /`app:\$\{[^}]+\}:/,
    /\bstart\b/,
    /github:/,
  ]) {
    assert.match(admin, stableTargetPattern);
  }
  assert.match(admin, /__sequence__/);
  assert.match(admin, /data-admin-seeded/);
  assert.match(admin, /is-admin-controls-open/);
  assert.match(admin, /is-admin-picking-target/);
  assert.doesNotMatch(
    admin,
    /querySelector\(\s*(?:binding|saved|state)\.[a-z]*target/i,
    "Persisted target values must not be executed as arbitrary selectors."
  );

  for (const feature of [
    /countdown/i,
    /hideBefore/i,
    /frequency/i,
    /duration/i,
    /intensity/i,
    /shotList/i,
    /safeArea/i,
    /audio/i,
    /visualEffects|\bvfx\b/i,
    /privacy/i,
    /pauseNatural/i,
    /resetScene/i,
  ]) {
    assert.match(admin, feature);
  }
  assert.match(admin, /localStateStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(admin, /orchestrator\.runEvent/);
  assert.match(admin, /orchestrator\.runRandomEvent/);
  assert.doesNotMatch(
    sourceBetween(admin, "const runEventChoice = async", "const hideCountdownOverlay"),
    /Math\.random/,
    "Random Admin choices must use the site's shared repeat-avoidance runtime."
  );
  assert.match(admin, /orchestrator\.runPreset/);
  assert.match(admin, /orchestrator\.resetScene/);
});

test("Admin validation ends with a complete repeatable promo-take runbook", async () => {
  const { validation } = await readAdminSources();
  const section = validation.slice(validation.lastIndexOf("## "));

  assert.match(section, /^## Repeatable promo-video takes/m);
  for (const controlOrConcept of [
    "Sequence seed",
    "Generate",
    "Next deterministic sequence cue",
    "Every click",
    "Replay",
    "Reset Scene",
    "Start Take",
    "Random",
  ]) {
    assert.match(section, new RegExp(escapeRegExp(controlOrConcept)));
  }
  assert.match(section, /same (?:order|click path)/i);
  assert.match(section, /record/i);
  assert.match(section, /retake/i);
  assert.match(section, /not deterministic/i);
});
