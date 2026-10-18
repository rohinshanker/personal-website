# A_admin-seeded-control-counts__20261018 — Active

- Scope: Extend Admin Controls seeded bindings so a spent one-shot seed stays listed greyed out, a Reset re-arms spent seeds, and each seed can fire every N clicks and at most M times instead of only "next click" or "every click".
- Status: active
- Opened: 2026-10-18
- Updated: 2026-10-18
- Current State: Implemented on branch `claude/admin-seed-counts-20261018` (2026-10-18): each seed stores an interval, a limit (or unlimited) and its click/fire progress in the existing version-1 state; legacy `once`/`repeat` records migrate on load; spent seeds stay listed greyed out with a SPENT badge; **Reset Seeds** re-arms every seed. Awaiting the owner's review of the rendered Bindings tab (see Owner Review) before closure.
- Verification: Unit-test binding normalization (interval, limit, counters, legacy `once`/`repeat` records), activation counting, spent state, re-arm and persistence in `tests/admin-controls.test.mjs`. In `tests/ui/admin-controls.spec.mjs`, seed a control with an interval and a limit, click through it, confirm the fire pattern, the greyed row, the seed badge state and the Reset, at 375×812 and 1280×800 with clean diagnostics. Keep the access gate, Clear Bindings and the picker unchanged.
- Cleanup: Record the binding contract in `docs/validation/admin-controls.md`, then resolve and delete this ticket and its index row.

## Current behaviour

`scripts/home/admin-controls.js` stores each binding as `{ target, label, eventId, mode: "once" | "repeat" }`. A `once` binding is spliced out of `state.bindings` the moment its target is activated, so it disappears from the Bindings list and loses its seed badge. The Bindings tab offers only the `Next click only` / `Every click` radios, `Seed Control` and `Clear Bindings` (delete all).

## Requested behaviour

- A spent seed stays in the list, greyed out, with its badge showing it is spent rather than removed.
- A Reset control re-arms spent seeds so the same take can be repeated without re-seeding.
- A seed can be configured to fire every N clicks (N ≥ 1) and at most M times (M ≥ 1 or unlimited). Today's `Next click only` is N = 1, M = 1; `Every click` is N = 1, M = unlimited.

## Decisions

- Owner (2026-10-18): one Reset control re-arms every spent seed back to its configured interval and limit.
- Owner (2026-10-18): the event fires on every multiple of N clicks (the Nth, 2Nth, 3Nth click; clicks in between only count), and the limit M decrements only when the event fires, never per click.
- Assumption (not asked of the owner): click and fire counters persist with the bindings, so progress survives the Reset Scene reload and a take can span it; Reset and Clear Bindings are the only ways to clear them.

## Owner Review

Rendered from the real page by `tests/ui/admin-controls.spec.mjs` with a seed that fires every 2 clicks up to 2 times on the Image Tools dock icon:

| File | Shows |
| --- | --- |
| `docs/validation/assets/admin-seeded-controls/bindings-armed-desktop.png` | Bindings tab at 1280×800 after seeding: Fire every / Up to / Unlimited fields, the row "every 2 clicks, 2 of 2 left", Reset Seeds disabled. |
| `docs/validation/assets/admin-seeded-controls/bindings-spent-desktop.png` | The same seed after four clicks: row greyed out with "spent (0 of 2 left)", Reset Seeds enabled. |
| `docs/validation/assets/admin-seeded-controls/bindings-spent-mobile.png` | The spent state at 375×812. |
| `docs/validation/assets/admin-seeded-controls/badge-spent-desktop.png` | The dock icon's grey SPENT badge while Admin Controls is open. |

## Verification Results (2026-10-18)

- `node --test tests/*.test.mjs`: 820 pass, 0 fail (includes the new normalization, migration, counting, spent and re-arm tests).
- `tests/ui/admin-controls.spec.mjs`: 18 pass, including the N = 2, M = 2 seed at 375×812 and 1280×800 (fires on clicks 2 and 4, greyed row, SPENT badge, Reset re-arms, axe clean) and the legacy-record migration.
- `npm run syntax:check`, `node scripts/check-no-secrets.mjs`, `node scripts/update-game-integrity.mjs --check`, `node --test tests/context-system.test.mjs`: pass.
- The Admin script and stylesheet cache tokens in `scripts/home/core/resources.js` were bumped; because that file is a game-build input, the game-build integrity token was regenerated with `node scripts/update-game-integrity.mjs` (one generated line each in `home.html`, `index.html`, `modeling/index.html`, `video-editor/index.html`, `scripts/home/game-stats-backend.js` and both `wrangler.jsonc` files).
