# Clash Royale Integration

- Purpose: Configure, release, and verify the public Clash Royale player app.
- Scope: Home app, `GET /clash-royale` on the existing Game Stats Worker, official API access, caching, and release checks.
- Last verified: 2026-10-02

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
  allowlisted fields and at most twenty recent battles in
  `{ ok, player, battles, fetchedAt, cacheTtlSeconds }`.
- The official profile and battle card entries supply elixir cost, rarity, and
  regular/variant artwork inline. No catalog request or asset-library download
  is needed. Current decks are bounded to eight cards; each historical
  participant deck may contain up to sixteen cards.
- Successful snapshots are cached for five minutes per Cloudflare location.
  Refresh may return that snapshot; `fetchedAt` identifies the data's fetch
  time. Arbitrary player tags, proxy targets, and cache-bypass queries are
  unsupported. The private Cache API key carries a schema version; bump it
  when a payload change would make an old cached snapshot incompatible.
- Upstream fetches have time and body-size bounds. Errors contain a public
  message and optional code/retry interval, never the raw upstream response
  or credential. Missing optional statistics stay unknown, rather than zero.
- Recent-battle arithmetic covers only the returned sample; it is not an
  account's full history or a reproduction of RoyaleAPI's proprietary analytics.

## Images and presentation

The app is named Clash Royale Stats on the desktop, taskbar, and window. Its
current deck uses four columns and two rows, with rarity glow (no visible rarity
word), names above the artwork, per-card elixir cost, and a one-decimal average
when every card has a known fixed cost. Hero/Evo labels sit next to current-deck
names; compact participant cards keep labels over the art and use Windows grey
backgrounds. Current Deck tiles use raised grey borders that depress on hover
and active without changing tile or grid dimensions. They remain semantic list
items. Player/stat frames use the shared sunken borders, with a separate inset
around each digit counter. At compact widths, let variant labels wrap rather
than forcing ordinary card names to break mid-word.
Mirror (card ID `28000006`) uses a variable `+1` label and makes the average
unavailable; missing costs must not become zero. Career wins and losses retain
text labels alongside green/red coloring. Per-card costs show the number and a
local potion icon whose accessible name identifies elixir; unknown costs show
an em dash with “Elixir unavailable” alternative text. Mirror retains its
`+1 variable` qualifier. The summary reads `Average Elixir: 3.9` followed by a
decorative potion icon (or “unavailable” when the average cannot be calculated).

Card images use only validated HTTPS PNG URLs supplied by the official API on
`api-assets.clashroyale.com`. Current-deck art loads when the app opens; battle
participant art loads only when its disclosure is expanded. Keep disclosure
image URLs in a private data attribute, not generic `data-src`: the site's
shared window media loader hydrates the latter on reopening, including images
inside collapsed details. Test a close/reopen cycle to prevent accidental
loading of every battle deck.

Selected deck entries with exact `evolutionLevel` 1 or 2 map to Evo or Hero,
respectively. Do not infer a selected form from rarity or `maxEvolutionLevel`;
ambiguous values such as 3 receive no variant label. Use the corresponding
validated `iconUrls.evolutionMedium` or `iconUrls.heroMedium` when provided.
If variant art is missing or fails, retain regular artwork and a labeled purple
EVO / yellow HERO frame; if regular art also fails, retain the card name and
metadata. Keep dimensions stable during loading. Do not guess asset URLs or
download a full card library. Arena art still requires a verified arena-ID
mapping.

Use the existing leaderboard digit sprites and local trophy icon. The pixel
crown, sword, and potion are vendored from the free MIT Pixelarticons set, with
sources recorded in `assets/pixelarticons/README.md`. Solitaire's desktop, taskbar, and Game
Progress icons use `game_solitaire.ico`; Clash Royale Stats uses
`game_freecell.ico`.

The battle list has its own bounded vertical scroll area; the surrounding
window may also scroll to accommodate the larger deck and player panels on
compact screens. Keep the Refresh button aligned with the last-update row and
all controls, disclosures, and the history footer reachable by keyboard and
pointer. The footer reports the actual number of available battles, up to 20,
and links to the fixed RoyaleAPI profile. Keep it after the final battle inside
the bounded scroll region, hidden at the top of a full history and reachable
at the bottom; never pin it outside that scroll area.

Match badges use exact type/ID mappings with explicit labels. Battle context
(such as Ranked, Challenge, or Clan War) takes precedence over a shared mode
ID. Clan War includes `boatBattle`, `riverRacePvP`, `riverRaceDuel`, and
`riverRaceDuelColosseum`; dedicated mode IDs include `72000266`, `72000267`,
and `72000268`. Require the known PvP/Ladder combination for Ladder; unknown
modes remain Other even when their raw names contain a familiar word. Do not
classify modes using substring guesses.

Every match badge exposes its actual `gameMode.name` on hover and keyboard
focus, falling back to `type`, then `Battle` when both are empty. Use a single
body-level tooltip, matching Solitaire's 12px pointer offset and 4px viewport
inset. Keep it out of layout and pointer hit testing; long raw titles wrap
within the viewport. Escape dismisses it until a fresh hover or focus, and
scrolling, resizing, window blur, page visibility changes, refresh rendering,
and app closure clear it. Avoid duplicate native title tooltips. Result and
mode badges have equal 26px heights and centered text on both axes. Ladder
uses `rgb(73, 212, 214)` with dark text. The battle title includes the player
name before “vs.” and preserves all participants on the correct sides.

## Validation and release

Run focused checks while editing, then the full quality gates in
[site-quality-gates.md](site-quality-gates.md). Render `/home.html` at
375×812, 768×1024, 1280×800, and 1440×900, including loading, populated,
empty, failed refresh, retry, and long content. Confirm usable controls,
accessible status, correct player-side battle results, Hero/Evo and
missing-image fallbacks, deferred battle-deck loading, and no accidental
overflow. Check raised/hover/active/reset card states, nested counter frames,
accessible elixir icons, badge hover/focus, and footer visibility at the
beginning and end of battle scrolling. Include the 639/641px breakpoint
neighbors.

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
It briefly polls a recognized pre-deployment card shape while a new Worker
propagates; unrelated malformed data, CORS, and configuration failures still
fail the gate.
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
