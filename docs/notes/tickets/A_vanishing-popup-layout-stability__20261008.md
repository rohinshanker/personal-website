# A_vanishing-popup-layout-stability__20261008 — Active

- Scope: Keep the Home page's “Is this popup annoying?” window and remaining buttons stationary as controls disappear and the explosion GIF plays.
- Status: active
- Opened: 2026-10-08
- Updated: 2026-10-09
- Current State: Final candidate `b2b866b` is independently accepted by DEM-332, including the corrected controller cache token. It preserves the 340×123 popup (339×123 below the cap) and independent 200×282 overlay. Captured clicks prevent shared toolbar resizing; hidden controls keep their layout slots. Integrated into main; await controlled release/live parity before closure.
- Validation results: 796 Node, 70 affected UI, nine pinned visual checks, 12 combined popup/graph/verified-game checks, 12 final resource-loading checks and 33 rollout/integrity checks pass. Original geometry cases failed 6/6. Actual screenshots/semantics inspected at four sizes and both cap boundaries; independent keyboard/lifecycle probe passes with zero console errors/warnings. Visual baselines unchanged. Final hash `410fdc1f…`, published `d8f9f98…` retained first in both 32-entry histories; unpublished intermediate excluded. Original cutoff and closed template preserved.
- Verification: Render the real popup at the project's standard desktop and mobile viewports. Record the popup and button bounding boxes before interaction, after each control disappears, and during GIF playback. Check both Yes/No orders and varied toolbar-control orders, including different final controls; verify repeat openings reset correctly. Add regression coverage using existing test infrastructure and run the applicable behavior, UI, visual, and accessibility checks.
- Cleanup: After acceptance, retain only reusable layout/overlay validation guidance in the appropriate indexed `docs/validation/` document, rename this ticket/H1 to resolved and record final validation, then delete the resolved ticket and remove its index row.

## Acceptance criteria

- The explosion GIF overlays the popup. Its intrinsic or displayed dimensions never resize, reposition, or reflow the window or its contents; the window keeps its pre-explosion bounds until it closes.
- Clicking Yes or No makes only that button disappear while preserving its layout space. All remaining controls keep their positions and sizes.
- The same rule applies to the toolbar's Minimize, Maximize, and Close buttons, regardless of click order.
- Disappeared controls cannot be clicked or reached by keyboard focus. Preserve the existing explosion trigger and close sequence after the final control disappears.
- Reopening restores all five controls and the initial layout, with no lingering GIF or stale geometry.

## Implementation pointers

- `home.html`: `#vanishing-popup-window`, its five `[data-vanishing-popup-button]` controls, and sibling `#vanishing-popup-explosion`.
- `scripts/home/events/prompts.js`: popup sizing, button hiding, explosion positioning/playback, and reset lifecycle.
- `styles/home/random-events.css`: hidden-control rules and GIF overlay styles; `styles/home/base.css`: base GIF visibility.
- The GIF already has separate fixed-position markup, and toolbar controls already have a space-preserving hidden rule. Reproduce the reported behavior before identifying the cause; preserve layout space for every disappearing control and check window-size locking against the actual rendered box model.
