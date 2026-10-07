# A_modeling-custom-cursors__20261006 — Active

- Scope: Use Home's existing custom cursor system on the public modeling portfolio route.
- Status: active
- Opened: 2026-10-06
- Updated: 2026-10-07
- Current State: Scoped Claude implementation in a separate worktree; reuse Home cursor runtime and validate real modeling states. Canonical branch `codex/home-loading-followup`; coordinator Agent Deck `1c881e50-1791344233`. Prior leaderboard ticket is closed at `f77f42a`.
- Verification: Reuse the shared cursor preference and existing runtime/assets; inspect normal, link/button, text-selection and viewer interaction states with light/dark preference changes. Render `/modeling/` at four standard viewports, verify mobile/touch behavior, and run affected cursor/modeling/browser/accessibility, cache-token/integrity and context checks.
- Cleanup: Add the route's reusable cursor contract to indexed custom-cursor/modeling guidance, then resolve and delete this ticket/index row after acceptance.

## Constraints

- Keep `rohin-os-cursor-mode` and upstream 98.css intact as the owner chose in items 11–12. Do not fork the shared cursor system or add a parallel preference store.
- Preserve carousel/fullscreen controls, native-size typography and media/focus lifetimes. Begin canonical edits after the leaderboard coordinator releases the checkout. No push/deployment is authorized.
