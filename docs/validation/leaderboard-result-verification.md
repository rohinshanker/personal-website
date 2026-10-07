# Leaderboard Result Verification Contract

- Purpose: Preserve server verification of legal game replays and the controlled release contract.
- Scope: Shared engines, issued games, timing, completion receipts, provenance, restore, execution bounds, and validation.
- Last verified: 2026-10-07

This guide covers result protocol 2. The legacy signed-session path and deployment
runbook are in [game-stats-backend.md](game-stats-backend.md). Check the live
client protocol and applied migrations before releasing either path.

## Trust boundary and presentation

The server issues the initial state, validates every recorded transition, and
derives the terminal result and metric. The browser controls its code, storage,
requests, and clocks; a public build hash identifies compatible assets and does
not attest that a player ran them.

Completion-only verification delivers the mine map, deck, and full Sudoku
solution to the client. A modified browser can inspect them or submit a legal
replay produced by an external solver. Verification establishes legality, not
human play or absence of outside assistance. Ordinary public profiles also do
not establish account ownership; Administrator authentication protects only its
reserved identity.

Historical and new records share one leaderboard with no badges, tabs, or
visible provenance distinction. Migration 0005 assigns existing rows internal
`provenance='legacy'`; successfully replayed publications store `verified` and a
completion ID. Never relabel historical rows or reset player data to migrate.

## Shared rules and catalog

`scripts/home/games/{rules,minesweeper,snake,solitaire,sudoku}.js` publish frozen
portable contracts and run unchanged as browser classic scripts and Worker
imports. Logical state is explicit, deterministic, JSON-only, and independent
of DOM, clocks, audio, and storage. Random choices use the issued seed and
state-owned Mulberry32 RNG. Illegal transitions throw `GameRuleError`.

`rules.js` defines result protocol 2 and initial rules, replay, and generator
versions 1. Bump the relevant version when a deployed contract changes. Legacy
issuance cutoff and cosmetic build hashes do not replace rules compatibility.

Solitaire/Sudoku issuance selects from an offline prevalidated catalog rather
than running a search during the request. The catalog contains 48 winnable
Solitaire base deals with eight legal suit relabelings (384 variants), and 16
unique Sudoku puzzles in each of six difficulties (96 puzzles). The full
`npm run game-stats:catalog:check` regenerates and checks both proofs and bytes;
the required Worker release verification job runs it before deployment.

Sudoku inputs require exactly one digit from 1–9; clears use their own operation.
The board stays exactly 81 cells at mutation, evaluation, and result derivation.
Issued puzzles contain givens and blanks, and their solutions satisfy the givens.

## Issuance, timing, and completion

`POST /sessions` receives `{game, config, buildVersion, resultProtocol:2,
rulesVersion, replayVersion, generatorVersion, firstCell?}`. It creates a new
six-hour session bound to the game/configuration/versions, initial state and
commitment, original timestamps, and server signature. Its descriptor includes
`id`, `gameId` equal to that ID, `token`, `initial`, `initialCommitment`,
`expiresAt`, versions, limits, and `timing:{revision:0,phase:"ready",elapsedMs:0}`.
Commitments are SHA-256 of canonical JSON, lowercase 64-character hex with no
prefix. The browser adapter validates the descriptor and recomputes the initial
commitment before adopting it. A new board needs its own issuance; edits made
before a late response arrives must not acquire that response's provenance.

`recordInput` assigns contiguous sequence numbers beginning at one. Inputs
before a running acknowledgment are buffered; they cannot alter an already
acknowledged pause prefix.

| Route | Body and invariant |
| --- | --- |
| `POST /sessions/:id/timing` | `{session:{id,token},operation:"pause"|"resume",expectedRevision,inputCount,inputHash}`. First resume starts timing. Pause commits its complete prefix. Resume must retain exactly that count/hash. Revisions and exact retries are atomic and idempotent. |
| `POST /sessions/:id/finish` | `{eventId,session:{id,token},gameId,rulesVersion,replayVersion,inputs,terminalTick?,timingRevision}`. Finish time freezes after the bounded body is received, before canonicalization, database/replay work, or profile selection. An immutable job owns the transcript and prevents further timing changes. |
| `POST /sessions/:id/finish/continue` | `{session:{id,token},progress:{id,token}}`. A 202 progress reply identifies a bounded checkpoint; continuations produce the same immutable completion receipt under concurrent or exact retries. |
| `POST /events` | `{event,completion:{id,token}}`. The selected profile is attached to the canonical event. All submitted canonical assertions must match the stored receipt. The receipt cannot enter the legacy session-only path. Publication is atomic and event-ID/completion idempotent. |

A running session may finish. A paused session may finish only its exact
acknowledged terminal prefix, with no further buffered inputs and time frozen
at that boundary. Minesweeper cannot subtract pauses. Snake verification
interleaves server-generated ticks with recorded direction changes, reproduces
apples/collisions, and requires enough observed active time for all ticks and
countdowns. Each active interval contributes at most its first 900 ms of actual
countdown; a pause halfway through a countdown does not charge a full interval.

| Game | Canonical result |
| --- | --- |
| Minesweeper | Legal reveal/flag/chord replay must reveal all safe cells without loss. Seconds are at least one and capped at 999, including hidden tabs and sleep; true elapsed milliseconds remain available. Closing discards the unfinished board. |
| Solitaire | Legal stock draws, transfers, undo, and permitted auto-solve must complete the foundations. Move count is derived from the replay. Staged/Admin presentation boards never publish. |
| Snake | Terminal score and collision are derived from deterministic ticks. A recorded terminal loss counts as a played game. Active-time evidence includes actual resume countdowns plus 118 ms per tick. |
| Sudoku | Edits, notes, checks, modes, and undo must respect givens and produce a valid completed board. Seconds are at least one and exclude acknowledged pauses. Assistance is exactly `noHints` or `withHints`; only finite `noHints` times rank. Puzzle ID and puzzle come from the stored session, not client assertions. |

Local results are saved first. Canonical metrics reconcile only their own
finished board. A reset/new board cannot abort an already claimed finish;
Reset Local Stats cannot resurrect cleared records when a later receipt arrives.
Completion expiry equals the original session expiry, not finish time plus a
new window. Expired results remain local with explicit session-expired feedback;
there is no end renewal button or extra modal. Exact publication/failure copy is
in [game-stats-refresh-control.md](game-stats-refresh-control.md).

## Restore and offline play

`POST /sessions/:id/restore` receives `{session:{id,token},inputCount,inputHash}`
and returns the original descriptor only for an unconsumed, unexpired ready or
server-acknowledged paused session at the exact stored prefix. It never issues a
replacement game. The controller rebuilds the original initial state and replay
and verifies that values/notes match the saved board before adopting it. Every
applied logical change while the request is pending also invalidates adoption,
even if cells still match. Keep the player's complete current board, release the
unadopted proof, and persist the local-only save. A stale response cannot detach
a newer puzzle's proof.

Running autosaves without an acknowledged pause, expired proofs, arbitrary
local saves, and offline games remain playable and locally recorded. They
cannot gain verified provenance by requesting a new proof at completion.
Legacy unconsumed/unexpired same-configuration session reuse retains its original
issue timestamp; new verified boards do not share that reusable proof.

## Execution limits and CPU qualification

| Bound | Limit |
| --- | --- |
| Replay/body; inputs | 256 KiB; 16,384 inputs |
| Snake ticks | 183,050 within six hours |
| Cumulative engine work | Snake 120,000,000; other games 2,000,000 |
| One action | 20,000 work; 16 KiB canonical input |
| One batch | 32 operations; 40,000 work; 64 KiB canonical input; 512 KiB checkpoint-clone preparation |
| Stored checkpoint | 256 KiB |
| Job/IP-hour continuations | 8,192 |
| Timing revisions | 900 |
| New sessions/IP-hour | 120 |

Snake's full 24×24 worst-case bound is 106,180,727 work, below its 120M limit.
Limits are cumulative as well as per request. Each action mutates a private
candidate; a failed action cannot partially update a committed checkpoint.
Exhausted jobs become immutable terminal failures with no partial publication.

Issuance and final checkpoints validate canonical JSON. The faster in-batch
JSON clone assumes engines produce only JSON state; maintain that invariant
when adding or changing engines, since JSON serialization can normalize invalid
intermediate values instead of preserving them for later rejection.

Design for the Workers Free 10 ms CPU limit, enforced by the platform. Keep
`limits.cpu_ms` absent in the production and example configs: custom CPU limits
are paid-plan-only and Cloudflare rejects them on Free, even when set to 10 ms.
See [Cloudflare CPU limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time).
Instrumented preparation/replay/serialization wall spans cover only parts of the
invocation;
request parsing, crypto, commit, and finalization also cost CPU. They are not
whole billed CPU, proof of compliance, or headroom. Record cold and warm maxima
without comparing runs with different warmup as equivalent. Cloudflare enforces
CPU limits only after deployment; qualify actual CPU and resource-limit outcomes
through authorized production measurements.

## Controlled rollout and integrity

Run `node scripts/update-game-integrity.mjs` after completion-source changes.
For a release containing unpublished intermediate builds, restore current/history
metadata from the last published source before regenerating; keep the existing
32-prior-build cap. Local checkpoints must not evict published clients.

`npm --prefix workers/game-stats run deploy` runs the read-only rollout preflight.
If the live client is legacy and the candidate speaks protocol 2, first set an
operator-selected future UTC `LEGACY_RESULT_ISSUANCE_CUTOFF`. Empty means closed
steady state. The cutoff controls new legacy issuance only; existing proofs
retain their original expiry. Public protocol-2 metadata does not prove all
cached legacy tabs have drained. Alternate configurations/environments,
static-first releases, and rollbacks require explicit operator coordination.

Apply tracked migrations, deploy the Worker, require the Worker transition
check, publish the exact static artifact, then require the full release check.
Never reset data to repair schema/configuration drift. Once a migration has
been applied, change schema through a new migration. `/health` table-count
success alone does not validate every column or applied migration.

## Repeatable verification

```bash
node --test tests/game-stats-verification.test.mjs \
  tests/game-stats-verification-runtime.test.mjs \
  tests/game-stats-verification-peer-snake-runtime.test.mjs \
  tests/game-stats-verification-peer-sudoku.test.mjs \
  tests/game-stats-issued-engines.test.mjs \
  tests/game-stats-issued-engines-runtime.test.mjs \
  tests/verified-game-replays.test.mjs \
  tests/verified-ms-snake-fixtures.test.mjs \
  tests/issued-game-catalog.test.mjs tests/game-stats-rollout.test.mjs
npm run game-stats:catalog:check
UI_TEST_PORT=4317 UI_TEST_OUTPUT_DIR=test-results/verified-games \
  npx playwright test --project=ui tests/ui/verified-game-replay.spec.mjs \
  tests/ui/verified-ms-snake-replays.spec.mjs \
  tests/ui/game-stats-replay-adapter.spec.mjs
```

Validate legal/illegal transitions, altered identity/configuration/versions,
canonical metrics, replay ordering/size, expiry/reuse, timing prefixes,
concurrency, rollback, original-proof restore, and offline/presentation behavior.
Use real SQLite and workerd with production engines, plus browser/server fixture
parity. Inspect Home publishing/game states at 375×812, 768×1024, 1280×800, and
1440×900; include rejected, expired, limit, successful, and resumed states.
Successful publication fixtures must await the browser-adopted game ID, then
the acknowledged refreshed read and drained queue. Observing a session or event
request alone does not establish that the response has settled. Hold issuance
and restore requests explicitly to test logical ownership across async replies.
Run the full repository quality gates before release.
