# A_clash-royale-api-integration__20261001 — Active

- Scope: Restore the personal website's Clash Royale app for player `#28CYYU08P`, using the owner's requested [RoyaleAPI profile](https://royaleapi.com/player/28CYYU08P) as the data reference.
- Status: active
- Opened: 2026-10-01
- Updated: 2026-10-01
- Current State: Backend and requested visual edits are implemented on `codex/clash-royale-integration`. The live-data preview has a dedicated scrollable battle log, fixed profile/deck, leaderboard digit sprites, trophy/crown icons, eight card PNGs, and distinct Solitaire icons. Validation is complete and the live preview is ready for owner review. Hold main push and frontend publication for the owner’s visual review; keep this ticket active through release.
- Verification: Production Worker version `c83bb382-7595-4d74-90a9-b22f0ab5d71f`; authenticated live profile, eight deck cards, ten battles, five-minute cache, production CORS, and Refresh verified. Final Node suite passes 521/521; focused Clash Royale browser suite passes 12/12, including axe, six viewport sizes, scroll isolation, lifecycle, loading/error/empty states, and image fallback. Final full UI run: 421 passed and one Neko image-load assertion failed; the unchanged Neko four-viewport scenario passed on focused rerun. Both full nine-case visual comparisons passed after inspecting the three Solitaire icon baseline changes. Live preview has zero console errors/warnings. Syntax, generated artifacts, integrity, secret scan, and all six context scopes pass.
- Cleanup: After implementation and validation, distill reusable integration and verification guidance into `docs/validation/`, update its index, then resolve and delete this ticket and remove its queue row.

## Starting points

- `home.html`: commented desktop launcher, app window, and taskbar icon for `clash-royale`; the window includes a player card, performance statistics, and Refresh control.
- `scripts/home/main.js`: disabled API configuration, `loadClashRoyaleData`, rendering helpers, app-open loading hook, and Refresh wiring. Inspect shared helpers before changing or deleting them.
- `styles/home/portfolio.css`: disabled Clash Royale app styles.
- `docs/validation/test-suite.md`: existing loading, failure, and empty-state coverage backlog.

## Implementation acceptance

1. Resolve the data-source constraint below for player `#28CYYU08P`, confirm available credentials, and verify a viable server-side request path before selecting the integration design. Keep API credentials out of browser code and committed files; disclose any missing credential or approval needed before accessing it.
2. Restore the app's launchers, window, styles, initial data loading, and Refresh behavior. Define the supported player and battle data from the API's actual responses.
3. Handle loading, empty data, failed requests, authentication failures, and rate limits with clear status and retry behavior. Cover data mapping and request/error paths with automated tests.
4. Use the `ui-render-inspect-repair` skill to render and inspect the restored app at desktop and mobile sizes, including opening, closing, refreshing, and loading/error/empty states. Run the repository's applicable quality gates and verify the live API path before closing the ticket.

## Requested source and token requirements

- Owner request (2026-10-01): Pull information from `https://royaleapi.com/player/28CYYU08P`.
- [RoyaleAPI's About page](https://royaleapi.com/about) says its public API was discontinued in 2020. The player profile URL is not a supported JSON API endpoint. The research browser could not retrieve that specific profile, so its current fields have not been verified.
- [RoyaleAPI's developer support](https://discuss.royaleapi.com/t/getting-data-via-beautifulsoup/4697) asks developers not to scrape its site and directs them to the official Clash Royale API.
- Accepted integration: fetch this player's supported data server-side using a developer key from [Supercell's developer portal](https://developer.clashroyale.com/), and link to the requested RoyaleAPI profile. Check field availability before promising parity with RoyaleAPI's analytics or history.
- [RoyaleAPI's proxy documentation](https://docs.royaleapi.com/proxy) offers a route for servers without static IPs, but still requires an official API key with the proxy IP allowlisted. Recheck the documented IP and service availability before implementation. The deployed Worker’s authenticated request is verified. Its secret is `CLASH_ROYALE_API_KEY`, and the key allowlists the documented proxy IP `45.79.218.79`.

## Coordination and contract

- Coordinator: Codex session `2f758d2d-1790569488`; canonical checkout `/Users/Rohin/Desktop/coding_stuff/personal-website`, baseline `e48e18e221390c9ecca31e0af9e00fe20ae50263`.
- Multica runtimes are offline. Native Codex implementers use separate worktrees; coordinator owns documentation, integration, release, and final checks.
- `GET /clash-royale` returns `{ ok: true, player, battles, fetchedAt, cacheTtlSeconds: 300 }` for the fixed player `#28CYYU08P`. `fetchedAt` is the upstream fetch time as ISO text. Refresh requests may use the five-minute server cache; no public cache bypass or arbitrary proxy target.
- Errors use the existing `{ ok: false, error, code?, retryAfterMs? }` envelope. No credentials, upstream authorization text, or implementation instructions appear in the browser. The frontend renders only verified API facts and arithmetic; omit guessed deck archetypes.

## Patch and validation ownership

- Backend result: `2d5b02683f60ede1b9fbffe4a02938c98d8a20b2`, integrated as `4dc82cf`; runtime fixes integrated as `e1a345c`; independent Claude review and resulting repairs completed.
- Frontend result `5500f47`, integrated as `e925a02`; browser fixtures cover the backend envelope. Generated integrity metadata preserves the prior live build, and the new launchers have inspected mobile/desktop visual baselines.
- Coordinator adds `clash-royale:deployment:check` before Pages publication and after deployment; this checks live data, timestamp, and CORS with no access to the secret.

## Owner visual audit and release hold

- Do not push to `main` or publish the frontend until the owner finishes their audit and provides edits. This is explicit owner steering from 2026-10-01, not an automatic approval requirement.
- Preview: `http://127.0.0.1:4192/home.html`; open Clash Royale from the desktop. Server is `node /tmp/clash-royale-preview.mjs`, bound only to loopback, with live public GETs forwarded to the production Worker. No API key is present in the preview. Keep the server running for the owner.
- Live backend remains compatible with the currently published browser build `sha256-781e9e3fe27f372dd47374c6a25a1012956d78dbfebd7c55067d2d06b6e9e1c6`. Candidate browser build is `sha256-25b89cbf47690075134fb790aef0e7b3c46a455282de496eff2175a7ce1f648b`.
- The main remote is still baseline `e48e18e221390c9ecca31e0af9e00fe20ae50263`; nothing from this task has been pushed. Re-run affected checks after requested edits. Regenerate integrity metadata only when its tracked game-completion source files change; the visual revision leaves the candidate build hash unchanged.

## Visual audit revision

- Owner requested a dedicated scrollable battle log with fixed profile/deck, leaderboard-style formatting and seven-segment digits, distinct Solitaire `game_solitaire.ico` launchers, and relevant images/icons.
- Native frontend result `193b0eb` from baseline `4500b895` was integrated as `a5685af`; coordinator added Solitaire icons, licensed crown asset, cache tokens, documentation, and final validation. Both Multica runtimes were offline, so native fallback was used.
- Load only eight current-deck PNG URLs supplied by the official API (about 1.16 MB total for the current deck). No card or arena library download. Reuse the local pixel trophy and add one 286-byte MIT Pixelarticons crown. Arena art requires a verified current mapping; never show another arena under Spirit Square's label.
- Main push and frontend publication remain on hold for owner review.

- Focused revision checks: 9/9 Node and 12/12 browser tests pass, including independent wheel/keyboard scrolling, safe image handling and failure fallback, numeric accessibility, six-viewport overflow checks, and axe. Live PNGs and semantics inspected at 375×812, 639×900, 641×900, 768×1024, 1280×800, and 1440×900. Evidence: `/Users/Rohin/Documents/CodexEvidence/clash-royale-style-20261001`. Canonical live preview rechecked at phone and desktop sizes, all eight images decoded, Refresh succeeded, and browser console had zero errors/warnings.
- Final regression evidence: `/tmp/clash-style-final-node.log`, `/tmp/clash-style-final-ui.log`, `/tmp/clash-style-neko-recheck.log`, and `/tmp/clash-style-visual-final.log`. The Neko trace shows a sprite request still pending at its immediate image-loaded assertion; no Neko source or test was changed. Canonical live screenshots and semantic snapshots are in `.playwright-cli/clash-style-root/`. Colima was restored to its original stopped state, the inspection browser was closed, and the owner preview remains running.
