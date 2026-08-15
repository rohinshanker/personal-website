import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const route = new URL("video-editor/", root);

const readRouteSources = async () => {
  const [html, css, script, audioAnalysis, audioAnalysisWorker] = await Promise.all([
    readFile(new URL("index.html", route), "utf8"),
    readFile(new URL("style.css", route), "utf8"),
    readFile(new URL("script.js", route), "utf8"),
    readFile(new URL("audio-analysis.js", route), "utf8"),
    readFile(new URL("audio-analysis-worker.js", route), "utf8"),
  ]);
  return { audioAnalysis, audioAnalysisWorker, css, html, script };
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

test("Video Editor offers opt-in social UI guidelines for fixed 9:16 frames", async () => {
  const { css, html, script } = await readRouteSources();
  const controls = html.match(
    /<div\b[^>]*\bid="video-editor-guidelines"[^>]*>[\s\S]*?<\/small>\s*<\/div>/i
  )?.[0];
  assert.ok(controls, "Missing the social UI guideline controls.");
  assert.match(controls, /\bdata-video-editor-guidelines-controls(?:\s|>|=)/i);
  assert.match(controls, /\brole="group"/i);
  assert.match(controls, /\baria-label="Social UI guidelines"/i);

  const toggle = controls.match(
    /<input\b[^>]*\bid="video-editor-guidelines-toggle"[^>]*>/i
  )?.[0];
  assert.ok(toggle, "Missing the social UI guideline toggle.");
  assert.match(toggle, /\bdata-video-editor-guidelines-toggle(?:\s|>|=)/i);
  assert.match(toggle, /\btype="checkbox"/i);
  assert.doesNotMatch(toggle, /\bchecked(?:\s|>|=)/i);
  assert.match(toggle, /\baria-controls="video-editor-social-guidelines-overlay"/i);
  assert.match(toggle, /\baria-describedby="video-editor-guidelines-note"/i);
  assert.match(controls, />\s*Show social UI guidelines\s*</i);

  const platform = controls.match(
    /<select\b[^>]*\bid="video-editor-guidelines-platform"[^>]*>[\s\S]*?<\/select>/i
  )?.[0];
  assert.ok(platform, "Missing the social guideline platform selector.");
  assert.match(platform, /\bdata-video-editor-guidelines-platform(?:\s|>|=)/i);
  assert.match(platform, /\bdisabled(?:\s|>|=)/i);
  assert.match(platform, /\baria-describedby="video-editor-guidelines-note"/i);
  assert.match(controls, /<label\b[^>]*for="video-editor-guidelines-platform"[^>]*>\s*Platform\s*<\/label>/i);
  assert.match(
    platform,
    /<option\b(?=[^>]*\bvalue="instagram-reels")(?=[^>]*\bselected\b)[^>]*>Instagram Reels<\/option>/i
  );
  assert.match(platform, /<option\b[^>]*\bvalue="tiktok"[^>]*>TikTok<\/option>/i);
  assert.match(
    controls,
    /\bid="video-editor-guidelines-note"[\s\S]*Approximate(?:&mdash;|—)platform UI varies by device, caption length, placement,[\s\S]*and add-ons\./i
  );

  const overlay = html.match(
    /<div\b[^>]*\bid="video-editor-social-guidelines-overlay"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i
  )?.[0];
  assert.ok(overlay, "Missing the social UI guideline preview overlay.");
  assert.match(overlay, /\bdata-video-editor-social-guidelines-overlay(?:\s|>|=)/i);
  assert.match(overlay, /\bdata-guideline-platform="instagram-reels"/i);
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
  assert.match(css, /--guideline-top-coverage\s*:\s*13\.8%/i);
  assert.match(css, /--guideline-safe-polygon\s*:\s*polygon\([\s\S]*5\.5%\s+13\.8%/i);
  assert.match(
    css,
    /\[data-guideline-platform="tiktok"\]\s*\{[^}]*--guideline-top-coverage\s*:\s*12\.5%/is
  );
  assert.match(css, /\[data-guideline-platform="tiktok"\][\s\S]*72\.2%\s+65\.6%/i);
  assert.match(script, /guidelinesEnabled:\s*false/);
  assert.match(script, /guidelinesPlatform:\s*"instagram-reels"/);
  assert.match(script, /state\.framePreset\s*===\s*"9:16"/);
  assert.match(script, /Social UI guidelines hidden\./);
  assert.match(script, /Social UI guidelines enabled\. Select Reel \/ TikTok \(9:16\) to display them\./);
  assert.doesNotMatch(controls, /\b(?:save|saved|persist|export|download)\b/i);
  assert.doesNotMatch(script, /sessionStorage\.(?:getItem|setItem)\([^)]*guideline/i);
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
  const tabList = html.match(
    /<menu\b[^>]*\bid="effect-tab-list"[^>]*\brole="tablist"[^>]*>/i
  )?.[0];
  assert.ok(tabList, "The dynamic effect tabs must use a 98.css menu tab list.");

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
  assert.match(tabTemplate, /&times;|&#215;|>\s*×\s*</i);

  assert.match(css, /\.effect-tab__close\s*\{[^}]*background\s*:\s*transparent/is);
  assert.match(css, /\.effect-tab__close\s*\{[^}]*box-shadow\s*:\s*none/is);
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

  assert.doesNotMatch(
    html,
    /<(?:button|a|input)\b[^>]*(?:export|download|save project|open project)|\b(?:Export|Download|Save project|Open project)\b(?!ed)/i
  );
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
