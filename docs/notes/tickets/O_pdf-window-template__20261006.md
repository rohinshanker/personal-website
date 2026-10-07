# O_pdf-window-template__20261006 — Open

- Scope: Assess and implement a shared template for eight similar Home PDF windows only if it reduces the amount of code.
- Status: open
- Opened: 2026-10-06
- Updated: 2026-10-06
- Current State: Owner conditionally approved content item 8: use a shared template when it reduces code, otherwise leave the current markup. Assessment is queued as possible work between long tickets; implementation has not started.
- Verification: Compare current authored markup with the complete template/data/helper cost. If smaller, exercise every PDF's title/source, open/close/drag/focus behavior, visible fallback/link access and boot ordering; render all standard viewports and run affected behavior/UI/accessibility, integrity and context gates. If it does not reduce code, record that finding and close without a source change.
- Cleanup: Retain only reusable PDF-window contracts in indexed validation guidance if implementation changes them, then resolve and delete this ticket/index row.

## Constraints

- Do not replace repetition with a larger framework or hidden initialization dependencies. Preserve meaningful crawlable PDF links/text and existing IDs where other code depends on them.
- Use existing window styling, lifecycle and testing infrastructure. Start canonical work after the leaderboard coordinator releases it. No push/deployment is authorized.
