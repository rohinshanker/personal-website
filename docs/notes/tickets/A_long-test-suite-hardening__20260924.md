# A_long-test-suite-hardening__20260924 — Active

- Scope: Split the statistical Node corpus, shard browser CI without retries, gate both deployments on browser success, consolidate browser isolation/diagnostics, remove timing waits and redundant artifacts, and convert the selected source checks to behavior tests.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-10-07
- Current State: Implementation is published to `main` and independently reviewed. After the focus/fixture failures were repaired, remote main browser runs 37650317064 and 37652900402 each passed all 577 cases plus pinned visuals. Their later deployment failures concerned Free-plan configuration and historical-manifest validation, not browser stability. One further consecutive successful browser run and completion of the controlled release remain before closure.
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

1. Observe the third consecutive successful remote `main` browser run after the latest browser failure, then confirm the gated release succeeds. Two browser matrices are confirmed at [37650317064](https://github.com/rohinshanker/personal-website/actions/runs/37650317064) and [37652900402](https://github.com/rohinshanker/personal-website/actions/runs/37652900402). Do not manufacture unrelated pushes for this signal.

## Acceptance

- Baseline fast command: 569/569 in 67.872 seconds. Final fast tier: 593/593 in 3.095 seconds.
- Preserved 500-seed slow corpus: 4/4 in 70.388 seconds; corpus, helper, and production Solitaire source are unchanged since that validation.
- Final browser shards: 164/164, 164/164, and 163/163, two workers each, zero retries; 491 unique cases with no overlap or omissions. Each shard produced its HTML report. Accessibility and automatic diagnostics are included.
- Final pinned visual gate: 9/9 in 20.1 seconds without baseline changes when run after the shards. A concurrent run timed out in three load/settling cases; traces showed slow local delivery, and the isolated run resolved the environment contention.
- Exact-patch cross-provider review approved CI, selected source behavior, native victory canvas/face/stats geometry, backend-helper integration, and the final fixture repair. Removing diagnostics collection/enforcement and the stale-response guard is detected by executable probes.
- Syntax, secret scanning, generated icons/resources/media, integrity, local deployment compatibility, whitespace, and ticket/index checks pass. Production game-build hash remains unchanged.
- The [first remote main run](https://github.com/rohinshanker/personal-website/actions/runs/37257403491) passed at published commit `f4f68cd`: source, slow corpus, all three browser shards, pinned visuals, Worker transition, Pages release, and live parity checks. Secret guard also passed. Three consecutive successful remote main runs remain unobserved. Raw logs and review artifacts are temporary/ignored; reusable contracts are in the validation guides.

- The [second remote main run](https://github.com/rohinshanker/personal-website/actions/runs/37258647848) passed at published commit `0c678778`: all browser/visual, Worker and Pages gates passed. These earlier successes do not establish the required consecutive sequence after the later failed browser run.
