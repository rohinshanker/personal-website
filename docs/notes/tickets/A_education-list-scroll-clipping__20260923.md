# A_education-list-scroll-clipping__20260923 — Active

- Scope: Stop the About Me Education list from reading as cut off at desktop widths (DEM-122, reported from DEM-113). Branch `fix/education-scroll-gutter` off `main` at `2926fc2`.
- Status: active
- Opened: 2026-09-23
- Updated: 2026-09-23
- Current State: Fixed in `styles/home/portfolio.css` across two commits. `d173ae8` reserved the scrollbar track with `scrollbar-gutter: stable` and pinned each `.about-institution > h4` to the scrollport top; review (codex-reviewer, DEM-124) found that a pinned heading is still dragged through the clipping edge as its own section leaves, so the list could rest at `scrollTop = 56` with the Yale heading sliced 6px above the top. The follow-up commit adds mandatory scroll snapping so the list only comes to rest where a heading or a card starts. `@media (max-width: 744px)` still returns the heading to `position: static`; the list does not scroll there, which also makes the snapping inert. Awaiting independent review by the coordinator.
- Verification: `npm test` (329 pass), `npm run test:ui:accessibility` (19 pass), `npm run test:visual` (7 pass, no baseline change in the follow-up commit; `d173ae8` updated `home-about-window.png` once for the 16px the gutter reserves). The rendered contract `tests/ui/about-me.spec.mjs` — "About Education list keeps a stable gutter and a whole heading at every rest" — walks the whole scroll range at 1280×800 and 1440×900, settles the list at each offset, and asserts that no heading is sliced, that no card's icon or label stops behind the pinned heading, that the end of the range is still reachable, and that the list rests on fewer offsets than were requested; it fails against `d173ae8` at nine rest positions. Swept every integer offset by hand at 745×900, 768×1024, 1280×800 and 1440×900: rest positions are `{0, 75, 76, 82}` and none slices a heading. 375×812 and 744×900 do not scroll. Console shows only the site's pre-existing offline game-stats CORS errors.
- Cleanup: After review, resolve this ticket, fold the scrollbar-gutter and snapping findings below into `docs/validation/` if they prove reusable, drop the queue row, and delete the resolved file.

## What is actually guaranteed

At every position the list can come to rest, the institution heading above the visible cards is drawn whole. That is a statement about rest positions, not about every frame: while a scroll is in flight a departing heading still passes through the clipping edge, because a sticky element is confined to its own section and no CSS stops it at the boundary. Snapping is what makes that transient — the list cannot stop inside it.

The bottom edge of the scrollport still cuts the card below it. That is what a scrolling region is supposed to look like, and the end of the range is reachable, so every card can be read whole.

## Why snapping rather than another mechanism

Three options were rendered and measured before choosing:

- **Sticky heading alone** (`d173ae8`) fixes the end of the scroll range but not the middle: `scrollTop` between 50 and 69 leaves the departing heading 1–19px above the clipping edge.
- **Snapping alone**, without the sticky heading, fails at both ends. Snapped to a card, the heading above it is sliced by however much of it remains on screen; and because Chromium clamps snap positions that lie past the maximum scroll offset, the end of the range is always a rest position, where the last heading sits 4px above the top.
- **Both together** is what shipped. Snapping restricts the rest positions to the starts of headings and cards; the sticky heading covers the end of the range, where the clamped snap position would otherwise slice it. The push-out band is shorter than one heading and always falls strictly between two snap positions — the previous one is the section's last card, a card being taller than a heading, and the next is the following section's heading — so no rest position can land in it. The 12-card stress list confirms it: 16 rest positions, one per card, none sliced.

`scroll-margin-block-start` on the cards is what keeps a snapped card below the pinned heading instead of underneath it; `scroll-padding-block-start` matches the list's own top padding so the top of the list stays a rest position and the window's reference render is unchanged.

## Constraint that ruled out the other approach

`tests/ui/about-me.spec.mjs` already requires, above 744px, that the overview panel's bottom sits within 1px of the carousel's bottom and that the degrees list overflows — and that adding twelve more cards changes neither. Letting the list grow to fit its content would have broken those contracts and the maximum-content behaviour they protect, so the scrolling region stays.

## Note for future renders

Headless Chromium runs with `--hide-scrollbars`, so the container that renders the visual baselines shows no scrollbar and, before `scrollbar-gutter: stable`, gave the cards 16px more width than a real browser. Render headed before concluding that a scrolling region has no affordance.
