import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const route = new URL("video-editor/", root);

const readRouteSources = async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL("index.html", route), "utf8"),
    readFile(new URL("style.css", route), "utf8"),
    readFile(new URL("script.js", route), "utf8"),
  ]);
  return { css, html, script };
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
    ["9:16", "16:9", "1:1", "4:5", "4:3", "21:9", "3:2", "custom"]
  );
  assert.equal(options[0].label, "Reel / TikTok (9:16)");
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
  assert.match(css, /--video-editor-preview-split\s*:\s*44%/i);
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

  assert.doesNotMatch(html, /\b(?:export|download|save project|open project)\b/i);
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
