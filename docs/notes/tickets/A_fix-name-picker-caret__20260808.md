# A_fix-name-picker-caret__20260808 — Active

Scope: Leaderboard profile Select Name combobox caret button geometry and responsive validation.

Status: active

Opened: 2026-08-08

Updated: 2026-08-08

Current State: The 21px name field uses a two-pixel Win98 inset border, but its caret button was 19px square at a one-pixel top/right inset. The button is now 17px square at a two-pixel top/right inset, matching the field's inner content box. The CSS cache key and source/browser regression contracts are updated.

Verification: All 238 Node tests pass, including 46 focused name-picker/cache regressions. The changed Playwright spec is discovered as seven tests and now asserts exact 17px geometry, two-pixel top/right/bottom insets, center hit-testing, containment, and 560/561px breakpoint behavior. JavaScript syntax, Game Stats integrity, and `git diff --check` pass. Rendered inspection at 375 x 812, 560 x 900, 561 x 900, 768 x 1024, 1280 x 800, and 1440 x 900 remains pending because this environment rejected browser/localhost permission.

Cleanup: Run the focused Playwright spec and inspect default, expanded, focused, and pressed states in an approved browser environment. After rendered validation, distill only reusable geometry guidance if warranted, resolve and remove this ticket, and remove its live-index row.

## Requirements

- Keep the caret visually flush with the field's two-pixel inner border.
- Preserve the Windows 98 raised/sunken button states and existing combobox behavior.
- Keep the picker contained without document-level overflow at all required viewports.
- Preserve unrelated dirty-worktree changes.
