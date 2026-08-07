# Native Retro Scrollbars

Purpose: Preserve the native Windows 98 scrollbar appearance without duplicate Chromium arrow slots.

Scope: Scrollable site containers that inherit the global WebKit scrollbar styling from `style.css`, including the Red Tool chat log.

Last verified: 2026-08-06

## Contract

- Keep scrolling native; do not replace it with custom DOM controls.
- Chromium exposes a secondary legacy button slot at each end. Scope `vertical:start:increment` and `vertical:end:decrement` to `display: none` with zero height.
- Retain only `vertical:start:decrement` for the up arrow and `vertical:end:increment` for the down arrow, using the shared `assets/icon/button-up.svg` and `button-down.svg` artwork.
- Apply the compatibility selectors to the affected scroll surface instead of changing global scrollbar rules without a site-wide rendered audit.
- Firefox and touch devices may use platform-native or overlay scrollbars without arrow buttons. The content must remain scrollable through wheel, touch, keyboard, or platform behavior independently of arrow rendering.

## Verification

Run:

```bash
node --test tests/red-tool-scrollbar.test.mjs
npm run test:ui -- tests/ui/red-tool-scrollbar.spec.mjs --workers=1
```

The browser suite opens Red Tool through the local orchestration API, forces a realistic overflowing conversation, verifies native wheel scrolling, horizontal containment, and viewport containment, and captures mobile, tablet, desktop, and wide renders. Because scrollbar pseudo-parts are not exposed through the accessibility tree or computed-style APIs—and headless browsers may omit their pixels—the source contract counts the exact visible and hidden selectors while a separate headed Chromium inspection provides visual arrow confirmation.
