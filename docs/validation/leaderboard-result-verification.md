# Leaderboard Result Verification Design

- Purpose: Define a practical server-verification boundary for public game results.
- Scope: Minesweeper, Solitaire, Snake, Sudoku, leaderboard metrics, release identity, and verification tests.
- Last verified: 2026-10-03

This is a proposed design. Production keeps the existing signed-session and
publishing contract in [game-stats-backend.md](game-stats-backend.md).

## Trust boundary

A visitor controls the browser, JavaScript, local storage, request bodies, and
client clocks. A public build hash identifies a release; it cannot attest that
the visitor ran those bytes. Changing hash algorithms, adding a browser-held
signing key, obfuscating code, or reporting a client checksum does not establish
honest gameplay. [Subresource integrity](https://www.w3.org/TR/sri/) can detect changed downloaded assets for
an enforcing browser, but a player controls their own browser.

The current Worker validates signed, stored, single-use sessions, configuration,
request shape, bounded metrics, minimum session age, and protected Administrator
proofs. It receives no input replay and does not derive wins or scores. The
security tests must preserve that distinction: valid session issuance does not
establish a valid game result.

[OWASP's frontend guidance](https://cheatsheetseries.owasp.org/cheatsheets/Web_Frontend_Security_Cheat_Sheet.html)
places security decisions on the server. An authoritative game backend validates
inputs against server-owned state; see the
[authoritative gameplay model](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/).

## Recommended design: issue a game, verify its replay

Use the existing Worker and signed-session mechanism. Avoid maintaining a live
server loop for every local single-player game.

1. The server issues the game identity, rules version, initial board/deck or
   deterministic seed, configuration, issue time, and expiry. Bind these values
   to the stored session and its server signature. Client-selected initial state
   cannot enter a verified leaderboard.
2. The browser records ordered game inputs against that issued state. Pure game
   engines apply the same deterministic rules in the browser and verifier;
   rendering, animation, audio, and storage stay outside the engines.
3. Completion submits a bounded replay and session proof. The server validates
   every transition and derives the win, score, moves, and assistance category.
   Client-reported metrics are assertions to check, never the authoritative
   values. Cap request bytes, replay length, ticks, and verification work for
   each game before execution; reject malformed or excessive input.
4. Consume the session and store the derived result atomically. Preserve exact
   duplicate idempotency, expiry, rate limits, configuration binding, and
   Administrator authorization. Replays cannot be reused with another session,
   initial state, rules version, or result.

| Game | Replay and derived result |
| --- | --- |
| Minesweeper | Reveals, flags, and chords on the issued board; enforce first-click safety, loss, and complete safe-cell revelation. |
| Solitaire | Stock draws, pile transfers, undo, and the permitted endgame auto-solve; validate card ownership and move legality, derive move count and foundation completion. |
| Snake | Direction changes indexed by deterministic ticks; reproduce apple generation, collisions, and score. Bound total ticks and require enough server-observed elapsed time for them. |
| Sudoku | Edits, undo, and assistance actions against the issued puzzle; verify givens and completed units, derive the permitted assistance bucket. Any server-provided answers/checks must be counted server-side. |

Extract the engines as independently testable units before introducing replay
validation. Version the replay/rules contract explicitly. Keep artifact hashes
for cache and release parity; protocol compatibility should follow supported
rules versions rather than cosmetic frontend edits.

## Timing, offline play, and hidden information

A one-shot replay cannot prove client timestamps or active-play duration. For a
timed ranking, use server-observed start and finish times. If ranked timing must
exclude pauses, the server must observe pause/resume boundaries and enforce the
pause rules. Preserving the current active-time behavior is a policy choice for
that implementation, not a claim supplied by a replay. Client timer values can
remain useful for local displays.

Offline games remain playable and retain local statistics. Strictly verified
rankings require a server-issued game and the applicable timing evidence; an
arbitrary offline save cannot acquire that provenance by obtaining a session at
completion. Resuming an issued game must retain its original session/state and
verification history.

Sending the full mine map, hidden deck, or Sudoku solution lets a modified client
inspect it. Replay verification proves legal transitions, but cannot prove that
a player did not inspect hidden information or use a solver. If concealing that
information is required, retain it server-side and serve only legal reveals or
assistance responses. That requires online gameplay requests and is a stronger,
more expensive contract than completion-only replay verification.

Neither design proves that a human played. Automation and externally generated
legal solutions remain possible. Authentication establishes player identity;
Turnstile and rate limits constrain abuse. None substitutes for game-rule
validation or proves absence of assistance.

## Migration and acceptance checks

Introduce verified-result provenance in a new protocol. Existing stored results
and legacy submissions retain their existing status; never relabel them as
server-replayed results. Filter or separate verified rankings explicitly while
rolling out compatible clients. No reset of existing data is needed to record
provenance.

Tests must cover legal wins and losses, each illegal transition, modified initial
state/configuration/rules version, fabricated metrics, unreported server
assistance, truncated/reordered/oversized replays, expiry, replay reuse,
concurrent duplicates, atomic failure, and offline/resume behavior. Use real
SQLite transaction tests plus Worker-runtime integration. Execute shared-engine
fixtures in browser and server environments and require identical state/results.
Verify timed eligibility with server-controlled clocks, never by trusting replay
timestamps. Render game controls and publishing states at the standard four
viewports before adopting the protocol.
