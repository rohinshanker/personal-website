import assert from "node:assert/strict";
import test from "node:test";

import worker from "../workers/game-stats/src/index.mjs";

const ORIGIN = "https://rohin.shanker.me";
const repeatedIds = new URLSearchParams({ protocol: "2" });
for (let index = 0; index < 33; index += 1) {
  repeatedIds.append("pendingEventId", `event-contract-${index}`);
}

const invalidQueries = [
  ["unsupported protocol", "protocol=3"],
  ["non-numeric protocol", "protocol=unknown"],
  ["invalid player ID", "protocol=2&playerId=not_valid"],
  ["short pending ID", "protocol=2&pendingEventId=x"],
  ["invalid pending ID", "protocol=2&pendingEventId=event_bad_id"],
  ["too many pending IDs", repeatedIds.toString()],
  ["pending IDs on the legacy protocol", "pendingEventId=event-valid-001"],
  ["invalid freshness value", "protocol=2&fresh=0"],
  ["non-numeric freshness value", "protocol=2&fresh=true"],
];

for (const [name, query] of invalidQueries) {
  test(`stats rejects ${name} before accessing D1`, async () => {
    let databaseCalls = 0;
    const database = {
      prepare() {
        databaseCalls += 1;
        throw new Error("Invalid requests must not prepare a database query");
      },
      batch() {
        databaseCalls += 1;
        throw new Error("Invalid requests must not execute database queries");
      },
    };
    const response = await worker.fetch(
      new Request(`https://stats.test/stats?${query}`, {
        headers: { Origin: ORIGIN },
      }),
      { personal_site_game_stats: database, ALLOWED_ORIGIN: ORIGIN }
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.ok(body.error.length > 0);
    assert.equal(databaseCalls, 0);
  });
}
