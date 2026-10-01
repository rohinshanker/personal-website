import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeClashTag,
  parseClashBattleTime,
  prepareClashSnapshot,
  resolveClashBattle,
  summarizeClashBattles,
} from "../scripts/home/clash-royale.js";

const PLAYER = Object.freeze({ tag: "#28CYYU08P", name: "Rohin" });
const OPPONENT = Object.freeze({ tag: "#ABC123", name: "Opponent" });

test("normalizes compact API timestamps and rejects unavailable battle times", () => {
  for (const value of ["20261001T121500.000Z", "20261001T121500Z", "2026-10-01T12:15:00Z"]) {
    assert.equal(parseClashBattleTime(value).toISOString(), "2026-10-01T12:15:00.000Z");
  }
  for (const value of [null, "", "not a date"]) assert.equal(parseClashBattleTime(value), null);
});

test("normalizes Clash Royale tags for participant matching", () => {
  assert.equal(normalizeClashTag(" #28cyyu08p "), "28CYYU08P");
  assert.equal(normalizeClashTag(null), "");
});

test("resolves the configured player from either battle side", () => {
  const fromTeam = resolveClashBattle(
    { team: [{ ...PLAYER, crowns: 2 }], opponent: [{ ...OPPONENT, crowns: 1 }] },
    PLAYER.tag
  );
  assert.equal(fromTeam.player.name, "Rohin");
  assert.equal(fromTeam.opponent.name, "Opponent");
  assert.equal(fromTeam.outcome, "win");

  const fromOpponent = resolveClashBattle(
    { team: [{ ...OPPONENT, crowns: 3 }], opponent: [{ ...PLAYER, crowns: 1 }] },
    PLAYER.tag
  );
  assert.equal(fromOpponent.player.name, "Rohin");
  assert.equal(fromOpponent.opponent.name, "Opponent");
  assert.equal(fromOpponent.outcome, "loss");
});

test("does not fabricate a result when crowns are missing", () => {
  const battle = resolveClashBattle(
    { team: [PLAYER], opponent: [{ ...OPPONENT, crowns: 0 }] },
    PLAYER.tag
  );
  assert.equal(battle.hasCrowns, false);
  assert.equal(battle.outcome, "unknown");
  assert.deepEqual(summarizeClashBattles([battle]), {
    crownDifference: 0,
    draws: 0,
    known: 0,
    losses: 0,
    total: 1,
    wins: 0,
  });
});

test("skips unusable battles and limits the recent sample", () => {
  const usableBattle = {
    team: [{ ...PLAYER, crowns: 1 }],
    opponent: [{ ...OPPONENT, crowns: 0 }],
  };
  const snapshot = prepareClashSnapshot({
    ok: true,
    fetchedAt: "2026-10-01T12:00:00.000Z",
    cacheTtlSeconds: 300,
    player: {
      ...PLAYER,
      currentDeck: [{ id: 1, name: "Knight" }, { id: 2 }, null],
    },
    battles: [
      { team: [OPPONENT], opponent: [{ tag: "#SOMEONE", name: "Other" }] },
      ...Array.from({ length: 12 }, () => usableBattle),
    ],
  });

  assert.equal(snapshot.battles.length, 10);
  assert.deepEqual(snapshot.currentDeck, [{ id: 1, name: "Knight" }]);
  assert.equal(snapshot.playerTag, "28CYYU08P");
});

test("summarizes only battles with factual crown results", () => {
  const battles = [
    resolveClashBattle(
      { team: [{ ...PLAYER, crowns: 3 }], opponent: [{ ...OPPONENT, crowns: 1 }] },
      PLAYER.tag
    ),
    resolveClashBattle(
      { team: [{ ...PLAYER, crowns: 0 }], opponent: [{ ...OPPONENT, crowns: 2 }] },
      PLAYER.tag
    ),
    resolveClashBattle(
      { team: [{ ...PLAYER, crowns: 1 }], opponent: [{ ...OPPONENT, crowns: 1 }] },
      PLAYER.tag
    ),
    resolveClashBattle({ team: [PLAYER], opponent: [OPPONENT] }, PLAYER.tag),
  ];
  assert.deepEqual(summarizeClashBattles(battles), {
    crownDifference: 0,
    draws: 1,
    known: 3,
    losses: 1,
    total: 4,
    wins: 1,
  });
});

test("rejects success payloads without a usable player identity or timestamp", () => {
  assert.throws(() => prepareClashSnapshot({ ok: true, player: {}, fetchedAt: "now" }));
  assert.throws(() =>
    prepareClashSnapshot({
      ok: true,
      player: { ...PLAYER, currentDeck: [] },
      battles: [],
      fetchedAt: null,
      cacheTtlSeconds: 300,
    })
  );
  assert.throws(() =>
    prepareClashSnapshot({
      ok: true,
      player: { ...PLAYER, tag: "#SOMEONEELSE", currentDeck: [] },
      battles: [],
      fetchedAt: "2026-10-01T12:00:00.000Z",
      cacheTtlSeconds: 300,
    })
  );
  assert.throws(() =>
    prepareClashSnapshot({
      ok: true,
      player: { ...PLAYER, currentDeck: [] },
      battles: null,
      fetchedAt: "2026-10-01T12:00:00.000Z",
      cacheTtlSeconds: 300,
    })
  );
  assert.throws(() =>
    prepareClashSnapshot({
      ok: true,
      player: { ...PLAYER, currentDeck: [] },
      battles: [],
      fetchedAt: "2026-10-01T12:00:00.000Z",
      cacheTtlSeconds: 600,
    })
  );
  assert.throws(() =>
    prepareClashSnapshot({
      ok: false,
      player: PLAYER,
      fetchedAt: "2026-10-01T12:00:00.000Z",
    })
  );
});
