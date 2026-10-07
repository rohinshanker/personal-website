# O_biome-quality-checks__20261007 — Open

- Scope: Add pinned Biome checks for authored code to local validation and CI, reporting formatting/import-order issues and code diagnostics.
- Status: open
- Opened: 2026-10-07
- Updated: 2026-10-07
- Current State: Owner approved Biome checks after their purpose was explained. Queued after the current leaderboard ticket; assess existing diagnostic/formatting scope before deciding whether this fits between-ticket work or needs a separate long pass.
- Verification: Retrieve current official configuration/CLI guidance, pin the development dependency, inspect the baseline, configure the existing code style and explicit vendor/generated exclusions, and resolve actual failures. Verify the real local/CI commands fail on a representative violation and pass on the final authored tree; run affected syntax/behavior/browser/visual/integrity/context gates for any code normalization and review the exact patch.
- Cleanup: Preserve only the reusable authored/generated/vendor scope and invocation contract in indexed quality-gate guidance, then resolve and delete this ticket/index row after acceptance.

## Constraints

- Validation is check-only; a local explicit write action may fix issues during implementation. Do not let CI rewrite source, weaken existing tests or adopt a passing baseline that ignores authored-code failures.
- Preserve the established two-space/double-quote style, meaningful comments, runtime import order and upstream 98.css. Exclude genuine vendored/generated artifacts deliberately rather than reformatting or silently hand-editing them.
- Use current official [Biome guidance](https://biomejs.dev/installation/quick-start/). Owner approval covers this development dependency; inspection tooling needs no additional project dependencies.
- Keep measured performance/loading work separate if normalization is substantial. Preserve the unpublished verified-game work and published compatibility history. No push/deployment is authorized.
