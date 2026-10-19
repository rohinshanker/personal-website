# A_writing-substack-pinned__20261018 — Active

- Scope: Pin a "Substack" item to the top of the Writing window (`data-app-window="taskmgr"`) that shows the Substack logo, invites readers to the latest publications, and offers "Open Substack" and "Subscribe" buttons.
- Status: active
- Opened: 2026-10-18
- Updated: 2026-10-18
- Current State: Implemented on branch `claude/content-items-20261018` (2026-10-18). A Substack item is pinned first in Writing (active by default) with the official Substack logo, "Read my latest publications on Substack.", and "Open Substack" / "Subscribe" buttons opening in a new tab. Awaiting the owner's look at the rendered item (see Owner Review) before closure.
- Verification: Render the Writing window at 375×812, 768×1024, 1280×800 and 1440×900 with the Substack item active (it is the default view) and after switching to another item; confirm both buttons open the right URLs in a new tab with `rel="noopener noreferrer"`, the logo renders crisply at the selector thumbnail size and in the viewer, and the UI, accessibility and visual suites plus `node --test tests/context-system.test.mjs` pass. Review the exact patch.
- Cleanup: Resolve and delete this ticket and its index row after the owner sees the rendered item.

## Content

- Selector item: title "Substack", description "Latest publications." (no season line), thumbnail: the Substack logo stored as `assets/writing/substack-logo.svg` (or PNG) rather than a Windows icon.
- Viewer panel: heading "Substack", the logo at a readable size, one line of copy: "Read my latest publications on Substack.", then an action row with two buttons:
  - "Open Substack" → https://rohins.substack.com/ (primary; gold-glow treatment like other primary links).
  - "Subscribe" → https://rohins.substack.com/subscribe .
- Both open in a new tab; the Socials window and About Me already link `https://rohins.substack.com/?utm_campaign=profile_chips` and may keep that URL.

## Constraints

- The item is the first selector entry (`is-active` by default) and its panel is the first `viewer-content`; the existing Writing items keep their order below it.
- Use the existing `.pdf-actions` / `.button-link` markup for the buttons so styling stays consistent; no new stylesheet unless the logo needs a size rule, in which case update `styles/home/portfolio.css` and its cache token in `home.html`.
- Obtain the Substack logo from Substack's brand resources and keep the file small; add the attribution line to the Credits window if their brand guidelines ask for it.
- Do not touch other in-flight work.

## Owner Review

- `docs/validation/assets/content-items/substack-writing-desktop.webp` — Writing at 1280×800.
- `docs/validation/assets/content-items/substack-writing-mobile.webp` — Writing at 375×812.

Verified with `tests/portfolio-content-items.test.mjs` and `tests/ui/portfolio-content-items.spec.mjs` (all four viewports, figures load, no overflow) plus the media, carousel, dialog and accessibility specs.
