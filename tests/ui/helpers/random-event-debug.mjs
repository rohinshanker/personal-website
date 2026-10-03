import { readFile } from "node:fs/promises";

import { homeScriptUrl } from "../../helpers/home-scripts.mjs";

export const PRODUCTION_PER_EVENT_DEBUG_IDS = Object.freeze([
  "neko-stream-system-alert",
]);

export const isolateProductionPerEventDebug = (
  source,
  { except = [] } = {}
) => {
  const retainedIds = new Set(except);
  retainedIds.forEach((eventId) => {
    if (!PRODUCTION_PER_EVENT_DEBUG_IDS.includes(eventId)) {
      throw new Error(`Unknown production debug event exception: ${eventId}.`);
    }
  });
  return PRODUCTION_PER_EVENT_DEBUG_IDS.reduce((isolatedSource, eventId) => {
    if (retainedIds.has(eventId)) return isolatedSource;
    const enabledMarker = `id: "${eventId}",\n  debug: true,`;
    const disabledMarker = `id: "${eventId}",\n  debug: false,`;
    const markerCount = isolatedSource.split(enabledMarker).length - 1;
    if (markerCount !== 1) {
      throw new Error(
        `Expected exactly one enabled per-event debug marker for ${eventId}; found ${markerCount}.`
      );
    }
    return isolatedSource.replace(enabledMarker, disabledMarker);
  }, source);
};

export const isolateAllProductionDebug = (source, { except = [] } = {}) => {
  const dataDrivenStart = "SYSTEM_ALERTS.forEach((alert) => {";
  const dataDrivenEnd = "\n  });\n});";
  const dataDrivenStartIndex = source.indexOf(dataDrivenStart);
  const dataDrivenEndIndex = source.indexOf(dataDrivenEnd, dataDrivenStartIndex);
  const dataDrivenRegistration = source.slice(
    dataDrivenStartIndex,
    dataDrivenEndIndex
  );
  if (
    dataDrivenStartIndex < 0 ||
    dataDrivenEndIndex < 0 ||
    !dataDrivenRegistration.includes('id: `debug-system-alert-${alert.id}`') ||
    dataDrivenRegistration.includes("debug: true,")
  ) {
    throw new Error("Unable to isolate the data-driven debug alert family.");
  }
  return isolateProductionPerEventDebug(source, { except });
};

/** The script the per-event debug flags live in. */
export const PRODUCTION_DEBUG_SCRIPT_KEY = "eventPrompts";

export const readIsolatedMainSource = async ({ except = [] } = {}) => {
  const source = await readFile(homeScriptUrl(PRODUCTION_DEBUG_SCRIPT_KEY), "utf8");
  return isolateAllProductionDebug(source, { except });
};
