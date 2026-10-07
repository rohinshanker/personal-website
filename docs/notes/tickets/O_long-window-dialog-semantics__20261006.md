# O_long-window-dialog-semantics__20261006 — Open

- Scope: Complete accurate dialog roles and title labels through shared window helpers while preserving existing focus, stacking and modal/non-modal behavior.
- Status: open
- Opened: 2026-10-06
- Updated: 2026-10-06
- Current State: Owner approved architecture decision item 3: extend `role="dialog"` and `aria-labelledby` via the shared helpers rather than migrate windows to native dialog elements. Queued behind the current leaderboard ticket and the selected loading ticket; implementation has not started.
- Verification: Audit current windows and shared open/close paths first. Test title associations, accurate modality, focus placement/restoration, hidden-window focus exclusion, keyboard dismissal and dynamic windows. Render affected routes/states at all four standard viewports; run behavior, browser, axe, pinned visual, integrity and context gates and an exact-patch independent review.
- Cleanup: Preserve only the reusable semantic/focus contract in the appropriate indexed validation guides, then resolve and delete this ticket/index row.

## Constraints

- Some windows already have correct roles/title labels; preserve them and repair actual gaps.
- Do not set `aria-modal="true"` on an interface whose background remains operable.
- Keep decorative/non-dialog containers out of the dialog pattern; generate stable unique title IDs for dynamic windows where needed.
- Preserve real initialization, managed event lifetimes, focus and z-order behavior. No native `<dialog>` migration, baseline churn to hide failures, push or deployment is authorized by this scope.
