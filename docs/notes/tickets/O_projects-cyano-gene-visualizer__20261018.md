# O_projects-cyano-gene-visualizer__20261018 — Open

- Scope: Add the Cyano gene visualizer built for the Isaacs Lab as the most recent (first) item in the Projects window (`data-app-window="windows"`), with a summary, links and a figure carousel.
- Status: open
- Opened: 2026-10-18
- Updated: 2026-10-18
- Current State: Requested by the owner on 2026-10-18. Not started; this ticket only records the content and constraints. The owner should confirm the public title and one-line description before the copy is written.
- Verification: Render the Projects window at 375×812, 768×1024, 1280×800 and 1440×900 with the new item as the default active view; confirm the links open in a new tab, carousel figures load with the hourglass indicator, and the UI, accessibility and visual suites plus `node --test tests/context-system.test.mjs` pass. Review the exact patch.
- Cleanup: Resolve and delete this ticket and its index row after the owner sees the rendered item.

## Content

- Source project: `github.com/rohinshanker/isaacs-cyano-gene-selection` (local checkout `/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`); live site https://rohinshanker.github.io/isaacs-cyano-gene-selection/ .
- Working title: "Cyano Gene Visualizer" with the selector description "Interactive cyanobacteria gene selection and visualization for the Isaacs Lab." and the current season; the owner may adjust the wording.
- Links: "Open the visualizer" → the live site (gold-glow treatment, as the newest project), "Open repository" → the GitHub repository.
- Media: two to four screenshots of the visualizer (zoomed-out chromosome view, a zoomed-in gene region, any selection or evidence panel) captured from the live site at 1280×800, stored as WebP under `assets/projects/cyano-gene-visualizer/` and listed as project figures in `scripts/home/features/gallery.js` with captions and descriptions.
- Icon: an icon from `assets/app-icons/ico/` suggesting biology or data (for example a microscope, chart or DNA-like icon; the owner may pick).

## Constraints

- This item becomes the first selector entry (`is-active` by default) and the first `viewer-content` panel; the existing items shift down and keep their order. The win98-site-kit item (`O_projects-win98-site-kit__20261018.md`) goes directly after it.
- Keep the lab's own site as the source of truth for scientific claims; the Projects copy should describe the tool, not restate results.
- Follow the existing selector/viewer markup and carousel helpers; update cache tokens for any changed stylesheet or script. Do not touch other in-flight work.
