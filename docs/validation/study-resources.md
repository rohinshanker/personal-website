# Study Resources interaction and rendering

- Purpose: Preserve native Windows-style row feedback, navigation, and file actions in the Study Resources explorer.
- Scope: Tree and file rows, selection, keyboard focus, PDF actions, disabled actions, responsive explorer layout, and rendered regression checks.
- Last verified: 2026-10-01

## Interaction contract

Clickable tree and file rows use `--dialog-blue` with white foreground text on
hover. Tree toggles share the row highlight so the complete clickable line reads
as one target. Selected rows use the same colors and keep a white dotted focus
outline; keyboard focus on an unselected row or toggle uses a black dotted
outline until its blue hover state requires the white outline for contrast.
Disabled toolbar and preview actions do not acquire row hover styling.

The hover rules are limited to hover-capable devices. They change only paint,
not padding, borders, or dimensions, so pointer feedback cannot shift a row.

## Regression gate

Run the focused browser contract on a unique port and output directory:

```bash
UI_TEST_PORT=4311 UI_TEST_OUTPUT_DIR=test-results/study-resources \
  npx playwright test --project=ui tests/ui/study-resources.spec.mjs
```

The spec uses the shared deterministic Home fixture, adds one manifest-backed
PDF, and covers 375×812, 768×1024, 1280×800, 1440×900, and both sides of the
760px responsive breakpoint. It verifies hover paint and geometry, selected and
keyboard-focus contrast (including simultaneous hover and focus), list and
gallery PDF rows, disabled actions, folder navigation, PDF window/tab/download
actions, overflow, runtime diagnostics, and a populated-state axe scan.

When `styles/home/study-resources.css` changes, bump its shared `?v=` token in
`home.html` and the `index.html` Home warm-up list. The root sitemap date changes
only when its current `lastmod` no longer matches the release date.
