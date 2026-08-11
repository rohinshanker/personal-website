import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const count = (source, pattern) => Array.from(source.matchAll(pattern)).length;

const windowSection = (home, appId) => {
  const marker = `data-app-window="${appId}"`;
  const start = home.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${appId} app window.`);
  const next = home.indexOf('data-app-window="', start + marker.length);
  return home.slice(start, next === -1 ? home.length : next);
};

test("Video Editor and Image Tools have desktop and taskbar launchers with their requested icons", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");
  const taskbarStart = home.indexOf('<div class="taskbar-apps"');
  const taskbarEnd = home.indexOf("</div>", taskbarStart);
  const taskbar = home.slice(taskbarStart, taskbarEnd);
  const desktop = home.slice(
    home.indexOf('<div class="desktop"'),
    home.indexOf('<div class="window-stack"')
  );

  const launchers = [
    {
      appId: "video-editor",
      label: "Video Editor",
      icon: "assets/app-icons/ico/camera3_vid.ico",
      controls: "video-editor-launch-window",
    },
    {
      appId: "image-tools",
      label: "Image Tools",
      icon: "assets/app-icons/ico/pcx_alt.ico",
      controls: "image-tools-coming-soon-window",
    },
  ];

  for (const launcher of launchers) {
    for (const [location, markup] of [
      ["desktop", desktop],
      ["taskbar", taskbar],
    ]) {
      assert.equal(
        count(markup, new RegExp(`data-app="${launcher.appId}"`, "g")),
        1,
        `${launcher.label} must have exactly one ${location} launcher.`
      );
      assert.match(
        markup,
        new RegExp(
          `data-app="${launcher.appId}"[\\s\\S]*?aria-label="${launcher.label}"[\\s\\S]*?aria-haspopup="dialog"[\\s\\S]*?aria-controls="${launcher.controls}"[\\s\\S]*?src="${launcher.icon.replaceAll("/", "\\/")}"`
        )
      );
    }
    assert.match(desktop, new RegExp(`>${launcher.label}<\\/span>`));
    const iconStats = await stat(new URL(launcher.icon, root));
    assert.ok(iconStats.isFile() && iconStats.size > 0, `${launcher.icon} must exist.`);
  }
});

test("Video Editor owns an accessible new-tab confirmation prompt", async () => {
  const [home, main, dom, randomEventStyles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("styles/home/random-events.css", root), "utf8"),
  ]);
  const section = windowSection(home, "video-editor");

  assert.match(section, /data-launch-prompt-window/);
  assert.doesNotMatch(section, /data-coming-soon-window/);
  assert.match(section, /data-random-viewport-position/);
  assert.match(section, /id="video-editor-launch-window"/);
  assert.match(section, /role="alertdialog"/);
  assert.match(section, /aria-modal="false"/);
  assert.match(section, /aria-hidden="true"/);
  assert.match(section, />Video Editor<\/div>/);
  assert.match(section, /src="assets\/app-icons\/ico\/camera3_vid\.ico" alt=""/);
  assert.match(section, />Open video editor in new tab\?<\/p>/);
  assert.doesNotMatch(section, />Coming soon<\/p>/);
  assert.match(
    section,
    /id="video-editor-launch-yes"[\s\S]*?data-video-editor-open[\s\S]*?data-dialog-initial-focus[\s\S]*?>Yes<\/button>/
  );
  assert.match(
    section,
    /id="video-editor-launch-no"[\s\S]*?data-video-editor-cancel[\s\S]*?data-close="video-editor"[\s\S]*?>No<\/button>/
  );
  assert.equal(count(section, /data-close="video-editor"/g), 2);
  assert.match(
    section,
    /id="video-editor-launch-error"[\s\S]*?role="alert"[\s\S]*?aria-live="assertive"[\s\S]*?hidden/
  );

  assert.match(dom, /videoEditorLaunchWindow: byId\("video-editor-launch-window"\)/);
  assert.match(dom, /videoEditorLaunchYes: byId\("video-editor-launch-yes"\)/);
  assert.match(dom, /videoEditorLaunchError: byId\("video-editor-launch-error"\)/);
  assert.match(main, /window\.open\(VIDEO_EDITOR_PATH, "_blank"\)/);
  assert.match(main, /openedWindow\.opener = null/);
  assert.match(main, /if \(!openedWindow\) \{[\s\S]*?showVideoEditorLaunchError\(\)/);
  assert.match(main, /Allow pop-ups for this site, then choose Yes again/);
  assert.match(
    main,
    /videoEditorLaunchYes\?\.addEventListener\("click", openVideoEditorInNewTab\)/
  );
  assert.match(
    main,
    /triggerRandomEvents\("newTabLink", \{[\s\S]*?source: "video-editor-launcher"/
  );
  assert.match(main, /closeAppWindow\("video-editor"\)/);
  assert.match(main, /FOCUS_RETURN_WINDOW_SELECTOR[\s\S]*?data-launch-prompt-window/);
  assert.match(
    main,
    /event\.key !== "Escape"[\s\S]*?closeAppWindow\(openFocusReturnWindow\.getAttribute\("data-app-window"\)\)/
  );
  assert.match(
    main,
    /comingSoonFocusReturns\.get\(win\)[\s\S]*?focusTarget\.focus\(\{ preventScroll: true \}\)/
  );
  assert.match(
    home,
    /styles\/home\/random-events\.css\?v=bulk-system-alerts-20260811/
  );
  assert.match(
    randomEventStyles,
    /\.launch-prompt-window \.window-body[\s\S]*?min-height:\s*0/
  );
  assert.match(
    randomEventStyles,
    /\.video-editor-launch-error\s*\{[\s\S]*?color:\s*#800000/
  );
});

test("Image Tools keeps its accessible Coming soon alert unchanged", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");
  const section = windowSection(home, "image-tools");

  assert.match(section, /data-coming-soon-window/);
  assert.match(section, /data-random-viewport-position/);
  assert.match(section, /id="image-tools-coming-soon-window"/);
  assert.match(section, /role="alertdialog"/);
  assert.match(section, /aria-modal="false"/);
  assert.match(section, /aria-hidden="true"/);
  assert.match(section, />Image Tools<\/div>/);
  assert.match(section, /src="assets\/app-icons\/ico\/pcx_alt\.ico" alt=""/);
  assert.match(section, />Coming soon<\/p>/);
  assert.equal(count(section, /data-close="image-tools"/g), 2);
  assert.match(
    section,
    /data-coming-soon-ok[\s\S]*?data-close="image-tools"[\s\S]*?>OK<\/button>/
  );

  assert.equal(
    count(home, /\bdata-random-viewport-position\b/g),
    2,
    "Only the two content-tool dialogs should opt into random placement."
  );
  assert.doesNotMatch(
    windowSection(home, "admin-controls-stand-in"),
    /data-random-viewport-position/
  );
});

test("the Image Tools future-work ticket remains open", async () => {
  const ticketPaths = ["O_image-tools__20260731.md"];
  const [index, ...tickets] = await Promise.all([
    readFile(new URL("docs/notes/tickets/INDEX.md", root), "utf8"),
    ...ticketPaths.map((path) =>
      readFile(new URL(`docs/notes/tickets/${path}`, root), "utf8")
    ),
  ]);

  ticketPaths.forEach((path, indexPosition) => {
    const ticket = tickets[indexPosition];
    assert.match(ticket, new RegExp(`^# ${path.replace(".md", "")} — Open`, "m"));
    assert.match(ticket, /^Status: open$/m);
    const escapedPath = path.replaceAll(".", "\\.");
    assert.equal(
      count(index, new RegExp(`\\[${escapedPath}\\]\\(${escapedPath}\\)`, "g")),
      1,
      `${path} must have exactly one live-ticket index row.`
    );
  });

  tickets.forEach((ticket) => assert.doesNotMatch(ticket, /^## /m));
});
