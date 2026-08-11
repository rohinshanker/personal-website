# O_automate-game-stats-worker-releases__20260730 — Open

Scope: GitHub Actions automation for synchronized personal-site game frontend and Cloudflare game-stats Worker releases.

Status: open

Opened: 2026-07-30

Updated: 2026-08-11

Current State: The synchronized release automation is implemented and isolated in a dedicated local commit. Pull requests use a credential-free verification job; trusted `main` runs wait for the matching static build, reject stale workflow revisions, deploy the Worker with strict configuration handling, and verify final browser/Worker parity. The commit is not yet on `origin/main`, and the repository secrets and real GitHub Actions runs still require remote configuration and validation.

Verification: The exact committed tree passes all 258 source tests, its generated-integrity check, secret scan, and Wrangler 4.114.0 strict deployment dry-run. The release-context guard has 100% line, branch, and function coverage. Automation verification still requires publication plus successful pull-request and trusted `main` release runs with the Actions secrets configured.

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
