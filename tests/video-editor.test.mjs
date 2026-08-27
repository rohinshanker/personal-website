import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const route = new URL("video-editor/", root);

const readRouteSources = async () => {
  const [
    html,
    css,
    script,
    cursor,
    audioAnalysis,
    audioAnalysisWorker,
    sharedCursorCss,
    textSelectionCursor,
  ] = await Promise.all([
    readFile(new URL("index.html", route), "utf8"),
    readFile(new URL("style.css", route), "utf8"),
    readFile(new URL("script.js", route), "utf8"),
    readFile(new URL("cursor.js", route), "utf8"),
    readFile(new URL("audio-analysis.js", route), "utf8"),
    readFile(new URL("audio-analysis-worker.js", route), "utf8"),
    readFile(new URL("styles/home/cursors.css", root), "utf8"),
    readFile(new URL("scripts/home/text-selection-cursor.js", root), "utf8"),
  ]);
  return {
    audioAnalysis,
    audioAnalysisWorker,
    css,
    cursor,
    html,
    script,
    sharedCursorCss,
    textSelectionCursor,
  };
};

test("Video Editor publishes canonical route metadata and the Windows desktop shell", async () => {
  const { css, html } = await readRouteSources();

  assert.match(html, /<html\b[^>]*\blang="en"/i);
  assert.match(html, /<meta\b[^>]*\bname="viewport"[^>]*>/i);
  assert.match(html, /<title>[^<]*Video Editor[^<]*<\/title>/i);
  assert.match(
    html,
    /<meta\b[^>]*\bname="description"[^>]*\bcontent="[^"]*video editor[^"]*"[^>]*>/i
  );
  assert.match(
    html,
    /<link\b[^>]*\brel="canonical"[^>]*\bhref="https:\/\/rohin\.shanker\.me\/video-editor\/"[^>]*>/i
  );
  assert.match(html, /<link\b[^>]*\bhref="(?:\.\/)?style\.css(?:\?[^"#]*)?"[^>]*>/i);
  assert.match(html, /<script\b[^>]*\bsrc="(?:\.\/)?script\.js(?:\?[^"#]*)?"[^>]*>/i);
  assert.match(css, /background-2200\.jpg/);
  assert.doesNotMatch(html, /\bdesktop-icon\b|\btaskbar\b/i);
});

test("Video Editor keeps pixel-font microcopy at its readable native size", async () => {
  const { css } = await readRouteSources();

  assert.match(css, /--editor-pixel-small-font-size\s*:\s*11px/);
  assert.match(css, /--editor-pixel-small-line-height\s*:\s*14px/);

  const compactCss = css.replace(/\s+/g, " ");
  for (const selector of [
    ".editor-window > .title-bar .title-bar-text",
    ".preview-clip-name",
    ".media-drop-zone small",
    ".media-item__meta",
    ".video-editor-guidelines-controls__note",
    ".video-editor-social-guidelines",
    ".timeline-tier__label",
    ".timeline-ruler__label",
    ".timeline-track__empty",
    ".timeline-item__label",
    ".audio-sync-graph",
    ".sound-effect-presets span",
  ]) {
    const block = Array.from(compactCss.matchAll(/[^{}]+\{[^{}]*}/g), ([match]) => match)
      .filter((candidate) => candidate.includes(selector))
      .find(
        (candidate) =>
          candidate.includes("font-size: var(--editor-pixel-small-font-size)") &&
          candidate.includes("line-height: var(--editor-pixel-small-line-height)")
      );
    assert.ok(block, `${selector} must use the readable pixel-font size and line box.`);
  }

  const undersizedBlocks = Array.from(
    compactCss.matchAll(/([^{}]+)\{([^{}]*\bfont-size:\s*(?:9|10)px[^{}]*)\}/g),
    ([, selector]) => selector.trim()
  );
  assert.deepEqual(
    undersizedBlocks,
    [".time-readout"],
    "Only the scalable Courier timecode may remain below the 11px pixel-font floor."
  );
});

test("Video Editor reuses the shared custom cursor theme and pointer semantics", async () => {
  const { css, cursor, html, script, sharedCursorCss, textSelectionCursor } =
    await readRouteSources();
  const sharedStylesheet =
    'href="../styles/home/cursors.css?v=text-selection-cursor-20260810"';
  const cursorRuntime = 'src="cursor.js?v=video-editor-cursors-20260826"';
  const routeStylesheet = 'href="style.css"';
  const textSelectionScript =
    'src="../scripts/home/text-selection-cursor.js?v=video-editor-cursor-guards-20260826"';
  for (const reference of [
    sharedStylesheet,
    cursorRuntime,
    routeStylesheet,
    textSelectionScript,
  ]) {
    assert.ok(html.includes(reference), `Missing shared cursor reference ${reference}.`);
  }
  assert.ok(html.indexOf(sharedStylesheet) < html.indexOf(cursorRuntime));
  assert.ok(html.indexOf(cursorRuntime) < html.indexOf(routeStylesheet));
  assert.ok(html.indexOf(routeStylesheet) < html.indexOf(textSelectionScript));
  assert.match(
    html,
    /<script\b[^>]*\bsrc="\.\.\/scripts\/home\/text-selection-cursor\.js\?v=video-editor-cursor-guards-20260826"[^>]*\bdefer(?:\s|>|=)/i
  );
  for (const id of [
    "desktop-required",
    "media-panel",
    "compose-panel",
    "effects-panel",
    "video-editor-auth-dialog",
  ]) {
    assert.match(
      html,
      new RegExp(`<[^>]+(?=[^>]*\\bid="${id}")(?=[^>]*\\bdata-no-drag(?:\\s|>|=))[^>]*>`, "i"),
      `${id} must opt out of shared draggable-title semantics.`
    );
  }

  assert.match(cursor, /CURSOR_MODE_STORAGE_KEY\s*=\s*"rohin-os-cursor-mode"/);
  assert.match(cursor, /localStorage\.getItem\(CURSOR_MODE_STORAGE_KEY\)\s*===\s*"dark"/);
  assert.match(cursor, /\?\s*"dark"\s*:\s*"light"/);
  assert.match(cursor, /document\.documentElement\.classList\.toggle\(DARK_MODE_CLASS/);
  assert.match(cursor, /document\.body\?\.classList\.toggle\(DARK_MODE_CLASS/);
  assert.match(cursor, /addEventListener\("storage"/);
  assert.match(cursor, /event\.key\s*!==\s*CURSOR_MODE_STORAGE_KEY/);
  assert.match(cursor, /event\.newValue\s*===\s*"dark"\s*\?\s*"dark"\s*:\s*"light"/);
  assert.match(cursor, /addEventListener\("pageshow"/);
  assert.doesNotMatch(cursor, /localStorage\.setItem/);
  assert.match(cursor, /#video-editor-auth-form/);
  assert.match(cursor, /#video-editor-app/);
  assert.match(cursor, /\[data-audio-sync-status\]/);
  assert.match(cursor, /getAttribute\("aria-busy"\)\s*===\s*"true"/);
  assert.match(cursor, /getAttribute\("data-state"\)\s*===\s*"analyzing"/);
  assert.match(cursor, /LOADING_FRAME_COUNT\s*=\s*9/);
  assert.match(cursor, /MutationObserver/);
  assert.match(cursor, /is-custom-cursor-loading/);
  assert.match(script, /elements\.app\?\.setAttribute\("aria-busy",\s*"true"\)/);
  assert.match(script, /finally\s*\{[^}]*elements\.app\?\.setAttribute\("aria-busy",\s*"false"\)/s);
  assert.match(script, /let mediaImportsInFlight\s*=\s*0/);
  assert.match(script, /mediaImportsInFlight\s*\+=\s*1/);
  assert.match(
    script,
    /finally\s*\{[\s\S]*?mediaImportsInFlight\s*=\s*Math\.max\(0,\s*mediaImportsInFlight\s*-\s*1\)[\s\S]*?if\s*\(mediaImportsInFlight\s*===\s*0\)/
  );
  assert.match(
    cursor,
    /addEventListener\("dragstart"[\s\S]*?if\s*\(event\.defaultPrevented\)\s*return;/
  );

  for (const cursorToken of [
    "normal",
    "select",
    "text",
    "unavailable",
    "working",
    "move",
    "pressed",
    "precision",
    "resize-ew",
    "resize-ns",
  ]) {
    assert.match(
      `${sharedCursorCss}\n${css}`,
      new RegExp(`--cursor-${cursorToken.replace("-", "-")}`),
      `Missing the ${cursorToken} custom cursor token.`
    );
  }
  assert.match(sharedCursorCss, /html\.is-cursor-dark-mode,\s*body\.is-cursor-dark-mode/);
  assert.match(sharedCursorCss, /:where\(html, body, body \*\)[^{]*\{[^}]*--cursor-normal|:where\(html, body, body \*\)\s*\{[^}]*cursor\s*:\s*var\(--cursor-normal\)/is);
  assert.match(textSelectionCursor, /is-custom-cursor-text-hover/);
  assert.match(textSelectionCursor, /is-custom-cursor-text-selecting/);
  assert.match(textSelectionCursor, /caretPositionFromPoint/);
  assert.match(textSelectionCursor, /event\.pointerType\s*!==\s*"mouse"/);
  for (const guard of [
    '[draggable="true"]',
    '[role="separator"]',
    "[data-custom-cursor-guard]",
  ]) {
    assert.ok(
      textSelectionCursor.includes(guard),
      `Missing the shared selectable-text guard ${guard}.`
    );
  }
  assert.match(
    html,
    /\bid="timeline-ruler"[^>]*\bdata-custom-cursor-guard(?:\s|>|=)/i
  );
  assert.match(
    html,
    /\bclass="timeline-track"[^>]*\bdata-custom-cursor-guard(?:\s|>|=)/i
  );
  assert.match(
    html,
    /\bid="effects-track"[^>]*\bdata-custom-cursor-guard(?:\s|>|=)/i
  );

  const compactCss = css.replace(/\s+/g, " ");
  for (const [selector, token] of [
    ["#playhead-scrubber", "precision"],
    ["#timeline-scale", "select"],
    [".video-editor-side-separator", "resize-ew"],
    [".video-editor-preview-timeline-separator", "resize-ns"],
    ['[data-video-editor-workspace-layout="side-by-side"]', "resize-ew"],
    ['.media-item[draggable="true"]', "move"],
    [".trim-handle", "resize-ew"],
    ['.video-editor-auth-form[aria-busy="true"]', "working"],
    ['[data-audio-sync-status][data-state="analyzing"]', "working"],
    ["button:disabled", "unavailable"],
    ["body.video-editor-page.is-holding-pointer-item", "pressed"],
    ["body.video-editor-page.is-video-editor-resizing-ew", "resize-ew"],
    ["body.video-editor-page.is-video-editor-resizing-ns", "resize-ns"],
  ]) {
    const matchingBlock = Array.from(compactCss.matchAll(/[^{}]+\{[^{}]*}/g), ([block]) => block)
      .filter((block) => block.includes(selector))
      .find((block) => block.includes(`cursor: var(--cursor-${token}) !important`));
    assert.ok(
      matchingBlock,
      `Missing the --cursor-${token} mapping for ${selector}.`
    );
  }
  for (const operationClass of [
    "is-holding-pointer-item",
    "is-video-editor-resizing-ew",
    "is-video-editor-resizing-ns",
  ]) {
    assert.match(cursor, new RegExp(operationClass));
  }

  await Promise.all(
    ["light", "dark"].flatMap((mode) =>
      [
        "normal",
        "select",
        "text",
        "unavailable",
        "move",
        "precision",
        "resize-ew",
        "resize-ns",
      ].map((name) =>
        access(new URL(`assets/cursor-assets/generated-png/${name}-${mode}.png`, root))
      )
    )
  );
});

test("Video Editor exposes fixed media, preview, and effects panels with stable controls", async () => {
  const { html } = await readRouteSources();

  assert.match(html, /<main\b[^>]*\bid="video-editor-app"[^>]*>/i);
  assert.match(html, /\bdata-panel="media"/);
  assert.match(html, /\bdata-panel="(?:compose|preview)"/);
  assert.match(html, /\bdata-panel="effects"/);
  assert.equal(
    Array.from(html.matchAll(/\bdata-panel="[^"]+"/g)).length,
    3,
    "The editor must expose exactly the three planned panels."
  );

  const mediaInput = html.match(
    /<input\b[^>]*\bid="(?:media-input|media-file-input)"[^>]*>/i
  )?.[0];
  assert.ok(mediaInput, "Missing the media file input.");
  assert.match(mediaInput, /\btype="file"/i);
  assert.match(mediaInput, /\bmultiple(?:\s|>|=)/i);
  assert.match(mediaInput, /\baccept="[^"]*video\/\*/i);
  assert.match(mediaInput, /\baccept="[^"]*audio\/\*/i);
  assert.match(html, /\bid="media-bin"/);
  assert.match(html, /\bid="timeline-(?:tiers|canvas|scroll)"/);
  assert.match(html, /\bid="effect-tab-(?:list|scroll)"/);
  assert.match(html, />\s*Import Media\s*</i);
  assert.match(html, />\s*Video 1\s*</i);
  assert.match(html, />\s*Audio 1\s*</i);
  assert.match(html, /aria-live="polite"/i);
});

test("Video Editor offers frame presets, custom dimensions, and contained preview media", async () => {
  const { css, html } = await readRouteSources();
  const frameSelect = html.match(
    /<select\b[^>]*\bid="video-editor-frame-preset"[^>]*>[\s\S]*?<\/select>/i
  )?.[0];
  assert.ok(frameSelect, "Missing the frame preset selector.");
  const options = Array.from(
    frameSelect.matchAll(/<option\b[^>]*\bvalue="([^"]+)"[^>]*>([^<]+)<\/option>/gi),
    ([, value, label]) => ({ value, label: label.trim() })
  );
  assert.deepEqual(
    options.map(({ value }) => value),
    ["none", "9:16", "16:9", "1:1", "4:5", "4:3", "21:9", "3:2", "custom"]
  );
  assert.equal(options[0].label, "N/A");
  assert.match(
    frameSelect,
    /<option\b(?=[^>]*\bvalue="none")(?=[^>]*\bselected\b)[^>]*>N\/A<\/option>/i
  );
  for (const { value, label } of options.slice(1, -1)) {
    assert.match(label, new RegExp(value.replace(":", "\\s*:\\s*")));
  }
  assert.equal(options.at(-1).label, "Custom");

  assert.match(
    html,
    /\bid="video-editor-frame-custom-size"[^>]*\bhidden(?:\s|>|=)/i
  );
  const customWidth = html.match(
    /<input\b[^>]*\bid="video-editor-frame-custom-width"[^>]*>/i
  )?.[0];
  const customHeight = html.match(
    /<input\b[^>]*\bid="video-editor-frame-custom-height"[^>]*>/i
  )?.[0];
  assert.ok(customWidth && customHeight, "Missing custom frame dimension inputs.");
  assert.match(customWidth, /\btype="number"/i);
  assert.match(customWidth, /\bvalue="1080"/i);
  assert.match(customHeight, /\btype="number"/i);
  assert.match(customHeight, /\bvalue="1920"/i);
  assert.match(css, /#preview-video\s*\{[^}]*object-fit\s*:\s*contain/is);
});

test("Video Editor offers a single platform selector and documented UI guidelines", async () => {
  const { css, html, script } = await readRouteSources();
  const controls = html.match(
    /<div\b[^>]*\bid="video-editor-guidelines"[^>]*>[\s\S]*?\bid="video-editor-guidelines-note"[\s\S]*?<\/div>\s*<\/div>/i
  )?.[0];
  assert.ok(controls, "Missing the UI guideline controls.");
  assert.match(controls, /\bdata-video-editor-guidelines-controls(?:\s|>|=)/i);
  assert.match(controls, /\brole="group"/i);
  assert.match(controls, /\baria-label="UI Guidelines"/i);
  assert.doesNotMatch(controls, /\btype="checkbox"|video-editor-guidelines-toggle/i);

  const platform = controls.match(
    /<select\b[^>]*\bid="video-editor-guidelines-platform"[^>]*>[\s\S]*?<\/select>/i
  )?.[0];
  assert.ok(platform, "Missing the social guideline platform selector.");
  assert.match(platform, /\bdata-video-editor-guidelines-platform(?:\s|>|=)/i);
  assert.doesNotMatch(platform, /\bdisabled(?:\s|>|=)/i);
  assert.match(platform, /\baria-describedby="video-editor-guidelines-note"/i);
  assert.match(platform, /\baria-controls="video-editor-social-guidelines-overlay"/i);
  assert.match(
    platform,
    /<option\b(?=[^>]*\bvalue="none")(?=[^>]*\bselected\b)[^>]*>None<\/option>/i
  );
  assert.match(platform, /<option\b[^>]*\bvalue="instagram-reels"[^>]*>Instagram Reels<\/option>/i);
  assert.match(platform, /<option\b[^>]*\bvalue="tiktok"[^>]*>TikTok<\/option>/i);

  const infoButton = controls.match(
    /<button\b[^>]*\bid="video-editor-guidelines-info"[^>]*>[\s\S]*?<\/button>/i
  )?.[0];
  assert.ok(infoButton, "Missing the UI guideline information button.");
  assert.match(infoButton, /\btype="button"/i);
  assert.match(infoButton, /\baria-(?:label|describedby)="[^"]*(?:UI guidelines|video-editor-guidelines-note)[^"]*"/i);
  const tooltip = controls.match(
    /<(?:p|div|span)\b[^>]*\bid="video-editor-guidelines-note"[^>]*>[\s\S]*?<\/(?:p|div|span)>/i
  )?.[0];
  assert.ok(tooltip, "Missing the UI guideline information tooltip.");
  assert.match(tooltip, /\brole="tooltip"/i);
  assert.match(tooltip, /\brough\b/i);
  assert.match(tooltip, /iPhone 15 Pro/i);
  assert.match(tooltip, /updated[^<]*August 2026/i);
  assert.match(tooltip, /UI varies/i);
  assert.match(
    css,
    /\.video-editor-guidelines-controls__note\s*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/is
  );
  assert.match(
    css,
    /\.video-editor-guidelines-info:(?:hover|focus|focus-visible)\s*\+\s*\.video-editor-guidelines-controls__note/is
  );

  const overlay = html.match(
    /<div\b[^>]*\bid="video-editor-social-guidelines-overlay"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i
  )?.[0];
  assert.ok(overlay, "Missing the social UI guideline preview overlay.");
  assert.match(overlay, /\bdata-video-editor-social-guidelines-overlay(?:\s|>|=)/i);
  assert.match(overlay, /\baria-hidden="true"/i);
  assert.match(overlay, /\bhidden(?:\s|>|=)/i);
  for (const [zone, label] of [
    ["top", "Top UI coverage"],
    ["right", "Right UI coverage"],
    ["bottom", "Bottom UI coverage"],
  ]) {
    assert.match(
      overlay,
      new RegExp(`data-guideline-zone="${zone}"[\\s\\S]*?>\\s*${label}\\s*<`, "i")
    );
  }
  assert.match(overlay, /\bdata-guideline-safe-area(?:\s|>|=)[\s\S]*>\s*Safe content area\s*</i);

  assert.match(css, /\.video-editor-social-guidelines\s*\{[^}]*pointer-events\s*:\s*none/is);
  assert.match(
    css,
    /\.video-editor-social-guidelines\s*\{[^}]*--guideline-top-coverage\s*:\s*13\.5%[^}]*--guideline-right-start\s*:\s*40%[^}]*--guideline-right-end\s*:\s*89%[^}]*--guideline-right-edge\s*:\s*0%[^}]*--guideline-right-coverage\s*:\s*18%[^}]*--guideline-bottom-coverage\s*:\s*32%/is
  );
  assert.match(
    css,
    /--guideline-safe-polygon\s*:\s*polygon\(\s*5\.5%\s+14%,\s*94\.5%\s+14%,\s*94\.5%\s+39%,\s*80%\s+39%,\s*80%\s+65%,\s*5\.5%\s+65%\s*\)/is
  );
  assert.match(
    css,
    /\[data-guideline-platform="tiktok"\]\s*\{[^}]*--guideline-top-coverage\s*:\s*13%[^}]*--guideline-right-start\s*:\s*41%[^}]*--guideline-right-end\s*:\s*90%[^}]*--guideline-right-edge\s*:\s*0%[^}]*--guideline-right-coverage\s*:\s*18%[^}]*--guideline-bottom-coverage\s*:\s*31%/is
  );
  assert.match(
    css,
    /\[data-guideline-platform="tiktok"\][\s\S]*?--guideline-safe-polygon\s*:\s*polygon\(\s*5%\s+13%,\s*95%\s+13%,\s*95%\s+40%,\s*81%\s+40%,\s*81%\s+68%,\s*5%\s+68%\s*\)/is
  );
  assert.doesNotMatch(script, /guidelinesEnabled\s*:/);
  assert.match(script, /guidelinesPlatform:\s*"none"/);
  assert.match(script, /state\.framePreset\s*===\s*"9:16"/);
  assert.match(script, /guidelinesPlatform\s*!==?\s*"none"|guidelinesPlatform\s*===?\s*"none"/);
  assert.match(script, /UI guidelines[^"'`]*(?:hidden|paused|shown)/i);
  assert.doesNotMatch(controls, /\b(?:save|saved|persist|export|download)\b/i);
  assert.doesNotMatch(script, /sessionStorage\.(?:getItem|setItem)\([^)]*guideline/i);
});

test("Video Editor uses vendored base Pixelarticons for action controls", async () => {
  const { html, script } = await readRouteSources();
  const iconNames = [
    "play.svg",
    "pause.svg",
    "download.svg",
    "info-box.svg",
    "close.svg",
    "delete.svg",
  ];
  const iconSources = await Promise.all(
    iconNames.map((name) => readFile(new URL(`assets/pixelarticons/${name}`, root), "utf8"))
  );
  for (const [index, source] of iconSources.entries()) {
    assert.match(source, /<svg\b[^>]*\bviewBox="0 0 24 24"/i, `${iconNames[index]} is not the vendored base SVG.`);
    assert.match(source, /\bfill="currentColor"/i);
    assert.doesNotMatch(source, /<script\b|<(?:image|use)\b[^>]*(?:href|src)=["']https?:/i);
  }
  const license = await readFile(new URL("assets/pixelarticons/LICENSE", root), "utf8");
  assert.match(license, /MIT License/i);
  assert.match(license, /Copyright \(c\) 2019 Gerrit Halfmann/i);

  const source = `${html}\n${script}`;
  for (const name of iconNames) {
    assert.match(source, new RegExp(`assets/pixelarticons/${name.replace(".", "\\.")}`, "i"));
  }
  assert.doesNotMatch(source, /https?:[^"'\s]*pixelarticons/i);
  assert.doesNotMatch(source, /[▶⏵►Ⅱ⏸⇩⬇ℹⓘ✕✖]/u);
  const dropZone = html.match(
    /<(?:div|button)\b(?=[^>]*\bid="media-drop-zone")[^>]*>[\s\S]*?<\/(?:div|button)>/i
  )?.[0];
  const infoButton = html.match(
    /<button\b(?=[^>]*\bid="video-editor-guidelines-info")[^>]*>[\s\S]*?<\/button>/i
  )?.[0];
  const closeButton = html.match(
    /<button\b(?=[^>]*\bdata-close-effect-tab)[^>]*>[\s\S]*?<\/button>/i
  )?.[0];
  assert.ok(dropZone && infoButton && closeButton);
  assert.match(dropZone, /pixelarticons\/download\.svg/i);
  assert.match(infoButton, /pixelarticons\/info-box\.svg/i);
  assert.match(closeButton, /pixelarticons\/close\.svg/i);
  const deleteButtons = Array.from(
    html.matchAll(
      /<button\b(?=[^>]*\bdata-delete-(?:clip|effect))[^>]*>[\s\S]*?<\/button>/gi
    ),
    (match) => match[0]
  );
  assert.equal(deleteButtons.length, 2);
  for (const button of deleteButtons) {
    assert.match(button, /pixelarticons\/delete\.svg/i);
    assert.doesNotMatch(button, /&times;|&#(?:215|xD7);|[×✕✖]/iu);
  }
  assert.match(html, /\bid="play-pause-button"[^>]*\baria-label="Play"[^>]*\baria-pressed="false"/i);
  assert.match(
    html,
    /\bid="play-pause-button"[\s\S]*?<img\b[^>]*\bsrc="\.\.\/assets\/pixelarticons\/play\.svg"[^>]*\balt=""/i
  );
  assert.match(script, /pixelarticons\/play\.svg/);
  assert.match(script, /pixelarticons\/pause\.svg/);
  assert.match(script, /setAttribute\s*\(\s*["']aria-label["']/);
  assert.match(script, /setAttribute\s*\(\s*["']aria-pressed["']/);
});

test("Video Editor offers persistent Standard and Side by side workspace layouts", async () => {
  const { css, html, script } = await readRouteSources();
  assert.match(
    html,
    /\bclass="[^"]*compose-panel__body[^"]*"[^>]*\bdata-video-editor-workspace-layout="standard"/i
  );
  const layoutControls = html.match(
    /<div\b[^>]*\bid="video-editor-workspace-layout"[^>]*>[\s\S]*?<\/div>\s*<\/div>/i
  )?.[0];
  assert.ok(layoutControls, "Missing workspace layout controls.");
  assert.match(layoutControls, /\bdata-video-editor-workspace-layout-controls(?:\s|>|=)/i);
  assert.match(layoutControls, /\brole="group"/i);
  assert.match(layoutControls, /\baria-label="Workspace layout"/i);
  for (const [layout, label, pressed] of [
    ["standard", "Standard", "true"],
    ["side-by-side", "Side by side", "false"],
  ]) {
    const button = layoutControls.match(
      new RegExp(
        `<button\\b[^>]*data-video-editor-workspace-layout-option="${layout}"[^>]*>[\\s\\S]*?<\\/button>`,
        "i"
      )
    )?.[0];
    assert.ok(button, `Missing the ${label} workspace layout button.`);
    assert.match(button, /\btype="button"/i);
    assert.match(button, new RegExp(`aria-pressed="${pressed}"`, "i"));
    assert.match(
      button,
      /aria-controls="video-editor-preview-section video-editor-timeline-section"/i
    );
    assert.match(button, new RegExp(`>\\s*${label}\\s*<`, "i"));
  }

  assert.match(
    css,
    /\.compose-panel__body\[data-video-editor-workspace-layout="side-by-side"\]\s*\{[^}]*grid-template-columns/is
  );
  assert.match(css, /\.video-editor-side-separator\s*\{[^}]*background\s*:\s*transparent/is);
  assert.match(css, /\.video-editor-side-separator\s*\{[^}]*box-shadow\s*:\s*none/is);
  assert.match(
    css,
    /\.video-editor-preview-timeline-separator\s*\{[^}]*background\s*:\s*transparent/is
  );
  assert.match(
    css,
    /\.video-editor-preview-timeline-separator\s*\{[^}]*box-shadow\s*:\s*none/is
  );
  assert.match(css, /\.video-editor-side-separator__grip\s*\{[^}]*repeating-linear-gradient/is);
  assert.match(
    css,
    /\.video-editor-preview-timeline-separator__grip\s*\{[^}]*repeating-linear-gradient/is
  );
  assert.match(script, /workspaceLayout:\s*"standard"/);
  assert.match(
    script,
    /previewSplitByLayout:\s*\{[\s\S]*standard:\s*DEFAULT_PREVIEW_SPLIT[\s\S]*"side-by-side":\s*DEFAULT_PREVIEW_SPLIT/
  );
  assert.match(script, /state\.previewSplitByLayout\[state\.workspaceLayout\]\s*=\s*state\.previewSplit/);
  assert.match(script, /state\.framePreset\s*===\s*"9:16"\s*&&\s*state\.workspaceLayout\s*===\s*"standard"/);
  assert.match(script, /Workspace layout changed to Side by side/);
  assert.match(script, /Workspace layout set to \$\{WORKSPACE_LAYOUTS\[layout\]\}/);
  assert.match(script, /layout === "side-by-side" \? "vertical" : "horizontal"/);
  assert.match(script, /Preview width \$\{state\.previewSplit\}%/);
  assert.match(script, /Preview height \$\{state\.previewSplit\}%/);
  assert.match(script, /Composed timeline preview, flexible frame \(N\/A\)/);
});

test("Video Editor exposes an accessible preview and timeline splitter", async () => {
  const { css, html, script } = await readRouteSources();

  assert.match(html, /\bid="video-editor-preview-section"/i);
  assert.match(html, /\bid="video-editor-timeline-section"/i);
  const separator = html.match(
    /<(?:div|button)\b[^>]*\bid="video-editor-preview-timeline-separator"[^>]*>/i
  )?.[0];
  assert.ok(separator, "Missing the preview and timeline separator.");
  assert.match(separator, /\bdata-video-editor-preview-timeline-separator(?:\s|>|=)/i);
  assert.match(separator, /\brole="separator"/i);
  assert.match(separator, /\btabindex="0"/i);
  assert.match(separator, /\baria-orientation="horizontal"/i);
  assert.match(separator, /\baria-valuemin="25"/i);
  assert.match(separator, /\baria-valuemax="75"/i);
  assert.match(separator, /\baria-valuenow="44"/i);
  assert.match(
    separator,
    /\baria-controls="video-editor-preview-section video-editor-timeline-section"/i
  );
  assert.match(css, /--video-editor-preview-split\s*:\s*44fr/i);
  assert.match(css, /--video-editor-timeline-split\s*:\s*56fr/i);
  assert.match(script, /--video-editor-preview-split["']\s*,\s*`\$\{state\.previewSplit\}fr`/i);
  assert.match(script, /--video-editor-timeline-split["']\s*,\s*`\$\{100\s*-\s*state\.previewSplit\}fr`/i);
  assert.match(script, /video-editor-preview-timeline-separator/);
  assert.match(script, /setPointerCapture|pointermove/);
  assert.match(script, /ArrowUp|ArrowDown/);
  assert.match(script, /aria-valuenow/);
});

test("Video Editor renders differentiated, bounded timeline ruler ticks", async () => {
  const { css, script } = await readRouteSources();

  assert.match(script, /timeline-ruler__tick/);
  assert.match(script, /dataset\.rulerTick|data-ruler-tick/);
  assert.match(script, /dataset\.timeSeconds|data-time-seconds/);
  assert.match(script, /timeline-ruler__label/);
  assert.match(
    css,
    /\.timeline-ruler__tick\s*\{[^}]*height\s*:\s*50%/is
  );
  assert.match(
    css,
    /\.timeline-ruler__tick\[data-ruler-tick="major"\]\s*\{[^}]*height\s*:\s*100%/is
  );
  assert.match(script, /TIMELINE_LABEL_RESERVE\s*=\s*42/);
  assert.match(script, /durationWidth\s*\+\s*TIMELINE_LABEL_RESERVE/);
  assert.match(css, /\.timeline-ruler__label\s*\{[^}]*left\s*:/is);
});

test("Video Editor aligns range hit areas with visible slider tracks", async () => {
  const { css } = await readRouteSources();

  assert.match(
    css,
    /\.video-editor input\[type="range"\]\s*\{[^}]*--video-editor-range-thumb-width\s*:\s*11px/is
  );
  assert.match(
    css,
    /calc\(100%\s*-\s*var\(--video-editor-range-thumb-width\)\)\s+4px\s+no-repeat/i
  );
  assert.match(
    css,
    /input\[type="range"\]::-(?:webkit-slider-runnable-track|moz-range-track)\s*\{/i
  );
});

test("Video Editor uses semantic 98.css effect tabs with restrained close and overflow states", async () => {
  const { css, html, script } = await readRouteSources();
  const effectsPanelId = html.indexOf('id="effects-panel"');
  assert.notEqual(effectsPanelId, -1, "Missing the Effect Editor panel.");
  const effectsPanel = html.slice(
    html.lastIndexOf("<section", effectsPanelId),
    html.indexOf("<template id=\"media-item-template\"")
  );
  const effectsPanelChrome = effectsPanel.slice(
    0,
    effectsPanel.indexOf('<div class="effect-editor-well sunken-panel"')
  );
  assert.doesNotMatch(effectsPanelChrome, /class="[^"]*\btitle-bar\b[^"]*"/i);
  assert.doesNotMatch(effectsPanelChrome, /<[^>]+>\s*Tabs\s*<\/[^>]+>/i);
  assert.doesNotMatch(effectsPanelChrome, /\bid="reopen-effect-tab"/i);
  assert.match(effectsPanelChrome, /\bid="effects-panel-title"[^>]*>Effect Editor<\/h2>/i);
  const tabList = html.match(
    /<menu\b[^>]*\bid="effect-tab-list"[^>]*\brole="tablist"[^>]*>[\s\S]*?<\/menu>/i
  )?.[0];
  assert.ok(tabList, "The dynamic effect tabs must use a 98.css menu tab list.");
  const defaultTab = tabList.match(
    /<li\b(?=[^>]*\bid="effect-tab-default")(?=[^>]*\bdata-effect-default-tab)[^>]*>[\s\S]*?<\/li>/i
  )?.[0];
  assert.ok(defaultTab, "Missing the permanent Effect editor home tab.");
  assert.match(defaultTab, /\brole="tab"/i);
  assert.match(defaultTab, /\baria-label="Effect editor home"/i);
  assert.match(defaultTab, /\baria-controls="effect-editor-empty"/i);
  assert.match(defaultTab, /\baria-selected="true"/i);
  assert.match(defaultTab, /\btabindex="0"/i);
  assert.match(defaultTab, /\bdraggable="false"/i);
  assert.match(defaultTab, /directory_program_group_cool\.ico/i);
  assert.match(defaultTab, /\bdata-effect-default-tab-face(?:\s|>|=)/i);
  assert.doesNotMatch(defaultTab, /data-close-effect-tab|data-effect-tab-title-track/i);
  assert.match(
    effectsPanel,
    /\bid="effect-editor-empty"[^>]*\brole="tabpanel"[^>]*\baria-labelledby="effect-tab-default"/i
  );

  const tabTemplate = html.match(
    /<template\b[^>]*\bid="effect-tab-template"[^>]*>[\s\S]*?<\/template>/i
  )?.[0];
  assert.ok(tabTemplate, "Missing the dynamic effect tab template.");
  assert.match(tabTemplate, /<li\b[^>]*\bdata-effect-tab-wrapper(?:\s|>|=)[^>]*>/i);
  assert.match(tabTemplate, /<li\b[^>]*\brole="tab"[^>]*>/i);
  assert.match(tabTemplate, /<li\b[^>]*\baria-selected="false"[^>]*>/i);
  assert.match(tabTemplate, /<a\b[^>]*\bclass="effect-tab__face"[^>]*\bdata-effect-tab/i);
  assert.match(
    tabTemplate,
    /<a\b[^>]*\bdata-effect-tab(?:\s|>|=)[^>]*\bdraggable="false"[^>]*>/i
  );
  assert.match(tabTemplate, /\bdata-effect-tab-icon(?:\s|>|=)/i);
  assert.match(tabTemplate, /\bdata-effect-tab-title-viewport(?:\s|>|=)/i);
  assert.match(tabTemplate, /\bdata-effect-tab-title-track(?:\s|>|=)/i);
  assert.match(tabTemplate, /<button\b[^>]*\bclass="effect-tab__close"[^>]*\bdata-close-effect-tab/i);
  assert.match(tabTemplate, /assets\/pixelarticons\/close\.svg/i);
  assert.doesNotMatch(tabTemplate, /&times;|&#215;|>\s*×\s*</i);

  assert.match(css, /\.effect-tab__close\s*\{[^}]*background\s*:\s*transparent/is);
  assert.match(css, /\.effect-tab__close\s*\{[^}]*box-shadow\s*:\s*none/is);
  assert.match(css, /\.effects-panel\s*\{[^}]*grid-template-rows\s*:\s*minmax\(0,\s*1fr\)/is);
  assert.match(css, /\.effects-panel\s*>\s*\.window-body\s*\{[^}]*margin\s*:\s*0/is);
  assert.match(
    css,
    /\.effect-tab-scroll\s*\{[^}]*padding-top\s*:\s*2px[^}]*overflow-x\s*:\s*auto[^}]*overflow-y\s*:\s*hidden/is
  );
  assert.doesNotMatch(
    css.match(/\.effect-tab-scroll\s*\{[^}]*}/is)?.[0] || "",
    /contain\s*:\s*paint/i
  );
  const defaultTabCss = css.match(
    /\.effect-tab-list\s*>\s*\.effect-tab\.effect-tab--default\s*\{[^}]*}/is
  )?.[0];
  assert.ok(defaultTabCss, "Missing the permanent home tab styles.");
  assert.match(defaultTabCss, /position\s*:\s*sticky/i);
  assert.match(defaultTabCss, /left\s*:\s*0/i);
  assert.match(defaultTabCss, /z-index\s*:\s*[1-9]\d*/i);
  assert.match(defaultTabCss, /overflow\s*:\s*hidden/i);
  assert.match(defaultTabCss, /width\s*:\s*34px/i);
  assert.match(defaultTabCss, /background\s*:\s*var\(--surface\)/i);
  assert.match(
    css,
    /\.effect-tab__close:active\s*\{[^}]*box-shadow\s*:\s*var\(--border-sunken-outer\)[^}]*var\(--border-sunken-inner\)/is
  );
  assert.match(css, /\.effect-tab\.is-title-overflowing[\s\S]*?\.effect-tab__title-track/);
  assert.match(css, /@keyframes\s+effect-tab-title-[\w-]*marquee/i);
  assert.match(css, /--effect-tab-title-scroll-distance/);
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.effect-tab__title-track[\s\S]*?animation\s*:\s*none/is
  );
  assert.match(script, /scrollWidth\s*-\s*[\w.]+clientWidth/);
  assert.match(script, /is-title-overflowing/);
  assert.match(script, /--effect-tab-title-scroll-distance/);
  assert.match(script, /ResizeObserver/);
  assert.match(script, /setAttribute\("aria-selected"/);
});

test("Video Editor exposes independently bounded side-panel separators", async () => {
  const { css, html, script } = await readRouteSources();
  const mediaSeparator = html.match(
    /<[^>]+\bid="video-editor-media-compose-separator"[^>]*>/i
  )?.[0];
  const effectsSeparator = html.match(
    /<[^>]+\bid="video-editor-compose-effects-separator"[^>]*>/i
  )?.[0];
  assert.ok(mediaSeparator && effectsSeparator, "Missing the two side-panel separators.");

  for (const [separator, side, minimum, maximum, controls] of [
    [mediaSeparator, "media", "220", "360", "media-panel compose-panel"],
    [effectsSeparator, "effects", "240", "420", "compose-panel effects-panel"],
  ]) {
    assert.match(separator, new RegExp(`data-video-editor-side-separator="${side}"`, "i"));
    assert.match(separator, /\brole="separator"/i);
    assert.match(separator, /\btabindex="0"/i);
    assert.match(separator, /\baria-orientation="vertical"/i);
    assert.match(separator, new RegExp(`aria-valuemin="${minimum}"`, "i"));
    assert.match(separator, new RegExp(`aria-valuemax="${maximum}"`, "i"));
    assert.match(separator, new RegExp(`aria-controls="${controls}"`, "i"));
  }

  assert.match(css, /--video-editor-media-panel-width\s*:\s*260px/i);
  assert.match(css, /--video-editor-effects-panel-width\s*:\s*300px/i);
  assert.match(css, /grid-template-columns:[^;]*--video-editor-media-panel-width[^;]*--video-editor-effects-panel-width/is);
  assert.match(script, /SIDE_PANEL_KEYBOARD_STEP\s*=\s*16|PANEL_RESIZE_STEP\s*=\s*16/);
  assert.match(script, /label:\s*"Project Media"/);
  assert.match(script, /label:\s*"Effect Editor"/);
  assert.match(
    script,
    /announce\(`\$\{details\.label\} panel set to \$\{state\[details\.stateKey\]\} pixels\.`\)/
  );
  assert.match(script, /setPointerCapture|pointermove/);
  assert.match(script, /aria-valuemax/);
  assert.match(script, /ArrowLeft|ArrowRight/);
});

test("Video Editor starts behind a semantic, non-dismissible Administrator gate", async () => {
  const { css, html } = await readRouteSources();

  assert.match(
    html,
    /<body\b[^>]*\bdata-video-editor-auth-state="unauthenticated"[^>]*>/i
  );
  assert.match(
    html,
    /<main\b[^>]*\bid="video-editor-app"[^>]*\baria-hidden="true"[^>]*\binert(?:\s|>|=)/i
  );
  assert.match(html, /\bid="video-editor-auth-overlay"/i);
  assert.match(html, /\bdata-video-editor-auth-gate(?:\s|>|=)/i);

  const dialog = html.match(
    /<(?:section|div)\b[^>]*\bid="video-editor-auth-dialog"[^>]*>/i
  )?.[0];
  assert.ok(dialog, "Missing the Video Editor authentication dialog.");
  assert.match(dialog, /\brole="dialog"/i);
  assert.match(dialog, /\baria-modal="true"/i);
  assert.match(dialog, /\baria-labelledby="video-editor-auth-title"/i);
  assert.match(dialog, /\baria-describedby="video-editor-auth-description"/i);

  assert.match(html, /\bid="video-editor-auth-form"/i);
  assert.match(html, /\bid="video-editor-auth-username"/i);
  assert.match(html, /\bid="video-editor-auth-password"/i);
  assert.match(html, /\bid="video-editor-auth-submit"/i);
  assert.match(html, /\bid="video-editor-auth-status"[^>]*\baria-live="polite"/i);
  assert.doesNotMatch(
    html,
    /\b(?:data-close|aria-label)="[^"]*(?:close|cancel)[^"]*"[^>]*video-editor-auth/i,
    "The required-access dialog must not expose a dismiss control."
  );

  assert.match(css, /\.video-editor-auth-overlay\s*\{[^}]*position\s*:\s*fixed/is);
  assert.match(css, /\.video-editor-auth-overlay\s*\{[^}]*background\s*:\s*rgba\(/is);
  assert.match(
    css,
    /\.video-editor-auth-field\s+input\[type=["']password["']\]\s*\{[^}]*font-family\s*:\s*Arial\s*,\s*sans-serif[^}]*font-size\s*:\s*13px[^}]*line-height\s*:\s*normal[^}]*letter-spacing\s*:\s*1px[^}]*-webkit-font-smoothing\s*:\s*auto/is
  );
  const mobileRule = css.slice(
    css.search(/@media[^\{]*(?:max-width\s*:\s*1023px|width\s*<\s*1024px)/i)
  );
  assert.match(
    mobileRule,
    /\.video-editor-auth-overlay\s*\{[^}]*display\s*:\s*none/is
  );
});

test("Video Editor reuses the expiring Administrator proof without persisting project data", async () => {
  const { html, script } = await readRouteSources();

  assert.match(html, /scripts\/home\/game-stats-backend\.js/i);
  assert.match(script, /personalSiteAdministratorProofV1/);
  assert.match(script, /sessionStorage\.(?:getItem|setItem|removeItem)\s*\(/);
  assert.match(script, /administrator\/sign-in/);
  assert.match(script, /\bPOST\b/);
  assert.match(script, /\bexpiresAt\b/);
  assert.match(script, /(?:60\s*\*\s*60\s*\*\s*1000|3_?600_?000)/);
  assert.match(script, /addEventListener\s*\(\s*["']visibilitychange["']/);
  assert.match(script, /addEventListener\s*\(\s*["']focus["']/);
  assert.doesNotMatch(script, /\blocalStorage\b/);
  assert.doesNotMatch(script, /\b(?:indexedDB|IDBDatabase|caches\.(?:open|match|put))\b/);
});

test("Video Editor exposes local Audio-Sync analysis and accessible guidepost controls", async () => {
  const { audioAnalysis, audioAnalysisWorker, css, html, script } =
    await readRouteSources();
  assert.match(html, /<script\b[^>]*\bsrc="audio-analysis\.js"/i);
  assert.match(html, /data-effect="audio-sync-cut"/i);
  assert.match(html, /data-effect-tab-target="effect-tab-audio-sync-cut"/i);
  assert.match(html, /\bid="effect-panel-audio-sync-cut"[^>]*\brole="tabpanel"/i);
  assert.match(html, /<select\b[^>]*\bid="audio-sync-source"[^>]*>/i);
  assert.match(html, /data-audio-sync-analyze[^>]*\bdisabled/i);
  assert.match(html, /data-audio-sync-status[^>]*\brole="status"[^>]*\baria-live="polite"/i);

  const graphSelect = html.match(
    /<select\b[^>]*\bid="audio-sync-graph-view"[^>]*>[\s\S]*?<\/select>/i
  )?.[0];
  assert.ok(graphSelect, "Missing the Audio-Sync graph selector.");
  assert.match(graphSelect, /<option\b[^>]*value="combined"[^>]*selected[^>]*>Combined<\/option>/i);
  assert.match(graphSelect, /<option\b[^>]*value="waveform"[^>]*>Waveform<\/option>/i);
  assert.match(graphSelect, /<option\b[^>]*value="frequency"[^>]*>Frequency<\/option>/i);
  for (const graph of ["waveform", "spectrum"]) {
    assert.match(
      html,
      new RegExp(`data-audio-sync-${graph}[\\s\\S]*?role="img"[\\s\\S]*?<canvas\\b`, "i")
    );
  }

  for (const [id, value] of [
    ["audio-sync-frequency-min", "40"],
    ["audio-sync-frequency-max", "2000"],
  ]) {
    const input = html.match(new RegExp(`<input\\b[^>]*id="${id}"[^>]*>`, "i"))?.[0];
    assert.ok(input, `Missing ${id}.`);
    assert.match(input, /\btype="number"/i);
    assert.match(input, new RegExp(`\\bvalue="${value}"`, "i"));
  }
  assert.match(
    html,
    /\bid="audio-sync-threshold"[^>]*\bmin="0"[^>]*\bmax="100"[^>]*\bstep="1"[^>]*\bvalue="65"/i
  );
  const direction = html.match(
    /<select\b[^>]*\bid="audio-sync-direction"[^>]*>[\s\S]*?<\/select>/i
  )?.[0];
  assert.ok(direction, "Missing threshold-crossing direction selector.");
  for (const value of ["rising", "falling", "both"]) {
    assert.match(direction, new RegExp(`<option\\b[^>]*value="${value}"`, "i"));
  }
  for (const [value, label] of [
    ["low", "Lows"],
    ["mid", "Mids"],
    ["high", "Highs"],
    ["beats", "Beats"],
  ]) {
    assert.match(
      html,
      new RegExp(`data-audio-sync-recommendation="${value}"[^>]*>\\s*${label}\\s*<`, "i")
    );
  }

  const ruleTemplate = html.match(
    /<template\b[^>]*\bid="audio-sync-rule-template"[^>]*>[\s\S]*?<\/template>/i
  )?.[0];
  const guideTemplate = html.match(
    /<template\b[^>]*\bid="audio-sync-guidepost-template"[^>]*>[\s\S]*?<\/template>/i
  )?.[0];
  assert.ok(ruleTemplate && guideTemplate, "Missing Audio-Sync rule or guidepost templates.");
  assert.match(ruleTemplate, /data-audio-sync-rule-id/);
  assert.match(ruleTemplate, /data-audio-sync-rule-color/);
  assert.match(ruleTemplate, /data-audio-sync-rule-label/);
  assert.match(ruleTemplate, /data-audio-sync-rule-count/);
  for (const action of ["cut", "fill", "effect"]) {
    assert.match(ruleTemplate, new RegExp(`data-guidepost-action="${action}"`, "i"));
  }
  assert.match(ruleTemplate, /data-guidepost-effect-type/);
  assert.match(ruleTemplate, /data-delete-audio-sync-rule/);
  assert.match(guideTemplate, /data-guidepost-group-id/);
  assert.match(guideTemplate, /data-guidepost-color/);
  assert.match(guideTemplate, /data-guidepost-source-clip-id/);
  assert.match(guideTemplate, /data-guidepost-visual-id/);
  assert.match(guideTemplate, /data-guidepost-source-time/);
  assert.match(html, /\bid="audio-sync-guide-layer"[^>]*\baria-hidden="true"/i);
  assert.match(html, /\bid="audio-sync-flash"[^>]*\bdata-flash-active="false"[^>]*\baria-hidden="true"/i);
  assert.match(css, /\.audio-sync-guide-layer\s*\{[^}]*pointer-events\s*:\s*none/is);
  assert.match(css, /\.audio-sync-flash\s*\{[^}]*pointer-events\s*:\s*none/is);

  assert.match(script, /decodeAudioData\s*\(/);
  assert.match(script, /AudioContext|webkitAudioContext/);
  assert.match(script, /new\s+Worker\s*\(/);
  assert.match(script, /audio-analysis-worker\.js/);
  assert.match(audioAnalysisWorker, /importScripts\s*\(\s*["']\.\/audio-analysis\.js["']\s*\)/);
  assert.match(audioAnalysisWorker, /postMessage\s*\(/);
  assert.match(audioAnalysis, /createBandSeries/);
  assert.match(audioAnalysis, /createOnsetSeries/);
  assert.match(audioAnalysis, /findThresholdCrossings/);
  assert.match(audioAnalysis, /recommendThreshold/);
  assert.doesNotMatch(`${audioAnalysis}\n${audioAnalysisWorker}`, /\bfetch\s*\(|XMLHttpRequest|WebSocket/);
  assert.match(script, /data-audio-sync-marker-list|audioSyncMarkerList/i);
  assert.match(script, /data-guidepost-source-time|guidepostSourceTime/i);
  assert.match(script, /sourceTime\s*-\s*[^;\n]*sourceStart/i);
  assert.match(script, /0\.05/);
  assert.match(script, /0\.25/);
  assert.match(script, /ArrowLeft|ArrowRight/);
  assert.match(script, /Delete|Backspace/);
});

test("Video Editor provides rights-safe local Audio and procedural sound-effect tools", async () => {
  const { html, script } = await readRouteSources();
  assert.match(html, /data-effect="audio"/i);
  assert.match(html, /data-effect-tab-target="effect-tab-audio"/i);
  assert.match(html, /\bid="effect-panel-audio"[^>]*\brole="tabpanel"/i);
  for (const formLabel of [
    "Search official YouTube for music",
    "Search official YouTube for sound effects",
  ]) {
    const form = html.match(
      new RegExp(`<form\\b[^>]*aria-label="${formLabel}"[^>]*>[\\s\\S]*?<\\/form>`, "i")
    )?.[0];
    assert.ok(form, `Missing ${formLabel}.`);
    assert.match(form, /action="https:\/\/www\.youtube\.com\/results"/i);
    assert.match(form, /method="get"/i);
    assert.match(form, /target="_blank"/i);
  }
  assert.match(html, /No audio is downloaded\s+or imported\./i);
  assert.match(html, /\bid="audio-local-file"[^>]*\btype="file"[^>]*\baccept="audio\/\*"/i);
  assert.match(html, /\bid="audio-local-source"/i);
  for (const id of ["audio-local-start", "audio-local-end"]) {
    assert.match(
      html,
      new RegExp(`<input\\b[^>]*id="${id}"[^>]*type="number"[^>]*step="0\\.01"[^>]*disabled`, "i")
    );
  }
  assert.match(html, /\bid="audio-local-preview"[^>]*\bcontrols[^>]*\bhidden/i);
  assert.match(html, /data-audio-local-insert[^>]*\bdisabled/i);

  for (const [preset, pressed] of [
    ["click", "true"],
    ["typing", "false"],
  ]) {
    assert.match(
      html,
      new RegExp(`data-sound-effect-preset="${preset}"[^>]*aria-pressed="${pressed}"`, "i")
    );
  }
  assert.match(html, /generated procedurally in this browser and remain local/i);
  assert.match(html, /\bid="sound-effect-loop"[^>]*\btype="checkbox"[^>]*\bdisabled/i);
  assert.match(
    html,
    /\bid="sound-effect-duration"[^>]*\btype="number"[^>]*\bmin="1"[^>]*\bmax="30"[^>]*\bstep="0\.25"[^>]*\bvalue="3"[^>]*\bdisabled/i
  );
  assert.match(html, /data-sound-effect-preview/);
  assert.match(html, /data-sound-effect-insert/);
  assert.match(script, /window\.open\s*\([^)]*[_"']blank[^)]*noopener,noreferrer/is);
  assert.match(script, /0\.12/);
  assert.match(script, /1\.2/);
  assert.match(script, /RIFF|WAVE/);
  assert.doesNotMatch(script, /youtube(?:\.com)?\/(?:watch|embed)|youtu\.be|googlevideo|yt-dlp/i);
  assert.doesNotMatch(script, /(?:extract|download)(?:YouTube|Youtube|Audio|Media)/);
  assert.doesNotMatch(script, /(?:api[_-]?key|oauth|client[_-]?secret)/i);
});

test("Video Editor keeps imported media browser-local and releases object URLs", async () => {
  const { html, script } = await readRouteSources();
  const source = `${html}\n${script}`;

  assert.match(script, /URL\.createObjectURL\s*\(/);
  assert.match(script, /URL\.revokeObjectURL\s*\(/);
  assert.match(script, /addEventListener\s*\(\s*["']change["']/);
  assert.match(script, /addEventListener\s*\(\s*["']drop["']/);
  assert.match(script, /\.files\b/);
  assert.match(script, /\b(?:video|audio)\//i);
  assert.equal(
    Array.from(script.matchAll(/\bfetch\s*\(/g)).length,
    1,
    "Only Administrator sign-in may use fetch."
  );
  assert.match(script, /fetch\s*\([^)]*administrator\/sign-in/s);
  assert.doesNotMatch(script, /\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon|FormData)\b/);
  assert.doesNotMatch(script, /body\s*:\s*(?:file|media|item|url)\b/i);
  assert.doesNotMatch(source, /\b(?:upload|uploaded|uploading)\b/i);
});

test("Video Editor defines the three labeled effect types with icons and three-second items", async () => {
  const { css, html, script } = await readRouteSources();
  const source = `${html}\n${css}\n${script}`;
  const effects = [
    {
      color: /(?:#ffff00|yellow)/i,
      icon: "accessibility_window_speak.ico",
      label: "Closed Captions",
    },
    { color: /(?:#000080|navy)/i, icon: "windows.ico", label: "Windows 98" },
    { color: /(?:#008080|teal)/i, icon: "movie_maker.ico", label: "Transitions" },
  ];

  for (const effect of effects) {
    assert.match(source, new RegExp(effect.label.replace(" ", "\\s+"), "i"));
    assert.match(source, new RegExp(effect.icon.replace(".", "\\."), "i"));
    assert.match(source, effect.color);
    await access(new URL(`assets/app-icons/ico/${effect.icon}`, root));
  }

  assert.match(source, /Add to timeline/i);
  assert.match(
    script,
    /\bduration\s*:\s*3\b|\b(?:effect\w*duration|duration\w*effect)\w*\s*=\s*3\b/i
  );
});

test("Video Editor swaps to a desktop-required message below 1024px", async () => {
  const { css, html } = await readRouteSources();

  assert.match(html, /class="[^"]*\bdesktop-required(?:-message|-window)?\b[^"]*"/i);
  assert.match(
    html,
    /desktop[^<]*(?:required|only|needs?)|(?:required|only|needs?)[^<]*desktop/i
  );
  assert.match(css, /@media[^\{]*(?:max-width\s*:\s*1023px|width\s*<\s*1024px)/i);

  const responsiveRule = css.slice(css.search(/@media[^\{]*(?:max-width\s*:\s*1023px|width\s*<\s*1024px)/i));
  assert.match(
    responsiveRule,
    /\.(?:editor-shell|video-editor)\s*\{[^}]*display\s*:\s*none\b/is
  );
  assert.match(
    responsiveRule,
    /\.desktop-required(?:-message|-window)?\s*\{[^}]*display\s*:\s*(?!none\b)(?:block|flex|grid)\b/is
  );
});

test("Video Editor makes no export or project-persistence surface", async () => {
  const { html, script } = await readRouteSources();
  const userFacingText = html.replace(/<[^>]+>/g, " ");

  assert.doesNotMatch(
    html,
    /<(?:button|a|input)\b[^>]*(?:export|download|save project|open project)/i
  );
  assert.doesNotMatch(userFacingText, /\b(?:Export|Download|Save project|Open project)\b(?!ed)/i);
  assert.doesNotMatch(
    script,
    /\b(?:localStorage|indexedDB|IDBDatabase|caches\.(?:open|match|put))\b/
  );
  assert.doesNotMatch(script, /\b(?:exportProject|saveProject|loadProject|downloadProject)\b/);
});

test("the public sitemap includes the canonical Video Editor route exactly once", async () => {
  const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
  const matches = sitemap.match(
    /<loc>https:\/\/rohin\.shanker\.me\/video-editor\/<\/loc>/g
  );

  assert.equal(matches?.length, 1);
});
