# O_study-resources-hover-highlight__20261001 — Open

- Scope: Study Resources clickable rows on white backgrounds, including folder rows.
- Status: open
- Opened: 2026-10-01
- Updated: 2026-10-01
- Current State: Owner requested a separate ticket. Implementation has not started; do not bundle it into the Clash Royale visual patch.
- Verification: Pending implementation and rendered validation.
- Cleanup: On completion, retain only reusable validation guidance if needed, resolve and delete this ticket, and remove its queue row.

## Requested behavior

- Add a blue highlight when hovering over a clickable Study Resources line on a white background, including folders. Reuse the site’s Windows selection blue and readable foreground treatment.
- Keep selection and keyboard focus legible and consistent. Avoid layout shifts, changes to noninteractive text, or loss of file/folder click behavior.
- Prefer scoped rules in `styles/home/study-resources.css` (`.study-tree-row`, `.study-tree-item`, `.study-tree-toggle`, and existing selected/focus styles). Markup lives in `home.html`; tree rendering is in the Study Resources section of `scripts/home/main.js`.
- Check both folder navigation and file actions, hover, keyboard focus, selection, and any disabled state. Inspect mobile 375×812, tablet 768×1024, desktop 1280×800, wide 1440×900, and applicable breakpoint neighbors with the UI render-inspect-repair skill. Run affected Playwright, accessibility, and repository completion gates.
- Bump the changed stylesheet’s cache token everywhere it is loaded. If game-integrity inputs such as `main.js` change, regenerate integrity using the repository workflow; a CSS-only change is preferable when sufficient.

## Handoff contract

Use the canonical repository `/Users/Rohin/Desktop/coding_stuff/personal-website`. Before implementation, refresh the live ticket queue, branch state, and exact baseline, then assign one writer an isolated worktree and explicit result target. This open ticket grants no separate frontend publication or main push approval.
