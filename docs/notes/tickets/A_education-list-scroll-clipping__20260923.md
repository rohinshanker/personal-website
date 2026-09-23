# A_education-list-scroll-clipping__20260923 — Active

- Scope: Stop the About Me Education list from reading as cut off at desktop widths (DEM-122, reported from DEM-113). Branch `fix/education-scroll-gutter` off `main` at `2926fc2`.
- Status: active
- Opened: 2026-09-23
- Updated: 2026-09-23
- Current State: Fixed in `styles/home/portfolio.css`. `.about-degrees-list` now reserves its scrollbar track with `scrollbar-gutter: stable`, and each `.about-institution > h4` is sticky to the scrollport top so an institution heading is never drawn half-way; `@media (max-width: 744px)` returns the heading to `position: static` because the list does not scroll there. Card spacing is unchanged: the heading trades its `5px` bottom margin for `5px` bottom padding so its opaque `--surface` background covers the gap that cards scroll under. Awaiting independent review by the coordinator.
- Verification: `npm test` (329 pass), `npm run test:ui:accessibility` (19 pass), `npm run test:visual` (7 pass after one deliberate baseline update). New rendered contract `tests/ui/about-me.spec.mjs` — "About Education list keeps a stable gutter and a whole heading when scrolled" — asserts at 1280×800 and 1440×900 that the reserved gutter does not depend on the content, that scrolling to the last degree leaves nothing partially drawn, and that the Berkeley heading is pinned to the scrollport top; it fails on the pre-fix stylesheet. Source contracts in `tests/about-me.test.mjs` cover the new declarations. Rendered at 375×812, 768×1024, 1280×800, and 1440×900 in headless and headed Chromium; only the site's pre-existing offline game-stats CORS errors appear in the console.
- Cleanup: After review, resolve this ticket, fold the scrollbar-gutter finding below into `docs/validation/` if it proves reusable, drop the queue row, and delete the resolved file.

## Why the list looked broken

Headless Chromium runs with `--hide-scrollbars`, so the container that renders the visual baselines — and the inspection that reported the defect — shows no scrollbar at all and gives the list 16px more width than a real browser does. A headed browser on the same build reserves 16px and paints the site's Windows-95 scrollbar. `scrollbar-gutter: stable` makes both render the same width, which is the width the cards actually get in a real browser.

The remaining defect was real in every browser: the scrollport is 171px tall against 253px of content, so any scroll offset could slice an institution heading through the middle of its glyphs. Pinning the heading removes that; the bottom edge of a scrolling region still cuts a card, which is what a scroll region is supposed to look like.

## Constraint that ruled out the alternative

`tests/ui/about-me.spec.mjs` already requires, above 744px, that the overview panel's bottom sits within 1px of the carousel's bottom and that the degrees list overflows — and that adding twelve more cards changes neither. Letting the list grow to fit its content would have broken those contracts and the maximum-content behaviour they protect, so the scrolling region stays.
