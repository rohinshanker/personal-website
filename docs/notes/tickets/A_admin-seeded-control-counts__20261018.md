# A_admin-seeded-control-counts__20261018 — Active

- Scope: Extend Admin Controls seeded bindings so a spent one-shot seed stays listed greyed out, a Reset re-arms spent seeds, and each seed can fire every N clicks and at most M times instead of only "next click" or "every click".
- Status: active
- Opened: 2026-10-18
- Updated: 2026-10-18
- Current State: Requested by the owner on 2026-10-18 during the Admin Controls manual acceptance, which otherwise passed (Capture is left as is; the owner does not use it). Design answered by the owner on 2026-10-18 (see Decisions); active in session pw-fable-ticket-closing-2 on a worktree branch since 2026-10-18.
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
