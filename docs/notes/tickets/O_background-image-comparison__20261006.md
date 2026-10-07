# O_background-image-comparison__20261006 — Open

- Scope: Prepare a smaller WebP background alongside the current JPEG for owner visual comparison, then ship only the accepted option.
- Status: open
- Opened: 2026-10-06
- Updated: 2026-10-06
- Current State: Owner approved preparation under content decision item 6. Queued behind the current leaderboard ticket. Use the preserved source image and existing optimization tooling; a proposed 1600 px WebP is a starting point whose actual bytes/quality must be measured. No quality-change shipping decision has been made.
- Verification: Record actual dimensions/bytes and render the real Home background with both candidates at 375×812, 768×1024, 1280×800 and 1440×900, including the existing cover/crop behavior. Present a local comparison and inspect diagnostics. If an option is accepted, update generation/reference contracts and run affected media, browser/visual, integrity and context gates.
- Owner Approval: Required before shipping a quality change and closing this ticket. Retain the comparison until the owner chooses and visually approves the result.
- Cleanup: After the accepted choice ships, remove temporary comparison artifacts and unused candidates, retain reusable optimization guidance, then resolve and delete this ticket/index row.

## Constraints

- Preparation changes no deployed background reference. Owner visual choice is required before shipping a quality change.
- Preserve the original bytes and build/optimization regeneration path. Keep temporary renders/logs outside permanent guidance; the review page may live under non-deployed docs.
- Do not push/deploy or start canonical edits while the leaderboard coordinator still owns its work.
