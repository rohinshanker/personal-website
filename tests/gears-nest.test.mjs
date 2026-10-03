import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  RANDOM_EVENT_SCRIPT_KEYS,
  readHomeScriptText,
} from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);
const [eventSources, eventStyles, homeSource, indexSource, domSource, cursorModeSource] = await Promise.all([
  readHomeScriptText(
    "windows",
    "cursor",
    "calendar",
    "minesweeper",
    ...RANDOM_EVENT_SCRIPT_KEYS
  ),
  readFile(new URL("styles/home/random-events.css", root), "utf8"),
  readFile(new URL("home.html", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readHomeScriptText(
    "windows",
    "cursor",
    "calendar",
    "minesweeper",
    ...RANDOM_EVENT_SCRIPT_KEYS
  ),
  readFile(new URL("scripts/home/core/cursor-mode.js", root), "utf8"),
]);
const baseStyles = await readFile(new URL("styles/home/base.css", root), "utf8");
const cursorStyles = await readFile(new URL("styles/home/cursors.css", root), "utf8");

const getCssBlock = (selector) => {
  const start = eventStyles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing CSS block: ${selector}`);
  const end = eventStyles.indexOf("\n}", start);
  assert.notEqual(end, -1, `Unterminated CSS block: ${selector}`);
  return eventStyles.slice(start, end + 2);
};

const getBaseCssBlock = (selector) => {
  const start = baseStyles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing base CSS block: ${selector}`);
  const end = baseStyles.indexOf("\n}", start);
  assert.notEqual(end, -1, `Unterminated base CSS block: ${selector}`);
  return baseStyles.slice(start, end + 2);
};

test("enemy health is reduced by ten percent from the prior scaling", () => {
  assert.match(
    eventSources,
    /const GEARS_NEST_ENEMY_HEALTH_MULTIPLIER = 3 \* 0\.9;/
  );
  const templates = eventSources.slice(
    eventSources.indexOf("const GEARS_NEST_ENEMY_TEMPLATES"),
    eventSources.indexOf("const applyGearsNestEnemyCoverSlot")
  );
  const baseHealth = [...templates.matchAll(/baseHealth: (\d+)/g)].map((match) =>
    Number(match[1])
  );
  assert.deepEqual(baseHealth.map((health) => Math.ceil(health * 3 * 0.9)), [
    81, 92, 76, 81, 157,
  ]);
});

test("nest character assets are local for localhost reliability", async () => {
  const expectedAssets = [
    "assets/random%20events/gears-nest/cog-gear.webp",
    "assets/random%20events/gears-nest/locust-drone.webp",
    "assets/random%20events/gears-nest/boomer.webp",
    "assets/random%20events/gears-nest/lancer.webp",
  ];

  for (const asset of expectedAssets) {
    const escapedAsset = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(eventSources, new RegExp(escapedAsset));
    await access(new URL(asset.replaceAll("%20", " "), root));
  }

  assert.doesNotMatch(
    eventSources,
    /static\.wikia\.nocookie\.net\/gearsofwar\/images\/(?:5\/50|a\/a8|3\/3f|b\/b6)/
  );
  assert.doesNotMatch(
    homeSource,
    /static\.wikia\.nocookie\.net\/gearsofwar\/images\/(?:5\/50|b\/b6)/
  );
  assert.match(homeSource, /data-src="assets\/random%20events\/gears-nest\/lancer\.webp"/);
  assert.match(homeSource, /data-src="assets\/random%20events\/gears-nest\/cog-gear\.webp"/);
});

test("nest event is not registered in debug mode", () => {
  const registrationStart = eventSources.indexOf('id: "gears-nest-clear"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  assert.notEqual(registrationStart, -1, "Missing gears nest registration");
  assert.notEqual(registrationEnd, -1, "Missing gears nest registration end");
  const registration = eventSources.slice(registrationStart, registrationEnd);

  assert.doesNotMatch(registration, /debug: true,/);
});

test("blade lock event is not registered in debug mode", () => {
  const registrationStart = eventSources.indexOf('id: "lancer-battle"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  assert.notEqual(registrationStart, -1, "Missing lancer battle registration");
  assert.notEqual(registrationEnd, -1, "Missing lancer battle registration end");
  const registration = eventSources.slice(registrationStart, registrationEnd);

  assert.doesNotMatch(registration, /debug: true,/);
});

test("castle gate event and its exclusive God King asset are fully retired", async () => {
  for (const source of [eventSources, domSource, homeSource, eventStyles]) {
    assert.doesNotMatch(source, /castle-gate|godking|god king/i);
  }

  await assert.rejects(access(new URL("assets/random events/godking.webp", root)), {
    code: "ENOENT",
  });
});

test("blade lock event has a title-bar close control during setup and clash", () => {
  const windowStart = homeSource.indexOf('id="lancer-battle-window"');
  const windowEnd = homeSource.indexOf('id="brand-burns-window"', windowStart);
  assert.notEqual(windowStart, -1, "Missing lancer battle window");
  assert.notEqual(windowEnd, -1, "Missing next event window after lancer battle");
  const markup = homeSource.slice(windowStart, windowEnd);

  assert.match(markup, /id="lancer-battle-title-close"/);
  assert.match(markup, /aria-label="Close"/);
  assert.match(markup, /id="lancer-battle-ready-stage"[\s\S]*id="lancer-battle-start"/);
  assert.match(markup, /id="lancer-battle-clash-stage"[\s\S]*id="lancer-battle-push"/);
  assert.match(domSource, /const lancerBattleTitleClose = byId\("lancer-battle-title-close"\)/);
  assert.match(
    eventSources,
    /bindRandomEventButton\(lancerBattleTitleClose, closeLancerBattleWindow\);/
  );
});

test("blade lock result clips keep playing through inside and outside clicks", () => {
  const windowStart = homeSource.indexOf('id="lancer-battle-window"');
  const windowEnd = homeSource.indexOf('id="brand-burns-window"', windowStart);
  const markup = homeSource.slice(windowStart, windowEnd);
  const resultVideoTag = [...markup.matchAll(/<video\b[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => tag.includes('id="lancer-battle-result-video"'));
  assert.ok(resultVideoTag, "Missing Lancer result video.");
  assert.doesNotMatch(resultVideoTag, /\bcontrols\b/);
  assert.match(
    eventStyles,
    /\.lancer-battle-result-video \{\s*pointer-events: none;\s*\}/
  );
  assert.match(
    eventSources,
    /const shouldKeepLancerBattleResultMediaPlaying = \(win\) =>\s*win === lancerBattleWindow &&\s*\(lancerBattleState === LANCER_BATTLE_STAGES\.win \|\|\s*lancerBattleState === LANCER_BATTLE_STAGES\.loss\);/
  );

  const clickAwayStart = eventSources.lastIndexOf(
    'document.addEventListener(\n  "pointerdown",\n  (event) => {\n    if (!activeWindow'
  );
  const clickAwayEnd = eventSources.indexOf(
    "\n\nconst pauseActiveWindowMedia",
    clickAwayStart
  );
  assert.notEqual(clickAwayStart, -1, "Missing active-window click-away handler.");
  assert.notEqual(clickAwayEnd, -1, "Missing click-away handler boundary.");
  const clickAwayHandler = eventSources.slice(clickAwayStart, clickAwayEnd);
  assert.match(
    clickAwayHandler,
    /if \(!shouldKeepActiveWindowMediaPlaying\(activeWindow\)\) \{\s*pauseMediaPlayback\(activeWindow\);\s*\}/
  );
  assert.match(
    clickAwayHandler,
    /activeWindowObservers\.forEach\(\(observer\) => observer\.onDeactivate\?\.\(\)\);\s*activeWindow = null;/
  );
  assert.match(
    eventSources,
    /const pauseActiveWindowMedia = \(\) => \{[\s\S]*?pauseMediaPlayback\(activeWindow\);[\s\S]*?activeWindow = null;/
  );
});

test("relic recovery event defines local relic assets and wiki descriptions", async () => {
  const expectedRelics = [
    ["Offering", "A coin-shaped Relic material.", "offering.webp"],
    [
      "Ugly Spinner",
      "A material used to make Relic equipment. If you try to stack them, they spin away for some reason.",
      "ugly-spinner.webp",
    ],
    ["Ivy Badge", "A badge-like Relic material.", "ivy-badge.webp"],
    [
      "Pulled Teeth",
      "A Relic material that resembles a pulled tooth.",
      "pulled-teeth.webp",
    ],
    [
      "Double-Bell Ball",
      "A ball within a ball. It makes a strange sound when shaken. It's softer than it looks.",
      "double-bell-ball.webp",
    ],
    [
      "Spiraling Heat Stone",
      "A material used for Relic equipment. Squeezing it will cause the rock in the middle to emit heat.",
      "spiraling-heat-stone.webp",
    ],
    [
      "Shatter Pot",
      "A material that looks like shattered pot pieces. Surprisingly, they're extremely hard.",
      "shatter-pot.webp",
    ],
    [
      "Tangled Fluid",
      "The inner fluids can be used as a strong adhesive.",
      "tangled-fluid.webp",
    ],
  ];

  for (const [name, description, filename] of expectedRelics) {
    assert.match(eventSources, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(
      eventSources,
      new RegExp(description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
    const asset = `assets/random events/relic-recovery/${filename}`;
    assert.match(
      eventSources,
      new RegExp(asset.replaceAll(" ", "%20").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
    await access(new URL(asset, root));
  }

  assert.match(eventSources, /made-in-abyss-background\.webp/);
  assert.match(eventSources, /nanachi-icon\.webp/);
});

test("relic recovery event has prompt, hotbar, detail flow, and normal gating", () => {
  const registrationStart = eventSources.indexOf('id: "relic-recovery"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  assert.notEqual(registrationStart, -1, "Missing relic recovery registration");
  const registration = eventSources.slice(registrationStart, registrationEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(homeSource, /id="relic-recovery-window"/);
  assert.match(homeSource, /Let's collect some relics!/);
  assert.match(homeSource, /Sounds good!/);
  assert.match(homeSource, /Maybe another time\./);
  assert.match(eventSources, /Thanks for all the help\. See you in Layer 2!/);
  assert.match(eventSources, /RELIC_RECOVERY_STAGE_PROMPT/);
  assert.match(eventSources, /RELIC_RECOVERY_STAGE_ACTIVE/);
  assert.match(eventSources, /RELIC_RECOVERY_STAGE_DETAIL/);
  assert.match(eventSources, /RELIC_RECOVERY_STAGE_COMPLETE/);
  assert.match(eventSources, /relicRecoveryCollectedIds\.add\(relicId\)/);
  assert.match(homeSource, /\[Press anywhere to continue\]/);
  assert.match(getCssBlock(".relic-recovery-hotbar"), /grid-template-columns: repeat\(8,/);
  assert.match(getCssBlock(".relic-recovery-slot"), /aspect-ratio: 1;/);
});

test("relic recovery scales one canonical composition to its viewport", () => {
  const windowStyles = getCssBlock(".relic-recovery-window");
  const sceneStyles = getCssBlock(".relic-recovery-scene");
  const tooltipStyles = getCssBlock(".relic-recovery-tooltip");
  const relicStyles = eventStyles.slice(
    eventStyles.indexOf(".relic-recovery-window"),
    eventStyles.indexOf(".toxic-jungle-window")
  );

  assert.match(windowStyles, /--relic-recovery-fit-scale: 1;/);
  assert.match(windowStyles, /width: 820px;/);
  assert.match(windowStyles, /max-width: none;/);
  assert.match(windowStyles, /transform: scale\(var\(--relic-recovery-fit-scale\)\);/);
  assert.match(windowStyles, /transform-origin: center center;/);
  assert.match(sceneStyles, /height: 480px;/);
  assert.doesNotMatch(sceneStyles, /100vh|min-height/);
  assert.match(tooltipStyles, /width: 240px;/);
  assert.doesNotMatch(relicStyles, /@media/);

  assert.match(eventSources, /const updateRelicRecoveryViewportFit = \(\) =>/);
  assert.match(
    eventSources,
    /availableWidth \/ relicRecoveryWindow\.offsetWidth,[\s\S]*availableHeight \/ relicRecoveryWindow\.offsetHeight/
  );
  assert.match(
    eventSources,
    /relicRecoveryWindow\.style\.setProperty\(\s*RELIC_RECOVERY_FIT_SCALE_PROPERTY/
  );
  assert.match(
    eventSources,
    /registerRandomEventWindows\(\(\) => \[\s*pokemonStarterWindow,/
  );
  assert.match(
    eventSources,
    /position: \(win\) => \{[^}]*updateRelicRecoveryViewportFit\(\);\s*positionRandomEventWindowInViewport\(win\);/
  );
  assert.match(
    eventSources,
    /onFrame: \(\) => updateRelicRecoveryViewportFit\(\),/
  );
});

test("relic recovery detail popup uses exact window animations", () => {
  assert.match(eventSources, /let relicRecoveryDetailCloseTimer = 0;/);
  assert.match(eventSources, /relicRecoveryDetail\?\.classList\.add\("is-opening"\);/);
  assert.match(eventSources, /relicRecoveryDetail\?\.classList\.add\("is-closing"\);/);
  assert.match(eventSources, /completeRelicRecoveryDetailClose/);
  assert.match(eventSources, /event\.animationName === "retro-window-open"/);
  assert.match(eventSources, /event\.animationName === "retro-window-close"/);
  assert.match(
    getCssBlock(".relic-recovery-detail.is-opening"),
    /animation: retro-window-open 260ms steps\(7, end\) both;/
  );
  assert.match(
    getCssBlock(".relic-recovery-detail.is-closing"),
    /animation: retro-window-close 180ms steps\(7, end\) both;/
  );
  assert.doesNotMatch(getCssBlock(".relic-recovery-detail"), /transform:/);
  assert.match(getCssBlock(".relic-recovery-detail"), /translate: -50% -50%;/);
  assert.match(getCssBlock(".relic-recovery-detail"), /transform-origin: center center;/);
  assert.match(getCssBlock(".relic-recovery-detail:active"), /box-shadow: none;/);
  assert.match(getCssBlock(".relic-recovery-detail:active"), /translate: -50% -50%;/);
  assert.match(
    getCssBlock(".relic-recovery-detail:active .relic-recovery-detail-panel"),
    /translate: 0 0;/
  );
  assert.doesNotMatch(getCssBlock(".relic-recovery-detail-panel"), /transform:/);
});

test("relic recovery keeps the relic visible while it flies to the hotbar", () => {
  assert.match(eventSources, /let relicRecoveryFlyTimer = 0;/);
  assert.match(eventSources, /let relicRecoveryFlyingId = "";/);
  assert.match(eventSources, /const animateRelicRecoveryToHotbar = \(item\) =>/);
  assert.match(eventSources, /flyer\.className = "relic-recovery-flyer";/);
  assert.match(
    eventSources,
    /item\.id !== relicRecoveryPendingId &&\s*item\.id !== relicRecoveryFlyingId/
  );
  assert.match(eventSources, /relicRecoveryFlyingId = item\.id;\s*renderRelicRecovery\(\);/);
  assert.match(
    eventSources,
    /querySelector\(\s*`\[data-relic-recovery-slot="\$\{item\.id\}"\]`/
  );
  assert.match(eventSources, /flyer\.style\.setProperty\("--fly-start-x"/);
  assert.match(eventSources, /flyer\.style\.setProperty\(\s*"--fly-end-x"/);
  assert.match(eventSources, /flyer\.style\.setProperty\(\s*"--fly-mid-x"/);
  assert.match(eventSources, /const sceneWidth = sceneRect\.width \/ fitScale;/);
  assert.match(eventSources, /const targetCenterX =[\s\S]*\/ fitScale;/);
  assert.match(eventSources, /flyer\.style\.setProperty\("--fly-end-x", `\$\{targetCenterX\}px`\);/);
  assert.match(eventSources, /animateRelicRecoveryToHotbar\(item\);/);
  assert.match(eventSources, /const completeRelicRecoveryCollection = \(relicId\) =>/);
  assert.match(
    getCssBlock(".relic-recovery-flyer"),
    /animation: relic-recovery-fly-to-hotbar 680ms/
  );
  assert.match(getCssBlock(".relic-recovery-flyer"), /outline: none;/);
  assert.match(
    eventStyles,
    /\.relic-recovery-detail:focus,[\s\S]*?\.relic-recovery-detail:focus-visible \{[\s\S]*?outline: none;/
  );
  assert.match(eventStyles, /@keyframes relic-recovery-fly-to-hotbar/);
});

test("relic recovery reuses pokemon dialogue styling and typewriter effects", () => {
  assert.match(homeSource, /class="pokemon-starter-dialogue pokemon-dialogue"/);
  assert.match(homeSource, /class="relic-recovery-dialog pokemon-dialogue"/);
  assert.match(homeSource, /class="pokemon-starter-oak pokemon-dialogue-portrait"/);
  assert.match(homeSource, /class="relic-recovery-nanachi pokemon-dialogue-portrait"/);
  assert.match(homeSource, /class="pokemon-dialogue-text"[\s\S]*id="relic-recovery-dialog-text"/);

  assert.match(getCssBlock(".pokemon-dialogue"), /background: #f8f8f8;/);
  assert.match(getCssBlock(".pokemon-dialogue"), /border: 3px solid #202020;/);
  assert.match(getCssBlock(".pokemon-dialogue-text"), /font-size: 15px;/);
  assert.match(eventSources, /const POKEMON_DIALOGUE_TYPEWRITER_MS = 24;/);
  assert.match(eventSources, /const setPokemonStyleSegmentedDialogue = /);
  assert.match(eventSources, /setPokemonStyleSegmentedDialogue\(relicRecoveryDialogText/);
  assert.match(eventSources, /has-pokemon-dialogue-arrow/);
  assert.match(eventSources, /relicRecoveryNotableSegment\("relics", "pokemon-starter-type-color--grass"\)/);
  assert.match(eventSources, /relicRecoveryNotableSegment\("Layer 2", "pokemon-starter-type-color--water"\)/);

  const relicDialogBlock = getCssBlock(".relic-recovery-dialog");
  assert.doesNotMatch(relicDialogBlock, /background:/);
  assert.doesNotMatch(relicDialogBlock, /border:/);
  assert.doesNotMatch(relicDialogBlock, /box-shadow:/);
});

test("relic recovery hotbar uses silhouettes and collected tooltips", () => {
  assert.match(eventSources, /slot\.classList\.toggle\("is-collected", collected\);/);
  assert.match(eventSources, /slot\.dataset\.relicTooltipName = item\.name;/);
  assert.match(eventSources, /slot\.dataset\.relicTooltipDescription = item\.description;/);
  assert.match(eventSources, /image\.setAttribute\("aria-hidden", String\(!collected\)\);/);
  assert.match(eventSources, /tooltip\.className = "relic-recovery-tooltip";/);
  assert.match(eventSources, /tooltipName\.style\.color = item\.color;/);
  assert.equal([...eventSources.matchAll(/\n    color: "#[0-9a-f]{6}",/g)].length, 8);
  assert.match(getCssBlock(".relic-recovery-item"), /cursor: var\(--cursor-select, pointer\) !important;/);
  assert.match(getCssBlock(".relic-recovery-dialog"), /z-index: 7;/);
  assert.match(getCssBlock(".relic-recovery-hotbar"), /z-index: 8;/);
  assert.match(getCssBlock(".relic-recovery-slot img"), /grayscale\(1\) opacity\(0\.34\)/);
  assert.match(getCssBlock(".relic-recovery-slot.is-collected img"), /filter: none;/);
  assert.match(
    eventStyles,
    /\.relic-recovery-window \.relic-recovery-scene \.relic-recovery-hotbar \.relic-recovery-slot,[\s\S]*?cursor: var\(--cursor-help, help\) !important;/
  );
  assert.match(getCssBlock(".relic-recovery-tooltip"), /display: grid;/);
  assert.match(getCssBlock(".relic-recovery-tooltip strong"), /font-weight: bold;/);
  assert.match(getCssBlock(".relic-recovery-window"), /overflow: visible;/);
  assert.match(getCssBlock(".relic-recovery-window .window-body"), /overflow: visible;/);
  assert.match(getCssBlock(".relic-recovery-scene"), /overflow: visible;/);
});

test("relic recovery positions relics with depth scaling", () => {
  const itemBlockStart = eventSources.indexOf("const RELIC_RECOVERY_ITEMS = Object.freeze");
  const itemBlockEnd = eventSources.indexOf("const RELIC_RECOVERY_STAGE_PROMPT", itemBlockStart);
  assert.notEqual(itemBlockStart, -1, "Missing relic recovery items");
  const itemBlock = eventSources.slice(itemBlockStart, itemBlockEnd);

  const xs = [...itemBlock.matchAll(/\n    x: (\d+),/g)].map((match) => Number(match[1]));
  const ys = [...itemBlock.matchAll(/\n    y: (\d+),/g)].map((match) => Number(match[1]));
  const scales = [...itemBlock.matchAll(/\n    scale: ([\d.]+),/g)].map((match) =>
    Number(match[1])
  );
  assert.equal(xs.length, 8);
  assert.equal(ys.length, 8);
  assert.equal(scales.length, 8);
  assert.ok(xs.every((value) => value >= 12 && value <= 88));
  assert.ok(ys.every((value) => value >= 28 && value <= 80));
  assert.ok(ys.filter((value) => value <= 43).length >= 3);
  assert.ok(ys.filter((value) => value > 43 && value <= 60).length >= 3);
  assert.ok(ys.filter((value) => value > 60).length >= 2);
  assert.match(itemBlock, /id: "offering",[\s\S]*?x: 80,[\s\S]*?y: 34,/);
  assert.match(itemBlock, /id: "double-bell-ball",[\s\S]*?x: 87,[\s\S]*?y: 41,/);
  assert.ok(Math.max(...scales) > 1.2);
  assert.ok(Math.min(...scales) < 0.6);
  assert.ok(scales.filter((value) => value < 0.7).length >= 3);
  assert.match(getCssBlock(".relic-recovery-item"), /scale\(var\(--relic-scale\)\)/);
  assert.match(
    eventStyles,
    /\.relic-recovery-item:hover,[\s\S]*?filter:[\s\S]*?grayscale\(1\)[\s\S]*?transform: translate\(-50%, -50%\) scale\(var\(--relic-scale\)\);/
  );
  assert.doesNotMatch(
    eventStyles,
    /\.relic-recovery-item:hover,[\s\S]*?scale\(calc\(var\(--relic-scale\) \* 1\.08\)\)/
  );
});

test("current publicly available information event uses local AOT assets outside debug mode", async () => {
  const expectedAssets = [
    "season-1.webp",
    "season-2.webp",
    "season-3.webp",
    "final-season.webp",
    "ova.webp",
  ];
  const registrationStart = eventSources.indexOf(
    'id: "current-publicly-available-information"'
  );
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="current-public-info-window"');
  const windowEnd = homeSource.indexOf('id="trna-request-window"', windowStart);

  assert.notEqual(registrationStart, -1, "Missing CP info registration");
  assert.notEqual(windowStart, -1, "Missing CP info window");
  assert.notEqual(windowEnd, -1, "Missing CP info window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,/);
  assert.match(windowMarkup, /Current Publicly Available Information/);
  assert.match(windowMarkup, /id="current-public-info-close"/);
  assert.match(windowMarkup, /id="current-public-info-image"/);
  assert.match(windowMarkup, /id="current-public-info-thanks"/);
  assert.match(windowMarkup, /Thanks for sharing\.\.\./);
  assert.equal((windowMarkup.match(/<button/g) || []).length, 2);
  assert.match(eventSources, /selectCurrentPublicInfoImage/);
  assert.match(eventSources, /bindRandomEventButton\(currentPublicInfoThanks, closeCurrentPublicInfoWindow\);/);
  assert.match(
    eventSources,
    /Math\.floor\(Math\.random\(\) \* CURRENT_PUBLIC_INFO_ASSETS\.length\)/
  );
  assert.match(
    getCssBlock(".current-public-info-window"),
    /--event-window-max-width: calc\(100vw - 24px\);[\s\S]*?--event-window-width: 494px;/
  );
  assert.match(getCssBlock(".current-public-info-window .window-body"), /padding: 4px;/);
  const imageStyles = getCssBlock(".current-public-info-window img");
  assert.match(imageStyles, /background: #000;/);
  assert.match(
    imageStyles,
    /box-shadow: var\(--border-sunken-outer\), var\(--border-sunken-inner\);/
  );
  assert.match(imageStyles, /box-sizing: border-box;/);
  assert.match(imageStyles, /height: auto;/);
  assert.match(imageStyles, /max-height: min\(78vh, 720px, calc\(100vh - 155px\)\);/);
  assert.match(imageStyles, /object-fit: contain;/);
  assert.match(getCssBlock(".current-public-info-actions"), /justify-content: flex-end;/);
  assert.ok(
    windowMarkup.indexOf('id="current-public-info-image"') <
      windowMarkup.indexOf('class="current-public-info-actions"'),
    "The public-information action row must remain below its image"
  );

  for (const filename of expectedAssets) {
    const asset = `assets/random events/current-publicly-available-information/${filename}`;
    assert.match(
      eventSources,
      new RegExp(asset.replaceAll(" ", "%20").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
    await access(new URL(asset, root));
  }
});

test("latest event cursor affordances use custom cursor variables", async () => {
  assert.match(getCssBlock(".death-note-lined-page"), /cursor: var\(--cursor-text, text\) !important;/);
  assert.match(getCssBlock(".relic-recovery-item"), /cursor: var\(--cursor-select, pointer\) !important;/);
  assert.match(getCssBlock(".relic-recovery-detail"), /cursor: var\(--cursor-select, pointer\);/);
  assert.match(
    eventStyles,
    /\.relic-recovery-window \.relic-recovery-scene \.relic-recovery-hotbar \.relic-recovery-slot,[\s\S]*?cursor: var\(--cursor-help, help\) !important;/
  );
  assert.match(
    cursorStyles,
    /:where\(html, body, body \*\) \{\s*\n  cursor: var\(--cursor-normal\) !important;/
  );
  assert.match(getCssBlock(".death-note-lined-page"), /cursor: var\(--cursor-text, text\) !important;/);
  assert.doesNotMatch(cursorStyles, /is-custom-cursor-overlay-active/);
  assert.doesNotMatch(cursorStyles, /custom-cursor-overlay/);
  assert.doesNotMatch(cursorStyles, /cursor: none !important;/);
  assert.doesNotMatch(cursorStyles, /is-custom-cursor-refreshing/);
  assert.doesNotMatch(cursorStyles, /cursor: auto !important;/);
  assert.match(cursorStyles, /generated-png\/normal-light\.png"\) 2 1/);
  assert.match(cursorStyles, /generated-png\/select-light\.png"\) 2 3/);
  assert.match(cursorStyles, /generated-png\/text-light\.png"\) 6 8/);
  assert.match(cursorStyles, /generated-png\/move-light\.png"\) 15 15/);
  assert.match(cursorStyles, /generated-png\/help-dark\.png"\) 2 3/);
  const pressedCursorIndex = cursorStyles.indexOf(
    "cursor: var(--cursor-pressed) !important;"
  );
  const titleBarClickableOverrideIndex = cursorStyles.indexOf(
    ".window:not([data-no-drag]) > .title-bar :is("
  );
  assert.ok(titleBarClickableOverrideIndex > pressedCursorIndex);
  assert.match(
    cursorStyles,
    /\.title-bar-controls,[\s\S]*?\.title-bar-controls \*,[\s\S]*?cursor: var\(--cursor-select\) !important;/
  );
  assert.match(cursorModeSource, /const CURSOR_IMAGE_NAMES = Object\.freeze\(\[/);
  assert.match(cursorModeSource, /"normal"/);
  assert.match(cursorModeSource, /generatedSuffix: "light"/);
  assert.match(cursorModeSource, /generatedSuffix: "dark"/);
  assert.match(cursorModeSource, /legacySuffix: " Light"/);
  assert.match(cursorModeSource, /window\.fetch\(new URL\(path, cursorAssetRoot\)/);
  assert.match(cursorModeSource, /const markReady = \(\) => \{/);
  assert.match(cursorModeSource, /window\.addEventListener\("pageshow", syncStoredMode\);/);
  assert.match(cursorModeSource, /const subscribeBodyMutations = \(listener\) => \{/);
  assert.match(cursorModeSource, /return loadingRuntime\.subscribeBodyMutations\(listener\);/);
  assert.match(eventSources, /cursorRuntime\.subscribe\(syncCursorModeButtons\);/);
  assert.match(eventSources, /cursorRuntime\.start\(\);/);
  assert.match(eventSources, /cursorRuntime\.setMode\(button\.getAttribute\("data-cursor-mode"\)/);
  assert.doesNotMatch(eventSources, /is-custom-cursor-refreshing/);
  assert.doesNotMatch(homeSource, /custom-cursor-overlay\.js/);
  assert.doesNotMatch(indexSource, /custom-cursor-overlay\.js/);
  await access(new URL("assets/cursor-assets/generated-png/normal-light.png", root));
  await access(new URL("assets/cursor-assets/generated-png/select-light.png", root));
  await access(new URL("assets/cursor-assets/generated-png/text-light.png", root));
  await access(new URL("assets/cursor-assets/generated-png/normal-dark.png", root));
});

test("spare a trna event is a probability-gated alert with a local ribosome icon", async () => {
  const registrationStart = eventSources.indexOf('id: "spare-a-trna"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="trna-request-window"');
  const windowEnd = homeSource.indexOf('id="nataraja-window"', windowStart);

  assert.notEqual(registrationStart, -1, "Missing tRNA request registration");
  assert.notEqual(registrationEnd, -1, "Missing tRNA request registration end");
  assert.notEqual(windowStart, -1, "Missing tRNA request window");
  assert.notEqual(windowEnd, -1, "Missing tRNA request window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(registration, /isVisible: isTrnaRequestVisible,/);
  assert.match(registration, /showTrnaRequestWindow\(\);/);
  assert.match(
    homeSource,
    /class="window random-event-window random-alert-window trna-request-window is-hidden"[\s\S]*id="trna-request-window"/
  );
  assert.match(windowMarkup, /Spare a tRNA\?/);
  assert.match(
    windowMarkup,
    /A poor ribosome passes by and asks if you have an extra tRNA it could borrow\./
  );
  assert.match(windowMarkup, /data-src="assets\/random%20events\/ribosome-icon\.svg"/);
  assert.match(windowMarkup, /alt="Clip art ribosome"/);
  assert.match(windowMarkup, /id="trna-request-yes">Yes<\/button>/);
  assert.match(windowMarkup, /id="trna-request-no">No<\/button>/);
  assert.match(eventSources, /preloadTargets: \(\) => \[trnaRequestWindow\]/);
  assert.match(eventSources, /bindRandomEventButton\(trnaRequestYes, closeTrnaRequestWindow\);/);
  assert.match(eventSources, /bindRandomEventButton\(trnaRequestNo, closeTrnaRequestWindow\);/);
  assert.match(getCssBlock(".trna-request-icon"), /image-rendering: auto;/);
  await access(new URL("assets/random events/ribosome-icon.svg", root));
});

test("spell on the stack event is probability-gated with counter and damage effects", async () => {
  const registrationStart = eventSources.indexOf('id: "spell-on-the-stack"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="spell-stack-window"');
  const windowEnd = homeSource.indexOf('id="nataraja-window"', windowStart);

  assert.notEqual(registrationStart, -1, "Missing Spell on the Stack registration");
  assert.notEqual(registrationEnd, -1, "Missing Spell on the Stack registration end");
  assert.notEqual(windowStart, -1, "Missing Spell on the Stack window");
  assert.notEqual(windowEnd, -1, "Missing Spell on the Stack window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(registration, /isVisible: isSpellStackVisible,/);
  assert.match(registration, /showSpellStackWindow\(\);/);
  assert.match(
    homeSource,
    /class="window random-event-window random-alert-window spell-stack-window is-hidden"[\s\S]*id="spell-stack-window"/
  );
  assert.match(windowMarkup, /<div class="title-bar-text">Spell on the Stack<\/div>/);
  assert.match(windowMarkup, /id="spell-stack-lightning-canvas"/);
  assert.match(windowMarkup, /class="spell-stack-image-frame"/);
  assert.match(windowMarkup, /class="spell-stack-image"/);
  assert.doesNotMatch(windowMarkup, /class="random-alert-message spell-stack-message"/);
  assert.match(windowMarkup, /data-src="assets\/random%20events\/lightning-bolt\.webp"/);
  assert.match(windowMarkup, /alt="Lightning Bolt"/);
  assert.match(
    windowMarkup,
    /Chandra targets your 1\/1 Soldier Token with lightning bolt\. Would you like to counter\?/
  );
  assert.match(windowMarkup, /id="spell-stack-yes">Yes<\/button>/);
  assert.match(windowMarkup, /id="spell-stack-no">No<\/button>/);
  assert.match(eventSources, /preloadTargets: \(\) => \[spellStackWindow\]/);
  assert.match(eventSources, /bindRandomEventButton\(spellStackYes, counterSpellOnStack\);/);
  assert.match(eventSources, /bindRandomEventButton\(spellStackNo, refuseSpellOnStackCounter\);/);
  assert.match(eventSources, /triggerSpellStackCounterFlash/);
  assert.match(
    eventSources,
    /const refuseSpellOnStackCounter = \(\) => \{[\s\S]*?triggerSpellStackLightning\(\);[\s\S]*?closeManagedRandomEventWindow\(spellStackWindow\);[\s\S]*?\};/
  );
  assert.match(eventSources, /drawLightningBorderFrame\(spellStackLightningCanvas, alpha, RED_LIGHTNING_PALETTE\);/);
  assert.match(getCssBlock(".spell-stack-window"), /--event-window-width: 420px;/);
  assert.match(getCssBlock(".spell-stack-image-frame"), /max-height: min\(58vh, 520px\);/);
  assert.match(getCssBlock(".spell-stack-image-frame"), /--spell-stack-image-inset: 20px;/);
  assert.match(getCssBlock(".spell-stack-image-frame"), /padding: var\(--spell-stack-image-inset\);/);
  assert.match(
    getCssBlock(".spell-stack-image"),
    /max-height: calc\(min\(58vh, 520px\) - \(var\(--spell-stack-image-inset\) \* 2\)\);/
  );
  assert.match(getCssBlock(".spell-stack-image"), /object-fit: contain;/);
  assert.match(getCssBlock(".spell-stack-counter-flash"), /background: #1f6fff;/);
  assert.match(getCssBlock(".spell-stack-window.is-spell-hit"), /spell-stack-window-shake/);
  assert.match(eventStyles, /@keyframes spell-stack-window-shake/);
  await access(new URL("assets/random events/lightning-bolt.webp", root));
});

test("soot sprites event is probability-gated GPU alert with animated swarm", async () => {
  const registrationStart = eventSources.indexOf('id: "soot-sprites"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="soot-sprites-window"');
  const windowEnd = homeSource.indexOf('id="nataraja-window"', windowStart);

  assert.notEqual(registrationStart, -1, "Missing soot sprites registration");
  assert.notEqual(registrationEnd, -1, "Missing soot sprites registration end");
  assert.notEqual(windowStart, -1, "Missing soot sprites window");
  assert.notEqual(windowEnd, -1, "Missing soot sprites window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(registration, /isVisible: isSootSpritesVisible,/);
  assert.match(registration, /showSootSpritesWindow\(\);/);
  assert.match(
    homeSource,
    /class="window random-event-window random-alert-window soot-sprites-window is-hidden"[\s\S]*id="soot-sprites-window"/
  );
  assert.match(windowMarkup, /<div class="title-bar-text">System Alert<\/div>/);
  assert.match(windowMarkup, /src="assets\/app-icons\/ico\/hardware\.ico"/);
  assert.match(
    windowMarkup,
    /There seems to be something hiding in your GPU\. Would you like to take a look\?/
  );
  assert.match(windowMarkup, /id="soot-sprites-yes">Yes<\/button>/);
  assert.match(windowMarkup, /id="soot-sprites-no">No<\/button>/);
  assert.match(eventSources, /preloadTargets: \(\) => \[sootSpritesWindow\]/);
  assert.match(eventSources, /bindRandomEventButton\(sootSpritesYes, inspectSootSpritesGpu\);/);
  assert.match(eventSources, /bindRandomEventButton\(sootSpritesNo, closeSootSpritesWindow\);/);
  assert.match(eventSources, /const SOOT_SPRITES_DESKTOP_COUNT = 32;/);
  assert.match(eventSources, /const SOOT_SPRITES_MOBILE_COUNT = 20;/);
  assert.match(eventSources, /const SOOT_SPRITES_CLEANUP_MS = 27000;/);
  assert.match(eventSources, /const SOOT_SPRITES_WINDOW_HOLD_AFTER_LOAD_MS = 1000;/);
  assert.doesNotMatch(eventSources, /SOOT_SPRITES_WINDOW_CLOSE_DURATION_MS/);
  assert.doesNotMatch(eventSources, /SOOT_SPRITES_HOVER_DURATION_MS/);
  assert.match(eventSources, /const SOOT_SPRITES_SPAWN_CLEARANCE = 64;/);
  assert.match(eventSources, /const SOOT_SPRITES_FALL_SAMPLE_COUNT = 12;/);
  assert.match(eventSources, /const SOOT_SPRITES_DIRECTION_SWITCH_CHANCE = 0\.55;/);
  assert.match(eventSources, /const SOOT_SPRITES_DIRECTION_SWITCH_MIN_DELAY_MS = 1000;/);
  assert.match(eventSources, /const SOOT_SPRITES_DIRECTION_SWITCH_MAX_DELAY_MS = 3000;/);
  assert.match(eventSources, /const SOOT_SPRITES_MIN_PATH_SPEED = 0\.22;/);
  assert.match(eventSources, /const SOOT_SPRITES_AIR_TRAIL_CANDIES_PER_SPRITE = 2\.2;/);
  assert.match(eventSources, /const SOOT_SPRITES_GROUND_RUN_CANDY_MULTIPLIER = 2;/);
  assert.doesNotMatch(eventSources, /SOOT_SPRITES_FALL_ACCELERATION_EXPONENT/);
  assert.match(eventSources, /const SOOT_CANDY_LANDING_PROGRESS = 0\.72;/);
  assert.match(eventSources, /const SOOT_CANDY_HOLD_AFTER_LANDING_MS = 4000;/);
  assert.match(eventSources, /const SOOT_CANDY_FADE_DURATION_MS = 1200;/);
  assert.match(eventSources, /const SOOT_SPRITES_CANDY_COLORS = Object\.freeze\(\[/);
  assert.match(eventSources, /"#c9f7c2"/);
  assert.match(eventSources, /"#ffc6dc"/);
  assert.match(eventSources, /"#fff2a6"/);
  assert.match(eventSources, /"#fffaf0"/);
  assert.match(eventSources, /"#bde7ff"/);
  assert.match(eventSources, /const randomSootCandyColor = \(\) =>/);
  assert.match(eventSources, /const getSootSpriteParabolaPoint = \(trajectory, progress\) =>/);
  assert.match(eventSources, /const createSootSpriteFallSamples = \(trajectory\) =>/);
  assert.match(eventSources, /const getSootSpriteFallPointAtDistance = \(trajectory, distance\) =>/);
  assert.match(eventSources, /const getSootSpriteTimelineOffset = \(trajectory, distance\) =>/);
  assert.match(eventSources, /const createSootSpritePathKeyframes = \(trajectory\) =>/);
  assert.match(eventSources, /\.\.\.trajectory\.runSegments\.map\(\(segment\) =>/);
  assert.match(eventSources, /const animateSootSpriteElement = \(sprite, trajectory\) =>/);
  assert.match(eventSources, /sprite\.animate\(createSootSpritePathKeyframes\(trajectory\)/);
  assert.match(eventSources, /landingProgress: fallDuration \/ totalPathDuration,/);
  assert.match(eventSources, /const elapsedTime = clampedProgress \* trajectory\.duration;/);
  assert.match(eventSources, /const getSootSpriteRunExitX = \(size, direction\) =>/);
  assert.match(eventSources, /const isSootSpriteOnScreenAtX = \(x, size\) =>/);
  assert.match(eventSources, /const createSootSpriteRunSegment = \(\{/);
  assert.match(eventSources, /const applySootSpriteRunSegmentTiming = \(\{/);
  assert.match(eventSources, /const getSootSpritesToolbarTop = \(\) =>/);
  assert.match(
    eventSources,
    /clampNumber\(toolbarTop - spriteSize, 0, window\.innerHeight - spriteSize\)/
  );
  assert.match(eventSources, /const getSootCandyLandingY = \(candySize\) =>/);
  assert.match(
    eventSources,
    /clampNumber\(toolbarTop - candySize, 0, window\.innerHeight - candySize\)/
  );
  assert.match(eventSources, /const getSootCandyGravityPoint = \(trajectory, progress\) =>/);
  assert.match(eventSources, /const createSootCandyTrajectory = \(\{/);
  assert.match(eventSources, /const landingY = getSootCandyLandingY\(size\);/);
  assert.match(eventSources, /const setSootCandyTrajectoryProperties = \(candy, trajectory\) =>/);
  assert.match(eventSources, /const setSootCandySpinProperties = \(candy, spin\) =>/);
  assert.match(eventSources, /const setSootCandyTimingProperties = \(candy, \{ delay, fallDuration \}\) =>/);
  assert.match(
    eventSources,
    /const landingDelay =[\s\S]*?delay \+ fallDuration \* SOOT_CANDY_LANDING_PROGRESS;/
  );
  assert.match(
    eventSources,
    /const fadeDelay = landingDelay \+ SOOT_CANDY_HOLD_AFTER_LANDING_MS;/
  );
  assert.match(eventSources, /"--candy-hold-duration"[\s\S]*?SOOT_CANDY_HOLD_AFTER_LANDING_MS/);
  assert.match(eventSources, /"--candy-fade-duration"[\s\S]*?SOOT_CANDY_FADE_DURATION_MS/);
  assert.match(eventSources, /"--candy-fade-delay", `\$\{fadeDelay\}ms`/);
  assert.match(eventSources, /const createSootSpriteSpawnGrid = \(launchRect, spriteCount\) =>/);
  assert.match(
    eventSources,
    /const columns = clampNumber\([\s\S]*?Math\.round\(Math\.sqrt\(spriteCount \* aspectRatio\)\)[\s\S]*?1,[\s\S]*?spriteCount/
  );
  assert.match(eventSources, /const rows = Math\.ceil\(spriteCount \/ columns\);/);
  assert.match(eventSources, /return Array\.from\(\{ length: spriteCount \}, \(_, index\) =>/);
  assert.match(eventSources, /const createSootSpriteTrajectory = \(launchRect, \{ startPoint \} = \{\}\) =>/);
  assert.match(eventSources, /const size = Math\.round\(randomSootSpriteValue\(24, 40\)\);/);
  assert.match(eventSources, /startPoint\.x - size \/ 2/);
  assert.match(eventSources, /startPoint\.y - size \/ 2/);
  assert.doesNotMatch(eventSources, /launchRect\.bottom \+ randomSootSpriteValue\(8, 24\)/);
  assert.match(eventSources, /groundY - minimumFallDistance/);
  assert.match(eventSources, /const initialRunDirection = Math\.random\(\) < 0\.5 \? -1 : 1;/);
  assert.match(
    eventSources,
    /const directionSwitchDelay = randomSootSpriteValue\([\s\S]*?SOOT_SPRITES_DIRECTION_SWITCH_MIN_DELAY_MS,[\s\S]*?SOOT_SPRITES_DIRECTION_SWITCH_MAX_DELAY_MS[\s\S]*?\);/
  );
  assert.match(eventSources, /const directionSwitchRoll = Math\.random\(\);/);
  assert.match(eventSources, /directionSwitchRoll < SOOT_SPRITES_DIRECTION_SWITCH_CHANCE/);
  assert.match(eventSources, /isSootSpriteOnScreenAtX\(switchX, size\)/);
  assert.match(
    eventSources,
    /const directionSwitchSpeedMultiplier = shouldSwitchDirection[\s\S]*?\? randomSootSpriteValue\(1, 2\)[\s\S]*?: 1;/
  );
  assert.match(eventSources, /const speedMultiplier = index === 0 \? 1 : switchSpeedMultiplier;/);
  assert.match(eventSources, /const speed = pathSpeed \* speedMultiplier;/);
  assert.match(eventSources, /duration = segment\.length \/ speed/);
  assert.match(eventSources, /directionSwitchSpeedMultiplier,/);
  assert.match(eventSources, /didSwitchDirection: shouldSwitchDirection,/);
  assert.match(eventSources, /duration: totalPathDuration,/);
  assert.match(eventSources, /totalPathDuration,/);
  assert.match(eventSources, /const getSootSpriteTrajectoryPoint = \(trajectory, progress\) =>/);
  assert.match(eventSources, /trajectory\.runSegments\.find\(\(candidate\) => elapsedTime <= candidate\.endTime\)/);
  const sootMotionStart = eventSources.indexOf("const getSootSpriteParabolaPoint");
  const sootMotionEnd = eventSources.indexOf("const getSootCandyGravityPoint", sootMotionStart);
  assert.notEqual(sootMotionStart, -1, "Missing soot sprite motion helpers");
  assert.notEqual(sootMotionEnd, -1, "Missing soot sprite motion helper boundary");
  const sootMotionHelpers = eventSources.slice(sootMotionStart, sootMotionEnd);
  assert.doesNotMatch(sootMotionHelpers, /Math\.pow\(/);
  assert.match(eventSources, /const fallQuarter = getSootSpriteFallPointAtDistance\(/);
  assert.match(eventSources, /fallLength \* 0\.25/);
  assert.match(eventSources, /fallLength \* 0\.5/);
  assert.match(eventSources, /fallLength \* 0\.75/);
  assert.match(eventSources, /createSootSpriteElement\(index, trajectory, \{ paused: true \}\)/);
  assert.match(eventSources, /createSootCandyElement\(launchRect\)/);
  assert.match(eventSources, /const size = Math\.round\(randomSootSpriteValue\(8, 14\)\);/);
  assert.match(eventSources, /const size = Math\.round\(randomSootSpriteValue\(6, 11\)\);/);
  assert.match(eventSources, /createSootPuffElement\(launchRect, index % 5 === 0\)/);
  assert.match(eventSources, /const size = randomSootSpriteValue\(large \? 192 : 84, large \? 380 : 208\);/);
  assert.match(eventSources, /"--puff-duration", `\$\{randomSootSpriteValue\(5400, 7600\)\}ms`/);
  assert.match(eventSources, /const size = randomSootSpriteValue\(76, 196\);/);
  assert.match(eventSources, /"--puff-duration", `\$\{randomSootSpriteValue\(5300, 7300\)\}ms`/);
  assert.match(eventSources, /createSootTrailPuffElement\(trajectories\[index % trajectories\.length\], index, progress\)/);
  assert.match(eventSources, /const getSootSpriteAirTrailProgress = \(trajectory\) =>/);
  assert.match(eventSources, /const getSootSpriteGroundRunProgress = \(trajectory\) =>/);
  assert.match(eventSources, /const airTrailCandyCount = Math\.round\([\s\S]*?SOOT_SPRITES_AIR_TRAIL_CANDIES_PER_SPRITE/);
  assert.match(eventSources, /const groundRunCandyCount = Math\.round\([\s\S]*?SOOT_SPRITES_GROUND_RUN_CANDY_MULTIPLIER/);
  assert.match(eventSources, /createSootTrailCandyElement\(trajectory, getSootSpriteGroundRunProgress\(trajectory\)\)/);
  assert.match(eventSources, /const trailPuffCount = Math\.round\(spriteCount \* 1\.4\);/);
  assert.match(eventSources, /const candyCount = Math\.round\(spriteCount \* 1\.28\);/);
  assert.match(eventSources, /const puffCount = Math\.round\(spriteCount \* 0\.48\);/);
  assert.match(eventSources, /getSootSpritesGroundY\(size\)/);
  assert.match(eventSources, /document\.querySelector\("\.taskbar-apps"\)/);
  assert.match(eventSources, /document\.querySelector\("\.taskbar"\)/);
  assert.match(eventSources, /setSootSpritesWindowLoading\(true\);/);
  assert.match(eventSources, /const getSootSpritesStagedZIndex = \(\) =>/);
  assert.match(eventSources, /const reserveSootSpritesSpawnLane = \(\) =>/);
  assert.match(eventSources, /toolbarTop - sootSpritesWindow\.offsetHeight - SOOT_SPRITES_SPAWN_CLEARANCE/);
  assert.match(eventSources, /if \(didOpen\) reserveSootSpritesSpawnLane\(\);/);
  assert.match(eventSources, /overlay\.style\.zIndex = String\(getSootSpritesStagedZIndex\(\)\);/);
  assert.match(
    eventSources,
    /showSootSpritesSwarm\(launchRect\);[\s\S]*?window\.requestAnimationFrame\(\(\) => \{[\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?closeManagedRandomEventWindow\(sootSpritesWindow\);[\s\S]*?\}, SOOT_SPRITES_WINDOW_HOLD_AFTER_LOAD_MS\);/
  );
  assert.match(eventSources, /const releaseSootSpritesSwarm = \(\) => \{[\s\S]*?overlay\.classList\.remove\("is-staged"\);[\s\S]*?sootSpriteMotionAnimations\.get\(sprite\)\?\.play\(\);/);
  assert.match(eventSources, /bindManagedRandomEventWindowAnimation\(sootSpritesWindow, \{[\s\S]*?afterClose: releaseSootSpritesSwarm,/);
  assert.match(eventSources, /motion\.pause\(\);[\s\S]*?sootSpriteMotionAnimations\.set\(sprite, motion\);/);
  assert.doesNotMatch(
    eventSources,
    /const inspectSootSpritesGpu = \(\) => \{[\s\S]*?const launchRect = getSootSpritesLaunchRect\(\);[\s\S]*?closeManagedRandomEventWindow\(sootSpritesWindow\);[\s\S]*?showSootSpritesSwarm/
  );
  assert.match(getCssBlock(".soot-sprites-window"), /--event-window-width: 372px;/);
  assert.match(
    eventStyles,
    /\.soot-sprites-window\.is-loading-sprites,[\s\S]*?\.soot-sprites-window\.is-loading-sprites \* \{[\s\S]*?cursor: var\(--cursor-working(?:, progress)?\) !important;/
  );
  assert.doesNotMatch(
    eventStyles,
    /\.soot-sprites-window\.is-loading-sprites,[\s\S]*?\.soot-sprites-window\.is-loading-sprites \* \{[\s\S]*?--cursor-busy/
  );
  assert.match(
    eventSources,
    /const hasCustomCursorLoadingIndicator = \(\) =>[\s\S]*?sootSpritesWindow\?\.classList\.contains\("is-loading-sprites"\)[\s\S]*?isSootSpritesVisible\(\)/
  );
  const cursorWatcherStart = eventSources.indexOf("const initCustomCursorLoadingWatcher");
  const cursorWatcherEnd = eventSources.indexOf(
    "runAfterHomeActivation(initCustomCursorLoadingWatcher);",
    cursorWatcherStart
  );
  assert.notEqual(cursorWatcherStart, -1, "Missing custom cursor loading watcher");
  assert.notEqual(cursorWatcherEnd, -1, "Missing custom cursor loading watcher boundary");
  const cursorLoadingWatcher = eventSources.slice(cursorWatcherStart, cursorWatcherEnd);
  assert.match(cursorLoadingWatcher, /RohinCursorRuntime\.observeLoading/);
  assert.match(cursorLoadingWatcher, /isLoading:\s*hasCustomCursorLoadingIndicator/);
  assert.doesNotMatch(cursorLoadingWatcher, /pointermove|mousemove|createElement/);
  assert.match(cursorModeSource, /is-custom-cursor-loading-frame-/);
  assert.match(cursorModeSource, /prefers-reduced-motion:\s*reduce/);
  assert.match(
    cursorStyles,
    /--cursor-working: url\("\.\.\/\.\.\/assets\/cursor-assets\/Jeelh-Cursor-Light\/working-in-background-frames\/working-in-background-light-1\.png"\) 2 1,[\s\S]*?working-in-background-light-1\.cur"\),[\s\S]*?progress;/
  );
  assert.match(
    cursorStyles,
    /body\.is-cursor-dark-mode\.is-custom-cursor-loading-frame-1 \{[\s\S]*?working-in-background-1\.png"\) 2 1,[\s\S]*?working-in-background-1\.cur"\),[\s\S]*?progress;/
  );
  for (const variant of [
    {
      directory: "Jeelh-Cursor-Light/working-in-background-frames",
      prefix: "working-in-background-light-",
    },
    {
      directory: "Jeelh-Cursor-Dark/working-in-background-frames",
      prefix: "working-in-background-",
    },
  ]) {
    assert.ok(
      cursorModeSource.includes(`workingPrefix: "${variant.prefix}"`),
      `Missing shared ${variant.directory} frame prefix.`
    );
    for (let frame = 1; frame <= 9; frame += 1) {
      const asset =
        `assets/cursor-assets/${variant.directory}/${variant.prefix}${frame}.png`;
      await access(new URL(asset, root));
    }
  }
  assert.match(getCssBlock(".soot-sprites-swarm"), /position: fixed;/);
  assert.match(getCssBlock(".soot-sprites-swarm.is-staged"), /z-index: 0;/);
  assert.match(
    eventStyles,
    /\.soot-sprites-swarm\.is-staged,[\s\S]*?\.soot-sprites-swarm\.is-staged \* \{[\s\S]*?animation-play-state: paused;/
  );
  assert.match(getCssBlock(".soot-sprite-body"), /border-radius: var\(--soot-body-radius\);/);
  assert.match(getCssBlock(".soot-sprite-body"), /filter: drop-shadow/);
  assert.match(getCssBlock(".soot-sprite-body"), /isolation: isolate;/);
  assert.match(
    eventStyles,
    /\.soot-sprite-body::before,[\s\S]*?\.soot-sprite-body::after \{[\s\S]*?clip-path: polygon\([\s\S]*?filter: blur\(0\.4px\);/
  );
  assert.match(
    eventStyles,
    /\.soot-sprite-body::after \{[\s\S]*?filter: blur\(1\.6px\);/
  );
  assert.match(getCssBlock(".soot-sprite-eye"), /radial-gradient\(circle at 56% 52%, #111/);
  assert.match(getCssBlock(".soot-star-candy"), /clip-path: polygon\(/);
  assert.match(
    getCssBlock(".soot-star-candy"),
    /soot-candy-fall var\(--candy-fall-duration\) linear var\(--candy-delay\) both,[\s\S]*soot-candy-fade var\(--candy-fade-duration\) ease-out var\(--candy-fade-delay\) forwards;/
  );
  assert.match(eventStyles, /\.soot-puff \{[\s\S]*?rgba\(0, 0, 0, 0\.72\)/);
  assert.match(eventStyles, /\.soot-puff \{[\s\S]*?filter: blur\(4\.5px\);/);
  assert.match(eventStyles, /\.soot-puff \{[\s\S]*?height: var\(--puff-size\);/);
  assert.match(
    eventStyles,
    /\.soot-puff \{[\s\S]*?width: calc\(var\(--puff-size\) \* 2\);/
  );
  assert.match(getCssBlock(".soot-puff--trail"), /mix-blend-mode: multiply;/);
  assert.doesNotMatch(getCssBlock(".soot-sprite"), /animation: soot-sprite-scatter/);
  assert.match(
    getCssBlock(".soot-sprite:not(.soot-sprite--scripted)"),
    /animation: soot-sprite-scatter var\(--soot-duration\) linear var\(--soot-delay\) both;/
  );
  assert.match(eventStyles, /@keyframes soot-sprite-scatter/);
  assert.match(
    eventStyles,
    /0% \{[\s\S]*?translate3d\(var\(--soot-x0\), var\(--soot-y0\), 0\)[\s\S]*?12% \{[\s\S]*?translate3d\(var\(--soot-x-fall-25\), var\(--soot-y-fall-25\), 0\)[\s\S]*?24% \{[\s\S]*?translate3d\(var\(--soot-x-fall-50\), var\(--soot-y-fall-50\), 0\)[\s\S]*?38% \{[\s\S]*?translate3d\(var\(--soot-x-fall-75\), var\(--soot-y-fall-75\), 0\)[\s\S]*?50% \{[\s\S]*?translate3d\(var\(--soot-x-land\), var\(--soot-y-land\), 0\)[\s\S]*?100% \{[\s\S]*?translate3d\(var\(--soot-x3\), var\(--soot-y3\), 0\)/
  );
  assert.match(eventStyles, /@keyframes soot-candy-fall/);
  assert.match(
    eventStyles,
    /20% \{[\s\S]*?translate3d\(var\(--candy-x-fall-25\), var\(--candy-y-fall-25\), 0\)[\s\S]*?40% \{[\s\S]*?translate3d\(var\(--candy-x-fall-50\), var\(--candy-y-fall-50\), 0\)[\s\S]*?60% \{[\s\S]*?translate3d\(var\(--candy-x-fall-75\), var\(--candy-y-fall-75\), 0\)[\s\S]*?72% \{[\s\S]*?translate3d\(var\(--candy-x-land\), var\(--candy-y-land\), 0\)[\s\S]*?82% \{[\s\S]*?opacity: 1;[\s\S]*?100% \{[\s\S]*?opacity: 1;[\s\S]*?translate3d\(var\(--candy-x-land\), var\(--candy-y-land\), 0\)/
  );
  assert.match(
    eventStyles,
    /@keyframes soot-candy-fade \{[\s\S]*?from \{[\s\S]*?opacity: 1;[\s\S]*?to \{[\s\S]*?opacity: 0;/
  );
  assert.match(eventStyles, /@keyframes soot-puff-drift/);
  assert.match(
    eventStyles,
    /@keyframes soot-puff-drift \{[\s\S]*?68% \{[\s\S]*?opacity: 0\.74;/
  );
  await access(new URL("assets/app-icons/ico/hardware.ico", root));
});

test("nataraja event is probability-gated and loops local video with offer buttons", async () => {
  const registrationStart = eventSources.indexOf('id: "nataraja"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="nataraja-window"');
  const windowEnd = homeSource.indexOf('id="noble-steed-window"', windowStart);

  assert.notEqual(registrationStart, -1, "Missing Nataraja registration");
  assert.notEqual(registrationEnd, -1, "Missing Nataraja registration end");
  assert.notEqual(windowStart, -1, "Missing Nataraja window");
  assert.notEqual(windowEnd, -1, "Missing Nataraja window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(registration, /isVisible: isNatarajaVisible,/);
  assert.match(registration, /showNatarajaWindow\(\);/);
  assert.match(windowMarkup, /<div class="title-bar-text">Nataraja<\/div>/);
  assert.match(windowMarkup, /id="nataraja-video"/);
  assert.match(windowMarkup, /data-src="assets\/random%20events\/nataraja\.mp4"/);
  assert.match(windowMarkup, /\sautoplay\s/);
  assert.match(windowMarkup, /\smuted\s/);
  assert.match(windowMarkup, /\sloop\s/);
  assert.match(windowMarkup, /\splaysinline\s/);
  assert.match(windowMarkup, /class="nataraja-credit">Art credit: u\/sol_erides<\/p>/);
  assert.match(windowMarkup, /Leave an offering\?/);
  assert.match(windowMarkup, /id="nataraja-yes">Yes<\/button>/);
  assert.match(windowMarkup, /id="nataraja-no">No<\/button>/);
  assert.match(eventSources, /preloadTargets: \(\) => \[natarajaWindow, "assets\/random%20events\/nataraja\.mp4"\]/);
  assert.match(eventSources, /natarajaVideo\.play\(\)\.catch\(\(\) => undefined\);/);
  assert.match(eventSources, /bindRandomEventButton\(natarajaYes, closeNatarajaWindow\);/);
  assert.match(eventSources, /bindRandomEventButton\(natarajaNo, closeNatarajaWindow\);/);
  assert.match(eventSources, /afterClose: resetNatarajaVideo,/);
  assert.match(
    getCssBlock(".nataraja-window"),
    /--event-window-max-width: calc\(75vw - 18px\);[\s\S]*?--event-window-width: 322\.5px;/
  );
  assert.match(
    getCssBlock(".nataraja-window .window-body"),
    /gap: 10px;[\s\S]*?padding: 10px 6\.75px;/
  );
  assert.match(getCssBlock(".nataraja-video"), /max-height: min\(46\.5vh, 390px\);/);
  assert.match(getCssBlock(".nataraja-credit"), /font-size: 11px;/);
  await access(new URL("assets/random events/nataraja.mp4", root));
});

test("noble steed event delays then shows a same-place result alert", async () => {
  const registrationStart = eventSources.indexOf('id: "noble-steed"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="noble-steed-window"');
  const resultWindowStart = homeSource.indexOf('id="noble-steed-result-window"');
  const windowEnd = homeSource.indexOf('id="toxic-jungle-window"', resultWindowStart);

  assert.notEqual(registrationStart, -1, "Missing Noble Steed registration");
  assert.notEqual(registrationEnd, -1, "Missing Noble Steed registration end");
  assert.notEqual(windowStart, -1, "Missing Noble Steed window");
  assert.notEqual(resultWindowStart, -1, "Missing Noble Steed result window");
  assert.notEqual(windowEnd, -1, "Missing Noble Steed result window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, resultWindowStart);
  const resultWindowMarkup = homeSource.slice(resultWindowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(registration, /isVisible: isNobleSteedVisible,/);
  assert.match(registration, /showNobleSteedWindow\(\);/);
  assert.match(eventSources, /preloadTargets: \(\) => \[[\s\S]*?nobleSteedWindow,[\s\S]*?nobleSteedResultWindow,[\s\S]*?"assets\/random%20events\/horse\.jpeg"/);
  assert.match(
    homeSource,
    /class="window random-event-window random-alert-window noble-steed-window is-hidden"[\s\S]*?id="noble-steed-window"/
  );
  assert.match(windowMarkup, /<div class="title-bar-text">Noble Steed<\/div>/);
  assert.match(windowMarkup, /data-src="assets\/random%20events\/horse\.jpeg"/);
  assert.match(windowMarkup, /alt="Horse"/);
  assert.match(windowMarkup, /Bring your horse to water\?/);
  assert.match(windowMarkup, /id="noble-steed-yes">Yes<\/button>/);
  assert.match(windowMarkup, /id="noble-steed-no">No<\/button>/);
  assert.match(
    homeSource,
    /class="window random-event-window random-alert-window noble-steed-result-window is-hidden"[\s\S]*?id="noble-steed-result-window"/
  );
  assert.match(resultWindowMarkup, /<div class="title-bar-text">System Alert<\/div>/);
  assert.match(resultWindowMarkup, /src="assets\/app-icons\/ico\/globe_map\.ico"/);
  assert.match(resultWindowMarkup, /The horse does not drink any water\./);
  assert.match(resultWindowMarkup, /id="noble-steed-result-ok">OK<\/button>/);
  assert.match(eventSources, /bindRandomEventButton\(nobleSteedYes, acceptNobleSteedOffer\);/);
  assert.match(eventSources, /bindRandomEventButton\(nobleSteedNo, closeNobleSteedWindow\);/);
  assert.match(eventSources, /bindRandomEventButton\(nobleSteedResultOk, closeNobleSteedResultWindow\);/);
  assert.match(eventSources, /nobleSteedResultPosition = getRandomEventWindowPosition\(nobleSteedWindow\);/);
  assert.match(eventSources, /nobleSteedResultTimer = window\.setTimeout\(showNobleSteedResultWindow, 2000\);/);
  assert.match(eventSources, /setRandomEventWindowPosition\(\s*nobleSteedResultWindow,[\s\S]*?nobleSteedResultPosition\.left,[\s\S]*?nobleSteedResultPosition\.top/);
  assert.match(eventSources, /const closeNobleSteedWindow = \(\) => \{[\s\S]*?closeManagedRandomEventWindow\(nobleSteedWindow\);[\s\S]*?\};/);
  await access(new URL("assets/random events/horse.jpeg", root));
  await access(new URL("assets/app-icons/ico/globe_map.ico", root));
});

test("toxic jungle event is probability-gated spore collection with pokemon dialogue", async () => {
  const registrationStart = eventSources.indexOf('id: "toxic-jungle"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="toxic-jungle-window"');
  const windowEnd = homeSource.indexOf('<div class="window random-event-window fate-window', windowStart);

  assert.notEqual(registrationStart, -1, "Missing Toxic Jungle registration");
  assert.notEqual(registrationEnd, -1, "Missing Toxic Jungle registration end");
  assert.notEqual(windowStart, -1, "Missing Toxic Jungle window");
  assert.notEqual(windowEnd, -1, "Missing Toxic Jungle window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(registration, /isVisible: isToxicJungleVisible,/);
  assert.match(registration, /showToxicJungleWindow\(\);/);
  assert.match(eventSources, /preloadTargets: \(\) => \[[\s\S]*?toxicJungleWindow,[\s\S]*?Object\.values\(TOXIC_JUNGLE_ASSETS\)/);
  assert.match(eventSources, /background: "assets\/random%20events\/toxic-jungle\.webp"/);
  assert.match(eventSources, /nausicaa: "assets\/random%20events\/nausicaa\.jpg"/);
  assert.match(homeSource, /class="window random-event-window toxic-jungle-window is-hidden"[\s\S]*?id="toxic-jungle-window"/);
  assert.match(windowMarkup, /<div class="title-bar-text">Toxic Jungle<\/div>/);
  assert.match(windowMarkup, /class="toxic-jungle-dialog pokemon-dialogue"/);
  assert.match(windowMarkup, /class="toxic-jungle-nausicaa pokemon-dialogue-portrait"/);
  assert.match(windowMarkup, /data-src="assets\/random%20events\/nausicaa\.jpg"/);
  assert.match(windowMarkup, /alt="Nausicaa"/);
  assert.match(windowMarkup, /Hey! Can you help me collect some spores\?/);
  assert.match(windowMarkup, /id="toxic-jungle-start">Of course!<\/button>/);
  assert.match(windowMarkup, /id="toxic-jungle-decline">Another time\.\.\.<\/button>/);
  assert.doesNotMatch(windowMarkup, /id="toxic-jungle-continue"/);
  assert.doesNotMatch(windowMarkup, />\s*Next\s*<\/button>/);
  assert.match(windowMarkup, /id="toxic-jungle-spores"/);
  assert.match(windowMarkup, /id="toxic-jungle-counters"/);
  assert.match(eventSources, /const TOXIC_JUNGLE_SPORE_TARGET = 10;/);
  assert.match(eventSources, /id: "blue"[\s\S]*?id: "red"[\s\S]*?id: "white"/);
  assert.match(eventSources, /Math\.max\(width \+ 72, 420\)/);
  assert.match(eventSources, /button\.style\.setProperty\("--spore-delay", "0s"\);/);
  assert.match(eventSources, /sporeCore\.className = "toxic-jungle-spore-core";/);
  assert.doesNotMatch(eventSources, /clearToxicJungleSporesByType/);
  assert.match(eventSources, /toxicJungleCounts\[type\.id\] = Math\.min\(/);
  assert.match(eventSources, /isToxicJungleComplete\(\)/);
  assert.match(eventSources, /setToxicJungleDialog\(TOXIC_JUNGLE_COMPLETE_MESSAGE\)/);
  assert.match(eventSources, /Thanks for the help! Watch your back out there\./);
  assert.match(eventSources, /bindRandomEventButton\(toxicJungleStart, startToxicJungleCollection\);/);
  assert.match(eventSources, /bindRandomEventButton\(toxicJungleDecline, closeToxicJungleWindow\);/);
  assert.doesNotMatch(eventSources, /toxicJungleContinue/);
  assert.match(eventSources, /toxicJungleWindow\?\.classList\.add\("is-complete"\);/);
  assert.match(eventSources, /toxicJungleDialogActions\?\.classList\.add\("is-hidden"\);/);
  assert.match(
    eventSources,
    /toxicJungleWindow\?\.addEventListener\("click", \(event\) => \{[\s\S]*?toxicJungleStage !== TOXIC_JUNGLE_STAGE_COMPLETE[\s\S]*?closeToxicJungleWindow\(\);[\s\S]*?\}\);/
  );
  assert.match(eventSources, /closest\("\[data-toxic-jungle-spore\]"\)/);
  assert.match(getCssBlock(".toxic-jungle-scene"), /toxic-jungle\.webp/);
  assert.match(getCssBlock(".toxic-jungle-spore"), /cursor: var\(--cursor-select, pointer\) !important;/);
  assert.match(getCssBlock(".toxic-jungle-spore"), /left: -44px;/);
  assert.match(getCssBlock(".toxic-jungle-spore"), /min-width: 0;/);
  assert.match(getCssBlock(".toxic-jungle-spore"), /height: 34px;/);
  assert.match(getCssBlock(".toxic-jungle-spore"), /width: 34px;/);
  assert.match(getCssBlock(".toxic-jungle-spore-core"), /border-radius: 50%;/);
  assert.match(getCssBlock(".toxic-jungle-spore-core"), /height: 24px;/);
  assert.match(getCssBlock(".toxic-jungle-spore-core"), /width: 24px;/);
  assert.match(getCssBlock(".toxic-jungle-spore-core"), /filter: blur\(0\.15px\);/);
  assert.match(getCssBlock(".toxic-jungle-spore-core::before"), /filter: blur\(1\.4px\);/);
  assert.match(
    eventStyles,
    /\.toxic-jungle-window\.is-complete,[\s\S]*?\.toxic-jungle-window\.is-complete \* \{[\s\S]*?cursor: var\(--cursor-select, pointer\) !important;/
  );
  assert.match(getCssBlock(".toxic-jungle-counter-panel"), /right: 10px;/);
  assert.match(getCssBlock(".toxic-jungle-counter-symbol"), /justify-self: center;/);
  assert.doesNotMatch(getCssBlock(".toxic-jungle-counter-symbol"), /box-shadow:/);
  assert.match(getCssBlock(".toxic-jungle-counter-symbol"), /radial-gradient\(circle at 50% 50%/);
  assert.match(getCssBlock(".toxic-jungle-counter-symbol::before"), /radial-gradient\(circle at 50% 50%/);
  assert.match(getCssBlock(".toxic-jungle-counter-symbol::before"), /inset: -4px;/);
  assert.match(getCssBlock(".toxic-jungle-dialog"), /bottom: 14px;/);
  assert.match(eventStyles, /@keyframes toxic-jungle-spore-drift/);
  assert.match(eventStyles, /@keyframes toxic-jungle-spore-bob/);
  await access(new URL("assets/random events/nausicaa.jpg", root));
  await access(new URL("assets/random events/toxic-jungle.webp", root));
});

test("resist causality window has title close and mobile-visible imagery", async () => {
  const registrationStart = eventSources.indexOf('id: "resist-your-fate"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  const windowStart = homeSource.indexOf('id="fate-window"');
  const windowEnd = homeSource.indexOf('<div class="window random-event-window lancer-battle-window', windowStart);

  assert.notEqual(registrationStart, -1, "Missing Resist Causality registration");
  assert.notEqual(registrationEnd, -1, "Missing Resist Causality registration end");
  assert.notEqual(windowStart, -1, "Missing Resist Causality window");
  assert.notEqual(windowEnd, -1, "Missing Resist Causality window end");

  const registration = eventSources.slice(registrationStart, registrationEnd);
  const windowMarkup = homeSource.slice(windowStart, windowEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(windowMarkup, /id="fate-title-close"/);
  assert.match(windowMarkup, /aria-label="Close"/);
  assert.match(domSource, /const fateTitleClose = byId\("fate-title-close"\)/);
  assert.match(eventSources, /bindRandomEventButton\(fateTitleClose, closeFateWindow\);/);
  assert.match(getCssBlock(".fate-photo-frame"), /max-width: 100%;/);
  assert.match(getCssBlock(".fate-photo-slot"), /height: clamp\(118px, 40vh, 320px\);/);
  assert.match(getCssBlock(".fate-photo-slot"), /min-height: 104px;/);
  assert.match(
    eventStyles,
    /@media \(max-width: 520px\), \(max-height: 620px\) \{[\s\S]*?\.fate-window \.window-body \{[\s\S]*?max-height: calc\(100vh - 74px\);[\s\S]*?\.fate-photo-slot \{[\s\S]*?height: clamp\(104px, 30vh, 240px\);/
  );
  await access(new URL("assets/random events/guts-v-zodd.png", root));
});

test("wall breach event shakes, flashes, and opens a probability-gated popup", async () => {
  const registrationStart = eventSources.indexOf('id: "wall-breach"');
  const registrationEnd = eventSources.indexOf("});", registrationStart);
  assert.notEqual(registrationStart, -1, "Missing wall breach registration");
  const registration = eventSources.slice(registrationStart, registrationEnd);

  assert.doesNotMatch(registration, /debug: true,/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(registration, /runWallBreachSequence\(\)/);
  assert.match(eventSources, /const WALL_BREACH_SHAKE_INTERVAL_MS = 1500;/);
  assert.match(eventSources, /const WALL_BREACH_FLASH_DURATION_MS = 760;/);
  assert.match(eventSources, /for \(let count = 0; count < 3; count \+= 1\)/);
  assert.match(eventSources, /await triggerWallBreachFlash\(\);/);
  assert.match(eventSources, /showWallBreachWindow\(\);/);
  assert.match(eventSources, /preloadTargets: \(\) => \[wallBreachWindow\]/);
  assert.match(
    homeSource,
    /class="window random-event-window random-alert-window wall-breach-window is-hidden"[\s\S]*id="wall-breach-window"/
  );
  assert.match(homeSource, /class="random-alert-message wall-breach-message"/);
  assert.match(homeSource, /class="random-alert-actions wall-breach-actions"/);
  assert.match(homeSource, /Wall Maria has been breached\. All scouts to their posts!/);
  assert.match(homeSource, /id="wall-breach-suit-up">Copy that!<\/button>/);
  assert.match(homeSource, /data-src="assets\/random%20events\/wall-maria-logo\.png"/);
  assert.match(getCssBlock(".wall-breach-flash"), /background: #fff;/);
  assert.match(getCssBlock(".random-alert-message img"), /height: 48px;/);
  assert.match(eventStyles, /@keyframes wall-breach-screen-shake/);
  await access(new URL("assets/random events/wall-maria-logo.png", root));
});

test("July 5 calendar event opens the standard random event image window", async () => {
  const eventStart = eventSources.indexOf('"6-5": {');
  const eventEnd = eventSources.indexOf("},", eventStart);
  assert.notEqual(eventStart, -1, "Missing July 5 calendar event");
  const calendarEvent = eventSources.slice(eventStart, eventEnd);

  assert.match(calendarEvent, /title: "July 5th"/);
  assert.match(calendarEvent, /image: "assets\/random%20events\/jul5\.png"/);
  assert.match(
    eventSources,
    /`calendar-day\$\{isToday \? " is-today" : ""\}\$\{calendarEvent \? " is-event-day" : ""\}`/
  );
  assert.match(eventSources, /openRandomEventWindow\(calendarEvent, eventKey\);/);
  assert.match(
    eventSources,
    /showManagedRandomEventWindow\(randomEventWindow, \{ isVisible: \(\) => false \}\);/
  );
  assert.match(homeSource, /id="random-event-window"/);
  assert.match(getBaseCssBlock(".calendar-day.is-event-day"), /position: relative;/);
  await access(new URL("assets/random events/jul5.png", root));
});

test("player attack damage is increased by ten percent and stays readable", () => {
  assert.match(eventSources, /const GEARS_NEST_PLAYER_ATTACK_MULTIPLIER = 1\.1;/);
  assert.match(
    eventSources,
    /const GEARS_NEST_DRONE_DAMAGE = 3\.5 \* GEARS_NEST_PLAYER_ATTACK_MULTIPLIER;/
  );
  assert.match(
    eventSources,
    /const GEARS_NEST_BOOMER_DAMAGE = 4 \* GEARS_NEST_PLAYER_ATTACK_MULTIPLIER;/
  );
  assert.match(
    eventSources,
    /Number\(\(enemy\.health - damage\)\.toFixed\(2\)\)/
  );
  assert.equal(3.5 * 1.1, 3.8500000000000005);
  assert.equal(Number((81 - 3.5 * 1.1).toFixed(2)), 77.15);
  assert.equal(Number((157 - 4 * 1.1).toFixed(2)), 152.6);
});

test("enemy health meters are positioned above the sprites", () => {
  const healthBlock = getCssBlock(".gears-nest-enemy-health");
  assert.match(healthBlock, /bottom: calc\(100% \+ 6px\);/);
  assert.doesNotMatch(healthBlock, /bottom:\s*-\d/);
});

test("cover warnings accelerate throughout the projectile fuse", () => {
  assert.match(eventSources, /y: target\.y - 12,/);
  assert.match(
    getCssBlock(".gears-nest-hazard"),
    /animation: gears-nest-hazard-countdown var\(--flight-ms\) steps\(1, end\) both;/
  );

  const keyframesStart = eventStyles.indexOf(
    "@keyframes gears-nest-hazard-countdown"
  );
  const keyframesEnd = eventStyles.indexOf("\n}\n", keyframesStart);
  const keyframes = eventStyles.slice(keyframesStart, keyframesEnd + 3);
  const milestones = [...keyframes.matchAll(/(?:^|\n)\s*(\d+(?:\.\d+)?)% \{/g)].map(
    (match) => Number(match[1])
  );
  assert.deepEqual(milestones, [0, 14, 27, 39, 50, 60, 69, 77, 84, 90, 95, 98, 99.5, 100]);
  const gaps = milestones.slice(1).map((value, index) => value - milestones[index]);
  assert.ok(gaps.every((gap, index) => index === 0 || gap < gaps[index - 1]));
});

test("grenade projectile travels in one continuous arc", () => {
  assert.match(
    getCssBlock(".gears-nest-projectile--grenade .gears-nest-projectile-body"),
    /animation: gears-nest-grenade-arc var\(--flight-ms\) linear both;/
  );

  const keyframesStart = eventStyles.indexOf("@keyframes gears-nest-grenade-arc");
  const keyframesEnd = eventStyles.indexOf("\n}\n", keyframesStart);
  const keyframes = eventStyles.slice(keyframesStart, keyframesEnd + 3);
  const peakStart = keyframes.indexOf("50% {");
  const peakEnd = keyframes.indexOf("\n  }", peakStart);
  const peakBlock = keyframes.slice(peakStart, peakEnd);

  assert.match(keyframes, /0% \{[\s\S]*left: var\(--start-x\);/);
  assert.match(keyframes, /100% \{[\s\S]*left: var\(--end-x\);/);
  assert.match(peakBlock, /top: var\(--arc-y\);/);
  assert.doesNotMatch(peakBlock, /left:/);
});

test("every projectile resolution creates and cleans up a pixel explosion", () => {
  assert.match(
    eventSources,
    /explosion: "assets\/random%20events\/pixel-explosion\.gif"/
  );
  assert.match(eventSources, /y: target\.y - 6,/);
  assert.match(eventSources, /gearsNestState\.explosions\.push\(explosion\);/);
  assert.match(
    eventSources,
    /candidate\.id !== explosion\.id[\s\S]*GEARS_NEST_EXPLOSION_DURATION_MS/
  );
  assert.match(getCssBlock(".gears-nest-explosion"), /image-rendering: pixelated;/);
});

test("boomer only uses rocket hazards for enemy attacks", () => {
  const attackStart = eventSources.indexOf("const chooseGearsNestEnemyAttack = () => {");
  const attackEnd = eventSources.indexOf("const startGearsNestEnemyAttacks", attackStart);
  assert.notEqual(attackStart, -1, "Missing chooseGearsNestEnemyAttack");
  assert.notEqual(attackEnd, -1, "Missing startGearsNestEnemyAttacks");
  const attackSource = eventSources.slice(attackStart, attackEnd);

  assert.match(
    attackSource,
    /const boomer = aliveEnemies\.find\(\(enemy\) => enemy\.type === "boomer"\);/
  );
  assert.match(attackSource, /launchGearsNestHazard\("rocket", boomer\);/);
  assert.match(attackSource, /const drones = aliveEnemies\.filter/);
  assert.match(attackSource, /if \(!drones\.length\) return;/);
  assert.match(
    attackSource,
    /applyGearsNestBulletDamage\(drones\[Math\.floor\(Math\.random\(\) \* drones\.length\)\]\);/
  );
  assert.doesNotMatch(attackSource, /applyGearsNestBulletDamage\(\s*aliveEnemies/);
});

test("failed combat tips only the player sprite", () => {
  const failedBlock = getCssBlock(
    ".gears-nest-window.is-failed .gears-nest-player img"
  );
  assert.match(failedBlock, /rotate\(88deg\)/);
  assert.match(eventSources, /classList\.toggle\("is-failed", outcome === "failed"\)/);
});

test("HTML entry points use the updated cache key", () => {
  for (const source of [homeSource, indexSource]) {
    assert.match(source, /random-events\.css\?v=managed-event-windows-20261001/);
    assert.match(source, /cursors\.css\?v=cache-token-parity-20260927/);
    assert.match(source, /minesweeper\.css\?v=minesweeper-grid-rows-20260909/);
    assert.match(source, /game-stats\.css\?v=html-semantics-20260927/);
    assert.match(source, /style\.css\?v=html-semantics-20260927/);
    assert.match(source, /core\/dom\.js\?v=game-build-[a-f0-9]{64}/);
    assert.match(source, /game-stats-backend\.js\?v=game-build-[a-f0-9]{64}/);
    assert.match(source, /features\/minesweeper\.js\?v=game-build-[a-f0-9]{64}/);
  }
});
