import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT_URL = new URL("../", import.meta.url);
const DATA_URL = new URL("scripts/home/modeling-portfolio.js", ROOT_URL);
const HOME_URL = new URL("home.html", ROOT_URL);
const COMMAND = "node scripts/build-modeling-markup.mjs";

/** Generated Home regions, each bounded by a start and an end comment on their own lines. */
export const MODELING_REGIONS = Object.freeze({
  selector: "modeling selector rows",
  viewer: "modeling viewer panels",
});

const startMarker = (region) => `<!-- BEGIN generated ${region}: ${COMMAND} -->`;
const endMarker = (region) => `<!-- END generated ${region} -->`;

const escapeText = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (value) => escapeText(value).replace(/"/g, "&quot;");

/** Evaluates the browser data script and returns its portfolio as plain objects. */
export const loadModelingPortfolio = (source) => {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  // Sandbox values carry another realm's prototypes; JSON makes them plain data.
  return JSON.parse(JSON.stringify(context.window.rohinModelingPortfolio));
};

/** Returns the shoots Home lists, validating the fields its markup needs. */
export const publishedShoots = (portfolio) => {
  const seen = new Set();
  const published = portfolio.shoots.filter((shoot, index) => {
    const name = shoot.id || `shoot ${index + 1}`;
    if (!Array.isArray(shoot.files)) throw new Error(`${name} needs a files list.`);
    if (!shoot.files.length) return false;
    for (const field of ["id", "title", "date", "icon"]) {
      if (typeof shoot[field] !== "string" || !shoot[field].trim()) {
        throw new Error(`${name} is published but has no ${field}.`);
      }
    }
    if (seen.has(shoot.id)) throw new Error(`Duplicate shoot id ${shoot.id}.`);
    seen.add(shoot.id);
    return true;
  });
  if (!published.length) throw new Error("No published modeling shoots to render.");
  return published;
};

const selectorRow = (shoot, index) => [
  "<li>",
  `  <button class="selector-item${index ? "" : " is-active"}" type="button" data-view="${escapeAttribute(shoot.id)}">`,
  `    <img class="selector-thumb" data-src="${escapeAttribute(shoot.icon)}" alt="" />`,
  "    <span>",
  `      <span class="selector-title">${escapeText(shoot.title)}</span>`,
  `      <span class="selector-desc">${escapeText(shoot.date)}</span>`,
  "    </span>",
  "  </button>",
  "</li>",
];

const viewerPanel = (shoot, index) => {
  const id = escapeAttribute(shoot.id);
  return [
    `<div class="viewer-content${index ? " is-hidden" : ""}" data-view="${id}">`,
    `  <h3>${escapeText(shoot.title)}</h3>`,
    `  <p class="project-view-subtitle">${escapeText(shoot.date)}</p>`,
    `  <div data-modeling-links="${id}"></div>`,
    `  <div data-modeling-gallery="${id}"></div>`,
    ...(shoot.credits ?? []).map((line) => `  <p>${escapeText(line)}</p>`),
    "</div>",
  ];
};

/** Renders each region's lines for the published shoots. */
export const renderModelingRegions = (portfolio) => {
  const shoots = publishedShoots(portfolio);
  return {
    selector: shoots.flatMap(selectorRow),
    viewer: shoots.flatMap(viewerPanel),
  };
};

const replaceRegion = (html, region, lines) => {
  const start = startMarker(region);
  const end = endMarker(region);
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(
      `home.html is missing the ${startIndex < 0 ? "start" : "end"} marker for ${region}.`,
    );
  }
  if (html.indexOf(start, startIndex + 1) >= 0 || html.indexOf(end, endIndex + 1) >= 0) {
    throw new Error(`home.html repeats a marker for ${region}.`);
  }
  if (endIndex < startIndex) throw new Error(`home.html ends ${region} before it starts.`);

  const lineStart = html.lastIndexOf("\n", startIndex) + 1;
  const indent = html.slice(lineStart, startIndex);
  const contentStart = startIndex + start.length + 1;
  const contentEnd = html.lastIndexOf("\n", endIndex) + 1;
  if (
    /\S/.test(indent) ||
    html[contentStart - 1] !== "\n" ||
    /\S/.test(html.slice(contentEnd, endIndex))
  ) {
    throw new Error(`home.html must keep each ${region} marker on its own line.`);
  }
  const body = lines.map((line) => `${indent}${line}\n`).join("");
  return `${html.slice(0, contentStart)}${body}${html.slice(contentEnd)}`;
};

/** Returns Home with every generated modeling region rewritten from the portfolio. */
export const renderModelingHome = (html, portfolio) => {
  const regions = renderModelingRegions(portfolio);
  return Object.entries(MODELING_REGIONS).reduce(
    (current, [key, region]) => replaceRegion(current, region, regions[key]),
    html,
  );
};

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const [source, home] = await Promise.all([
    readFile(DATA_URL, "utf8"),
    readFile(HOME_URL, "utf8"),
  ]);
  const expected = renderModelingHome(home, loadModelingPortfolio(source));

  if (home === expected) {
    process.stdout.write("Home modeling markup is current.\n");
  } else if (process.argv.includes("--check")) {
    process.stderr.write(`Home modeling markup is stale. Run: ${COMMAND}\n`);
    process.exitCode = 1;
  } else {
    await writeFile(HOME_URL, expected, "utf8");
    process.stdout.write("Updated the Home modeling markup in home.html.\n");
  }
}
