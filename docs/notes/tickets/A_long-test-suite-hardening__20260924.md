# A_long-test-suite-hardening__20260924 — Active

- Scope: Split the statistical Node corpus, shard browser CI without retries, gate both deployments on browser success, consolidate browser isolation/diagnostics, remove timing waits and redundant artifacts, and convert the selected source checks to behavior tests.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-10-04
- Current State: Local implementation and independent review are in progress on canonical `main`. Fast/slow tiers and gated reusable CI are implemented. Selected behavior conversions and the shared-fixture migration are integrated. Node, CI, and selected rendered behavior passed independent review; focused fixture coverage repairs and final integrated gates remain. Nothing has been pushed or deployed.
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

1. DEM-214: specialist repairs first-navigation popup diagnostics, explicit external embed allowlisting, and a mutation-sensitive successful stale sign-in response test. Baseline `c12e349`; original writer and queued supplements are cancelled. Codex reviewer confirms the exact repaired patch.
2. Coordinator: run final three browser shards, pinned visual gate and fast Node timing; update fixture guidance and record concrete local acceptance.
3. Observe three consecutive successful remote `main` runs after authorized publication; leave this ticket active until that condition is met.

## Validation so far

- Baseline `08a5b00`: fast command included slow corpus, 569/569 in 67.872 seconds.
- Split fast tier: 570/570 in 3.419 seconds; preserved slow corpus 4/4 in 70.388 seconds.
- Workflow contracts and diagnostics smoke passed; integrity and local deployment compatibility checks passed with unchanged game-build hash.
- Selected source behavior, deployment graph, and rendered game coverage passed independent review after finite repairs. Eight selected browser cases pass with two workers and zero retries; disabling production victory canvas drawing fails the bounded pixel gate.
- Shared migration is integrated. Independent review identified first-navigation popup diagnostics and stale successful sign-in response false negatives; specialist repair is active.
- Full integrated browser, pinned visual, final Node timing, and exact fixture repair review remain pending. Logs/artifacts live only in ignored test-result directories and temporary files.
