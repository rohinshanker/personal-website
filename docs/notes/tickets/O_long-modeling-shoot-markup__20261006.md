# O_long-modeling-shoot-markup__20261006 — Open

- Scope: Generate Home's modeling shoot titles, dates, icons, viewer headers and credits from the shared shoot data rather than hand-maintained copies.
- Status: open
- Opened: 2026-10-06
- Updated: 2026-10-06
- Current State: Owner approved content item 7's recommendation. Queued behind the current leaderboard ticket and selected loading work; implementation has not started.
- Verification: Preserve shoot ordering, complete credits/links, accessible names and meaningful crawlable text. Test shared-data rendering and missing optional fields, navigate every shoot, and inspect Home and `/modeling/` at four standard viewports. Run affected behavior/browser/accessibility/visual, integrity and context checks and review the exact patch.
- Cleanup: Distill the single-source rendering contract into the indexed modeling validation guide, then resolve and remove this ticket/index row.

## Constraints

- Use `scripts/home/modeling-portfolio.js` as the existing source of truth. Preserve full-quality images and the independently committed Arthaus photo.
- Prefer the smallest rendering/build mechanism that preserves the current visible and crawlable content; measure net source reduction including the helper/data/configuration.
- Preserve existing carousel/viewer media lifetimes, focus, first-use initialization and route parity. No push or deployment is authorized.
