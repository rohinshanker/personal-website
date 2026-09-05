# Game Stats Backend Setup

Purpose: Controlled Cloudflare Worker and D1 release, security, production verification, and scoped data reset.

Scope: Game Stats browser client, Worker, D1, secrets, Turnstile, release synchronization, and server-data reset.

Last verified: 2026-09-05

This guide deploys the automatic global game-stat backend: Cloudflare Worker +
D1 + browser integration. It covers the four tracked games: Minesweeper wins,
Solitaire wins, completed Snake games/scores, and Sudoku wins, plus the
separate Administrator sign-in used only to restore the protected local profile.

Local browser stats remain useful offline. This backend stores public global
statistics and leaderboards; it is not a trustworthy record for a competitive
or high-stakes game.

## Verified Production State — 2026-08-12

- The automated release for commit `6323c02db29dd18a667a98d60122466134f9a37a`
  completed successfully in [GitHub Actions run 31568841667](https://github.com/rohinshanker/personal-website/actions/runs/31568841667).
  Its verification, compatible Worker transition, Pages packaging, Pages
  deployment, and final live parity jobs all passed. This proves the required
  repository credentials and GitHub Pages Actions source are configured.
- A cache-busted production read found both the deployed browser configuration
  and Worker `/health` on
  `sha256-d707808da831507ece4fe8566912ef22f65a4c8f438daea4d35ced5fe9e7c2aa`.
  The public Worker endpoint remains
  `https://personal-site-game-stats.rohinshankerme.workers.dev`.
- The deployed Worker accepts the exact production origin and allows both
  `Authorization` and `Content-Type` in CORS preflight. It rejects local page
  origins by design, so test production credentials on the deployed site—not
  `localhost` or `127.0.0.1` against the public Worker.
- `scripts/home/game-stats-backend.js` now uses that public HTTPS endpoint. It
  contains no credential; the Worker secrets remain server-only.
- New sessions require an accepted browser hash. A valid signed and
  D1-backed session issued before a deployment remains usable until expiry,
  while any token-to-D1 build, issue-time, config, IP, expiry, or signature
  mismatch is rejected without consuming the session or storing an event.

## Local Release Candidate — 2026-09-05 (Not Deployed)

- The checked-in candidate is build
  `sha256-3eb3d0ae0871fc21f1e49c62b0e259ac2dccc247c7047e7b4d9de2766380c8fc`.
  It is not the live build described above. Deploy its rolling-compatible
  Worker first, require the transition gate, then publish the matching Pages
  artifact and run the full parity gate.
- Solitaire now generates randomized deals with a constructive winning path
  under its draw-one unlimited-redeal rules. The proof and regression workflow
  are documented in [Winnable Solitaire Deals](solitaire-winnable-deals.md).
- A player-scoped `GET /stats?playerId=...` now returns complete lifetime
  totals for Minesweeper wins, Solitaire wins, Snake games, and Sudoku wins.
  Game Progress prefers those verified D1-derived totals, refreshes whenever
  it opens and after a result publishes, and keeps the last confirmed totals
  through a transient refresh failure. Browser-local best times, scores, and
  records remain local. No D1 migration is required because the Worker derives
  the new totals from the existing validated event rows.
- The browser retries a temporary stale-build rejection for two minutes while
  a release finishes, then reports the failure instead of silently treating
  the result as publishable. Queued global submissions
  from the normal client flow always include a normalized, unexpired session
  proof; the Worker remains responsible for verifying its signature and D1
  state. The Worker accepts the active hash and the bounded, generated
  compatibility list for new sessions while allowing an already-issued HMAC-
  and D1-matched session to finish before its normal expiry.
- Sudoku has a persisted one-completion-per-puzzle latch. Both hint buckets
  increment the verified difficulty total, while only finite no-hints times
  enter Top 3, rank, and record data. Strict new-write validation rejects
  missing or non-integer times, malformed scalar/profile fields, mismatched
  difficulty, irrelevant cross-game fields, and invalid HMACs without consuming
  a reusable session. Repeating the exact accepted event is idempotent rather
  than incrementing any counter. Defensive historical-row reads remain
  separate from strict ingress.
- Local verification passes all 290 source tests, all 254 browser checks after
  isolated retry of nine parallel resource/timing flakes, and the generated-
  integrity check. The focused 16-test rendered lifetime-total and Solitaire publish
  matrix passes across 375×812, 768×1024, 1280×800, and 1440×900. It covers
  historical totals, automatic refresh-on-open and post-publication refresh,
  reload persistence, Administrator reauthorization, transient-failure
  retention and recovery, and bounded Game Progress layouts.
- A fresh isolated local D1 run on the final candidate accepted two no-hints
  wins and one hinted win, rejected a difficulty mismatch without consuming
  its session, accepted the corrected event, and returned `applied: false` for
  replay. The no-hints leaderboard contained only the 87- and 120-second
  results, the requested player was rank 1 of 2, and zero sessions remained
  unconsumed. No production D1 writes or deployments were performed.

Do not invent a Worker URL from the account ID. After deploying, copy the URL
from Wrangler's successful deployment output. A `workers.dev` URL is normally
`https://personal-site-game-stats.<workers-dev-subdomain>.workers.dev`, not
`<account>.workers.dev`; a custom route is also valid. The verified URL above
is the current endpoint for this site.

## Security Model And Its Limit

```text
game completion
  -> generated public build version
  -> POST /sessions (validated game/config/version + optional Turnstile)
  -> short-lived, server-HMAC-signed single-use session
  -> POST /events (normalized result + session proof)
  -> server validation, IP-hash rate controls, D1 idempotency
  -> global stats and leaderboards

Administrator sign-in
  -> POST /administrator/sign-in from the exact allowed browser origin
  -> keyed-IP limit (five attempts per 15 minutes) + constant-time credential checks
  -> one-hour, IP-bound, server-HMAC-signed proof held in session storage for one browser tab
  -> protected profile events require that proof
```

This is defense in depth, not proof of gameplay. The browser, its JavaScript,
the public SHA-256 build version, request data, and any client-side hash can be
read or changed by the visitor. An attacker can also automate a real browser
and request a valid session. Server-held HMAC keys, a single-use session,
timestamp/config checks, bounded metrics, rate limits, and Turnstile make
casual forgery and bulk spam harder, but cannot prove that a game was honestly
completed. Ordinary public profile IDs also do not prove account ownership.
Treat these as moderation-grade public stats. A competitive system would
require authenticated profiles plus authoritative server-side game simulation
or a server-validated deterministic seed and input replay.

Never turn CORS, a public hash, a client-only CAPTCHA result, or an event ID
into an authentication mechanism. CORS only controls cooperative browsers;
the Worker must reject malformed, replayed, expired, rate-limited, and
incorrectly signed requests itself.

## Checked-In Layout

```text
scripts/
  update-game-integrity.mjs          # Generates/checks public build metadata
  home/game-stats-backend.js         # Generated public API URL + build version
workers/game-stats/
  src/index.mjs                      # Worker routes and server validation
  migrations/                        # D1 schema and future additive migrations
  wrangler.jsonc                     # Deploy config; public vars only
  wrangler.jsonc.example             # Sanitized config template
  .dev.vars.example                  # Local secret names only
tests/
  game-stats-worker.test.mjs
  game-stats-integrity.test.mjs
```

Commit source, migrations, the generated public build metadata, and Wrangler
config. Do not commit `.dev.vars`, `.env*`, Cloudflare API tokens, Worker
secrets, or Turnstile secrets. The D1 `database_id` is configuration, not a
credential.

## Required Secrets And Public Variables

| Name | Kind | Purpose | Handling |
| --- | --- | --- | --- |
| `EVENT_SIGNING_SECRET` | Worker secret | HMAC-signs the opaque, short-lived game session proof. | Required in production; never return, log, or commit it. |
| `IP_HASH_SECRET` | Worker secret | HMACs `CF-Connecting-IP` before rate accounting, so D1 does not need the raw IP. | Required in production; do not use a plain or unsalted hash. |
| `ADMIN_USERNAME` | Worker secret | Administrator sign-in username. | Choose a non-personal identifier, store it in a password manager, and enter it only in Wrangler's prompt. |
| `ADMIN_PASSWORD` | Worker secret | Administrator sign-in password. | Use a unique high-entropy password; never put it in source, a command line, browser storage, or a URL. |
| `ADMIN_SESSION_SIGNING_SECRET` | Worker secret | Separately signs the one-hour proof for the protected administrator profile. | Generate a different random value from every other secret; rotation immediately invalidates outstanding administrator proofs. |
| `TURNSTILE_SECRET_KEY` | Worker secret | Calls Cloudflare Siteverify. | Do **not** set it yet: the current browser client does not send a Turnstile token. Set it only after shipping and testing the client widget flow; never expose it to the browser. |
| `GAME_BUILD_VERSION` | committed Worker var | Must equal the generated browser build version. | Public release metadata, updated only by the integrity script. |
| `GAME_BUILD_COMPATIBILITY_VERSIONS` | committed Worker var | Ordered recent browser hashes accepted during staged releases. | Public release metadata maintained only by the integrity script; never edit or reorder it manually. |
| `ALLOWED_ORIGIN` | committed Worker var | Browser CORS allowlist. | Public, but set it to the one exact production site origin. |
| Turnstile sitekey | browser config | Renders the Turnstile widget. | Public by design; it is not the secret key. |

Set every required production secret interactively from the Worker directory.
Paste each value only into Wrangler's prompt; do not put a secret after the
command or in shell history. Record the username and generated password in a
password manager, not in this repository. `ADMIN_SESSION_SIGNING_SECRET` is a
separate generated random value, not the account password.

```bash
cd workers/game-stats
npx wrangler secret put EVENT_SIGNING_SECRET
npx wrangler secret put IP_HASH_SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SIGNING_SECRET
```

If this is the first deployment and Wrangler reports that required secrets are
missing before it has created the Worker, use the documented bootstrap in
[Deploy In A Controlled Release](#deploy-in-a-controlled-release). Do not work
around it by placing a value in `wrangler.jsonc` or committing `.dev.vars`.

`TURNSTILE_SECRET_KEY` intentionally stays unset in this release. The Worker
enables Turnstile as soon as that secret exists, but the current browser request
contains no `turnstileToken`; setting it now would make every `POST /sessions`
request fail. See [Production Turnstile](#production-turnstile) for the later,
atomic client-and-Worker rollout.

For local-only development, copy `.dev.vars.example` to `.dev.vars`, set
development secret values there, and set `ALLOWED_ORIGIN` to the exact local
page origin being tested. Use deliberately different local administrator
credentials. Keep `.dev.vars` ignored. Production must use deployed Worker
secrets, not an uploaded `.dev.vars` file; do not add local origins to the
production Worker configuration.

## Build-Version Integrity Workflow

`scripts/update-game-integrity.mjs` computes SHA-256 over the files that make
completion decisions:

```text
scripts/home/main.js
scripts/home/core/dom.js
```

It writes the same public `buildVersion` to all three release artifacts:

- `scripts/home/game-stats-backend.js`
- `workers/game-stats/wrangler.jsonc`
- `workers/game-stats/wrangler.jsonc.example`

It also derives the cache key for `scripts/home/game-stats-backend.js`,
`scripts/home/core/dom.js`, and `scripts/home/main.js` in both HTML entry
points from that build version. This prevents a browser from pairing a cached
completion script or generated browser config with a newly deployed Worker.
Before replacing `GAME_BUILD_VERSION`, the updater moves the outgoing value to
the front of `GAME_BUILD_COMPATIBILITY_VERSIONS`, removes duplicates, and
retains at most 32 prior hashes. This rolling compatibility window lets the
transition Worker accept both the public site and the candidate site while
Pages changes over.

After **every** change to either listed source file, run:

```bash
node scripts/update-game-integrity.mjs
node scripts/update-game-integrity.mjs --check
node --test tests/game-stats-integrity.test.mjs
```

The first command is the only supported way to update `buildVersion`; do not
edit it by hand. The `--check` command and test fail when generated metadata
is stale. Commit the generated changes together with the gameplay change, then
redeploy the Worker because its accepted `GAME_BUILD_VERSION` changed.

Use the local-only check to compare the checked-in generated browser config
with the active Worker before a controlled release:

```bash
npm run game-stats:deployment:local-check
```

After a production release, check what browsers actually receive instead of
assuming that the checked-in file has reached the site:

```bash
npm run game-stats:deployment:check
# Equivalent from the Worker package:
npm --prefix workers/game-stats run deployment:check
```

The live-only check requests
`https://rohin.shanker.me/scripts/home/game-stats-backend.js` with `no-store`
semantics and a unique cache-busting query, parses its API URL and SHA-256, then
requests that API's no-store `/health` endpoint. It fails unless the deployed
browser hash and Worker hash are identical. It never creates a session or
writes to D1.

The release gate additionally requires the checked-in API URL and SHA-256 to
equal the deployed browser config and Worker health. It also fetches the live
`scripts/home/main.js` and `scripts/home/core/dom.js` bytes without caches,
recomputes the updater's ordered `relative path + NUL + bytes + NUL` digest,
and verifies that both live HTML entry points reference all three integrity
assets with the corresponding `game-build-...` cache token:

```bash
npm run game-stats:release:check
```

It polls the cache-busted browser config, completion sources, and HTML entries
for up to two minutes so an in-progress Pages deployment can converge. A stale
live config, source file, or HTML cache reference fails even when the
checked-in config and Worker already match.

The static-only form remains available as a read-only diagnostic:

```bash
npm run game-stats:static-release:check
```

It requires the checked-in config, recomputed live completion-source hash, and
both live HTML cache-token sets to converge while intentionally ignoring
Worker `/health`. The automated release does not use static-first ordering
because an independently published browser can expose a new-build/old-Worker
gap.

After deploying the candidate Worker and before publishing Pages, run:

```bash
npm run game-stats:worker-transition:check
```

This transition gate requires the Worker active hash to equal the checked-in
candidate, verifies that the coherent browser build currently served by Pages
is in the Worker's rolling compatibility window, and recomputes that live
browser's completion-source hash and HTML cache references. Pages publication
is unsafe until this check passes.

`.github/workflows/game-stats-worker-release.yml` separates credential-free
verification from production mutation jobs. Every pull request and `main` push
runs source tests, the integrity check, and a lockfile-installed strict
Wrangler dry-run; pull requests cannot reach Cloudflare or Pages deployment.
After a trusted `main` push or `main` workflow dispatch passes verification,
the workflow requires both repository secrets, rejects superseded revisions,
deploys the rolling-compatible Worker with Wrangler's `--strict` configuration
guard, and runs the transition gate. Only then does it package the public
static allowlist, upload a Pages artifact, deploy that exact artifact, and run
the full polling release gate.

GitHub Pages must use **GitHub Actions** as its publishing source. In the
repository, open **Settings → Pages → Build and deployment → Source** and choose
**GitHub Actions**. Do not leave Pages configured to publish directly from the
`main` branch: branch publishing can expose unverified browser files before the
Worker transition is ready, even when the release workflow fails. Keep the
`github-pages` deployment environment restricted to `main`.

Releases share one concurrency group per ref and a new push cancels the
superseded run. The immediate current-`main` check also fails closed when an old
successful run is manually rerun after a newer revision has landed. Both
Worker and Pages mutation jobs verify the current `main` revision immediately
before their release action. All
official GitHub actions are pinned to immutable commit SHAs and checkout does
not persist its GitHub credential. Configure these GitHub Actions repository
secrets:

- `CLOUDFLARE_API_TOKEN`: a narrowly scoped token allowed to deploy this Worker.
- `CLOUDFLARE_ACCOUNT_ID`: the account that owns the Worker and D1 database.

Keep both values in GitHub Actions secrets, never in repository variables or
source. A `main` release fails with an explicit error when either value is
missing; it must never report success while leaving an older Worker active.
Create `CLOUDFLARE_API_TOKEN` from Cloudflare's **Edit Cloudflare Workers**
template and scope it to the account that owns `personal-site-game-stats`;
`CLOUDFLARE_ACCOUNT_ID` is that account's ID. These CI credentials are separate
from the five encrypted runtime secrets already attached to the Worker. Confirm
those runtime secrets remain configured, and disable any Cloudflare Workers
Builds/Git integration that could deploy the same Worker in parallel.

Pushing alone is not enough for the first automated release. Complete the
one-time Pages-source selection and add both repository secrets, then rerun the
latest failed **Game Stats Worker release** run or use `workflow_dispatch` on
`main`. The release is complete only when the transition check, Pages deploy,
and final live parity check all pass.

If gameplay-completion logic moves to another file, first add that file to
`GAME_COMPLETION_SOURCE_FILES` in the script, update its test, run the updater,
and deploy the static site and Worker as one release. The script preserves the
public `apiBaseUrl`; after changing only that URL, still run the updater so the
generated config remains canonical.

## D1 Schema And Migrations

The checked-in schema stores validated events. The hardened protocol also needs
additive, tracked D1 state for one-time sessions and expiring rate-limit
records. Never edit a migration that has reached remote D1; add the next
numbered migration instead.

From the repository root, validate locally and then inspect remote state:

```bash
node --test tests/game-stats-worker.test.mjs tests/game-stats-integrity.test.mjs
node scripts/update-game-integrity.mjs --check

cd workers/game-stats
npx wrangler d1 migrations apply personal_site_game_stats --local
npx wrangler d1 migrations list personal_site_game_stats --remote
```

`migrations list --remote` is read-only. Apply pending production migrations
only after reviewing their output:

```bash
npx wrangler d1 migrations apply personal_site_game_stats --remote
```

The Worker uses bound D1 prepared statements; do not interpolate request data
into SQL. D1 migration application captures a backup and rolls back a failing
migration, but it still changes production state, so it belongs in the release
checklist rather than endpoint discovery.

## Hardened API Contract

The Worker exposes these routes:

| Route | Purpose | Write behavior |
| --- | --- | --- |
| `GET /health` | Queries D1 and reports the active `buildVersion` plus ordered `acceptedBuildVersions`. | None; a `200` proves the Worker can read its bound database and validated rollout configuration. |
| `GET /stats` | Reads global totals and Top 3 leaderboards; with `playerId`, also returns that player's lifetime totals, rank, and record for every supported category. | None; use this to verify D1 reads. |
| `POST /sessions` | Validates the requested game/config/build and creates a short-lived server-signed session. | Creates one expiring session only after all checks pass. |
| `POST /events` | Accepts the normalized result envelope and consumes its valid session exactly once. | Inserts one idempotent event and consumes its session in one transactional D1 batch, or rejects both changes. |
| `POST /administrator/sign-in` | Validates the Administrator username and password. | Creates no D1 profile data; returns a one-hour proof only after an exact-origin, rate-limited successful check. |

The browser must ask for a session before a result can be submitted. A session
request contains `game`, the allowed game `config`, the generated
`buildVersion`, and a fresh `turnstileToken` when Turnstile is enabled. The
Worker rejects unknown games/configurations, a build version outside its
explicit rolling compatibility window, expired timestamps, or a disallowed
browser Origin.

The result post uses the Worker’s normalized event envelope and server-issued
session proof. Do not add a frontend shortcut that sends a raw `win` directly
to `/events`. On the server, all of the following must be true before D1
changes:

- the session HMAC is valid, unexpired, matches the event game/config/version,
  and has not already been consumed;
- the event matches that game's completion type and valid metric bounds;
- event time is a plausible, bounded timestamp; and
- the keyed IP rate limit allows the request.

Strict event ingress accepts only scalar strings and the exact fields for that
game. The common fields are `id`, `game`, `type`, `occurredAt`, `metric`,
`metricKind`, and `profile`; Minesweeper adds only `difficulty`, Snake adds
only `boardSize`, and Sudoku adds only `difficulty` and `hintBucket`.
Solitaire has no category field. Reject arrays, objects in scalar fields,
unknown fields, and irrelevant cross-game fields before reading or consuming
the session. Historical D1 rows may be normalized more defensively for public
read availability, but that tolerance must never be reused for new writes.

An event profile has the exact public API shape `{ "id", "name", "icon" }`.
Fields used only by the browser, including `rerollCount`, must be removed at
the API boundary. Keep the Worker strict: an unknown profile field is a
contract error and must not consume the session. Attach the saved profile to
every result, including later Solitaire wins that do not reopen the profile
prompt, so accepted events can update player leaderboards.

The tracked result types are Minesweeper `win`, Solitaire `win`, Snake
`gamePlayed` with a bounded board score, and Sudoku `win`. Keep event-ID
idempotency as a second replay guard: retrying a completed request must not
increment counts twice.

For a valid `playerId` query, `playerTotals` must include Minesweeper wins by
difficulty, Solitaire wins, Snake total games and games by board size, and
Sudoku wins by difficulty and hint bucket. Count only validated historical
events whose normalized profile ID exactly matches the requested player;
exclude unprofiled, malformed, other-player, and duplicate-ID rows. Return the
complete zero-filled shape when the player has no matching events. The browser
must treat the field as available only after a successful player-scoped
response, preserve the previous confirmed global state when refresh fails, and
fall back to browser-local totals when talking to an older Worker that omits
the field. Opening Game Progress and successfully publishing a queued result
both trigger a fresh player-scoped read. Renewing authorization for an already
active Administrator profile must not reset that profile's browser-local data.

Sudoku records both `noHints` and `withHints` completions in the matching
difficulty total, but only a finite `noHints` time may enter a leaderboard,
requested-player rank, or personal record. The browser also keeps a persisted
per-puzzle completion latch: undo, redo, notes, or cell edits after a solve
must not record the same generated puzzle again. Only generating a fresh
puzzle may reset that latch and request a fresh single-use session. A puzzle
restored from local storage remains local-only because its original in-memory
session proof is unavailable; do not make restored client-controlled puzzle
state globally eligible by starting a new session for it.

Ingress metrics must be JSON safe integers. Minesweeper and Sudoku times and
Solitaire moves start at one; Snake scores start at zero; every game retains
its upper bound. Invalid stored legacy rows are skipped individually so one
old or corrupt value cannot take all public stats offline. For Snake, retain a
five-second minimum and the score-aware floor `900 + score × 118` milliseconds.
When a genuine quick result needs no more than five additional seconds, use
the Workers Scheduler wait and recheck the clock before the atomic D1 write.
Longer remaining delays return `425` with bounded `Retry-After` metadata and
must not consume the session, increment its event rate bucket, or insert an
event. The browser keeps that submission queued for a later manual refresh.

The administrator endpoint accepts exactly `{ "username", "password" }` and
never returns a credential. It requires an explicit allowed `Origin` header,
returns the same generic `401` response for every non-matching valid credential
pair, and limits attempts to five per keyed IP address per 15 minutes. A successful
response contains only the public protected-profile identity and an opaque
proof that expires one hour after issuance. The browser must keep that proof in
session storage for the current tab only, never in local storage, cookies, a
URL, analytics, or logs. This lets a refreshed deployed page finish saving a
valid, queued protected-profile completion. It is still an expiring bearer
proof, not a credential: the Worker checks its expiry and IP binding, and a
reset, a new tab, or expiry requires another sign-in. The Worker requires
`Authorization: Bearer <proof>` before accepting any event for the protected
profile; ordinary profiles retain the normal session flow.

The one-hour lifetime applies only to proofs issued after the updated Worker is
deployed. Previously issued proofs retain the expiry embedded in their signed
payload, including the former ten-minute lifetime; neither a browser refresh
nor the deployment extends them.

## Production Turnstile

Turnstile is not deployable yet: this repository currently has server-side
validation only. There is no browser widget, public sitekey, or
`turnstileToken` in the session request. Keep `TURNSTILE_SECRET_KEY` unset
until a dedicated client integration is reviewed and released.

That future release must add a production widget restricted to
`rohin.shanker.me`, a separate local/test widget, and the exact
`game-session` action. It must render the public sitekey in the browser, attach
a fresh widget token to every `POST /sessions` request, then set
`TURNSTILE_SECRET_KEY` through Wrangler's interactive prompt and deploy the
Worker and static site together. The sitekey is public by design; the secret
key never reaches the browser or repository.

For each session request, the Worker must call
`https://challenges.cloudflare.com/turnstile/v0/siteverify` itself. It must:

- send the private `TURNSTILE_SECRET_KEY` and the submitted token;
- pass `CF-Connecting-IP` as `remoteip` without storing the raw address;
- use a stable UUID `idempotency_key` if Siteverify needs a retried request;
- require `success: true`, the configured production hostname, and the exact
  session-creation action; and
- reject a failure, expired token, duplicate token, timeout, missing token, or
  unexpected hostname/action before session creation.

Siteverify tokens are single-use and expire after five minutes. Reset or
refresh the browser widget after a rejected submission; never cache a token.
Do not call Siteverify from the browser. Do not log the token, the secret,
session HMACs, or an IP-derived identifier.

## Deploy In A Controlled Release

1. Install dependencies and run local checks.

   ```bash
   npm --prefix workers/game-stats ci
   node --test tests/game-stats-worker.test.mjs tests/game-stats-integrity.test.mjs
   node scripts/update-game-integrity.mjs --check
   ```

2. Confirm the intended Cloudflare account and D1 migration state. These
   commands are read-only.

   ```bash
   cd workers/game-stats
   npx wrangler whoami
   npx wrangler d1 migrations list personal_site_game_stats --remote
   ```

3. Apply the reviewed remote migration. This changes production D1 state.

   ```bash
   npx wrangler d1 migrations apply personal_site_game_stats --remote
   ```

4. Set the five required secrets only through Wrangler's interactive prompt,
   then deploy. The initial deploy is safe while `apiBaseUrl` remains empty in
   the static site; no browser is pointed at the Worker yet. If this is the
   first Worker deployment and `wrangler secret put` cannot create the secret
   before the script exists, temporarily remove only the `secrets.required`
   block from the local `wrangler.jsonc`, deploy once, restore that unchanged
   block, set all five secrets, and deploy again. Never replace the block with
   plaintext values or commit the temporary configuration.

   ```bash
   npx wrangler secret put EVENT_SIGNING_SECRET
   npx wrangler secret put IP_HASH_SECRET
   npx wrangler secret put ADMIN_USERNAME
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put ADMIN_SESSION_SIGNING_SECRET
   npx wrangler deploy
   npx wrangler deployments list --json
   npx wrangler secret list
   ```

   Keep all five required secret names declared in `wrangler.jsonc`. This makes
   Wrangler fail a deployment when a required value has not been configured;
   it does **not** replace checking the deployed secret names with
   `npx wrangler secret list`:

   ```json
   "secrets": {
     "required": [
       "EVENT_SIGNING_SECRET",
       "IP_HASH_SECRET",
       "ADMIN_USERNAME",
       "ADMIN_PASSWORD",
       "ADMIN_SESSION_SIGNING_SECRET"
     ]
   }
   ```

   When the reviewed Turnstile browser integration is later released, add
   `TURNSTILE_SECRET_KEY` to the same required list only after setting it with
   `wrangler secret put`. Do not add it before the browser sends a token.

5. Copy the deployed `workers.dev` URL or configured custom-domain URL from the
   successful deploy output. If deployment asks for a `workers.dev` subdomain,
   register one in the Cloudflare dashboard. For production, prefer a dedicated
   custom domain such as `game-stats.rohin.shanker.me` when that zone is active
   in the same Cloudflare account; do not guess or overwrite an existing DNS
   record.

6. Set the copied public URL as `apiBaseUrl` in
   `scripts/home/game-stats-backend.js`, run
   `node scripts/update-game-integrity.mjs`, verify with `--check`, and publish
   the static site. The site must never contain a Worker secret or D1
   credential.

7. On releases that change covered gameplay sources, run the integrity updater
   first. Deploy the candidate Worker, require
   `npm run game-stats:worker-transition:check`, then publish the exact static
   artifact and run `npm run game-stats:release:check`. The normal GitHub
   Actions workflow owns this ordering. Cached builds remain in the explicit
   compatibility window, temporary mismatches retry in the browser, and an
   already-issued, unexpired signed and D1-backed session remains valid across
   the deployment.

For a Worker-only hotfix while production static files remain on an older
valid hash, do not run the ordinary deploy from a newer worktree. First read
the cache-busted live browser config and verify its sources and HTML cache
tokens. Then dry-run and deploy with that exact live hash passed through
`--var GAME_BUILD_VERSION:<live-sha256> --keep-vars --strict`. `--keep-vars`
preserves remote configuration and `--strict` fails rather than overwriting a
concurrent deployment. Run `npm run game-stats:deployment:check` immediately
afterward; the reported hash must remain the live browser hash. The normal
release command becomes safe again only after the static site and checked-in
Worker configuration converge.

## Endpoint Verification After Deploy

Set the real URL only in your terminal; it is public but avoids copying an
incorrect placeholder into commands.

```bash
export GAME_STATS_API_URL='https://personal-site-game-stats.<workers-dev-subdomain>.workers.dev'
curl --fail-with-body "$GAME_STATS_API_URL/health"
curl --fail-with-body \
  -H 'Origin: https://rohin.shanker.me' \
  "$GAME_STATS_API_URL/stats"
```

Confirm the health response's `buildVersion` exactly matches
`scripts/home/game-stats-backend.js`, that `acceptedBuildVersions[0]` is the
same value, and that every remaining accepted value is a generated lowercase
SHA-256 build before testing any result submission.

Run these negative checks before submitting real events; they should return a
4xx response and make no D1 write:

```bash
curl -i -X POST "$GAME_STATS_API_URL/sessions" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://untrusted.example' \
  --data '{"game":"snake","config":{"boardSize":"10"},"buildVersion":"invalid"}'

curl -i -X POST "$GAME_STATS_API_URL/sessions" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://rohin.shanker.me' \
  --data '{"game":"unknown","config":{},"buildVersion":"invalid"}'

curl -i -X POST "$GAME_STATS_API_URL/administrator/sign-in" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://rohin.shanker.me' \
  --data '{"username":"invalid","password":"invalid"}'
```

The administrator check must return the generic `401` response without
revealing whether either field was wrong. Do not paste a real administrator
credential into `curl`, browser devtools, a screenshot, a test, or a shell
command. Verify the successful flow only through the deployed site: open
Cursor Settings, click the title-bar `?` immediately before Close, enter the
credentials from the password manager, and confirm that the Administrator
window closes and the System Alert:

- uses the annoying-popup window shape and bundled warning-triangle icon;
- says exactly `Administrator access granted.` and nothing else; and
- has a right-aligned `OK` button.

Verify ordinary and protected publishing separately:

1. In a fresh browser profile on the deployed site, save the generated public
   player profile, then complete a duration-valid run of Minesweeper,
   Solitaire, Snake, and Sudoku through the real game controls.
2. For every game, confirm `POST /sessions` and `POST /events` return `201`,
   the event response has `applied: true`, the serialized profile contains
   only `id`, `name`, and `icon`, and the local retry queue is empty.
3. Refresh each stats window and confirm the matching count increments. Query
   `/stats?playerId=<id>` and reconcile the visible `Your Record` rank and
   metric for all 14 categories: three Minesweeper difficulties, Solitaire,
   four Snake board sizes, and six no-hints Sudoku difficulties. A qualifying
   result may appear in the public Top 3, but a player outside it must not
   replace a better global entry.
4. In a separate fresh tab, sign in as Administrator through the visible form
   and complete one duration-valid beginner Minesweeper game before the
   one-hour proof expires. Confirm the protected event returns `201` with
   `applied: true`, its count increments, its requested-player rank/record is
   correct independently of its public Top 3 position, and the queue drains.
5. Reconcile the accepted event IDs and public player fields with a read-only
   remote D1 query. Reopening or refreshing stats must not change totals;
   event-ID uniqueness and the Worker tests cover duplicate submission.

Also verify that an expired/replayed session, bad HMAC, mismatched build
version, and malformed metric are rejected. Test CORS with the expected origin
and a different origin. Test a reused Turnstile token only after the complete
Turnstile client flow is released.

## Reset Production Game Data

Use this only for an intentional full reset of server-held player and game
state. It preserves the D1 database, schema, indexes, migrations, Worker,
bindings, configuration, and secrets.

Do not use a full reset to clean up tagged production smoke data. Follow the
manifest-based scoped procedure in
[Game Stats Multiplayer Rankings](game-stats-multiplayer.md#production-tagging-and-cleanup)
so unrelated or concurrent production rows survive.

The reset target is exactly:

- `game_events`: game results and their public player identities;
- `game_stat_sessions`: issued/consumed session state and keyed IP hashes; and
- `game_stats_rate_limits`: event, session, and Administrator sign-in buckets.

Do not delete `d1_migrations`, `_cf_KV`, `sqlite_sequence`, tables, indexes, or
the database. Before deletion, inspect counts and capture the current Time
Travel bookmark. Cloudflare maintains Time Travel automatically; keep the
bookmark out of source and use it only for an approved recovery within the
account's retention window.

```bash
cd workers/game-stats
npx wrangler d1 time-travel info personal_site_game_stats --json
npx wrangler d1 execute personal_site_game_stats --remote \
  --command "SELECT (SELECT COUNT(*) FROM game_events) AS game_events, (SELECT COUNT(*) FROM game_stat_sessions) AS game_stat_sessions, (SELECT COUNT(*) FROM game_stats_rate_limits) AS game_stats_rate_limits;" \
  --json
```

Execute the three deletions as one semicolon-separated D1 batch. D1 batches
are transactional; do not add explicit `BEGIN` or `COMMIT`.

```bash
npx wrangler d1 execute personal_site_game_stats --remote \
  --command "DELETE FROM game_stat_sessions; DELETE FROM game_events; DELETE FROM game_stats_rate_limits;" \
  --json
```

Verify the reset with a separate read. Expected results are zero application
rows, the known migration count and names, and `quick_check = ok`.

```bash
npx wrangler d1 execute personal_site_game_stats --remote \
  --command "SELECT (SELECT COUNT(*) FROM game_events) AS game_events, (SELECT COUNT(*) FROM game_stat_sessions) AS game_stat_sessions, (SELECT COUNT(*) FROM game_stats_rate_limits) AS game_stats_rate_limits, (SELECT COUNT(DISTINCT player_id) FROM game_events WHERE player_id IS NOT NULL) AS distinct_players, (SELECT COUNT(*) FROM d1_migrations) AS d1_migrations; SELECT id, name FROM d1_migrations ORDER BY id; PRAGMA quick_check;" \
  --json
```

Finally, request public `/stats` both without a player ID and with a previously
valid player ID. Both responses must have no event IDs, empty leaderboard
arrays, every numeric counter in `totals` set to zero, all 14 `playerRanks`
objects equal to `{ "rank": null, "totalPlayers": 0 }`, and all 14
`playerRecords` values equal to `null`. Do not submit a successful event as a
smoke test because that would repopulate the reset database. Re-query D1 after
the public reads to detect a concurrent write.

This operation cannot erase profiles, progress, queues, or scores already held
in visitors' browser storage. A separately approved frontend storage-epoch
release can clear selected keys when a visitor next loads the site, but it
cannot reach dormant browsers or already-open tabs before reload.

## Repository And GitHub Secret Protection

Before every commit and release, run the repository guard:

```bash
node scripts/check-no-secrets.mjs
node --test tests/no-secrets.test.mjs
```

The guard scans tracked and non-ignored candidate files and reports only a
path/rule, never a matched value. The repository's GitHub Actions workflow runs
the same guard on pushes and pull requests. Keep `.env*`, `.dev.vars*`, private
key containers, and any temporary secret-export file untracked; `git add -f`
can still bypass `.gitignore`, but the guard rejects an indexed sensitive file.
Administrator username, password, and password-hash assignments receive a
dedicated any-length check across exact environment names and common camel-case
aliases, including quoted source literals and unquoted environment-file values.
Keep browser-test fixtures explicitly prefixed `test-only-` or `test-`; they
must never duplicate a deployed credential. The CI `gitleaks` job scans all
reachable history in addition to the current-tree source guard.

In GitHub repository **Settings → Advanced Security**, enable secret scanning,
generic secret detection when available, alert notifications, and push
protection. Do not bypass a push-protection finding unless it is confirmed to
be a harmless test fixture. If CI later deploys this Worker, put a dedicated
least-privilege Cloudflare API token only in a GitHub Actions secret—never in
source, a repository variable, `wrangler.jsonc`, a workflow literal, or shell
history.

If a real secret is ever committed or pasted into an issue, log, or workflow,
rotate it immediately, revoke the old credential, remove it from all reachable
Git history, and inspect GitHub secret-scanning alerts before considering the
incident resolved.

## Secret Rotation And Maintenance

Rotate a secret if it may be exposed and on the project’s normal security
schedule. Generate replacement values in a password manager or secure secret
tool, then use `npx wrangler secret put <NAME>` and `npx wrangler deploy`.
Never display the replacement in source, a shell command, a note, or a test.

- Rotating `EVENT_SIGNING_SECRET` invalidates outstanding short-lived sessions;
  this is safe and intentional. Users may need to finish/restart a game.
- Rotating `IP_HASH_SECRET` causes the current rate-limit buckets to use new
  keyed identifiers. Let old, expiring records age out; do not attempt to
  reverse or migrate the old HMAC values.
- Rotating `ADMIN_USERNAME` or `ADMIN_PASSWORD` changes the next required
  sign-in. Update the password manager first, then use `wrangler secret put`
  for the changed name and deploy; never publish these values to users.
- Rotating `ADMIN_SESSION_SIGNING_SECRET` immediately invalidates outstanding
  administrator proofs. This is safe: the user simply signs in again through
  the visible Administrator window.
- Rotate the Turnstile secret in the Cloudflare Turnstile dashboard, update
  `TURNSTILE_SECRET_KEY` in the Worker immediately, deploy, and verify one
  real widget flow. Rotate the sitekey only if the widget itself is replaced.
- A change to either hashed browser completion source is not a secret rotation:
  it requires `node scripts/update-game-integrity.mjs`, a matching Worker
  deploy, and a matching static-site publish. A Worker-only change that leaves
  `GAME_BUILD_VERSION` untouched requires Worker verification and deployment,
  but no integrity regeneration or static-site publish.

Keep Workers observability enabled, but record only operational outcomes and
coarse error reasons. Never emit request bodies, Turnstile responses, secrets,
session proofs, raw IPs, or IP HMACs to logs or analytics.

## Operational Next Steps

Use this checklist after the verified release and after every future Game Stats
change:

1. Keep frontend and Worker build metadata synchronized: regenerate integrity
   metadata, deploy the compatible transition Worker, require the transition
   gate, publish the same committed Pages artifact through GitHub Actions, then
   require the full live browser/source/HTML/Worker gate to pass on the
   identical active build hash.
2. Run the full source and rendered UI suites, including mobile and desktop
   multiplayer, unplayed, empty, loading, authentication, failure, and timeout
   states. Inspect the committed at-a-glance contact sheet when copy or state
   logic changes.
3. Exercise one ordinary player and the protected Administrator through the
   visible production UI. Confirm the local queue drains, Game Progress
   lifetime totals and requested-player rank/record agree with
   `/stats?playerId=...`, and public Top 3 data does not depend on the queried
   player. Reload once with local aggregate data cleared and verify the same
   lifetime totals return from D1.
4. For any production smoke run, export D1 and capture a Time Travel bookmark
   immediately before writes. Use a unique run prefix and a temporary manifest,
   then delete only exact manifest-listed events and sessions and reconcile
   every pre-existing row afterward.
5. Monitor Worker errors, rate-limit pressure, and D1 growth without logging
   request bodies, credentials, proofs, raw IPs, or IP-derived hashes. Let
   shared rate counters expire normally.
6. Rotate Administrator and signing secrets on the security schedule or after
   suspected exposure. Re-test the visible sign-in, one-hour proof,
   protected publish, and failure copy after rotation.
7. Add Turnstile only as an atomic browser-and-Worker release. Do not set the
   production secret until the widget sends a fresh token and the complete
   flow passes on the deployed origin.

## Official References

- [Workers Scheduler](https://developers.cloudflare.com/workers/runtime-apis/scheduler/)
- [Wrangler deploy command](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy)
- [Workers Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [D1 Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers routes and domains](https://developers.cloudflare.com/workers/configuration/routing/)
- [Turnstile server-side token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [GitHub secret scanning](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning)
- [GitHub push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
