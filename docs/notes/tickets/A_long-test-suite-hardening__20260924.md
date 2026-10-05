# A_long-test-suite-hardening__20260924 — Active

- Scope: Split the statistical Node corpus, shard browser CI without retries, gate both deployments on browser success, consolidate browser isolation/diagnostics, remove timing waits and redundant artifacts, and convert the selected source checks to behavior tests.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-10-04
- Current State: Local implementation and independent review are in progress on canonical `main`. Fast/slow tiers and gated reusable CI are implemented. Selected behavior conversions are integrated; review repairs and shared-fixture migration remain in progress. Nothing has been pushed or deployed.
- Verification: Fast Node under ten seconds; intact 500-seed slow corpus; all browser shards with two workers and zero retries; pinned visual/accessibility/diagnostic gates; exact-patch independent review; three consecutive successful remote `main` browser runs. Remote stability proof remains unobserved.
- Cleanup: Keep only reusable contracts in `docs/validation/test-suite.md` and `browser-visual-accessibility.md`. Resolve and delete this ticket/index row after acceptance; do not retain test logs or completion histories.

## Decisions and constraints

- Owner chose browser gating for both site and Worker deployment (2026-10-04). Preserve Worker-before-Pages release ordering.
- Owner chose conversions for Game Stats, Administrator sign-in, Minesweeper, and Solitaire victory (2026-10-04). Keep meaningful literal copy, assets, wiring, security, and generated-reference checks.
- Preserve every seed and original solver/distribution threshold in `test:slow`; no statistical coverage reduction.
- Use the current feature-local scripts and existing test tooling. Add no dependencies or production changes to hide test failures.
- Do not manufacture unrelated pushes to obtain the three-run stability signal. Publication needs a concrete reviewed result first.
- Separate decisions about linting, script load order, new browser engines/touch projects, and real Cloudflare runtime coverage remain outside this ticket.

## Remaining work

1. DEM-214: shared hermetic context, automatic diagnostics including popups, narrow explicit remote embed stubs, shared viewport/backend helpers, no fixed waits, and finite full-suite repair pass. Owner: Claude implementer; original run `01a10969-b4b3-7666-aa60-39a98285c6a5`.
2. DEM-217: repair selected Node coverage from DEM-216's mutation-based review. Owner: Codex implementer; run `01a10990-1b6f-7869-920e-7961b184e8b5`. Cover flag-count/guard transitions, both presentation-win modes, faithful VM normalization, preload/layout wiring and retained security invariants.
3. Coordinator: integrate exact owned patches, inspect all four new flow/victory renders and semantic snapshots, run final shards and pinned visual gate, confirm review repairs, update fixture guidance, and record final acceptance state.
4. Observe three consecutive successful remote `main` runs after authorized publication; leave this ticket active until that condition is met.

## Validation so far

- Baseline `08a5b00`: fast command included slow corpus, 569/569 in 67.872 seconds.
- Split fast tier: 570/570 in 3.419 seconds; preserved slow corpus 4/4 in 70.388 seconds.
- Workflow contracts and diagnostics smoke passed; integrity and local deployment compatibility checks passed with unchanged game-build hash.
- Source conversion review caught coverage regressions and redundant browser assertions; repairs are required before acceptance. Initial conversions are not treated as complete merely because they pass.
- `b3ef0e1`: four victory/mobile-mark browser cases passed with real presented video frames; all four screenshots show the readable victory banner. No range seek is assumed from the static test server.
- Full integrated browser, visual, final Node timing, and exact repair reviews remain pending. Logs/artifacts live only in ignored test-result directories and temporary files.
