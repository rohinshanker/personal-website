# About Me Responsive Window

- Purpose: Preserve a reachable About Me title bar and internally scrollable content across compact phone, tablet, and desktop viewports.
- Scope: `#about-window`, `.about-body`, the About content grid, the Education list scroll region, and compact social-card layout on `home.html`.
- Last verified: 2026-09-23

## Sizing contract

- Tablet and desktop retain the default `min(79vh, 750px)` About body.
- Viewports at most 640px wide or 500px tall use a `min(65dvh, 640px)` body, with `vh` as the fallback. The outer centering and height caps also use dynamic viewport units so mobile browser chrome is reflected in the usable height.
- The compact maximum reserves 140px for the title bar, taskbar, and vertical clearance. Its minimum may shrink below 220px on short landscape screens instead of overriding that cap.
- `.about-body` remains the primary vertical scroll surface. The title bar and Close button must not move while content scrolls from the welcome heading to the signature.
- The About page grid uses one shrinkable `minmax(0, 1fr)` track. At 340px and narrower, social cards use two columns to prevent hidden horizontal overflow and uneven card heights.

## Education list scroll region (repair guide)

- Symptom: above 744px the Education list scrolls inside a fixed-height panel and reads as cut off: the cards are 16px narrower than in a real browser once a scrollbar appears, and the list can rest with an institution heading sliced at the top edge.
- Root cause: a sticky heading is confined to its own section, so while that section leaves it is dragged through the clipping edge and no CSS stops it at the boundary. Headless Chromium runs with `--hide-scrollbars`, so gutter defects are invisible in the visual baselines.
- Durable fix (`styles/home/portfolio.css`): `scrollbar-gutter: stable` on the list; each `.about-institution > h4` sticky at the scrollport top; `scroll-snap-type: y mandatory` with headings and cards as `start` snap targets; `scroll-margin-block-start` on cards so a snapped card clears the pinned heading; `scroll-padding-block-start` equal to the list's top padding so the top of the list stays a rest position. Neither mechanism suffices alone: sticky alone slices the departing heading mid-range, snapping alone slices the last heading at the clamped end of the range.
- Guarantee: at every rest position the heading above the visible cards is whole. Frames during an in-flight scroll may still cross the edge. The bottom edge may cut a card, and the end of the range stays reachable.
- Constraint: the list must keep scrolling. Growing it to fit content breaks the overview-panel/carousel bottom alignment and the maximum-content contracts in `tests/ui/about-me.spec.mjs`.
- Regression check: the walked-range test "About Education list keeps a stable gutter and a whole heading at every rest" settles the list at each offset and asserts no sliced heading, no card behind the pinned heading, a reachable end, and fewer rest offsets than requested. Below 745px the list does not scroll and the heading returns to `position: static`.
- Render headed as well as headless before concluding a scrolling region has (or lacks) an affordance. Firefox and Safari rendering has not been checked.

## Verification

Run:

```bash
node --test tests/about-me.test.mjs
npm run test:ui -- tests/ui/about-me.spec.mjs --workers=1
```

The browser suite covers 320x568, 375x500, 375x812, 568x320, both sides of the 640/641px width and 500/501px height compact boundaries, the 744/745px stack boundary, 768x1024, 1280x720, 1280x800, and 1440x900. It verifies the title bar and Close button against `visualViewport`, taskbar clearance, pointer hit testing, dismissal and reopening, body scrolling to the signoff, horizontal containment, breakpoint reflow, console errors, and runtime errors.

Chromium viewport testing does not reproduce every iOS Safari notch or browser-chrome configuration. Dynamic viewport units plus the short portrait and landscape geometry checks are the repository approximation; visually recheck on a physical phone after changing these rules.
