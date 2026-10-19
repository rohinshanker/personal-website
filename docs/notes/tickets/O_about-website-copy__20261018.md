# O_about-website-copy__20261018 — Open

- Scope: Replace the "About this Website" paragraph in the About Me window (`home.html`, `.about-website-section`) with the owner's new copy, keeping the section heading and the "—Rohin" signature line.
- Status: open
- Opened: 2026-10-18
- Updated: 2026-10-19
- Current State: Implemented on 2026-10-19: the paragraph in `home.html` carries the new copy with the "—Rohin" signature, `styles/home/portfolio.css` reserves the section's previous height so the Education list keeps its tuned scrollport (see `docs/validation/about-me-responsive.md`), the stylesheet token is `about-copy-20261019`, and the copy assertions in both About tests are updated. Awaiting the owner's look at the rendered window below.
- Verification: Update the copy assertions in `tests/about-me.test.mjs` and `tests/ui/about-me.spec.mjs`; run them, the About Me responsive and accessibility specs, and `node --test tests/*.test.mjs`. Render About Me at 375×812, 768×1024, 1280×800 and 1440×900 and confirm the shorter paragraph keeps the overview panel's layout (no clipped or overflowing text, Education list still reachable). Review the exact patch.
- Cleanup: Resolve and delete this ticket and its index row after the owner sees the rendered window.

## Copy

Replace the paragraph text with exactly:

> Welcome to my website! I wanted to make something to keep all of my work organized in a playful & interactive format. Feel free to reach out to me if you would like to work together or if you have any questions on my projects. Enjoy your stay :)

In HTML the ampersand is written `&amp;`. Keep the existing `<br />` and "—Rohin" signature after it (owner decision, 2026-10-19).

## Constraints

- Only the paragraph changes; the heading, the Education list and the rest of About Me stay as they are.
- `home.html` itself has no cache token, but if `styles/home/portfolio.css` needs a spacing adjustment for the shorter text, bump its token in `home.html` and `index.html` together and update the pin in `tests/about-me.test.mjs`.
- `docs/validation/about-me-responsive.md` documents the compact overview panel; re-check its layout contract still holds.

## Owner Review

Rendered from the real page with the new copy, under `docs/validation/assets/about-website-copy/`: `about-mobile.png` (375×812), `about-tablet.png` (768×1024), `about-desktop.png` (1280×800) and `about-wide.png` (1440×900). At every size the paragraph fits its panel without clipping, the window has no horizontal overflow, and the Education list is reachable; the list's whole-heading sweep passes at 768, 1280 and 1440.
