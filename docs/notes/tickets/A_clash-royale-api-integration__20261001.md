# A_clash-royale-api-integration__20261001 — Active

- Scope: Restore the personal website's Clash Royale app for player `#28CYYU08P`, using the owner's requested [RoyaleAPI profile](https://royaleapi.com/player/28CYYU08P) as the data reference.
- Status: active
- Opened: 2026-10-01
- Updated: 2026-10-01
- Current State: Backend deployed and authenticated live data verified for `#28CYYU08P` (profile, eight current-deck cards, ten battles). Owner requested a personal visual audit before any push to main or frontend publication; hold both until their edits are integrated. Local implementation is on `codex/clash-royale-integration`. Keep this ticket active through that review and release.
- Verification: Production Worker version `c83bb382-7595-4d74-90a9-b22f0ab5d71f`; `clash-royale:deployment:check` and `game-stats:worker-transition:check` pass. Two live EWR requests returned HTTP 200 and identical `fetchedAt`, confirming Cache API use. Independent Claude review found no release blocker; missing-deck, timestamp metadata, close/module startup, and runtime cache-test findings were repaired. Focused Clash Royale browser matrix is 9/9, including axe, six viewport sizes, early opening, cancellation, loading, failure, and empty states. Both full nine-case visual runs passed. Full UI run had 416 passes and two failures: fixed launcher ordering and a local image-delivery timeout; both pass on focused rerun. Final Node suite passes 519/519. Live-data preview rendered at 1280×800 and 375×812; Refresh succeeds and console reports zero errors/warnings. Syntax, generated integrity, secret scan, and context checks pass.
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
- [RoyaleAPI's proxy documentation](https://docs.royaleapi.com/proxy) offers a route for servers without static IPs, but still requires an official API key with the proxy IP allowlisted. Recheck the documented IP and service availability before implementation. Production secret presence is verified; the authenticated request remains pending backend deployment.

## Coordination and contract

- Coordinator: Codex session `2f758d2d-1790569488`; canonical checkout `/Users/Rohin/Desktop/coding_stuff/personal-website`, baseline `e48e18e221390c9ecca31e0af9e00fe20ae50263`.
- Multica runtimes are offline. Native Codex implementers use separate worktrees; coordinator owns documentation, integration, release, and final checks.
- `GET /clash-royale` returns `{ ok: true, player, battles, fetchedAt, cacheTtlSeconds: 300 }` for the fixed player `#28CYYU08P`. `fetchedAt` is the upstream fetch time as ISO text. Refresh requests may use the five-minute server cache; no public cache bypass or arbitrary proxy target.
- Errors use the existing `{ ok: false, error, code?, retryAfterMs? }` envelope. No credentials, upstream authorization text, or implementation instructions appear in the browser. The frontend renders only verified API facts and arithmetic; omit guessed deck archetypes.

## Patch and validation ownership

- Backend result: `2d5b02683f60ede1b9fbffe4a02938c98d8a20b2`, integrated as `4dc82cf`; runtime fixes integrated as `e1a345c`; final independent Claude review underway.
- Frontend result `5500f47`, integrated as `e925a02`; browser fixtures cover the backend envelope. Generated integrity metadata preserves the prior live build, and the new launchers have inspected mobile/desktop visual baselines.
- Coordinator adds `clash-royale:deployment:check` before Pages publication and after deployment; this checks live data, timestamp, and CORS with no access to the secret.

## Owner visual audit and release hold

- Do not push to `main` or publish the frontend until the owner finishes their audit and provides edits. This is explicit owner steering from 2026-10-01, not an automatic approval requirement.
- Preview: `http://127.0.0.1:4192/home.html`; open Clash Royale from the desktop. Server is `node /tmp/clash-royale-preview.mjs`, bound only to loopback, with live public GETs forwarded to the production Worker. No API key is present in the preview. Keep the server running for the owner.
- Live backend remains compatible with the currently published browser build `sha256-781e9e3fe27f372dd47374c6a25a1012956d78dbfebd7c55067d2d06b6e9e1c6`. Candidate browser build is `sha256-25b89cbf47690075134fb790aef0e7b3c46a455282de496eff2175a7ce1f648b`.
- The main remote is still baseline `e48e18e221390c9ecca31e0af9e00fe20ae50263`; nothing from this task has been pushed. Re-run affected checks and regenerate integrity metadata after any requested edits.
