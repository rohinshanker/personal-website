# Clash Royale Integration

- Purpose: Configure, release, and verify the public Clash Royale player app.
- Scope: Home app, `GET /clash-royale` on the existing Game Stats Worker, official API access, caching, and release checks.
- Last verified: 2026-10-01

## Data and credentials

The app targets player `#28CYYU08P` and links to the
[RoyaleAPI profile](https://royaleapi.com/player/28CYYU08P). Data comes from
the official Clash Royale API through RoyaleAPI's proxy. RoyaleAPI's website
is not an API endpoint, and its maintainers
[disallow scraping even at low volume](https://discuss.royaleapi.com/t/royaleapi-scrape/50033).

Create a developer key at [Supercell's portal](https://developer.clashroyale.com/).
Allowlist the proxy IP from the [current proxy instructions](https://docs.royaleapi.com/proxy.html)
(`45.79.218.79` when verified). Store the key on the Worker using the private prompt:

```sh
cd workers/game-stats
./node_modules/.bin/wrangler secret put CLASH_ROYALE_API_KEY
```

The command updates the deployed Worker's secret. Do not put its value in
source, command arguments, browser storage, chat, or screenshots. Key rotation
uses the same command. Visitors need no account or token. For local backend
development only, use the ignored `.dev.vars` file and the same secret name.

## Request contract

- The browser uses `window.rohinGameStatsBackend.apiBaseUrl`; it never contacts
  the upstream API with a credential.
- The Worker fetches the fixed player's profile and battle log. It returns
  allowlisted fields and at most ten recent battles in
  `{ ok, player, battles, fetchedAt, cacheTtlSeconds }`.
- Successful snapshots are cached for five minutes per Cloudflare location.
  Refresh may return that snapshot; `fetchedAt` identifies the data's fetch
  time. Arbitrary player tags, proxy targets, and cache-bypass queries are
  unsupported.
- Upstream fetches have time and body-size bounds. Errors contain a public
  message and optional code/retry interval, never the raw upstream response
  or credential. Missing optional statistics stay unknown, rather than zero.
- Recent-battle arithmetic covers only the returned sample; it is not an
  account's full history or a reproduction of RoyaleAPI's proprietary analytics.

## Images and presentation

Current-deck art loads from the official API's allowlisted
`https://api-assets.clashroyale.com` PNG URLs, for at most eight cards when the
app opens. Do not download a whole card library or guess image URLs. Keep card
names usable when an image is unavailable, and retain intrinsic image sizes so
loading cannot move the surrounding controls. Arena artwork requires a verified
mapping to the actual arena ID; otherwise keep the arena name.

Use the existing leaderboard digit sprites and local trophy icon. The pixel
crown is vendored from the free MIT Pixelarticons set with its source recorded
in `assets/pixelarticons/README.md`. Solitaire's desktop, taskbar, and Game
Progress icons use `game_solitaire.ico`; Clash Royale uses `game_freecell.ico`.

The battle list owns vertical scrolling. Keep the title, Refresh control,
profile statistics, deck, and battle-list heading stationary. Verify keyboard
and wheel scrolling with ten battles at phone, tablet, and desktop sizes.

## Validation and release

Run focused checks while editing, then the full quality gates in
[site-quality-gates.md](site-quality-gates.md). Render `/home.html` at
375×812, 768×1024, 1280×800, and 1440×900, including loading, populated,
empty, failed refresh, retry, and long content. Confirm usable controls,
accessible status, correct player-side battle results, and no overflow.

```sh
node --test tests/clash-royale*.test.mjs
npx playwright test --project=ui tests/ui/clash-royale.spec.mjs
npm run game-stats:worker-secrets:check
npm run clash-royale:deployment:check
```

Use the normal [Worker and Pages release](game-stats-backend.md). The live
Clash Royale gate runs after Worker deployment and before Pages publication,
then again after publication. It verifies the exact player tag, a fresh
timestamp, the response contract, and production CORS without reading a key.
An authenticated live response is required for completion; mocked browser
fixtures alone cannot verify the credential or upstream service.

The runtime tests use Miniflare from the existing Worker dependencies to verify
real workerd fetch and Cache API behavior. Install both root and Worker
dependencies before running the Node suite. Compare `fetchedAt` across two
successive live requests to verify caching at the serving Cloudflare location.

## Failure diagnosis

- HTTP 503: confirm `CLASH_ROYALE_API_KEY` exists on the deployed Worker.
- Upstream authentication failure: confirm the key is active and the proxy's
  documented IP is allowlisted, then rotate the secret if needed.
- HTTP 429: honor the retry interval; repeated clicks must not bypass caching.
- HTTP 502/504: check upstream availability and response shape; keep the last
  successful browser snapshot visible and offer a retry.
- Stale timestamp or CORS failure: fix the server response before publishing
  the browser. Re-run the live gate; do not weaken it to skip unavailable data.
