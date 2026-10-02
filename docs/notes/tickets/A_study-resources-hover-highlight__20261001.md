# A_study-resources-hover-highlight__20261001 — Active

- Scope: Study Resources clickable rows on white backgrounds, including folder rows.
- Status: active
- Opened: 2026-10-01
- Updated: 2026-10-01
- Current State: Implementation and focused validation are complete on the isolated task branch; awaiting coordinator review and integration.
- Verification: Focused Playwright Study Resources contract passes 10/10 across 375×812, 768×1024, 1280×800, 1440×900, 759×900, and 761×900, including simultaneous hover/focus, list/gallery PDF states, folder and file actions, disabled actions, runtime diagnostics, and axe. Cache-token and manifest tests pass. Fresh rendered inspection found no clipping outside the intentional mobile file-list scroller, no layout shift from row paint, and no console or request failures.
- Cleanup: Coordinator will resolve and delete this ticket and remove its queue row after independent review and integration.

## Requested behavior

- Add a blue highlight when hovering over a clickable Study Resources line on a white background, including folders. Reuse the site’s Windows selection blue and readable foreground treatment.
- Keep selection and keyboard focus legible and consistent. Avoid layout shifts, changes to noninteractive text, or loss of file/folder click behavior.
- Prefer scoped rules in `styles/home/study-resources.css` (`.study-tree-row`, `.study-tree-item`, `.study-tree-toggle`, and existing selected/focus styles). Markup lives in `home.html`; tree rendering is in the Study Resources section of `scripts/home/main.js`.
- Check both folder navigation and file actions, hover, keyboard focus, selection, and any disabled state. Inspect mobile 375×812, tablet 768×1024, desktop 1280×800, wide 1440×900, and applicable breakpoint neighbors with the UI render-inspect-repair skill. Run affected Playwright, accessibility, and repository completion gates.
- Bump the changed stylesheet’s cache token everywhere it is loaded. If game-integrity inputs such as `main.js` change, regenerate integrity using the repository workflow; a CSS-only change is preferable when sufficient.

## Handoff contract

Use the canonical repository `/Users/Rohin/Desktop/coding_stuff/personal-website`. Before implementation, refresh the live ticket queue, branch state, and exact baseline, then assign one writer an isolated worktree and explicit result target. This open ticket grants no separate frontend publication or main push approval.
