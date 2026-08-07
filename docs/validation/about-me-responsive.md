# About Me Responsive Window

Purpose: Preserve a reachable About Me title bar and internally scrollable content across compact phone, tablet, and desktop viewports.

Scope: `#about-window`, `.about-body`, the About content grid, and compact social-card layout on `home.html`.

Last verified: 2026-08-05

## Sizing contract

- Tablet and desktop retain the default `min(79vh, 750px)` About body.
- Viewports at most 640px wide or 500px tall use a `min(65dvh, 640px)` body, with `vh` as the fallback. The outer centering and height caps also use dynamic viewport units so mobile browser chrome is reflected in the usable height.
- The compact maximum reserves 140px for the title bar, taskbar, and vertical clearance. Its minimum may shrink below 220px on short landscape screens instead of overriding that cap.
- `.about-body` remains the primary vertical scroll surface. The title bar and Close button must not move while content scrolls from the welcome heading to the signature.
- The About page grid uses one shrinkable `minmax(0, 1fr)` track. At 340px and narrower, social cards use two columns to prevent hidden horizontal overflow and uneven card heights.

## Verification

Run:

```bash
node --test tests/about-me.test.mjs
npm run test:ui -- tests/ui/about-me.spec.mjs --workers=1
```

The browser suite covers 320x568, 375x500, 375x812, 568x320, both sides of the 640/641px width and 500/501px height compact boundaries, the 744/745px stack boundary, 768x1024, 1280x720, 1280x800, and 1440x900. It verifies the title bar and Close button against `visualViewport`, taskbar clearance, pointer hit testing, dismissal and reopening, body scrolling to the signoff, horizontal containment, breakpoint reflow, console errors, and runtime errors.

Chromium viewport testing does not reproduce every iOS Safari notch or browser-chrome configuration. Dynamic viewport units plus the short portrait and landscape geometry checks are the repository approximation; visually recheck on a physical phone after changing these rules.
