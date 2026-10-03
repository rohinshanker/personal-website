import { readFile } from "node:fs/promises";

import { homeScriptPath, homeScriptUrl } from "../../helpers/home-scripts.mjs";

/**
 * Serves one Home script with a transform applied, so a browser test can
 * install a bridge or neutralise a production debug event without touching the
 * repository. Each fixture names the script that owns what it instruments, so
 * moving a feature changes the key here rather than silently serving a script
 * that no longer contains the code the fixture was written for.
 */
export async function routeHomeScript(page, key, transform) {
  const source = await readFile(homeScriptUrl(key), "utf8");
  const routed = transform(source);
  if (routed === source) {
    throw new Error(
      `The browser fixture did not transform ${homeScriptPath(key)}; the code it instruments has moved.`
    );
  }
  const path = homeScriptPath(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(new RegExp(`/${path}(?:\\?.*)?$`), (route) =>
    route.fulfill({ contentType: "application/javascript", body: routed })
  );
  return routed;
}

/** Source text of one Home script, for a fixture that needs it unmodified. */
export function readHomeScriptSource(key) {
  return readFile(homeScriptUrl(key), "utf8");
}
