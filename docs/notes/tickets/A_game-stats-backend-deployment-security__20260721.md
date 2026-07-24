# A_game-stats-backend-deployment-security__20260721 — Active

Scope: Cloudflare Game Stats Worker deployment, production browser configuration, and the release/security contract in [the backend runbook](../../validation/game-stats-backend.md).

Status: active

Opened: 2026-07-21

Updated: 2026-07-24

Current State: The public Worker endpoint is enabled in the browser configuration: `https://personal-site-game-stats.rohinshankerme.workers.dev`. Its `/health` and `/stats` routes return `200`; production CORS is exact and includes `Authorization` and `Content-Type`; all required secrets are configured; Turnstile is absent; and no D1 migrations are pending. The deployed site and Worker are synchronized on `sha256-cc616b0bbf67d4ddf6562a352bede283edd88f1c659f43ecde72cc2551714ff8`, but D1 has five issued, unconsumed sessions and zero game events. The confirmed write failure is a browser/API contract mismatch: saved browser profiles include the local-only `rerollCount` field, while the Worker correctly accepts only `id`, `name`, and `icon`, so every profiled event is rejected with `400` before session consumption. The checked-in fix projects the public profile schema, attaches saved profiles to every game event, repairs queue cleanup/refresh/retry behavior, and is build `sha256-2bd2ca9411a5784f3b5ad3170e22473d6e072010588b0ac9f6a365e4f15c40e2`. It still needs a coordinated Worker/static publish and real production completion verification.

The three visible leaderboard slots intentionally remain padded with placeholder entries. Real verified results replace those entries in rank order, including the current saved profile when it is in the top results. Rendered tests cover populated, partially populated, and empty data shapes. The production payload remains empty because no game event has yet reached D1: localhost is intentionally denied by production CORS, so a localhost game cannot obtain the server-issued session needed to publish a result.

Administrator access is intentionally absent from the app dock. It is available only through the Windows-style question-mark control immediately before Close in Cursor Settings; the browser entry-point cache key was advanced with that change.

Verification: Local Worker, integration, integrity, migration, and secret-guard checks were previously recorded; production verification is pending.

Cleanup: On resolution, distill reusable procedure changes to `docs/validation/`, remove this file from the live index, and delete the resolved ticket.

## Context

Local implementation, migration, integration, and secret-guard checks were
previously completed. The Worker uses short-lived, signed, single-use sessions;
server-side validation; HMAC-keyed rate limits; and strict CORS.

The public Worker and production D1 reads are verified. Production CORS
preflight allows the required Administrator headers from the exact production
origin. Turnstile remains disabled because the browser does not yet send a
widget token.

## Next action

1. Deploy the matching Worker and static release artifacts for build version
   `sha256-2bd2ca9411a5784f3b5ad3170e22473d6e072010588b0ac9f6a365e4f15c40e2`.
   Verify the deployed Worker accepts that exact version before attempting a
   production completion.
2. On `https://rohin.shanker.me`, save the prompted leaderboard profile (do
   not skip it), then start a new game and play beyond its server minimum.
   Verify `POST /sessions` returns `201`, and completion `POST /events` returns
   `201` with `applied: true`.
3. Repeat for Minesweeper, Solitaire, Snake, and Sudoku. After each accepted
   event, confirm the automatic stats refresh contains the nonzero total and
   the saved player in the appropriate top-three leaderboard when their result
   qualifies.
4. If another code release is needed, first confirm
   `npx wrangler d1 migrations list personal_site_game_stats --remote` has no
   pending reviewed migration; never record secret values. Resolve this ticket
   only after all four production completions are accepted.

## Constraints

- Global statistics are moderation-grade, not proof of honest gameplay.
- Keep the production CORS origin exact; local origins belong only in ignored
  development variables.
- Never place secret values in this ticket, the runbook, or repository files.

## Recorded verification

- Previously recorded local checks: Worker tests, frontend integration tests,
  `node scripts/update-game-integrity.mjs --check`, a local D1 migration, and
  one local completion submission per supported game.
- 2026-07-24 Solitaire projection update: 104 unit tests and 27 browser tests
  passed; source integrity was subsequently advanced for Administrator
  confirmation work.
- 2026-07-24 Administrator entry update: focused static and rendered checks
  confirm the dock has no Administrator control, while Cursor Settings opens
  the same accessible sign-in dialog from its title-bar question-mark control.
- 2026-07-24 Administrator success confirmation: the success dialog explicitly
  says only `Administrator access granted.`, uses the bundled warning triangle,
  and provides a right-aligned `OK` action. The public
  Worker accepts the production origin and required Administrator headers;
  local browser testing must use a local Worker because production CORS remains
  exact by design. The current source integrity is
  `sha256-a056790aaf26a1c94e356568bbfc721241b933ee3829486550f3a2753fc5435c`;
  its updater also derives the three game-stat script cache keys from this
  version so browser and Worker releases stay synchronized.
- 2026-07-24 leaderboard verification: focused static tests passed for
  Minesweeper, Solitaire, Snake, and Sudoku. Rendered coverage confirms a
  verified current Solitaire player occupies rank one while ranks two and
  three retain the intended placeholder rows; rendered Sudoku coverage confirms
  a real server player replaces only the first padded row. The same state was
  visually inspected at 375×812, 768×1024, 1280×800, and 1440×900 with no
  console errors or horizontal overflow. Full regression passed: 104 static
  tests and 28 browser tests.
- 2026-07-24 submission diagnosis: public `/stats` is still entirely empty.
  Production CORS allows only `https://rohin.shanker.me`; it rejects
  `http://127.0.0.1:8000`, so local completions remain local because their
  session creation fails. A saved profile and a new, duration-valid game on
  the deployed site are required for a player to enter the global ranks.
- 2026-07-24 Rohin profile/session update: Administrator sign-in now stores
  only the opaque, short-lived server proof in per-tab `sessionStorage`, never
  a username, password, or long-lived local credential. A refreshed deployed
  tab therefore retains its unexpired, IP-bound authorization long enough to
  publish a verified protected-profile completion. A `403` for that profile is
  kept in the local retry queue and asks for a fresh sign-in rather than
  discarding the valid game result. The profile Neko now reuses the roaming
  Neko scratch, yawn, and nap cadence; each rendered Neko image owns separate
  timers, sleeps with a 30% per-instance chance, and only claws left or right.
  Build metadata was regenerated to
  `sha256-dde488d20a4b3155c8a66661cb798665695fe18b7724354b9e114b165d589ddd`.
  Local verification passed: 105 static tests, 31 browser tests, integrity
  check, and repository secret guard. Rendered Game Progress inspection at
  375×812, 768×1024, 1280×800, and 1440×900 found no console errors or
  page-level horizontal overflow; visual evidence is in
  `/private/tmp/rohin-neko-profile-{mobile,tablet,desktop,wide}.png`.
- 2026-07-24 production empty-leaderboard diagnosis: read-only checks of the
  live site and Worker found an empty D1 event list, zero global counts, and
  no player rank; the screen therefore reflects real backend state rather than
  a rendering defect. Production still serves the old `a056` browser client,
  which retained the Rohin Administrator proof only in JavaScript memory. A
  refresh kept the saved `rohin ^.^` profile but lost that proof; a protected
  completion was rejected with `403`, dropped by the old client, and then
  misleadingly displayed as “Global stats are up to date” after a stats refresh.
  The missing event cannot be safely reconstructed because it never reached
  D1. Publish the current synchronized Worker/static pair, sign in again, and finish
  a new game in the same tab while the short-lived authorization remains valid.
- 2026-07-24 Minesweeper mobile-controls and top-panel repair: the optional
  flag and question-mark buttons start hidden and can be enabled from the
  bottom-left “Mobile controls?” checkbox. Every top-panel item now has an
  explicit grid column, so hiding those optional controls cannot reflow the
  mine counter, reset smiley, or elapsed-time counter. Build metadata was
  regenerated to `sha256-44447e32790c63b78a334ead1f37e5d31ea2ff704f09a713c01fc1df211f6e91`.
  Verification passed: 105 static tests, two focused browser tests, integrity
  check, secret guard, and diff check. Rendered local inspection at 375×812,
  768×1024, 1280×800, and 1440×900 covered both checkbox states; no overlap,
  horizontal overflow, or console errors occurred after isolating the optional
  production API request. Evidence is in
  `/private/tmp/minesweeper-mobile-controls-{off-375,on-375,on-768,off-1280,on-1280,on-1440}.png`.
- 2026-07-24 production write root cause: the live static site and Worker are
  synchronized on `cc616`, and production successfully created five D1-backed
  sessions, but all remain unconsumed and `game_events` remains empty. The
  browser attached local-only `rerollCount` to every saved profile; the strict
  Worker rejected those event bodies with `400 Unknown profile field:
  rerollCount` before session consumption. The client now serializes exactly
  `id`, `name`, and `icon`, attaches a saved profile to every game event,
  discards legacy null-session queue entries, refreshes after accepted writes,
  preserves truthful pending/error messages, retains retryable `408`, `425`,
  and `429` responses, retries when the browser returns online, and coalesces
  sync triggers that arrive during an active request. Generated build metadata
  is `2bd2ca9411a5784f3b5ad3170e22473d6e072010588b0ac9f6a365e4f15c40e2`.
- Re-run the production verification in the backend runbook before resolution.
