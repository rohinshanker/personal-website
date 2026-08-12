# A_automate-game-stats-worker-releases__20260730 — Active

Scope: GitHub Actions automation for synchronized personal-site game frontend and Cloudflare game-stats Worker releases.

Status: active

Opened: 2026-07-30

Updated: 2026-08-11

Current State: The first release workflow is on `origin/main`, but every production release has failed. The latest run passed verification and stopped because both required Cloudflare repository secrets are missing, leaving the live browser on build `sha256-7c5f92037db895a1bb868a79152c2db70fc7d7a65c13482ebb56920047c40d0a` and the Worker on `sha256-8da5fabb2d24da0b79b4cbb6a314df595fefbd926adab3a1447c185d865aa6e2`. The rollout-safe implementation is complete locally: the workflow owns Pages publication, deploys a rolling-compatible Worker first, and prevents browser refreshes from masking an in-progress session retry. The ticket remains active until the one-time remote settings are applied and a real release succeeds.

Verification: The published workflow has three failed `main` runs. Run `31547175097` passed verification and then reported both missing repository secrets at the credential gate. Cache-busted production checks confirm browser build `sha256-7c5f92037db895a1bb868a79152c2db70fc7d7a65c13482ebb56920047c40d0a` and Worker build `sha256-8da5fabb2d24da0b79b4cbb6a314df595fefbd926adab3a1447c185d865aa6e2`. The local candidate passes all 264 source tests, generated-integrity verification, Wrangler 4.114.0's strict deployment dry-run, and 4/4 rendered recovery-and-publication cases at 375×812, 768×1024, 1280×800, and 1440×900. Automation acceptance still requires the one-time remote settings plus successful pull-request and trusted `main` runs.

Cleanup: Preserve unrelated website changes. When resolved, update existing reusable guidance in `docs/validation/game-stats-backend.md` only if the final release contract differs, then remove this ticket and its index row.

## Required Work

1. Publish the rollout-safe Worker, browser retry, integrity generator, Pages-owned release workflow, tests, and reusable validation guide without bundling unrelated user changes.
2. In repository Pages settings, change the publishing source from direct `main` branch publication to GitHub Actions and restrict the `github-pages` environment to `main`.
3. Configure repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Scope the token to the owning Cloudflare account and permissions required to deploy `personal-site-game-stats`; never commit or print either value.
4. Confirm the five existing Worker runtime secrets remain configured and disable any Cloudflare Workers Builds/Git integration that could deploy the same Worker independently.
5. Confirm pull-request runs are read-only and execute source tests, the generated-integrity check, and Wrangler's strict deployment dry run.
6. Confirm trusted `main` runs deploy the compatibility Worker, pass `npm run game-stats:worker-transition:check`, publish the exact Pages artifact, and finish with `npm run game-stats:release:check`.
7. Confirm concurrency cancellation prevents an older `main` run from publishing after a newer revision.
8. Exercise `workflow_dispatch` or a controlled `main` change and retain the successful GitHub Actions run URL in the verification evidence while the ticket is active.

## Acceptance Criteria

- The workflow is tracked on `main` and visible in GitHub Actions.
- Missing credentials fail before either Worker or Pages deployment with a clear error; secret values never appear in source or logs.
- Pull requests cannot mutate Cloudflare production.
- GitHub Pages publishes only the artifact produced by this workflow after verification and the Worker transition succeed.
- Before Pages publication, the candidate Worker accepts both its active build and the coherent browser build currently live.
- The run fails closed on any browser/Worker build mismatch and succeeds only when full live parity is verified.
- A temporary rollout mismatch retries automatically, and cached/open compatible browsers can still create verified sessions.
- After a gameplay source change is merged, newly loaded and recently cached browsers can create verified sessions without manual Worker deployment or the permanent deployment-error state.
