# O_automate-game-stats-worker-releases__20260730 — Open

Scope: GitHub Actions automation for synchronized personal-site game frontend and Cloudflare game-stats Worker releases.

Status: open

Opened: 2026-07-30

Updated: 2026-07-30

Current State: The live browser and Worker currently match at `sha256-f6d3…fe69f`, but `.github/workflows/game-stats-worker-release.yml` is untracked and absent from `origin/main`. Game source updates therefore require a manual Worker deployment and can temporarily prevent verified results from publishing.

Verification: Pending a successful pull-request verification run and a successful `main` release run whose final `npm run game-stats:release:check` proves live browser/source/cache-token/Worker parity.

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
