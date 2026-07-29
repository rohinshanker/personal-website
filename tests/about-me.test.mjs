import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const socialLinks = [
  [
    "LinkedIn",
    "@rohin-shanker",
    "https://www.linkedin.com/in/rohin-shanker/",
    "users_green.ico",
  ],
  ["Instagram", "@rrohinss", "https://www.instagram.com/rohin.personal", "camera.ico"],
  ["Substack", "@rohins", "https://substack.com/@rohins", "newspaper.ico"],
  [
    "Spotify",
    "@rohin",
    "https://open.spotify.com/user/rohindaman?si=ee2c1491d5eb48fe",
    "keyboard_musical_midi.ico",
  ],
  ["GitHub", "@rohinshanker", "https://github.com/rohinshanker", "gears.ico"],
];

const aboutCarouselItems = [
  [
    "assets/about-carousel/1.jpg",
    "Portrait of Rohin Shanker in front of red rock formations",
  ],
  [
    "assets/about-carousel/2.jpg",
    "Rohin Shanker seated for the Fast Sonder Lookbook Shoot 2",
  ],
  ["assets/about-carousel/3.jpg", "Rohin Shanker making a pie with a friend"],
  [
    "assets/about-carousel/4.jpg",
    "Rohin Shanker walking in the Club Rambutan runway show",
  ],
  [
    "assets/about-carousel/5.jpg",
    "Rohin Shanker celebrating graduation with friends at UC Berkeley",
  ],
  [
    "assets/about-carousel/6.jpg",
    "Rohin Shanker backstage at the Garb Sub-urban runway show",
  ],
  [
    "assets/about-carousel/7.jpg",
    "Rohin Shanker with a friend at a music festival",
  ],
  [
    "assets/about-carousel/8.jpg",
    "Rohin Shanker resting beside climbing pads",
  ],
  [
    "assets/about-carousel/9.jpg",
    "Rohin Shanker modeling in the Garb Means Business shoot",
  ],
];

test("About Me provides the requested page structure and dated article", async () => {
  const html = await readFile(new URL("home.html", root), "utf8");
  const aboutStart = html.indexOf('id="about-window"');
  const aboutEnd = html.indexOf('\n      <div class="window app-window is-hidden portfolio-window"', aboutStart);
  assert.notEqual(aboutStart, -1, "The About Me window must exist");
  assert.notEqual(aboutEnd, -1, "The About Me window must remain independently bounded");
  const about = html.slice(aboutStart, aboutEnd);

  assert.match(about, /role="dialog"/);
  assert.match(about, /aria-modal="false"/);
  assert.match(about, /aria-labelledby="about-window-title"/);
  assert.match(about, /<h2 class="about-title">Welcome to my Website!<\/h2>/);
  assert.match(about, /<time class="about-date" id="about-current-date"><\/time>/);
  assert.match(about, /class="window-body about-body" tabindex="0"/);
  assert.match(about, /<h3 id="about-website-heading">About this Website<\/h3>/);
  const websiteSectionStart = about.indexOf('class="about-website-section"');
  const websiteSectionEnd = about.indexOf("</section>", websiteSectionStart);
  const websiteSection = about.slice(websiteSectionStart, websiteSectionEnd);
  assert.equal(
    websiteSection.match(/<p>/g)?.length,
    1,
    "About this Website must contain one paragraph"
  );
  assert.match(
    websiteSection,
    /Welcome to my personal website! I wanted to make something unique &amp; playful[\s\S]*?that would give me a reason to come back to often \(and hopefully you too!\) while[\s\S]*?also keeping record of a few things I’m proud of in one place\. Enjoy your stay :\)[\s\S]*?<br \/>[\s\S]*?—Rohin/
  );
  assert.equal(
    about.match(/class="about-degree-card"/g)?.length,
    4,
    "Berkeley and Yale must expose three plus one degrees"
  );
  const yaleHeading = about.indexOf("Yale University (2026-2027)");
  const berkeleyHeading = about.indexOf(
    "University of California, Berkeley (2022-2026)"
  );
  assert.ok(yaleHeading > -1, "Yale must include its requested years");
  assert.ok(berkeleyHeading > yaleHeading, "Yale must appear before Berkeley");
  for (const [fullLabel, shortLabel, field] of [
    ["Master of Science", "M.S.", "Biomedical Engineering"],
    [
      "Bachelor of Science",
      "B.S.",
      "Electrical Engineering &amp; Computer Science (EECS)",
    ],
    ["Bachelor of Science", "B.S.", "Bioengineering"],
    ["Certificate", "Cert.", "Entrepreneurship &amp; Technology (SCET)"],
  ]) {
    assert.match(
      about,
      new RegExp(
        `class="about-degree-type"[\\s\\S]*?data-full-label="${fullLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?data-short-label="${shortLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?class="about-degree-field"[\\s\\S]*?aria-label="${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`
      )
    );
  }
  const berkeleySectionEnd = about.indexOf("</section>", berkeleyHeading);
  const berkeleySection = about.slice(berkeleyHeading, berkeleySectionEnd);
  assert.deepEqual(
    [...berkeleySection.matchAll(/class="about-degree-field"[\s\S]*?aria-label="([^"]+)"/g)].map(
      ([, label]) => label
    ),
    [
      "Electrical Engineering &amp; Computer Science (EECS)",
      "Bioengineering",
      "Entrepreneurship &amp; Technology (SCET)",
    ],
    "Berkeley degrees must place EECS before Bioengineering"
  );
  assert.match(about, /aria-label="Academic degrees"/);
  assert.equal(
    about.match(/data-about-degree-field/g)?.length,
    4,
    "Every degree field must support measured overflow behavior"
  );
  assert.equal(about.match(/class="about-degree-field-track"/g)?.length, 4);
  assert.doesNotMatch(about, /about-degree-title/);
  assert.deepEqual(
    [...about.matchAll(/<li class="about-degree-card">\s*<img src="([^"]+)" alt=""/g)].map(
      ([, source]) => source
    ),
    [
      "assets/app-icons/ico/certificate_gear.ico",
      "assets/app-icons/ico/certificate.ico",
      "assets/app-icons/ico/certificate.ico",
      "assets/app-icons/ico/certificate_seal.ico",
    ],
    "Degree types must use their requested certificate icon variants"
  );
  assert.match(about, /<h3 id="about-article-heading">About Me<\/h3>/);
  assert.match(about, /<option value="30-07-2026">30\/07\/2026<\/option>/);
  assert.equal(
    about.match(/<article class="about-article-copy"[\s\S]*?<\/article>/)?.[0].match(/<p(?:>|\s)/g)
      ?.length,
    8,
    "The dated article must retain all seven prose paragraphs and its quoted paragraph"
  );
  assert.match(about, /My name is Rohin! I am a creative and aspiring polymath/);
  assert.match(about, /doesn’t really make me <em>me<\/em>/);
  assert.match(about, /class="about-article-quote"/);
  assert.match(
    about,
    /<strong[\s\S]*?>When a tree is growing, it’s tender and pliant\.[\s\S]*?never win\.<\/strong/
  );
  assert.match(about, /class="about-article-quote-source">—Andrei Tarkovsky<\/footer>/);
  assert.match(about, /more importantly <em>you<\/em> should take charge/);
  assert.match(about, /<p>Yours Truly,<\/p>\s*<p>Rohin Shanker<\/p>/);
  assert.match(
    about,
    /class="about-signature"[\s\S]*?src="assets\/about-signature\.png"[\s\S]*?width="1404"[\s\S]*?height="648"[\s\S]*?alt="Rohin S\. Shanker handwritten signature"/
  );
  assert.match(
    about,
    /class="about-social-link about-social-launcher"[\s\S]*?type="button"[\s\S]*?data-app="socials"[\s\S]*?aria-controls="socials-window"[\s\S]*?aria-haspopup="dialog"[\s\S]*?connected_world\.ico[\s\S]*?<span class="socials-name">Socials<\/span>[\s\S]*?<span class="socials-username">See All<\/span>/
  );
  assert.match(
    html,
    /id="socials-window"[\s\S]*?data-app-window="socials"[\s\S]*?role="dialog"[\s\S]*?aria-modal="false"[\s\S]*?aria-labelledby="socials-window-title"[\s\S]*?id="socials-window-title">Socials<\/div>/
  );
  assert.doesNotMatch(about, /Coming soon\./);
});

test("About Me links every requested social profile with safe external navigation", async () => {
  const html = await readFile(new URL("home.html", root), "utf8");

  for (const [label, username, href, icon] of socialLinks) {
    const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      html,
      new RegExp(
        `class="about-social-link"[\\s\\S]*?href="${escapedHref}"[\\s\\S]*?target="_blank"[\\s\\S]*?rel="noopener noreferrer"[\\s\\S]*?${icon.replace(".", "\\.")}[\\s\\S]*?<span class="socials-name">${label}<\\/span>[\\s\\S]*?<span class="socials-username">${username}<\\/span>`
      )
    );
  }

  await Promise.all(
    [
      ...aboutCarouselItems.map(([asset]) => asset),
      "assets/app-icons/ico/certificate.ico",
      "assets/app-icons/ico/certificate_seal.ico",
      "assets/app-icons/ico/certificate_gear.ico",
      "assets/app-icons/ico/users_green.ico",
      "assets/app-icons/ico/camera.ico",
      "assets/app-icons/ico/newspaper.ico",
      "assets/app-icons/ico/keyboard_musical_midi.ico",
      "assets/app-icons/ico/gears.ico",
      "assets/app-icons/ico/connected_world.ico",
      "assets/about-signature.png",
    ].map((asset) => access(new URL(asset, root)))
  );
});

test("About carousel assets stay optimized for sequential preloading", async () => {
  const assetStats = await Promise.all(
    aboutCarouselItems.map(([asset]) => stat(new URL(asset, root)))
  );
  const totalBytes = assetStats.reduce((total, asset) => total + asset.size, 0);

  assert.ok(
    assetStats.every((asset) => asset.size <= 250 * 1024),
    "Every carousel image must remain at or below 250 KiB"
  );
  assert.ok(totalBytes <= 1.5 * 1024 * 1024, "The nine-image carousel must stay below 1.5 MiB");
});

test("About Me date, degree marquee, and carousel stay data driven", async () => {
  const [html, dom, source] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
  ]);

  const dateStart = source.indexOf("const aboutDateOrdinalSuffix =");
  const dateEnd = source.indexOf("\n\nconst updateAboutCurrentDate", dateStart);
  assert.notEqual(dateStart, -1, "About date helpers must exist");
  assert.notEqual(dateEnd, -1, "About date helpers must remain bounded");
  const context = vm.createContext({ Date });
  vm.runInContext(
    `${source.slice(dateStart, dateEnd)}\n` +
      "globalThis.aboutDate = { label: aboutDateLabel, value: aboutDateValue };",
    context
  );

  assert.equal(
    context.aboutDate.label(new Date(2026, 6, 27, 12)),
    "Monday the 27th, July 2026"
  );
  assert.equal(context.aboutDate.label(new Date(2026, 7, 1, 12)), "Saturday the 1st, August 2026");
  assert.equal(context.aboutDate.label(new Date(2026, 7, 2, 12)), "Sunday the 2nd, August 2026");
  assert.equal(context.aboutDate.label(new Date(2026, 7, 3, 12)), "Monday the 3rd, August 2026");
  assert.equal(context.aboutDate.label(new Date(2026, 7, 11, 12)), "Tuesday the 11th, August 2026");
  assert.equal(context.aboutDate.label(new Date(2026, 7, 12, 12)), "Wednesday the 12th, August 2026");
  assert.equal(context.aboutDate.label(new Date(2026, 7, 13, 12)), "Thursday the 13th, August 2026");
  assert.equal(context.aboutDate.value(new Date(2026, 6, 7, 12)), "2026-07-07");

  assert.match(source, /updateAboutCurrentDate\(now\);/);
  assert.match(source, /const ABOUT_DEGREE_DWELL_MS = 1000;/);
  assert.match(source, /const ABOUT_DEGREE_SCROLL_SPEED_PX_PER_SECOND = 30;/);
  assert.match(source, /const updateAboutDegreeTypeLabel = \(type\) =>/);
  assert.match(source, /type\.scrollWidth > type\.clientWidth \+ 1/);
  assert.match(source, /const updateAboutDegreeField = \(field\) =>/);
  assert.match(source, /field\.classList\.add\("is-overflowing"\);/);
  assert.match(source, /aboutDegreeReducedMotion\.matches/);
  assert.match(source, /const duration = 2 \* \(ABOUT_DEGREE_DWELL_MS \+ travelMs\);/);
  assert.match(source, /track\.animate\(/);
  assert.match(source, /iterations: Infinity/);
  assert.match(
    source,
    /field\.addEventListener\("mouseenter", \(\) => aboutDegreeAnimations\.get\(field\)\?\.pause\(\)\);/
  );
  assert.match(
    source,
    /field\.addEventListener\("mouseleave", \(\) => aboutDegreeAnimations\.get\(field\)\?\.play\(\)\);/
  );
  assert.match(source, /new ResizeObserver\(queueAboutDegreeRefresh\)/);
  assert.match(source, /document\.fonts\?\.ready\.then\(queueAboutDegreeRefresh\);/);
  const carouselStart = source.indexOf("const ABOUT_CAROUSEL_ITEMS = Object.freeze([");
  const carouselEnd = source.indexOf("\n]);\nlet aboutCarouselIndex", carouselStart);
  assert.notEqual(carouselStart, -1, "About carousel data must exist");
  assert.notEqual(carouselEnd, -1, "About carousel data must remain independently bounded");
  const carouselSource = source.slice(carouselStart, carouselEnd);
  assert.equal(
    carouselSource.match(/Object\.freeze\(\{/g)?.length,
    aboutCarouselItems.length,
    "The carousel must contain all nine requested photos"
  );
  let previousSourceIndex = -1;
  for (const [asset, alt] of aboutCarouselItems) {
    const sourceIndex = carouselSource.indexOf(`src: "${asset}"`);
    const altIndex = carouselSource.indexOf(`alt: "${alt}"`, sourceIndex);
    assert.ok(sourceIndex > previousSourceIndex, `${asset} must be in the requested position`);
    assert.ok(altIndex > sourceIndex, `${asset} must have descriptive alternative text`);
    previousSourceIndex = sourceIndex;
  }
  assert.match(source, /const navigationDisabled = ABOUT_CAROUSEL_ITEMS\.length < 2;/);
  assert.match(source, /bindGalleryNavigation\(\n  aboutCarouselPrev,[\s\S]*?updateAboutCarousel\n\);/);
  assert.doesNotMatch(html, /id="about-carousel-prev" disabled/);
  assert.doesNotMatch(html, /id="about-carousel-next" disabled/);
  assert.match(html, /id="about-carousel-counter" aria-live="polite">\s*1 of 9/);

  for (const binding of [
    "aboutCurrentDate",
    "aboutCarouselImage",
    "aboutCarouselPrev",
    "aboutCarouselCounter",
    "aboutCarouselNext",
  ]) {
    assert.match(dom, new RegExp(`${binding}:`));
    assert.match(source, new RegExp(`\\b${binding}\\b`));
  }
});

test("About Me layout is bounded, responsive, and visibly interactive", async () => {
  const css = await readFile(new URL("styles/home/portfolio.css", root), "utf8");

  assert.match(
    css,
    /#about-window \{[\s\S]*?max-height: calc\(100vh - 76px\);[\s\S]*?width: min\(calc\(100vw - 24px\), 720px\);/
  );
  assert.match(
    css,
    /\.about-intro-grid \{[\s\S]*?grid-template-columns: 332px minmax\(0, 1fr\);/
  );
  assert.match(
    css,
    /#about-window \.about-body \{[\s\S]*?height: min\(79vh, 750px\);[\s\S]*?max-height: calc\(100vh - 116px\);[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;/
  );
  assert.match(
    css,
    /\.about-page \{[\s\S]*?padding: 2px;[\s\S]*?padding-inline-end: 10px;/
  );
  assert.match(
    css,
    /\.about-intro-grid \{[\s\S]*?align-items: start;[\s\S]*?grid-template-columns: 332px minmax\(0, 1fr\);/
  );
  assert.match(
    css,
    /\.about-carousel-section \{[\s\S]*?align-self: start;[\s\S]*?width: min\(100%, 350px\);/
  );
  assert.match(css, /#about-window \.about-carousel \{\n  margin: 0;\n\}/);
  assert.match(
    css,
    /#about-window \.about-carousel-media \{[\s\S]*?aspect-ratio: 720 \/ 669;[\s\S]*?height: auto;[\s\S]*?max-height: none;[\s\S]*?overflow: hidden;/
  );
  assert.doesNotMatch(css, /#about-window \.about-carousel-media \{[^}]*padding:/);
  assert.match(
    css,
    /\.gallery-scroll \{[\s\S]*?--gallery-content-inset: 2px;[\s\S]*?padding: var\(--gallery-content-inset\);/
  );
  assert.match(
    css,
    /#about-window \.about-carousel-media \.about-photo \{[\s\S]*?height: 100%;[\s\S]*?max-height: 100%;[\s\S]*?max-width: 100%;[\s\S]*?object-fit: contain;[\s\S]*?object-position: center;[\s\S]*?width: 100%;/
  );
  assert.match(
    css,
    /\.about-overview-panel \{[\s\S]*?align-self: start;[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);[\s\S]*?overflow: hidden;/
  );
  assert.match(
    css,
    /\.about-degrees-list \{[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;/
  );
  assert.match(
    css,
    /\.about-degree-card \{[\s\S]*?column-gap: 4px;[\s\S]*?grid-template-columns: 32px minmax\(0, 1fr\);[\s\S]*?min-height: 48px;[\s\S]*?padding: 4px 4px 4px 6px;/
  );
  assert.match(
    css,
    /\.about-degree-card img \{[\s\S]*?height: 32px;[\s\S]*?width: 32px;/
  );
  assert.match(
    css,
    /\.about-degree-copy \{[\s\S]*?display: grid;[\s\S]*?gap: 0;[\s\S]*?grid-template-rows: auto auto;[\s\S]*?line-height: 1\.2;[\s\S]*?min-width: 0;/
  );
  assert.match(css, /\.about-degree-type \{[\s\S]*?font-weight: bold;[\s\S]*?overflow: hidden;/);
  assert.match(
    css,
    /\.about-degree-field \{[\s\S]*?font-weight: normal;[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: hidden;/
  );
  assert.match(css, /\.about-degree-field-track \{[\s\S]*?width: max-content;/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.about-degree-field\.is-overflowing \{[\s\S]*?overflow-x: auto;/
  );
  assert.match(
    css,
    /\.about-social-links \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/
  );
  assert.match(
    css,
    /\.about-social-link \{[\s\S]*?justify-content: flex-start;[\s\S]*?min-height: 54px;[\s\S]*?padding: 4px 6px;[\s\S]*?text-align: left;/
  );
  assert.match(css, /\.about-social-copy \{[\s\S]*?min-width: 0;/);
  assert.match(
    css,
    /\.about-social-link:hover,\n\.about-social-link:focus-visible \{\n  background: var\(--dialog-blue\);\n  color: #fff;/
  );
  assert.match(
    css,
    /\.about-article-copy \{[\s\S]*?box-sizing: border-box;[\s\S]*?margin-inline: auto;[\s\S]*?width: 75%;/
  );
  assert.match(
    css,
    /\.about-article-quote \{[\s\S]*?border-inline-start: 4px solid var\(--dialog-blue\);[\s\S]*?box-sizing: border-box;[\s\S]*?margin: 20px 0;[\s\S]*?padding: 0;[\s\S]*?padding-inline-start: 20px;/
  );
  assert.doesNotMatch(css, /\.about-article-quote > \*/);
  assert.doesNotMatch(
    css.match(/\.about-signature-slot \{[^}]+\}/)?.[0] ?? "",
    /background|box-shadow/
  );
  assert.match(
    css,
    /\.about-signature \{[\s\S]*?display: block;[\s\S]*?height: auto;[\s\S]*?max-width: 100%;[\s\S]*?width: 100%;/
  );
  assert.match(
    css,
    /@media \(max-width: 744px\) \{[\s\S]*?\.about-article-copy \{[\s\S]*?width: 100%;[\s\S]*?\.about-intro-grid \{\n    grid-template-columns: minmax\(0, 1fr\);/
  );
});
