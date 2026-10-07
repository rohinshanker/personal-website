# A_legacy-client-release-window__20261007 — Active

- Scope: Select the legacy game-client compatibility deadline needed to complete the already-pushed approved release, then validate and retry the controlled Worker-before-Pages pipeline.
- Status: active
- Opened: 2026-10-07
- Updated: 2026-10-07
- Current State: All approved implementation commits are already on `origin/main` at `9b6d60170df6c0be5b4b35e01af687250dd3f8bf`; local main matches and the checkout was clean. The release pipeline stopped at its rollout preflight because the live browser still speaks protocol 1, the candidate speaks protocol 2, and `LEGACY_RESULT_ISSUANCE_CUTOFF` is empty. Owner selected seven days. Production cutoff is `2026-10-14T14:34:06Z`; local validation and the controlled release are underway.
- Verification: [Release run 37617604073](https://github.com/rohinshanker/personal-website/actions/runs/37617604073) passed source, full slow corpus, all three browser shards, pinned visuals, credentials and required-secret checks. D1 migrations succeeded before the deploy preflight failed. Worker transition, Pages packaging and Pages publication were skipped. The secret guard also passed. After the owner chooses, verify the concrete future UTC value in production and retain the closed default in the template, preserve the live build/history, run rollout and focused config/integrity checks, push the reviewed configuration and require the complete release/parity pipeline to pass.
- Cleanup: Keep only reusable rollout guidance in indexed backend/leaderboard validation docs. Resolve and delete this ticket/index row after the controlled release succeeds; retain no terminal logs or completion ledger.

## Owner decision

How long may cached old clients still start new legacy scoring sessions while the verified client rolls out?

- Seven days (recommended): allows a one-week compatibility window.
- Twenty-four hours: closes new legacy issuance sooner, with less time for old tabs to refresh.
- Thirty days: accommodates old tabs longer and accepts new unverified sessions for longer.

The owner may supply another duration or exact future UTC deadline. A selected duration becomes a concrete UTC instant when the answer arrives; elapsed time is not approval. Existing issued sessions retain their original expiry. An empty cutoff closes new legacy issuance, which is appropriate only after the first transition has been coordinated.

## Constraints and release contract

- The [backend release contract](../../validation/game-stats-backend.md) says: “If the live client is legacy, the operator must select a future UTC `LEGACY_RESULT_ISSUANCE_CUTOFF`”. The [verification rollout guide](../../validation/leaderboard-result-verification.md) and `scripts/check-game-stats-rollout.mjs` enforce it. This is a remaining rollout decision, not a missing coding review or a reason to bypass the guard.
- Do not reset data or reapply migrations manually to repair this configuration failure. The pipeline already applied its tracked migrations successfully.
- Keep both published compatibility lists intact. Never insert unpublished intermediate hashes and evict live clients.
- Keep pending owner visual/account review tickets open. Pushing approved implementations does not select the background candidate, approve the Admin promotional workflow, complete Search Console steps, or approve the soot sprite.
- The owner authorized pushing all approved changes to main on 2026-10-07. The implementation push is already complete; once the deadline is chosen, use the existing controlled release workflow and its gates.

- Decision (2026-10-07): owner selected “7 days (recommended)”. Exact UTC cutoff: `2026-10-14T14:34:06Z`, seven days from the configuration instant. Update production only; the template deliberately remains closed. No further deadline approval is needed.

- Local preflight passes against the currently published protocol-1 client with issuance open until the approved deadline. All 33 rollout/integrity tests pass; strict Wrangler 4.114.0 dry run and generated integrity checks pass. Production config diff is only the deadline string; browser/Worker build hash and both compatibility lists are unchanged.

- Push245ff99 configured the approved cutoff. Release37638412378 hit a flaky existing Node timer test (legacy Snake fallback expected201 but returned425 when a real timer woke before the exact wall-clock deadline). Local reproduction passed; CI evidence identified the test. The fixture now uses the existing controlled clock and a mocked Node timer, asserting the exact100ms scheduling and successful result without changing production timing/eligibility. All66Worker tests and795fullNode tests pass with the repair. Retry the controlled pipeline with this test-only change; do not bypass any gate.
