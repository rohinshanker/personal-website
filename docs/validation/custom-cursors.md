# Custom Cursor Semantics

Purpose: Preserve native-style cursor meaning while using the Jeelh light and dark cursor packs.

Scope: Entry, Home, and Video Editor cursor tokens, selectable text, guarded
controls, loading states, editor operations, and Admin target picking.

Last verified: 2026-08-26

## Behavior contract

- The text I-beam follows a real selectable text glyph under a mouse pointer. A retained, keyboard-created, or programmatic `Selection` never changes unrelated cursors.
- A primary-mouse selection gesture retains the I-beam from `selectstart` through pointer release, cancellation, lost capture, or window blur. Touch input never activates cursor-only document state.
- Links, buttons, help targets, editable controls, draggable title bars, resize handles, disabled controls, and loading states keep their semantic cursor precedence.
- `tabindex` alone indicates focusability, not clickability. Interactive elements must use their native element or an appropriate role/class rather than relying on a focusable ancestor to force pointer cursors on its text.
- Base and text-state cursor rules remain zero-specificity and ordered before semantic rules. Help targets remap select/pressed tokens to help; unavailable and loading rules remain authoritative. Admin pickable targets remap interactive tokens to precision only while picker mode is active.
- The Video Editor loads the shared cursor stylesheet and text-selection
  behavior rather than copying cursor assets. It reads the Home Cursor Settings
  value from `localStorage["rohin-os-cursor-mode"]`; only `dark` enables the dark
  pack, while missing, invalid, inaccessible, or `light` values use the light
  pack. The editor reapplies this mode on `pageshow` and responds to same-origin
  `storage` events so an already-open editor follows changes made on Home.
- Fixed Video Editor windows opt out of draggable-title semantics. Timeline
  placement uses precision, clip and tab dragging uses move/pressed, edge and
  panel handles use the matching resize direction, and disabled, help, text,
  and ordinary action controls retain the shared semantic tokens. Generic
  custom-cursor guards prevent draggable, separator, and timeline-placement
  text from entering document text-selection cursor state.
- Administrator sign-in, local media metadata reads, and Audio-Sync analysis
  use the nine-frame working cursor. Reduced motion holds a single frame.
  Pointer release, cancellation, lost capture, blur, page hiding, and
  deauthentication clear editor drag or resize cursor state.

## Verification

Run:

```sh
npm test
npx playwright test tests/ui/custom-cursor-selection.spec.mjs
npx playwright test tests/ui/video-editor.spec.mjs --grep "cursor"
npx playwright test tests/ui/about-me.spec.mjs tests/ui/admin-controls.spec.mjs
```

The focused browser matrix covers `/index.html`, `/home.html`, and
`/video-editor/` at mobile and desktop boundaries; Home and editor light/dark
modes; cross-tab preference changes; hover, drag, release, retained selection,
touch cleanup, guarded cursor tokens, precision and resize modes, working and
reduced-motion states, overflow, semantics, cursor-resource responses, console
errors, and runtime errors. Successful screenshots are ephemeral under
`test-results/` and are not visual baselines.
