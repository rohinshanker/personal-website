# A_game-stats-backend-deployment-security__20260721 — Active

Scope: Cloudflare Game Stats Worker deployment, production browser configuration, and the release/security contract in [the backend runbook](../../validation/game-stats-backend.md).

Status: active

Opened: 2026-07-21

Updated: 2026-07-24

Current State: The public Worker endpoint is enabled in the browser configuration: `https://personal-site-game-stats.rohinshankerme.workers.dev`. On 2026-07-24, its `/health` and `/stats` routes returned `200` from Cloudflare and D1 returned an empty valid stats payload. Its Administrator endpoint and production CORS preflight are live, including `Authorization` and `Content-Type`; all five required secret names are configured. The source now has a newer game build version for the explicit Administrator success confirmation and build-derived cache keys, so the Worker and static site still need one coordinated release. The checked-in Worker derives Solitaire leaderboard entries as per-player verified win totals (highest first); deploying it applies that view to existing stored Solitaire events without a migration.

Administrator access is intentionally absent from the app dock. It is available only through the Windows-style question-mark control immediately before Close in Cursor Settings; the browser entry-point cache key was advanced with that change.

Verification: Local Worker, integration, integrity, migration, and secret-guard checks were previously recorded; production verification is pending.

Cleanup: On resolution, distill reusable procedure changes to `docs/validation/`, remove this file from the live index, and delete the resolved ticket.

## Context

Local implementation, migration, integration, and secret-guard checks were
previously completed. The Worker uses short-lived, signed, single-use sessions;
server-side validation; HMAC-keyed rate limits; and strict CORS.

The public Worker and production D1 reads are verified. The deployment’s CORS
preflight is stale relative to the checked-in Administrator-proof code, so the
latest Worker must be deployed before the browser configuration is published.
Turnstile remains disabled because the browser does not yet send a widget token.

## Next action

1. From `workers/game-stats`, use `npx wrangler secret list` to confirm the
   five required secret names exist, then deploy the current Worker. This is
   required to expose `Authorization` in CORS, add Administrator proof
   validation, and publish the Solitaire most-wins projection; never record
   secret values.
2. Confirm `npx wrangler d1 migrations list personal_site_game_stats --remote`
   has no pending reviewed migration, publish the static site with the enabled
   public URL, and complete the runbook's endpoint checks for all four games.
3. Resolve this ticket only after the production endpoint accepts one valid
   completion for Minesweeper, Solitaire, Snake, and Sudoku and the release
   version matches the browser artifact.

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
  confirms that the Game Progress profile changed to `rohin ^.^.`. The public
  Worker accepts the production origin and required Administrator headers;
  local browser testing must use a local Worker because production CORS remains
  exact by design. The current source integrity is
  `sha256-a056790aaf26a1c94e356568bbfc721241b933ee3829486550f3a2753fc5435c`;
  its updater also derives the three game-stat script cache keys from this
  version so browser and Worker releases stay synchronized.
- Re-run the production verification in the backend runbook before resolution.
