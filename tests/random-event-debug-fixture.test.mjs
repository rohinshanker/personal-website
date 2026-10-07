import assert from "node:assert/strict";
import test from "node:test";

import {
  isolateProductionRandomEventPolicies,
  PRODUCTION_FORCED_START_EVENT_IDS,
  PRODUCTION_RANDOM_EVENT_POLICY_SCRIPT_KEY,
  routeProductionRandomEventPolicies,
} from "./ui/helpers/random-event-debug.mjs";
import { routeHomeScript } from "./ui/helpers/home-script-routes.mjs";
import { TEST_SERVER_ORIGIN } from "./ui/helpers/rendered-site.mjs";
import {
  RANDOM_EVENT_SCRIPT_KEYS,
  readHomeScript,
  readHomeScriptText,
} from "./helpers/home-scripts.mjs";

/**
 * Browser tests isolate production policies that force events from common
 * controls, so unrelated Start-button interactions cannot open a window in the
 * middle of an assertion. Feature tests retain the policy explicitly.
 */

test("only the known production events force-run from Start", async () => {
  const everyEvent = await readHomeScriptText(...RANDOM_EVENT_SCRIPT_KEYS);
  const forcedIds = [...everyEvent.matchAll(/id: "([^"]+)",\n  forceOnStart: true,/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(
    forcedIds,
    [...PRODUCTION_FORCED_START_EVENT_IDS],
    "PRODUCTION_FORCED_START_EVENT_IDS must list every forced-Start event"
  );
  assert.doesNotMatch(everyEvent, /id: "[^"]+",\n  debug: true,/);
});

test("the browser fixture isolates every forced-Start policy unless explicitly retained", async () => {
  const source = await readHomeScript(PRODUCTION_RANDOM_EVENT_POLICY_SCRIPT_KEY);

  const isolated = isolateProductionRandomEventPolicies(source);
  assert.doesNotMatch(isolated, /id: "[^"]+",\n  forceOnStart: true,/);
  assert.doesNotMatch(isolated, /debug: alert\.debug === true,/);

  const retained = isolateProductionRandomEventPolicies(source, {
    except: ["neko-stream-system-alert"],
  });
  assert.match(retained, /id: "neko-stream-system-alert",\n  forceOnStart: true,/);

  // An event that never ships armed cannot be asked for, so a stale exception
  // in a fixture fails loudly instead of quietly doing nothing.
  for (const unknownId of ["red-tool", "lain-system-alert"]) {
    assert.throws(
      () => isolateProductionRandomEventPolicies(source, { except: [unknownId] }),
      new RegExp(`Unknown production forced-Start event exception: ${unknownId}`)
    );
  }
});

test("the browser fixture routes the owning event script and rejects stale transforms", async () => {
  let routeHandler;
  let routesUrl;
  const page = {
    async route(matcher, handler) {
      routesUrl = (url) => matcher(new URL(url));
      routeHandler = handler;
    },
  };

  await routeProductionRandomEventPolicies(page);
  assert.ok(routesUrl(`${TEST_SERVER_ORIGIN}/scripts/home/events/prompts.js?v=test`));
  assert.ok(!routesUrl(`${TEST_SERVER_ORIGIN}/scripts/home/main.js?v=test`));
  assert.ok(
    !routesUrl("https://assets.example.invalid/scripts/home/events/prompts.js?v=test"),
    "The fixture must not answer for the script's path on another host"
  );

  let fulfillment;
  await routeHandler({
    fulfill(options) {
      fulfillment = options;
    },
  });
  assert.equal(fulfillment.contentType, "application/javascript");
  assert.doesNotMatch(fulfillment.body, /id: "[^"]+",\n  forceOnStart: true,/);

  await assert.rejects(
    routeHomeScript(page, PRODUCTION_RANDOM_EVENT_POLICY_SCRIPT_KEY, (source) => source),
    /browser fixture did not transform scripts\/home\/events\/prompts\.js/
  );
});

/** One event's `registerRandomEvent({ … })` block. */
function registrationFor(source, eventId) {
  const idIndex = source.indexOf(`id: "${eventId}",`);
  assert.notEqual(idIndex, -1, `${eventId} must be registered`);
  const start = source.lastIndexOf("registerRandomEvent({", idIndex);
  const end = source.indexOf("\n});", idIndex);
  assert.ok(start !== -1 && end > start, `${eventId}'s registration must be bounded`);
  return source.slice(start, end);
}

test("events that must never ship armed stay disarmed", async () => {
  const cases = [
    ["eventNotes", "lain-system-alert"],
    ["eventRedTool", "red-tool"],
  ];

  for (const [key, eventId] of cases) {
    const registration = registrationFor(await readHomeScript(key), eventId);
    assert.match(registration, /\bdebug: false,/, `${eventId} must ship disarmed`);
  }
});
