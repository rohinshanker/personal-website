# Game Stats Backend Setup

- Purpose: Controlled Cloudflare Worker and D1 release, security, production verification, and scoped data reset.
- Scope: Game Stats browser client, Worker, D1, secrets, Turnstile, Sudoku puzzle identity, the scheduled expiry purge, release synchronization, and server-data reset.
- Last verified: 2026-10-06

This guide deploys the automatic global game-stat backend: Cloudflare Worker +
D1 + browser integration. It covers the four tracked games: Minesweeper wins,
Solitaire wins, completed Snake games/scores, and Sudoku wins, plus the
separate Administrator sign-in used only to restore the protected local profile.

Local browser stats remain useful offline. This backend stores public global
statistics and leaderboards; it is not a trustworthy record for a competitive
or high-stakes game.

## Production release contract

Before a legacy-to-verified rollout, the `predeploy` script compares live client
protocol metadata with the candidate. If the live client is legacy, the operator
must select a future UTC `LEGACY_RESULT_ISSUANCE_CUTOFF`; empty closes new legacy
issuance. Existing proofs retain their original expiry. Protocol-2 metadata alone
does not show that every cached legacy tab has drained. Alternate configs,
environments, static-first releases, and rollbacks need operator coordination.


- A push to `main` must run source and browser verification, perform a strict
  Worker dry-run, deploy the rolling-compatible Worker, pass the transition
  check, publish the matching Pages artifact, and pass final live parity.
- Before deploying the Worker, confirm the build from the live browser config
  remains in `GAME_BUILD_COMPATIBILITY_VERSIONS`. Unpublished development builds
  can fill its 32-entry history and evict the actual live build; retain the live
  build explicitly before running the transition gate.
- During a transition to a different browser build, the integrity check also
  recognizes the pre-split three-file and pre-generator two-file manifests only if their fetched bytes
  reproduce the advertised hash and its HTML cache references match. Final
  parity always requires the complete current manifest, including the generator.
- When Worker source changes, record the new Cloudflare Worker version ID from
  the successful release job. Build-hash parity alone covers browser completion
  sources and cannot prove that a particular Worker source revision is active.
- The public endpoint is
  `https://personal-site-game-stats.rohinshankerme.workers.dev`. The Worker
  accepts only the exact production origin and intentionally rejects localhost.
- New sessions require an accepted browser build. A valid signed, D1-backed
  session issued before a deployment remains usable until expiry while invalid
  build, issue-time, config, expiry, or signature state fails closed. The
  client address may change during a game; it is not part of validation.
- The Worker release workflow applies pending D1 migrations automatically,
  immediately before the deploy, so the schema is in place when the new Worker
  starts serving. Only rollback-compatible migrations belong there. Proven
  unused-index removal and index replacement qualify; a table or column change
  the previous Worker could not survive is applied by hand in a reviewed release
  of its own. A browser-only change adds no migration and the
  step is a no-op.
- Before deploying, the release workflow asserts that every name in
  `wrangler.jsonc` `secrets.required` is present on the account. Wrangler itself
  ignores that block and a strict dry run says nothing about it, so a missing
  secret would otherwise surface only as a runtime 500.
- The same Worker serves the public Clash Royale profile. Its live data check
  gates Pages publication after Worker deployment and runs again after release;
  see [Clash Royale setup and validation](clash-royale.md).

Do not invent a Worker URL from the account ID. After deploying, copy the URL
from Wrangler's successful deployment output. A `workers.dev` URL is normally
`https://personal-site-game-stats.<workers-dev-subdomain>.workers.dev`, not
`<account>.workers.dev`; a custom route is also valid. The verified URL above
is the current endpoint for this site.

## Legacy game session lifetime and reuse

The session-creation budget for both protocols is 120 per IP-hash per hour.
The reuse rules in this section apply to legacy (`resultProtocol: 1`) proofs;
verified boards require fresh issued state and the replay/timing contract in
[leaderboard-result-verification.md](leaderboard-result-verification.md). Their lifetime
is six hours; expiry is inclusive. Browser reuse is limited to unconsumed,
unexpired sessions for the same game and normalized configuration, including
pending creation requests. Reuse retains the original server-issued timestamp:
later attempts inherit time from abandoned attempts for the minimum-duration
checks. Those checks bound session age, not an independently verified attempt
clock. The six-hour TTL still bounds reuse; server-verified attempt timing is a
separate contract in [leaderboard-result-verification.md](leaderboard-result-verification.md).
Recorded Snake losses consume their proofs because they submit a `gamePlayed` result.

A result reserves its proof before waiting for profile selection. Resetting or
starting another game cannot abort, reuse or replace that result's proof.
Changed configurations replace only the unclaimed reusable request. Failed or
expired slots require a fresh session when a new attempt begins. The browser
keeps at most one reusable slot per game; queued results own detached proofs.

Expired completions stay local and show the explicit expiry notice in the
per-game Stats window. The browser neither renews at completion nor sends an
already-expired proof. Expiry during a failed publication request is classified
separately from authentication or generic verification rejection. Server
minimum-duration, signed-proof and single-use checks remain unchanged. See
[shared-game-layer.md](shared-game-layer.md) and
[game-stats-refresh-control.md](game-stats-refresh-control.md) for hooks and
repeatable browser checks.

## Legacy security boundary

```text
game session start
  -> generated public build version
  -> POST /sessions (validated game/config/version + optional Turnstile)
  -> short-lived, server-HMAC-signed single-use session
  -> POST /events (normalized result + session proof)
  -> server validation, IP-hash rate controls, D1 idempotency
  -> global stats and leaderboards

Administrator sign-in
  -> POST /administrator/sign-in from the exact allowed browser origin
  -> keyed-IP limit (five attempts per 15 minutes) + constant-time credential checks
  -> one-hour, server-HMAC-signed proof held in session storage for one browser tab
  -> protected profile events require that proof; a rejected proof answers 403 with
     code "administrator-authorization" so the browser can renew sign-in once
```

This is defense in depth, not proof of gameplay. The browser, its JavaScript,
the public SHA-256 build version, request data, and any client-side hash can be
read or changed by the visitor. An attacker can also automate a real browser
and request a valid session. Server-held HMAC keys, a single-use session,
timestamp/config checks, bounded metrics, rate limits, and Turnstile make
casual forgery and bulk spam harder, but cannot prove that a game was honestly
completed. The keyed client-IP hash feeds only rate limiting and is recorded on
each session for abuse review; sessions and Administrator proofs are
deliberately not bound to the request address, because mobile carriers,
dual-stack networks, and privacy relays change it between game start,
sign-in, and publish, and a visitor can already request a session from any
address. Ordinary public profile IDs also do not prove account ownership.
The replay protocol validates the issued state and every logical transition,
then derives metrics on the server. Its timing, restore, and verification
limitations are in [leaderboard-result-verification.md](leaderboard-result-verification.md).
Legal replays still do not establish human play or exclude external solving.

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
  src/index.mjs                      # Small public Worker facade
  src/aggregate.mjs                  # D1 totals, window ranks, Top 3, acknowledgments
  src/events.mjs                     # Stored-event normalization and validation
  src/security.mjs                   # Origins, HMACs, rate limits, Administrator proof
  src/sessions.mjs                   # Session creation, validation, and atomic writes
  src/http.mjs                       # HTTP parsing, CORS, responses, five-second cache
  src/router.mjs                     # Routes and scheduled expiry purge
  src/constants.mjs, data.mjs        # Shared constants and response shapes
  migrations/                        # D1 schema and rollback-compatible migrations
  wrangler.jsonc                     # Deploy config; public vars only
  wrangler.jsonc.example             # Sanitized config template
  .dev.vars.example                  # Local secret names only
tests/
  game-stats-worker.test.mjs
  game-stats-sql.test.mjs
  game-stats-http-request.test.mjs
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
| `CLASH_ROYALE_API_KEY` | Worker secret | Reads the fixed Clash Royale player's profile and battle log through RoyaleAPI's proxy. | Required for the Clash Royale release gate; configure the upstream IP allowlist as described in [clash-royale.md](clash-royale.md). |
| `TURNSTILE_SECRET_KEY` | Worker secret | Calls Cloudflare Siteverify. | Do **not** set it yet: the current browser client does not send a Turnstile token. Set it only after shipping and testing the client widget flow; never expose it to the browser. |
| `GAME_BUILD_VERSION` | committed Worker var | Must equal the generated browser build version. | Public release metadata, updated only by the integrity script. |
| `GAME_BUILD_COMPATIBILITY_VERSIONS` | committed Worker var | Ordered recent browser hashes accepted during staged releases. | Public release metadata normally maintained by the integrity script; retain the observed live build before rollout if development builds evicted it. |
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

`LOCAL_ALLOWED_ORIGIN` and `EXTRA_ALLOWED_ORIGINS` are development-only origin
additions read from `.dev.vars`; the second accepts a comma-separated list. Both
are added to `ALLOWED_ORIGIN` rather than replacing it, and neither may appear in
`wrangler.jsonc` — `tests/game-stats-integrity.test.mjs` asserts their absence.

For local-only development, copy `.dev.vars.example` to `.dev.vars`, set
development secret values there, and set `ALLOWED_ORIGIN` to the exact local
page origin being tested. Use deliberately different local administrator
credentials. Keep `.dev.vars` ignored. Production must use deployed Worker
secrets, not an uploaded `.dev.vars` file; do not add local origins to the
production Worker configuration.

## Build-Version Integrity Workflow

`scripts/update-game-integrity.mjs` computes SHA-256 over the completion-source
manifest in `scripts/lib/game-build.mjs`: the four game scripts and Game Stats,
their transitive Home contracts, and the Sudoku generator worker. Manifest
closure tests prevent an extracted dependency from silently dropping out.

It writes the same public `buildVersion` to all three release artifacts:

- `scripts/home/game-stats-backend.js`
- `workers/game-stats/wrangler.jsonc`
- `workers/game-stats/wrangler.jsonc.example`

It also derives the cache key for `scripts/home/game-stats-backend.js` and every
declared completion source in both HTML entry
points from that build version. This prevents a browser from pairing a cached
completion script or generated browser config with a newly deployed Worker.
Before replacing `GAME_BUILD_VERSION`, the updater moves the outgoing value to
the front of `GAME_BUILD_COMPATIBILITY_VERSIONS`, removes duplicates, and
retains at most 32 prior hashes. This rolling compatibility window lets the
transition Worker accept both the public site and the candidate site while
Pages changes over.

The window is a count, not a time. `MAX_GAME_BUILD_COMPATIBILITY_VERSIONS` in
the Worker refuses configurations above 32 entries and the updater keeps the
32 newest. Only a release that changes the game build hash adds an entry, and
once the list is full each one evicts the oldest, so at N distinct new hashes
per day a cached browser stays accepted for roughly 32 / N days. The limit lives in
`scripts/lib/game-build.mjs` and again in the Worker source; raise both
together if the release cadence needs a longer grace window.

After **every** change to a declared completion source, run:

```bash
node scripts/update-game-integrity.mjs
node scripts/update-game-integrity.mjs --check
node --test tests/game-stats-integrity.test.mjs
```

The first command is the only supported way to update `buildVersion`; do not
edit it by hand. The `--check` command and test fail when generated metadata
is stale. Commit the generated changes together with the gameplay change, then
redeploy the Worker because its accepted `GAME_BUILD_VERSION` changed.

## Stats read, cache, and acknowledgment contract

The SQL aggregation and protocol-2 source was verified in production as Worker
version `a28081b4-d91f-4c93-8329-87b82353dd01`. Record a new version ID when
Worker source changes; a later documentation-only deployment can have a new
version ID with identical source.

The current browser reads
`GET /stats?protocol=2&playerId=<id>&pendingEventId=<id>...`. Protocol 2 returns
SQL-derived totals, global Top 3 arrays, the requested player's rank and full
record, and only the requested IDs that D1 actually contains in
`acknowledgedEventIds`. A request accepts at most 32 pending IDs. The response
does not contain the lifetime event-ID set, so its size is bounded by the stats
shape rather than table growth. An unversioned request remains an explicit
protocol-1 compatibility path for already-cached browser builds and still
returns `eventIds`; remove that path only in a separately verified release.

Ordinary protocol-2 reads use `caches.default` for five seconds. The internal
cache key contains the normalized protocol and player ID, never `Origin`, and
the cached object contains no CORS headers. Each response reconstructs CORS
for the current request and remains browser `no-store`. Reads containing
`pendingEventId`, `fresh=1`, or a legacy protocol bypass the cache. Manual
Refresh and the read immediately after a successful publication use `fresh=1`
and browser `cache: "no-store"`. A successful modern bypass also refreshes the
ordinary cache entry, stripping request-specific acknowledgments first, so a
later ordinary read cannot regress to the pre-publication snapshot. Cache
failures fall through to D1; failed D1 reads return an uncached 500.

Migration `0004_optimize_stats_aggregation.sql` replaces the four category
indexes with partial category indexes matched to the grouped/window queries.
It removes the obsolete broad game/type and player indexes while retaining
session-expiry, rate-limit-expiry, and Sudoku puzzle-identity indexes. The real
SQLite test asserts `EXPLAIN QUERY PLAN` uses all four category indexes. They
restrict scans by game/type; profile lookups and window sorting still read the
table and use temporary B-trees, so they are not covering indexes.
Every uncached read normalizes historical strings and scans those partitions.
Unicode trimming costs more than SQLite’s default ASCII-space trim; retain the
parity regression tests and monitor D1 latency as history grows.

Totals, rankings, and acknowledgments share one bound future-date cutoff in a
D1 batch. Historical unpadded calendar dates must parse in SQLite; relative values such
as `now`, time-only strings, and padded ISO timestamps are rejected. Released
Workers store canonical UTC ISO timestamps. String fields use JavaScript's
whitespace set, and returned names retain the 32 UTF-16-unit limit.

For Worker-only coverage, exclude test helpers explicitly:

```bash
node --test --experimental-test-coverage \
  '--test-coverage-include=**/workers/game-stats/src/**' \
  --test-coverage-lines=95 tests/game-stats-worker.test.mjs \
  tests/game-stats-sql.test.mjs tests/game-stats-http-request.test.mjs
```

## Confirmed-event UI convergence

The browser removes a queued result after `POST /events` succeeds, but retains
that exact normalized event in a bounded 32-entry map until a later `/stats`
response explicitly acknowledges an ID that this request sent. An absent
acknowledgment never discards a confirmed result. During that interval, the
confirmed event is applied once to the
in-memory global totals and, when the response is player-scoped, the matching
player totals. This keeps an already-open Game Progress or Game Stats window
current when the immediate follow-up read fails or briefly returns an older
snapshot. A response for a profile that changed while the request was in flight
is ignored and schedules another sync. Explicit acknowledgment prevents the
later authoritative response from incrementing the count twice.

For Solitaire, validate all count surfaces together: Game Progress wins, the
personal record row and rank, the current player's Global Top 3 row when
present, and Global Wins. Re-sort the visible Top 3 after applying a confirmed
win and derive the player's displayed rank from that order. A release
regression must keep both windows open, publish an
Administrator result with a valid proof, return one stale `/stats` response
that omits the acknowledgment, and then return an authoritative response that
acknowledges the requested ID. Both states must show one increment and the same updated rank,
and the submission queue must be empty after the accepted write.

Run the focused contract and rendered checks with:

```bash
node --test tests/game-stats-frontend-contract.test.mjs \
  tests/game-stats-worker.test.mjs \
  tests/solitaire-stats-layout.test.mjs
npx playwright test tests/ui/solitaire-publish-flow.spec.mjs \
  tests/ui/game-progress-overall-totals.spec.mjs --workers=2
```

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
declared completion-source bytes without caches,
recomputes the updater's ordered `relative path + NUL + bytes + NUL` digest,
and verifies that both live HTML entry points reference every declared integrity
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

- `CLOUDFLARE_API_TOKEN`: a narrowly scoped token allowed to deploy this Worker
  and apply migrations with **Account → D1 → Edit** on its database account.
- `CLOUDFLARE_ACCOUNT_ID`: the account that owns the Worker and D1 database.

Keep both values in GitHub Actions secrets, never in repository variables or
source. A `main` release fails with an explicit error when either value is
missing; it must never report success while leaving an older Worker active.
Create `CLOUDFLARE_API_TOKEN` from Cloudflare's **Edit Cloudflare Workers**
template, add **Account → D1 → Edit**, and scope it to the account that owns
`personal-site-game-stats`;
`CLOUDFLARE_ACCOUNT_ID` is that account's ID. These CI credentials are separate
from the five encrypted runtime secrets already attached to the Worker. A token
that can deploy a Worker or inspect its secrets may still lack direct D1 access;
error `7403` during migration requires checking D1 permission and account scope,
not bypassing the migration step. Confirm
those runtime secrets remain configured, and disable any Cloudflare Workers
Builds/Git integration that could deploy the same Worker in parallel.

Pushing alone is not enough for the first automated release. Complete the
one-time Pages-source selection and add both repository secrets, then rerun the
latest failed **Game Stats Worker release** run or use `workflow_dispatch` on
`main`. The release is complete only when the transition check, Pages deploy,
and final live parity check all pass.

The completion-source manifest is `scripts/lib/game-build.mjs`. The generator
worker is included because the solution it returns decides whether a Sudoku board is
correct and complete, so a release that changes only the worker changes what
counts as a win. If gameplay-completion logic moves to another file, update
the game seeds and their transitive contract closure in `GAME_COMPLETION_SOURCE_FILES`;
`INTEGRITY_CACHE_ASSET_PATHS` derives the corresponding cache assets. Then
update its test, run the updater, and deploy the static site and Worker as one
release. `tests/game-stats-integrity.test.mjs` mutates each declared source in
turn and requires the build version to move, so a source that the digest does
not actually read is caught there rather than in production. The script preserves the
public `apiBaseUrl`; after changing only that URL, still run the updater so the
generated config remains canonical.

## D1 Schema And Migrations

The checked-in schema stores validated events. The hardened protocol also needs
additive, tracked D1 state for one-time sessions and expiring rate-limit
records. Never edit a migration that has reached remote D1; add the next
numbered migration instead.

Migration `0005_add_verified_game_results.sql` adds the issued-session timing
columns and the `verified_timing_transitions`, `verified_game_completions`,
`verified_completion_jobs`, `verified_completion_progress`, and
`verified_completion_replay_chunks` tables for the replay-verification
protocol in [leaderboard-result-verification.md](leaderboard-result-verification.md).
Apply it before deploying code that queries these tables/columns. Inspect the
actual migration ledger before changing it: an unapplied local migration may
be amended, but any applied migration is immutable and needs a new numbered
follow-up. `/health` table-count success does not validate every column. Never
reset historical events to repair schema or configuration drift.

From the repository root, validate locally and then inspect remote state:

```bash
node --test tests/game-stats-worker.test.mjs tests/game-stats-sql.test.mjs \
  tests/game-stats-http-request.test.mjs tests/game-stats-integrity.test.mjs
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

The release workflow's `deploy-worker` job applies pending migrations with the
production credentials immediately before `wrangler deploy`, so the schema the
new Worker expects is already in D1 when it starts serving.
`tests/game-stats-deployment.test.mjs` pins that step, its credentials, and its
position ahead of the deploy. Only rollback-compatible migrations may run there: a
migration that a rollback to the previous Worker could not survive belongs in a
reviewed manual release instead.

### Sudoku puzzle identity

- Migration `0003_add_sudoku_puzzle_identity.sql` and the puzzle-identity handler
  first deployed as Worker version `796ee42e-72d9-4e6a-9c4c-5d61773852ae`.

- A Sudoku win may carry `puzzleId` and `puzzle`, the 81-character board string
  it was solved from. Migration `0003_add_sudoku_puzzle_identity.sql` stores
  them as one `puzzle_key` of `<puzzleId>:<puzzle>` and adds a partial unique
  index on `(player_id, puzzle_key)` where both are non-null, so a player has at
  most one recorded win per puzzle.
- This closes the cross-tab races the browser's claim list cannot: same-instant
  completions, a claim dropped by concurrent writes, and eviction past the
  claim list's 500-puzzle cap all reach the Worker as a second event id for one
  puzzle. The browser contract and its limits are in
  `sudoku-leaderboard-eligibility.md`.
- A second win for a puzzle already on record is not an error. The Worker
  answers `{ ok: true, applied: false, eventId: <the recorded event> }`. The
  id is the row that stands, never the submitted one, so a client is never
  told to look in `/stats` for an event that was never written — that holds
  for the duplicate shortcut, for a loss at the unique index, and for two
  results racing one session.
- The duplicate answer is not a shortcut around validation. It sits behind
  `validateSession`, so a duplicate carrying a session for another game, a
  different difficulty, or an unsigned proof is refused like any other bad
  submission, and the session a duplicate does supply is spent. A duplicate
  must not leave a validated session open for a different result. A consumed
  session with a new event id still passes the row/token, difficulty, event
  window, eligibility, and rate-limit checks before duplicate acknowledgement;
  exact event-id retries retain their existing idempotent response.
- The browser must not confirm a submission the Worker answered with another
  event id. That submission stored nothing, so counting it would add a second
  win to the local totals, and `reconcileConfirmedGameStatsEvents` only drops
  a confirmed event once its own id appears in the server list — an id that
  lost a race never will, so the inflation would survive every refresh.
- Both fields are optional and travel together. A Worker released ahead of the
  browser that sends them keeps accepting wins without them and stores a null
  `puzzle_key` — the same rolling compatibility the accepted build versions
  have. One field without the other, or a puzzle that is not 81 digits, is a
  400: that is a malformed event, not a legacy one.
- A stored row with no key still matches a retry that brings one, so an event
  published before the rollout can be replayed during it. A stored key that
  differs is a 409, as any changed result is.

### Scheduled expiry purge

`game_stat_sessions` gains a row for every game start and
`game_stats_rate_limits` one per address-and-operation bucket. No request path
deletes either, so the Worker's `scheduled` handler is the only thing that
bounds those tables and the only consumer of the `*_expiry_idx` indexes from
migration `0002`.

The contract:

- `triggers.crons` in both `wrangler.jsonc` and `wrangler.jsonc.example` is
  `["0 * * * *"]`. The two files must always declare the same schedule.
- One atomic batch deletes `game_stat_sessions` and `game_stats_rate_limits`
  rows whose `expires_at` is at or before the purge time. Expiry is inclusive
  because a session whose `expires_at` equals now already fails validation.
  The protocol-2 purge also removes expired timing transitions, jobs, progress
  checkpoints, replay chunks, and unpublished completion receipts. Migration
  0005 must be applied before this handler can run. Published completion
  receipts remain available for idempotent publication retries.
- A consumed session is kept until it expires. Deleting it early would turn a
  replayed result into "no longer on record" instead of "already used". The
  same holds for an unpublished verified completion: it is swept only once
  its own `expires_at` passes, never on consumption.
- The purge deletes no `game_events` row. Published results are permanent; only
  the short-lived security tables are swept.
- Each run logs the session, rate-limit, verified-state purge counts and timestamp. Cloudflare's scheduled
  invocation log is where to confirm the cron fired.
- First deployed with the purge handler as Worker version
  `6d26f54b-b328-46df-a0ab-6c01e3db9ac4` (release run 36366610966,
  2026-09-28, `schedule: 0 * * * *` reported by the deploy).

Verify a deployed change to the handler:

```bash
node --test tests/game-stats-worker.test.mjs
cd workers/game-stats
npx wrangler deploy --dry-run --config wrangler.jsonc --strict
# After the release job deploys, record its Worker version ID and confirm the
# next scheduled invocation in the Cloudflare dashboard's Cron Triggers view.
# `expires_at` holds an ISO UTC string, so the cutoff must use that exact
# format: datetime('now') separates the date and time with a space, which sorts
# below every same-day 'T' timestamp and misses rows that expired earlier today.
npx wrangler d1 execute personal_site_game_stats --remote --command \
  "SELECT COUNT(*) AS overdue FROM game_stat_sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')"
```

Rows that expired since the last hourly run are expected, so the cutoff is an
hour old: a non-zero `overdue` count means the trigger is not running. Check the
Cron Triggers view before changing code.

## Hardened API Contract

Result protocol 2 adds `POST /sessions/:id/timing`, `POST /sessions/:id/finish`,
`POST /sessions/:id/finish/continue`, and `POST /sessions/:id/restore`;
`POST /events` receives the canonical event plus a completion receipt. See
[leaderboard-result-verification.md](leaderboard-result-verification.md) for
that contract. The session-proof write behavior below is the legacy
(`resultProtocol: 1`) path; health, stats, profiles, and Administrator auth are
shared by both protocols.

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
puzzle may reset that latch and request a fresh single-use session. A legacy puzzle restored without its in-memory proof remains local-only.
Protocol 2 can restore the original unexpired, ready/acknowledged-paused proof
and replay; a running or arbitrary save cannot become globally eligible by
starting a fresh session for it.

Ingress metrics must be JSON safe integers. Minesweeper and Sudoku times and
Solitaire moves start at one; Snake scores start at zero; every game retains
its upper bound. The browser accumulates Minesweeper's time since the first reveal: at
each sync (every second while running, and once more at the win) it adds
whichever of `performance.now()` and `Date.now()` advanced further, never a
negative amount, in whole seconds capped at 999. The guarantees are exactly
these: the displayed time never decreases; a hidden or throttled tab counts in
full; system sleep counts in full; a device clock moved backwards while the
page is awake does not change the metric; a device clock moved forwards can
only lengthen it. The one known undercount is a backwards clock change inside
the same sync interval as a sleep that paused the monotonic clock: only the
wall-clock advance that remains is counted (10 s awake, 60 s asleep, clock
back 20 s records 50, not 70), because no browser clock reports the lost time.
The metric is a client measurement, not a tamper-proof one. This paragraph
covers the metric alone: the event timestamp still comes from the device
clock, so a clock change during a game can put the result outside its session
or event-date window and the Worker then rejects it. Invalid stored legacy rows are skipped individually so one
old or corrupt value cannot take all public stats offline. For legacy Snake, retain a
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
proof, not a credential: the Worker checks its signature, scope, and expiry,
and a reset, a new tab, or expiry requires another sign-in. The Worker requires
`Authorization: Bearer <proof>` before accepting any event for the protected
profile; ordinary profiles retain the normal session flow.

Home and Video Editor load `core/administrator-session.js` before their route
scripts. It owns proof normalization, the session-storage key, the protected
profile identity, and the expiry/storage lifecycle. Both routes cap a stored
proof at the server expiry or one hour from acceptance, whichever comes first;
restoring a normalized proof never extends its recorded expiry. In-memory
sessions remain bounded by that expiry when browser storage is unavailable.
Expiry or storage revocation returns an open Home Admin Controls window to its
access gate while preserving its local settings. Video Editor retains its project
while presenting its sign-in overlay. The shared-literal test compares the public
profile with the separately deployed Worker constants. Keep credential submission and each route's sign-in UI in
the route adapters.

Every rejected proof (missing, malformed, tampered, expired, or wrong profile
identity) returns `403` with `code: "administrator-authorization"` before the
game session is read. A `403` without that code is a rejected game session
(tampered token, stored-row mismatch, expiry, or origin) and must never be
treated as a lost proof. The browser applies exactly this contract in its
sync pass:

- A `403` for the protected profile with no proof attached keeps the result
  queued and opens sign-in.
- A coded rejection of a presented proof clears the proof, increments the
  queued result's `proofRejections`, and renews sign-in only while that count
  is at most `GAME_STATS_MAX_ADMINISTRATOR_PROOF_RETRIES` (one renewal).
- Every coded rejection clears the presented proof. A proof rejected again
  after renewal drops the queued result with the
  `could not pass server verification` notice while keeping the local win.
- Any other `403` drops the queued result the same way but keeps the current
  proof, because the game session, not the sign-in, was rejected.
- A queued result whose protected identity is not the canonical name and icon
  is dropped before any request; no credential can repair it.
- The proof still carries the keyed IP hash from sign-in as informational
  data so a rolled-back Worker revision keeps accepting new proofs from the
  same address; the current Worker does not compare it.

The one-hour lifetime applies only to proofs issued after the updated Worker is
deployed. Previously issued proofs retain the expiry embedded in their signed
payload, including the former ten-minute lifetime; neither a browser refresh
nor the deployment extends them.

## Repair Guide: Administrator Sign-In Loop After A Protected Result

Symptoms: after completing a game as the protected profile, the sign-in window
reopens after every successful sign-in, the stats row stays on
`Waiting for authentication...` while the dialog is open, the sign-in rate
limit (`429`) eventually fires, the win is missing from global stats, and D1
shows the game's session with `consumed_at = NULL`, an
`administrator-sign-in:` bucket at its limit, and no `events:` bucket.

Root cause (fixed 2026-09-10): session and proof validation compared the
keyed client-IP hash from the current request with the one captured at issue
time. A client whose address changed mid-game received `403` from the session
check, and the browser treated every protected-profile `403` as a rejected
proof, cleared it, and reopened sign-in indefinitely.

Durable fix: the Worker no longer compares the request address for sessions
or proofs and tags proof rejections with `code: "administrator-authorization"`;
the browser reopens sign-in only for a missing or coded proof rejection,
renews a rejected proof once per queued result, and otherwise records a
server-verification rejection.

Regression checks:

```bash
node --test tests/game-stats-worker.test.mjs \
  tests/game-stats-administrator-publish.test.mjs \
  tests/administrator-sign-in.test.mjs
npx playwright test tests/ui/solitaire-publish-flow.spec.mjs \
  -g "rejected Administrator"
```

Read-only diagnosis from the Worker directory when the symptom recurs:

```bash
npx wrangler d1 execute personal_site_game_stats --remote --json --command \
  "SELECT game, issued_at, consumed_at, substr(ip_hash,1,6) AS ip FROM game_stat_sessions ORDER BY issued_at DESC LIMIT 10; SELECT substr(bucket,1,22) AS bucket, request_count, window_started_at FROM game_stats_rate_limits ORDER BY window_started_at DESC LIMIT 10;"
```

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
- A change to a declared browser completion source is not a secret rotation:
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

- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
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
