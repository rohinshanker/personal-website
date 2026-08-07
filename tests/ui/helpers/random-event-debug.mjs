import { readFile } from "node:fs/promises";

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
  const dataDrivenMarker = "debug: alert.debug === true,";
  if (!source.includes(dataDrivenMarker)) {
    throw new Error("Unable to isolate the data-driven debug alert family.");
  }
  return isolateProductionPerEventDebug(
    source.replace(dataDrivenMarker, "debug: false,"),
    { except }
  );
};

export const readIsolatedMainSource = async ({ except = [] } = {}) => {
  const mainSource = await readFile(
    new URL("../../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  return isolateAllProductionDebug(mainSource, { except });
};
