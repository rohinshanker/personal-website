# Custom Cursor Semantics

Purpose: Preserve native-style cursor meaning while using the Jeelh light and dark cursor packs.

Scope: Entry and Home route cursor tokens, selectable text, guarded controls, loading states, and Admin target picking.

Last verified: 2026-08-11

## Behavior contract

- The text I-beam follows a real selectable text glyph under a mouse pointer. A retained, keyboard-created, or programmatic `Selection` never changes unrelated cursors.
- A primary-mouse selection gesture retains the I-beam from `selectstart` through pointer release, cancellation, lost capture, or window blur. Touch input never activates cursor-only document state.
- Links, buttons, help targets, editable controls, draggable title bars, resize handles, disabled controls, and loading states keep their semantic cursor precedence.
- `tabindex` alone indicates focusability, not clickability. Interactive elements must use their native element or an appropriate role/class rather than relying on a focusable ancestor to force pointer cursors on its text.
- Base and text-state cursor rules remain zero-specificity and ordered before semantic rules. Help targets remap select/pressed tokens to help; unavailable and loading rules remain authoritative. Admin pickable targets remap interactive tokens to precision only while picker mode is active.

## Verification

Run:

```sh
npm test
npx playwright test tests/ui/custom-cursor-selection.spec.mjs
npx playwright test tests/ui/about-me.spec.mjs tests/ui/admin-controls.spec.mjs
```

The focused browser matrix covers `/index.html` and `/home.html` at 375×812, 768×1024, 1280×800, and 1440×900; Home light/dark modes; hover, drag, release, retained selection, touch cleanup, guarded cursor tokens, precision mode, overflow, semantics, console errors, and runtime errors. Successful screenshots are ephemeral under `test-results/` and are not visual baselines.
