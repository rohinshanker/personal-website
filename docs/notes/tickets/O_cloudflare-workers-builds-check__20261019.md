# O_cloudflare-workers-builds-check__20261019 — Open

- Scope: Diagnose the failing `Workers Builds: personal-site-game-stats` GitHub check that Cloudflare's Git integration reports on every push to `main`, then either disconnect that integration or make it harmless, so the release workflow in `.github/workflows/game-stats-worker-release.yml` stays the only path that deploys the Worker.
- Status: open
- Opened: 2026-10-19
- Updated: 2026-10-19
- Current State: Diagnosed from GitHub only. The check is posted by the `cloudflare-workers-and-pages` GitHub app, not by the repository's workflows. It first appears on commit 403df5d (2026-10-18, pushed between 20:54 and 21:28 ET) and has failed on every `main` push since, including b498ff2 and 489bb3b; no earlier commit carries it, so the Worker was connected to the repository in that window. Its check output holds only a dashboard build link, and the build log could not be read: it lives only in the Cloudflare dashboard, this machine holds no Cloudflare API token, and the browser extension was not connected. `wrangler deployments list` shows that every Worker deployment, including the four on 2026-10-19, came from the release workflow, so the integration has never deployed anything.
- Verification: Read the failing build log in the Cloudflare dashboard (Workers & Pages → personal-site-game-stats → Builds) and record the cause. After the fix, push a docs-only commit to `main` and confirm the commit's check runs show no `Workers Builds` entry (or a passing one that does not deploy), that `wrangler deployments list` gains a deployment only after the owner approves the `production` environment, and that the release workflow still passes `npm --prefix workers/game-stats run deploy:check`.
- Cleanup: Record the chosen outcome in the release section of `docs/validation/game-stats-backend.md` (either "no Cloudflare Git integration" or the integration's exact non-deploying settings), update `docs/validation/INDEX.md`, resolve this ticket, and delete it with its index row.

## Likely cause

Cloudflare Workers Builds runs its build at the repository root by default with `npx wrangler deploy` as the deploy command. The Worker's configuration lives in `workers/game-stats/wrangler.jsonc`, so a root build finds no config and fails before deploying. Confirm this against the build log before acting on it.

## Decision needed

- **Disconnect (recommended):** the release workflow already verifies, gates and deploys the Worker, and a successful Cloudflare build would deploy straight from a push, bypassing the test suite, the rolling-compatibility transition check and the owner's `production` approval. Disconnecting removes the red check and the bypass risk.
- **Keep:** only if the owner wants Cloudflare's preview builds for some reason. Then set the build root to `workers/game-stats`, replace the deploy command with a non-deploying check such as `npm run deploy:check`, restrict it to non-`main` branches, and document the settings.

## Constraints

- Only the owner can change the Cloudflare dashboard; agents on this Mac have Wrangler's OAuth login but no dashboard or build-log access.
- Do not "fix" the check by making Cloudflare's deploy succeed; that would bypass the release gate added on 2026-10-19 (`approve-release` job, `production` environment).
- Find out who connected the integration on 2026-10-18 if it was not the owner; the Cloudflare audit log lists the actor.
