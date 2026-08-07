# A_fix-icon-picker-scroll__20260807 — Active

Scope: Game Profile Select Icon gallery frame containment, scrolling, and selection stability.

Status: active

Opened: 2026-08-07

Updated: 2026-08-07

Current State: Implemented a fixed 2px clipped frame around the independently scrolling icon grid, with the prior total inset preserved as 2px frame padding plus 4px grid padding. Icon selection now updates the existing option nodes in place instead of rebuilding the gallery, preserving focus and every relevant scroll position. Source and integrity checks pass; rendered browser validation remains pending because no approved browser is available.

Verification: `node --test tests/game-profile-icon-picker.test.mjs tests/game-stats-name-generator.test.mjs tests/game-profile-prompt-window.test.mjs` passes 12/12; `npm test` passes 235/235; `npm run test:ui -- tests/ui/game-progress-profile-name.spec.mjs --list` discovers all 18 responsive cases; game integrity, secret, icon-manifest, syntax, and `git diff --check` checks pass. The browser spec covers initial and scrolled frame geometry, border hit testing, flush top clipping, mouse and keyboard selection, node/focus retention, and unchanged gallery/dialog/page scroll at 320x568, 375x812, 559x900, 561x900, 639x900, 641x900, 768x1024, 1280x800, and 1440x900. Pending: execute that spec in a real browser, inspect screenshots, console/runtime output, and applicable accessibility state.

Cleanup: Resolve and remove this ticket after validation; distill reusable guidance only if the fix changes a general UI contract.

## Requirements

- Keep icon buttons visually inside the approximately 2px sunken frame while scrolling.
- When a scrolled row reaches the top content edge, keep it flush to that edge without border overlap or added margin.
- Preserve the icon gallery, dialog, and page scroll positions when an icon is selected.
- Preserve focus visibility, selected state, filtering, mouse/keyboard operation, responsive containment, and native styling.
