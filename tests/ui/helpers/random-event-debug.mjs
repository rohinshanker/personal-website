import { routeHomeScript } from "./home-script-routes.mjs";

export const PRODUCTION_FORCED_START_EVENT_IDS = Object.freeze([
  "neko-stream-system-alert",
]);

export const isolateProductionForcedStart = (
  source,
  { except = [] } = {}
) => {
  const retainedIds = new Set(except);
  retainedIds.forEach((eventId) => {
    if (!PRODUCTION_FORCED_START_EVENT_IDS.includes(eventId)) {
      throw new Error(`Unknown production forced-Start event exception: ${eventId}.`);
    }
  });
  return PRODUCTION_FORCED_START_EVENT_IDS.reduce((isolatedSource, eventId) => {
    if (retainedIds.has(eventId)) return isolatedSource;
    const enabledMarker = `id: "${eventId}",\n  forceOnStart: true,`;
    const disabledMarker = `id: "${eventId}",\n  forceOnStart: false,`;
    const markerCount = isolatedSource.split(enabledMarker).length - 1;
    if (markerCount !== 1) {
      throw new Error(
        `Expected exactly one forced-Start marker for ${eventId}; found ${markerCount}.`
      );
    }
    return isolatedSource.replace(enabledMarker, disabledMarker);
  }, source);
};

export const isolateProductionRandomEventPolicies = (source, { except = [] } = {}) => {
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
  return isolateProductionForcedStart(source, { except });
};

/** The script the production forced-Start policies live in. */
export const PRODUCTION_RANDOM_EVENT_POLICY_SCRIPT_KEY = "eventPrompts";

/** Routes only the production module that owns the forced-Start policies. */
export const routeProductionRandomEventPolicies = (page, { except = [] } = {}) =>
  routeHomeScript(page, PRODUCTION_RANDOM_EVENT_POLICY_SCRIPT_KEY, (source) =>
    isolateProductionRandomEventPolicies(source, { except })
  );
