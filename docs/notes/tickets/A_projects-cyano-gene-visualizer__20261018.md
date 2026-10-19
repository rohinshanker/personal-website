# A_projects-cyano-gene-visualizer__20261018 — Active

- Scope: Add the Cyano gene visualizer built for the Isaacs Lab as the most recent (first) item in the Projects window (`data-app-window="windows"`), with a summary, links and a figure carousel.
- Status: active
- Opened: 2026-10-18
- Updated: 2026-10-18
- Current State: Implemented on branch `claude/content-items-20261018` (2026-10-18). Cyano Gene Visualizer is the first Projects item (active by default) with "Open the visualizer" and "Open repository" links and a three-figure carousel (codon-space map, recoding scheme with gene search, chromosome tracks) captured from the live site. The working title and description are used; change the wording at review if needed. Awaiting the owner's look at the rendered item (see Owner Review) before closure.
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

## Owner Review

- `docs/validation/assets/content-items/cyano-visualizer-desktop.webp` — Projects at 1280×800 opening on the new item.
- `docs/validation/assets/content-items/cyano-visualizer-mobile.webp` — the second figure at 375×812.

Verified with `tests/portfolio-content-items.test.mjs` and `tests/ui/portfolio-content-items.spec.mjs` (all four viewports, figures load, no overflow) plus the media, carousel, dialog and accessibility specs.
