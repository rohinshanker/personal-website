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
      controls: "video-editor-coming-soon-window",
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

test("each content-tool launcher owns an accessible Coming soon alert", async () => {
  const [home, main, randomEventStyles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/random-events.css", root), "utf8"),
  ]);

  const alerts = [
    {
      appId: "video-editor",
      title: "Video Editor",
      icon: "camera3_vid.ico",
      id: "video-editor-coming-soon-window",
    },
    {
      appId: "image-tools",
      title: "Image Tools",
      icon: "pcx_alt.ico",
      id: "image-tools-coming-soon-window",
    },
  ];

  for (const alert of alerts) {
    const section = windowSection(home, alert.appId);
    assert.match(section, /data-coming-soon-window/);
    assert.match(section, /data-random-viewport-position/);
    assert.match(section, new RegExp(`id="${alert.id}"`));
    assert.match(section, /role="alertdialog"/);
    assert.match(section, /aria-modal="false"/);
    assert.match(section, /aria-hidden="true"/);
    assert.match(section, new RegExp(`>${alert.title}<\\/div>`));
    assert.match(section, new RegExp(`src="assets/app-icons/ico/${alert.icon}" alt=""`));
    assert.match(section, />Coming soon<\/p>/);
    assert.equal(
      count(section, new RegExp(`data-close="${alert.appId}"`, "g")),
      2,
      `${alert.title} must close from both the title bar and OK button.`
    );
    assert.match(section, /data-coming-soon-ok[\s\S]*?data-close="[^"]+"[\s\S]*?>OK<\/button>/);
    const okButtonTag = section.match(/<button\b[^>]*data-coming-soon-ok[^>]*>/)?.[0];
    assert.ok(okButtonTag, `${alert.title} must have an OK button.`);
    assert.doesNotMatch(
      okButtonTag,
      /\bclass=/,
      `${alert.title} must use the native 98.css button without a variant class.`
    );
  }

  assert.equal(
    count(home, /\bdata-random-viewport-position\b/g),
    2,
    "Only the two content-tool placeholders should opt into random placement."
  );
  assert.doesNotMatch(
    windowSection(home, "admin-controls-stand-in"),
    /data-random-viewport-position/
  );

  assert.match(main, /const comingSoonFocusReturns = new WeakMap\(\);/);
  assert.match(
    main,
    /\.\.\.document\.querySelectorAll\("\[data-random-viewport-position\]"\),/
  );
  assert.match(
    main,
    /if \(win\.hasAttribute\("data-random-viewport-position"\)\) \{[\s\S]*?win\.classList\.remove\("app-window--center"\);[\s\S]*?positionRandomEventWindowInViewport\(win\);[\s\S]*?\} else if \(/
  );
  assert.match(main, /win\.hasAttribute\("aria-hidden"\)[\s\S]*?win\.setAttribute\("aria-hidden", "false"\)/);
  assert.match(main, /win\.matches\("\[data-coming-soon-window\]"\)[\s\S]*?comingSoonFocusReturns\.set/);
  assert.match(main, /querySelector\("\[data-coming-soon-ok\]"\)\?\.focus/);
  assert.match(main, /event\.key !== "Escape"[\s\S]*?closeAppWindow\(openComingSoonWindow\.getAttribute\("data-app-window"\)\)/);
  assert.match(main, /comingSoonFocusReturns\.get\(win\)[\s\S]*?focusTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    home,
    /styles\/home\/random-events\.css\?v=lain-wired-chat-v2-20260806/
  );
  assert.match(
    randomEventStyles,
    /\.coming-soon-window \.window-body\s*{\s*min-height:\s*0;\s*}/
  );
});

test("the requested content-tool future-work tickets remain open", async () => {
  const ticketPaths = [
    "O_video-editor__20260731.md",
    "O_image-tools__20260731.md",
  ];
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
