# O_automate-game-stats-worker-releases__20260730 — Open

Scope: GitHub Actions automation for synchronized personal-site game frontend and Cloudflare game-stats Worker releases.

Status: open

Opened: 2026-07-30

Updated: 2026-08-09

Current State: A manual production deployment restored browser/Worker parity at `sha256-8da5…aa6e2` with Worker version `a3ef1b5d-0410-4725-8759-7f8c2c8de6e3`. `.github/workflows/game-stats-worker-release.yml` remains untracked and absent from `origin/main`, so future game-source updates still require a manual Worker deployment until the release automation is published and configured.

Verification: Worker tests pass 46/46, the Wrangler production-bundle dry run passes, remote D1 reports no pending migrations, and the static release gate confirms the live website at `sha256-8da5…aa6e2`. The manual Worker deploy completed successfully, `/health` reports the same build, live `/stats` returns successfully, and `npm run game-stats:release:check` proves full live parity. Automation verification still requires a successful pull-request run and `main` release run.

Cleanup: Preserve unrelated website changes. When resolved, update existing reusable guidance in `docs/validation/game-stats-backend.md` only if the final release contract differs, then remove this ticket and its index row.

## Required Work

1. Review and commit `.github/workflows/game-stats-worker-release.yml` without bundling unrelated About Me changes.
2. Configure the repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Scope the API token to the Cloudflare account and permissions required to deploy `personal-site-game-stats`; never commit or print either value.
3. Confirm pull-request runs are read-only and execute source tests, the generated-integrity check, and Wrangler's deployment dry run.
4. Confirm `main` runs require both credentials, wait for `npm run game-stats:static-release:check`, deploy `workers/game-stats/wrangler.jsonc`, and finish with `npm run game-stats:release:check`.
5. Confirm concurrency cancellation prevents an older `main` run from deploying after a newer revision.
6. Exercise `workflow_dispatch` or a controlled `main` change and retain the successful GitHub Actions run URL in the verification evidence while the ticket is active.

## Acceptance Criteria

- The workflow is tracked on `main` and visible in GitHub Actions.
- Missing credentials fail before deployment with a clear error; secret values never appear in source or logs.
- Pull requests cannot mutate Cloudflare production.
- A successful `main` run waits for the matching static release before deploying the Worker.
- The run fails closed on any browser/Worker build mismatch and succeeds only when full live parity is verified.
- After a gameplay source change is merged, a newly loaded browser can create verified sessions without manual Worker deployment.
