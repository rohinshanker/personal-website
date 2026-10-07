# A_legacy-client-release-window__20261007 — Active

- Scope: Select the legacy game-client compatibility deadline needed to complete the already-pushed approved release, then validate and retry the controlled Worker-before-Pages pipeline.
- Status: active
- Opened: 2026-10-07
- Updated: 2026-10-07
- Current State: Approved implementation, seven-day cutoff and independently accepted release repairs are pushed to `origin/main` at `cae043dd7f7ebf4d25dc624f0204ab68997ff7ea`. Release 37650317064 passed all browser/source/visual gates but Cloudflare rejected a paid-only CPU override on Free. Removing that unsupported field preserves the platform's 10 ms budget; strict dry run and all 33 rollout/integrity tests pass. Production cutoff remains `2026-10-14T14:34:06Z`; template is closed. Await the complete controlled release and live parity.
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

- Pushf066e7d fixes the Node timer fixture. Release37639779122 passed source/slow/visuals and browser shards2/3+3/3; shard1/3 had192pass1failure at admin-controls.spec.mjs1483 (expiry). FullAdmin closes and gateappears, but OK losesfocus. No Worker/Pages deployment occurred. Same approved scope now has a bounded focus repair in MulticaDEM282, exclusive `/Users/Rohin/.cache/pw-release-focus-20261007`, branch `codex/release-admin-expiry-focus-20261007`, exactbaselinef066e7d. Preservefocus/security/settingsassertions and deadline; diagnose product/test/environment with CItrace, then exactreview/integration and controlledpipeline retry.

- Focus repair2fe198b accepted by independent Claude reviewDEM283: real180ms close-animation cleanup stole replacementgatefocus; guard now preservesfocus alreadymoved elsewhere. Author795Node/53affectedUI/forcedpair+axe pass; reviewer allsixfocus-returnwindow paths and targetedexpiry/removal pass, with one unrelatedstatic-assettimeoutpassingin isolation. Finalsource/codehashd8f9f98f integrated; bothcompatstrings32byte-identical, exactdeadlineunchanged, rolloutpreflightpasses. RetryfullremoteCI; do not bypassbrowsergates.

- Release 37645860771 passed source, slow corpus, all nine pinned visuals and browser shard 1, including the repaired Admin expiry case. Shard 2 had 191 passes and one failure in `game-stats-session-policy.spec.mjs` at tablet: expected expiry feedback, received invalid-session feedback. DEM-285 owns diagnosis and bounded repair in exclusive `/Users/Rohin/.cache/pw-release-session-policy-20261007`, baseline `dbc4c1e27f6436062439570a673bd083f978412a`. Check whether the fixture advances its clock before both fulfilled session responses are consumed; preserve production expiry validation and existing assertions. No deployment gate bypass or blind retry.

- DEM-286 independently accepted fixture commit `274d3d81368ee0c7a9f8f4c031c8a7af9739c381`. The CI trace and an adversarial ordering probe reproduced clock advancement before response normalization. The test now awaits both captured session promises and asserts their normalized IDs before advancing time; production rules and all prior assertions are unchanged. Author four-size/40-repeat checks and reviewer four-size/20-repeat checks pass. Independent probes also confirm invalid responses fail and a resolved session cannot publish while the profile prompt is pending. An earlier local server refusal left a failed report; fresh isolated review renders/checks passed. Final remote release remains required.

- Release 37650317064 passed all 577 browser cases, nine pinned visuals, source and slow corpus. Secrets, current-main and migration checks passed; there were no pending migrations. Cloudflare then rejected `limits.cpu_ms` with code 100328 because custom CPU limits are unsupported on Free. Official limits document the platform-enforced 10 ms Free budget. Remove only the unsupported override from production/template, keep Free and the same enforced budget, validate config/rollout/integrity, and retry the controlled pipeline. No Worker or Pages deployment succeeded in this run.
