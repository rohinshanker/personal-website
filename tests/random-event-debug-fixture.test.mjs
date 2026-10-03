import assert from "node:assert/strict";
import test from "node:test";

import {
  isolateAllProductionDebug,
  PRODUCTION_DEBUG_SCRIPT_KEY,
  PRODUCTION_PER_EVENT_DEBUG_IDS,
} from "./ui/helpers/random-event-debug.mjs";
import {
  RANDOM_EVENT_SCRIPT_KEYS,
  readHomeScript,
  readHomeScriptText,
} from "./helpers/home-scripts.mjs";

/**
 * A browser test cannot leave a production debug event armed: those fire on
 * sight and would open a window in the middle of an unrelated assertion. The
 * fixture disarms them in the script that declares them, and these checks keep
 * its list of debug events equal to what the event scripts actually ship.
 */

test("only the known production debug events ship armed", async () => {
  const everyEvent = await readHomeScriptText(...RANDOM_EVENT_SCRIPT_KEYS);
  const armedIds = [...everyEvent.matchAll(/id: "([^"]+)",\n  debug: true,/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(
    armedIds,
    [...PRODUCTION_PER_EVENT_DEBUG_IDS],
    "PRODUCTION_PER_EVENT_DEBUG_IDS must list every event that ships with debug on"
  );
});

test("the browser fixture isolates every production debug event unless explicitly retained", async () => {
  const source = await readHomeScript(PRODUCTION_DEBUG_SCRIPT_KEY);

  const isolated = isolateAllProductionDebug(source);
  assert.doesNotMatch(isolated, /id: "[^"]+",\n  debug: true,/);
  assert.doesNotMatch(isolated, /debug: alert\.debug === true,/);

  const retained = isolateAllProductionDebug(source, {
    except: ["neko-stream-system-alert"],
  });
  assert.match(retained, /id: "neko-stream-system-alert",\n  debug: true,/);

  // An event that never ships armed cannot be asked for, so a stale exception
  // in a fixture fails loudly instead of quietly doing nothing.
  for (const unknownId of ["red-tool", "lain-system-alert"]) {
    assert.throws(
      () => isolateAllProductionDebug(source, { except: [unknownId] }),
      new RegExp(`Unknown production debug event exception: ${unknownId}`)
    );
  }
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
