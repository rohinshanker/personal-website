import { readFile } from "node:fs/promises";

import { dedentScriptBody, homeScriptPath, homeScriptUrl } from "../../helpers/home-scripts.mjs";
import { servedFile } from "./rendered-site.mjs";

/**
 * Serves one Home script with a transform applied, so a browser test can
 * install a bridge or neutralise a production debug event without touching the
 * repository. Each fixture names the script that owns what it instruments, so
 * moving a feature changes the key here rather than silently serving a script
 * that no longer contains the code the fixture was written for. The script is
 * served with its file-level IIFE body dedented to column 0, the same text the
 * unit readers see, so a fixture's markers survive the formatter's indentation.
 */
export async function routeHomeScript(page, key, transform) {
  const source = dedentScriptBody(await readFile(homeScriptUrl(key), "utf8"));
  const routed = transform(source);
  if (routed === source) {
    throw new Error(
      `The browser fixture did not transform ${homeScriptPath(key)}; the code it instruments has moved.`,
    );
  }
  await page.route(servedFile(homeScriptPath(key)), (route) =>
    route.fulfill({ contentType: "application/javascript", body: routed }),
  );
  return routed;
}

/**
 * Replaces exactly one occurrence of `marker` in `source`, failing loudly when the marker is
 * missing or ambiguous. A fixture that composes several replacements must use this for each
 * one: a plain `String.replace` with a stale marker changes nothing and is only noticed when
 * the test later reaches for the hook it never installed.
 */
export function replaceOnce(source, marker, replacement) {
  const first = source.indexOf(marker);
  if (first === -1) throw new Error(`Fixture marker not found: ${JSON.stringify(marker)}`);
  if (source.indexOf(marker, first + marker.length) !== -1) {
    throw new Error(`Fixture marker is not unique: ${JSON.stringify(marker)}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + marker.length);
}

/** Source text of one Home script, for a fixture that needs it unmodified. */
export function readHomeScriptSource(key) {
  return readFile(homeScriptUrl(key), "utf8");
}
