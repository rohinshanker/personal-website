# Modeling Portfolio Route

Purpose: Preserve the public `/modeling/` portfolio route, the shoot data it shares with Home, and the Home "Open in separate tab" prompt.

Scope: `modeling/index.html`, `modeling/style.css`, `modeling/script.js`, `scripts/home/modeling-portfolio.js`, the Home Modeling window and its `modeling-launch` prompt, release packaging, and the sitemap.

Last verified: 2026-09-16

## Data contract

- `scripts/home/modeling-portfolio.js` is the single source for every shoot: id, title, date, selector icon, asset folder, ordered files, autoplay, links, and credits. It publishes `window.rohinModelingPortfolio` and loads before `scripts/home/main.js` on Home and before `script.js` on the route.
- Home keeps its static selector rows and viewer panels. `tests/modeling-portfolio.test.mjs` fails when their order, titles, dates, icons, or credit lines drift from the shared data, and when a listed file, icon, or link icon is missing from disk.
- Add a shoot by inserting one entry in the shared data (newest first) and the matching Home selector row and viewer panel. Photos stay in `assets/modeling/<folder>/` at their original quality.
- `instagram` and `dropbox` live in the same file. An empty Dropbox URL renders a disabled Highlights or Digitals button with a "Link coming soon" note; a value renders a new-tab link in its place.

## Route contract

- Canonical URL `https://rohin.shanker.me/modeling/`; the release workflow copies the `modeling` directory into the Pages artifact and `sitemap.xml` lists the route once.
- Header: the `Rohin Shanker Modeling Portfolio` heading, an Instagram link showing the handle, the two Dropbox slots, a collapsed "Jump to a shoot" list linking to every shoot anchor, and a link back to `/`.
- Each shoot is a 98.css window whose title bar holds the shoot icon, the `h2` title, and a Maximize control that opens the fullscreen viewer at the current slide. The body holds the date, the carousel, labelled link buttons, and a collapsed `Credits` disclosure; shoots without credits render no disclosure.
- Below 900 pixels the body stacks date, carousel, links, credits. From 900 pixels the carousel occupies the left column and date, links, and credits the right column.
- The carousel is a snap-scrolling strip with Previous, Next, a live counter, and Left/Right arrow keys. Previous and Next wrap. Only the current slide and its neighbours carry a `src`; the rest keep `data-src` until a carousel is within half a viewport or a slide is within half a strip width. Loading shows the Home hourglass over the slot and sets `aria-busy`. Video slides keep native controls, never open the viewer on click, and the Stand Still clip autoplays muted only while current and near the viewport.
- The fullscreen viewer is a 98.css window over an 85% black backdrop: title bar with Close, black stage, Previous, counter, Next. It opens from a photo or the Maximize control, never changes the URL, locks page scroll by fixing `body` at the recorded offset, sets `inert` on the rest of the page, traps Tab, and answers Escape, Left/Right, backdrop clicks, and horizontal swipes. Closing restores the exact scroll offset and focuses the control that opened it. On phones the window fills the viewport.

## Home prompt contract

- Opening the Modeling window through any launcher opens `#modeling-launch-window` above it with the Modeling icon, `Open in separate tab (rohin.shanker.me/modeling)?`, and Yes/No. The prompt uses the shared `data-launch-prompt-window` behaviour: Yes opens `/modeling/` with `opener` cleared and closes only the prompt; No, Close, and Escape close only the prompt; a blocked popup shows the pop-up error and keeps Yes focused; focus returns to the launcher.
- Both new-tab prompts (Video Editor and Modeling) share `NEW_TAB_LAUNCH_PROMPTS`, `[data-launch-prompt-open]`, and `[data-launch-prompt-error]` in `scripts/home/main.js`; there is no per-prompt registry in `scripts/home/core/dom.js`.
- The prompt is centred, not randomly placed, so `home.html` still carries exactly two `data-random-viewport-position` dialogs.

## Verification

```bash
node --test tests/modeling-portfolio.test.mjs tests/content-tool-placeholders.test.mjs tests/media-priority.test.mjs
npx playwright test --project=ui tests/ui/modeling-portfolio.spec.mjs tests/ui/modeling-launch-prompt.spec.mjs
npx playwright test --project=ui tests/ui/accessibility.spec.mjs -g "modeling"
npm run test:visual
```

The route spec covers 375x812, 768x1024, 1280x800, and 1440x900 with stubbed photos: header content, shoot order, column placement, document overflow, neighbour-only loading, Previous/Next/arrow navigation with wrap, the hourglass, credits, the viewer's scroll lock, inert page, focus trap and restoration, keyboard and swipe navigation, video slides, a configured Dropbox link, deep links, the jump list, the Top link, and the phone-sized viewer. The prompt spec covers all four viewports, stacking order, Yes with a real popup, repeated opens, Escape and Close, and a blocked popup. The accessibility matrix scans the route, its open viewer, and the Home prompt with no expected violations. Visual baselines cover the route at desktop and mobile with stubbed media.

Changes to `scripts/home/main.js` or `scripts/home/core/dom.js` also require:

```bash
node scripts/update-game-integrity.mjs
npm run game-stats:integrity:check
```

For rendered inspection, serve the repository and open `/modeling/` at the four review viewports plus `/home.html` with the Modeling window open. Check the header wrap at 375 pixels, the two-column shoot layout from 900 pixels, an opened Credits list, the viewer at desktop and phone sizes, console output, page errors, and failed requests. A direct local Home load logs the known localhost CORS rejection from the production Game Stats Worker; it is unrelated to this route.
