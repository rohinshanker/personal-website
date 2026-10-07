# Home loading and on-demand resources

- Purpose: Keep Home initialization ordered while excluding hidden event and Administrator resources from the initial page load.
- Scope: `home.html`, the entry-page warm-up list, classic-script ordering, random-event styling, Administrator activation, cache tokens, and regression checks.
- Last verified: 2026-10-07

## Initial-load contract

- Every classic Home script uses `defer` and keeps its document order. Do not add
  `async`, dynamically reorder the main chain, or convert a classic script to a
  module without checking its globals and initialization order. The Clash Royale
  entry remains a module.
- `scripts/home/core/resources.js` is eager because both event and Administrator
  activation use it. It owns one state and one in-flight promise per resource;
  concurrent callers must share that promise, a failed element must be removed,
  and the next call must be able to retry.
- `styles/home/base.css` keeps the shared alert/window chrome, hidden state, and
  opening/closing rules needed before an on-demand stylesheet arrives. Static
  non-window overlays also keep any initial hiding needed to prevent fallback
  text or media from painting; `#lost-grace-overlay` and
  `#vanishing-popup-explosion` are the two current cases.
  Event-only presentation stays in `styles/home/random-events.css`.
- Do not add random-event CSS, Administrator CSS, or Administrator scripts to the
  initial Home markup or `index.html` warm-up list. A warm-up change must match
  the actual eager Home graph.

## Random-event activation

`showManagedRandomEventWindow()` begins loading the random-event stylesheet on
first use and queues the requested window until that stylesheet reports `load`.
Only then may it load deferred media, measure or place the window, make it
visible, focus it, or start animation. Repeated cold callbacks share the pending
stylesheet request. A failed request leaves the window hidden and permits the
next trigger or Administrator preview to retry. Closing the queued window or
leaving the page invalidates its pending open.

Keep media, focus, and geometry work in `afterShow` when it depends on the lazy
stylesheet. Administrator previews use the same style gate as ordinary and
scheduled events.

## Administrator activation

- Check the live, unexpired Administrator proof before requesting resources and
  again after every awaited load. Missing, malformed, expired, invalidated, or
  rejected access may show only the existing denial stand-in.
- An authorized launch loads event CSS and Administrator CSS together, then the
  classic scripts strictly in `admin/orchestrator.js` → `admin-controls.js`
  order. Duplicate desktop or taskbar launches share that work and initialize
  the controller once. A script `load` event is not sufficient: the loader must
  validate the orchestrator methods and mounted controller namespace, discard an
  incomplete script, and leave Retry able to request it again.
- A valid restored Administrator session also loads those resources, without
  opening a window or moving focus, when persisted state has live behavior to
  apply: muted audio, disabled effects, privacy mode, a frame guide/safe area,
  promo random mode, or a valid seeded binding. Default state and unauthorized
  or expired sessions stay cold. Restoration waits for both prerender activation
  and the final eager Home boot marker, so the lazy controller cannot race an
  event family that has not published its runtime yet.
- A pending Reset Scene marker is cheap bootstrap state, not a reason to load
  Administrator resources. The eager window runtime consumes it once, caches
  the result for the optional controller, and suppresses the ordinary reload
  event even when access is missing/expired or an unrelated active-state restore
  fails to download. Direct `rohinAdminControls.create()` calls still consume
  their supplied `resetStorage` when no shared result is passed.
- While work is pending, the stand-in says `Loading Admin Controls…`, its action
  is `Cancel`, and the existing loading cursor is active. Failure changes the
  same stand-in to a usable `Retry` state. Success opens the full window and
  focuses its selected tab.
- Cancel, title-bar close, proof expiry/rejection, and `pagehide` invalidate the
  launch and restore the cursor. A stylesheet that finishes after cancellation
  must not start either Administrator script. Closing any stand-in or full
  window restores focus to the launcher that initiated it.

## Cache and integrity contract

Change the query token everywhere a changed resource is referenced, including
Administrator preview stylesheets. Keep on-demand assets out of entry prefetch.
After a game-integrity regeneration, preserve every published compatible build
from the last published commit; an unpublished local build must not displace a
published hash in either Worker configuration.

## Verification

Run the focused source and browser coverage while editing:

```bash
node --test tests/home-resource-loading.test.mjs \
  tests/home-module-contracts.test.mjs tests/entry-point-cache-tokens.test.mjs \
  tests/managed-random-event-windows.test.mjs tests/random-event-lifecycle.test.mjs \
  tests/admin-controls.test.mjs
npx playwright test tests/ui/home-resource-loading.spec.mjs \
  tests/ui/admin-controls.spec.mjs tests/ui/managed-random-event-windows.spec.mjs \
  tests/ui/deferred-window-media.spec.mjs --workers=1
```

For final validation, run the full fast Node and UI suites plus the syntax,
generated-icon, Study Resources, media, game-integrity, secrets, diff, and ticket
checks in [site-quality-gates.md](site-quality-gates.md). Render and inspect Home,
the Administrator denial/loading/error/full-window states, and a cold random
event at 375×812, 768×1024, 1280×800, and 1440×900. Include slow/failing loads,
duplicate launches, cancellation, retry, proof invalidation, focus restoration,
page exit, reset reloads, delayed eager scripts, prerender activation, runtime
diagnostics, and accessibility in browser coverage. Keep
screenshots and traces as temporary task evidence rather than committing them.

## Controlled load measurements

Use the repository's installed Playwright Chromium and a local server owned by
the measurement. Compare baseline and final source with the same browser,
viewport, reduced-motion setting, storage, random draw, CPU and network limits,
and settling interval. Collect at least three fresh-context cold measurements,
three same-context warm reloads after priming, and three throttled cold loads.
Record the exact source commit and environment with each temporary capture.

Avoid Playwright routes in this measurement: [routing disables the HTTP
cache](https://playwright.dev/docs/api/class-browsercontext#browser-context-route).
Use a [CDP session](https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session)
for cache controls, throttling, external-request blocking, and Chrome traces.
Record FCP, the last observed LCP after a consistent settling interval,
DOMContentLoaded, load, the Home paint marker, local request count and encoded
bytes. Inspect the actual render and trace; exclude blocked external requests
from local transfer totals. Keep one-off JSON, traces and screenshots as
temporary evidence. These are laboratory comparisons, not field Core Web
Vitals or a Lighthouse score.
