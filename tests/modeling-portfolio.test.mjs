import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const DATA_VERSION = "modeling-portfolio-highlights-20260921";
const ROUTE_VERSION = "modeling-portfolio-download-20260916";

const isFile = async (path) => {
  try {
    return (await stat(new URL(path, root))).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

/** Evaluates the shared data script the same way a browser would. */
const loadPortfolio = async () => {
  const context = { window: {} };
  vm.runInNewContext(await read("scripts/home/modeling-portfolio.js"), context);
  // Values born in the sandbox realm carry its prototypes; a JSON round trip
  // makes them plain objects that deep-equal comparisons accept.
  return JSON.parse(JSON.stringify(context.window.rohinModelingPortfolio));
};

const decodeEntities = (value) =>
  value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'");

/** The Home Modeling window's selector rows, in document order. */
const homeSelectorRows = (home) =>
  Array.from(
    home.matchAll(
      /data-view="(modeling-[^"]+)">\s*<img class="selector-thumb" data-src="([^"]+)" alt="" \/>\s*<span>\s*<span class="selector-title">([^<]+)<\/span>\s*<span class="selector-desc">([^<]+)<\/span>/g
    ),
    ([, id, icon, title, date]) => ({ id, icon, title: decodeEntities(title), date })
  );

/** The Home Modeling viewer panels keyed by view id. */
const homeViewerPanels = (home) => {
  const modelingWindow = home.slice(
    home.indexOf('data-app-window="modeling"'),
    home.indexOf('data-app-window="mec-pdf"')
  );
  const panels = {};
  for (const [, id, body] of modelingWindow.matchAll(
    /<div class="viewer-content(?: is-hidden)?" data-view="(modeling-[^"]+)">([\s\S]*?)<\/div>\s*(?=<div class="viewer-content|<\/div>)/g
  )) {
    panels[id] = {
      heading: decodeEntities(body.match(/<h3>([^<]+)<\/h3>/)?.[1] ?? ""),
      date: body.match(/<p class="project-view-subtitle">([^<]+)<\/p>/)?.[1] ?? "",
      credits: Array.from(body.matchAll(/<p>([^<]+)<\/p>/g), ([, line]) => decodeEntities(line)),
    };
  }
  return panels;
};

test("the shared modeling data is complete and every referenced file exists", async () => {
  const portfolio = await loadPortfolio();

  assert.equal(portfolio.title, "Rohin Shanker Modeling Portfolio");
  assert.equal(portfolio.instagram.handle, "@rrohinss");
  assert.equal(portfolio.instagram.href, "https://www.instagram.com/rrohinss/");
  assert.deepEqual(Object.keys(portfolio.dropbox).sort(), ["digitals", "highlights"]);
  for (const href of Object.values(portfolio.dropbox)) {
    assert.match(href, /^(?:https:\/\/\S+)?$/, "Dropbox links are empty or https URLs");
  }
  for (const icon of Object.values(portfolio.linkIcons)) {
    assert.ok(await isFile(icon), `${icon} must exist`);
  }

  assert.equal(portfolio.shoots.length, 20);
  const ids = portfolio.shoots.map((shoot) => shoot.id);
  assert.equal(new Set(ids).size, ids.length, "shoot ids are unique");
  for (const shoot of portfolio.shoots) {
    assert.match(shoot.id, /^modeling-[a-z0-9-]+$/);
    assert.ok(shoot.title.trim().length, `${shoot.id} needs a title`);
    assert.match(shoot.date, /^[A-Z][a-z]+ \d{4}$/, `${shoot.id} date reads "Month YYYY"`);
    assert.ok(await isFile(shoot.icon), `${shoot.id} icon ${shoot.icon} must exist`);
    assert.ok(shoot.files.length > 0, `${shoot.id} lists at least one file`);
    for (const filename of shoot.files) {
      assert.ok(await isFile(`${shoot.folder}/${filename}`), `${shoot.folder}/${filename} must exist`);
    }
    assert.equal(new Set(shoot.files).size, shoot.files.length, `${shoot.id} files are unique`);
    for (const link of shoot.links) {
      assert.match(link.href, /^https:\/\//, `${shoot.id} link ${link.label} uses https`);
      assert.ok(link.label.trim().length, `${shoot.id} links carry labels`);
      assert.ok(link.type in portfolio.linkIcons, `${shoot.id} link type ${link.type} has an icon`);
    }
    for (const line of shoot.credits) {
      assert.ok(line.trim().length, `${shoot.id} credits have no blank lines`);
    }
  }
  assert.equal(portfolio.shoots.filter((shoot) => shoot.autoplay).length, 1);
  assert.equal(portfolio.shoots[0].id, "modeling-stand-still-drop");
});

test("the Home Modeling window matches the shared data in order, titles, dates, and credits", async () => {
  const [portfolio, home] = await Promise.all([loadPortfolio(), read("home.html")]);
  const rows = homeSelectorRows(home);
  const panels = homeViewerPanels(home);

  assert.deepEqual(
    rows.map((row) => row.id),
    portfolio.shoots.map((shoot) => shoot.id),
    "selector order matches the shared order"
  );
  for (const shoot of portfolio.shoots) {
    const row = rows.find((candidate) => candidate.id === shoot.id);
    assert.equal(row.title, shoot.title, `${shoot.id} selector title`);
    assert.equal(row.date, shoot.date, `${shoot.id} selector date`);
    assert.equal(row.icon, shoot.icon, `${shoot.id} selector icon`);
    const panel = panels[shoot.id];
    assert.ok(panel, `${shoot.id} has a viewer panel`);
    assert.equal(panel.heading, shoot.title, `${shoot.id} viewer heading`);
    assert.equal(panel.date, shoot.date, `${shoot.id} viewer date`);
    assert.deepEqual(panel.credits, shoot.credits, `${shoot.id} viewer credits`);
  }
});

test("Home derives its modeling galleries from the shared data instead of duplicating it", async () => {
  const [home, main] = await Promise.all([read("home.html"), read("scripts/home/main.js")]);

  const dataTag = `scripts/home/modeling-portfolio.js?v=${DATA_VERSION}`;
  assert.ok(home.includes(`<script src="${dataTag}"></script>`), "Home loads the shared data");
  assert.ok(
    home.indexOf(dataTag) < home.indexOf("scripts/home/main.js?v="),
    "the shared data loads before main.js"
  );
  assert.match(main, /const modelingPortfolio = window\.rohinModelingPortfolio/);
  assert.match(main, /const modelingLinkIconPaths = modelingPortfolio\.linkIcons/);
  assert.match(main, /modelingPortfolio\.shoots\.map\(\(shoot\) => \[shoot\.id, shoot\.links\]\)/);
  assert.match(main, /media: shoot\.files\.map\(\(filename\) => `\$\{shoot\.folder\}\/\$\{filename\}`\)/);
  assert.doesNotMatch(main, /const modelingBrandLinks/);
  assert.doesNotMatch(main, /assets\/modeling\/[a-z0-9-]+"\s*,\s*\[/);
});

test("Home shows the Modeling launch prompt every time the Modeling window opens", async () => {
  const [home, main] = await Promise.all([read("home.html"), read("scripts/home/main.js")]);
  const start = home.indexOf('data-app-window="modeling-launch"');
  assert.notEqual(start, -1, "the prompt window exists");
  const section = home.slice(start, home.indexOf('data-app-window="', start + 1));

  assert.match(section, /data-launch-prompt-window/);
  assert.doesNotMatch(section, /data-random-viewport-position/);
  assert.match(section, /id="modeling-launch-window"/);
  assert.match(section, /role="alertdialog"/);
  assert.match(section, /aria-modal="false"/);
  assert.match(section, /aria-hidden="true"/);
  assert.match(section, /aria-labelledby="modeling-launch-title"/);
  assert.match(section, /aria-describedby="modeling-launch-message"/);
  assert.match(section, /id="modeling-launch-title">Modeling<\/div>/);
  assert.match(section, /src="assets\/app-icons\/ico\/accessibility_window_objs\.ico" alt=""/);
  assert.match(
    section,
    /id="modeling-launch-message">Open in separate tab \(rohin\.shanker\.me\/modeling\)\?<\/p>/
  );
  assert.match(
    section,
    /id="modeling-launch-error"[\s\S]*?data-launch-prompt-error[\s\S]*?role="alert"[\s\S]*?aria-live="assertive"[\s\S]*?hidden/
  );
  assert.match(
    section,
    /id="modeling-launch-yes"[\s\S]*?data-launch-prompt-open[\s\S]*?data-dialog-initial-focus[\s\S]*?>Yes<\/button>/
  );
  assert.match(section, /id="modeling-launch-no"[\s\S]*?data-close="modeling-launch"[\s\S]*?>No<\/button>/);
  assert.equal(section.match(/data-close="modeling-launch"/g).length, 2);
  assert.match(home, /class="desktop-icon" data-app="modeling"/);
  assert.match(home, /class="taskbar-icon" data-app="modeling"/);

  assert.match(main, /const MODELING_PORTFOLIO_PATH = "\/modeling\/"/);
  assert.match(main, /const MODELING_LAUNCH_APP_ID = "modeling-launch"/);
  assert.match(
    main,
    /\[MODELING_LAUNCH_APP_ID\]: Object\.freeze\(\{\s*path: MODELING_PORTFOLIO_PATH,\s*source: "modeling-launcher",\s*\}\)/
  );
  assert.match(main, /const openModelingLaunchPrompt = \(\) => \{[\s\S]*?setWindowOpen\(MODELING_LAUNCH_APP_ID, true\)/);
  assert.match(
    main,
    /restartWindowAnimation\(win, "is-opening"\);[\s\S]*?if \(appId === "modeling"\) openModelingLaunchPrompt\(\);\s*return;/
  );
});

test("the /modeling/ route publishes its metadata, shared assets, and blank Dropbox slots", async () => {
  const [html, css, script] = await Promise.all([
    read("modeling/index.html"),
    read("modeling/style.css"),
    read("modeling/script.js"),
  ]);

  assert.match(html, /<html\b[^>]*\blang="en"/);
  assert.match(html, /<meta\b[^>]*\bname="viewport"[^>]*content="width=device-width, initial-scale=1, viewport-fit=cover"/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale/);
  assert.match(html, /<title>Modeling Portfolio \| Rohin Shanker<\/title>/);
  assert.match(html, /<meta\b[^>]*\bname="description"[^>]*content="[^"]*modeling portfolio[^"]*"/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/rohin\.shanker\.me\/modeling\/" \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/rohin\.shanker\.me\/modeling\/" \/>/);
  assert.match(html, /<meta property="og:title" content="Rohin Shanker Modeling Portfolio" \/>/);
  assert.match(html, /<link rel="icon" href="\/assets\/favicon-96\.png" type="image\/png" sizes="96x96" \/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/apple-touch-icon-180\.png" sizes="180x180" \/>/);
  assert.match(html, /href="\.\.\/style\.css\?v=first-win-stats-handoff-20260722"/);
  assert.match(html, new RegExp(`href="style\\.css\\?v=${ROUTE_VERSION}"`));
  assert.match(html, new RegExp(`src="\\.\\./scripts/home/modeling-portfolio\\.js\\?v=${DATA_VERSION}"`));
  assert.match(html, new RegExp(`<script src="script\\.js\\?v=${ROUTE_VERSION}" defer></script>`));
  assert.ok(
    html.indexOf("modeling-portfolio.js") < html.indexOf(`script.js?v=${ROUTE_VERSION}`),
    "the shared data loads before the route script"
  );
  assert.match(
    html,
    /Tap or click any photo to view it fullscreen\. Press the download button to download the\s+current image from the carousel\./
  );
  assert.doesNotMatch(html, /newest first/);

  assert.match(html, /<h1 class="portfolio-title" id="portfolio-title">Rohin Shanker Modeling Portfolio<\/h1>/);
  assert.match(html, /data-portfolio-instagram[\s\S]*?href="https:\/\/www\.instagram\.com\/rrohinss\/"[\s\S]*?target="_blank"[\s\S]*?rel="noreferrer"/);
  assert.match(html, /data-portfolio-instagram-handle>@rrohinss</);
  for (const slot of ["highlights", "digitals"]) {
    assert.match(
      html,
      new RegExp(
        `data-portfolio-dropbox="${slot}"[\\s\\S]*?<button[\\s\\S]*?aria-describedby="portfolio-${slot}-note"[\\s\\S]*?disabled[\\s\\S]*?id="portfolio-${slot}-note">Link coming soon</small>`
      ),
      `${slot} renders as a disabled button with a note`
    );
  }
  assert.match(html, />Highlights<\/strong>/);
  assert.match(html, />Digitals<\/strong>/);
  assert.match(html, /<nav class="portfolio-nav" aria-label="Shoots">/);
  assert.match(html, /<main class="portfolio-shoots" id="shoots" data-portfolio-shoots aria-label="Shoots">/);
  assert.match(html, /<noscript>/);
  assert.match(html, /href="\/">Back to Rohin OS<\/a>/);
  assert.doesNotMatch(html, /\bdesktop-icon\b|\btaskbar\b/);

  assert.match(css, /--portfolio-wallpaper: url\("\.\.\/assets\/optimized\/background-2200\.jpg"\)/);
  assert.match(css, /html\.is-lightbox-open body\.modeling-page \{[\s\S]*?position: fixed/);
  assert.match(css, /\.carousel__strip \{[\s\S]*?scroll-snap-type: x mandatory/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*?"gallery date"/);
  assert.doesNotMatch(css, /!important/);

  assert.match(script, /assets\/app-icons\/ico\/download\.ico/);
  assert.match(script, /link\.setAttribute\("download", downloadName\(shoot, item, index, media\.length\)\)/);
  assert.match(script, /fullscreen\.textContent = "Expand"/);
  assert.match(css, /\.carousel__download,\s*\.lightbox__download \{/);
  assert.match(css, /button\[aria-label\]\.close \{[\s\S]*?background-size: contain/);
  assert.match(script, /windows98-hourglass-2x\.gif/);
  assert.match(script, /windows98-hourglass-padded-2x\.gif/);
  assert.match(script, /new IntersectionObserver\(/);
  assert.match(script, /rootMargin: "0px 50% 0px 50%"/);
  assert.match(script, /classList\.add\("is-lightbox-open"\)/);
  assert.match(script, /window\.scrollTo\(0, lockedScrollY\)/);
  assert.match(script, /setAttribute\("inert", ""\)/);
  assert.doesNotMatch(script, /history\.(?:pushState|replaceState)|location\.(?:hash|href) =/);
  assert.doesNotMatch(script, /\b(?:TODO|FIXME)\b/);
});

test("the release packages the /modeling/ route and the sitemap lists it once", async () => {
  const [workflow, sitemap] = await Promise.all([
    read(".github/workflows/game-stats-worker-release.yml"),
    read("sitemap.xml"),
  ]);

  assert.match(workflow, /cp -R assets styles video-editor modeling "\$RUNNER_TEMP\/personal-site\/"/);
  assert.equal(sitemap.match(/<loc>https:\/\/rohin\.shanker\.me\/modeling\/<\/loc>/g)?.length, 1);
});
