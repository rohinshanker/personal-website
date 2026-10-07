# O_background-image-comparison__20261006 — Open

- Scope: Prepare a smaller WebP background alongside the current JPEG for owner visual comparison, then ship only the accepted option.
- Status: open
- Opened: 2026-10-06
- Updated: 2026-10-07
- Current State: Comparison is prepared in `docs/validation/assets/background-comparison/review.html`. Current JPEG is 2200×1446 / 352,363 bytes; candidate WebP is 1600×1052 / 49,350 bytes (86% smaller). Actual Home renders at all four viewports and the review controls are inspected and pass. Owner was asked to choose the WebP, keep the JPEG, or defer review; answer is pending. Deployed background reference is unchanged.
- Verification: Record actual dimensions/bytes and render the real Home background with both candidates at 375×812, 768×1024, 1280×800 and 1440×900, including the existing cover/crop behavior. Present a local comparison and inspect diagnostics. If an option is accepted, update generation/reference contracts and run affected media, browser/visual, integrity and context gates.
- Owner Approval: Required before shipping a quality change and closing this ticket. Retain the comparison until the owner chooses and visually approves the result.
- Cleanup: After the accepted choice ships, remove temporary comparison artifacts and unused candidates, retain reusable optimization guidance, then resolve and delete this ticket/index row.

## Constraints

- Candidate reproduction: `cwebp -resize 1600 0 -q 80 -m 6 docs/assets-src/background.jpg -o docs/validation/assets/background-comparison/background-1600.webp` using installed libwebp 1.6.0. Source and deployed current JPEG retain their original bytes.
- Preparation validation: 8 real Home background cases plus 4 review-page cases pass with enforced diagnostics; current/candidate pairs and the controls were inspected at 375×812, 768×1024, 1280×800 and 1440×900. All viewport/variant controls load the matching screenshot without accidental page overflow. No visual baseline was changed.

- Preparation changes no deployed background reference. Owner visual choice is required before shipping a quality change.
- Preserve the original bytes and build/optimization regeneration path. Keep temporary renders/logs outside permanent guidance; the review page may live under non-deployed docs.
- Do not push/deploy or start canonical edits while the leaderboard coordinator still owns its work.
