# Modeling Portfolio Route

- Purpose: Preserve the public `/modeling/` portfolio route, the shoot data it shares with Home, and Home's two new-tab entry points to it.
- Scope: `modeling/index.html`, `modeling/style.css`, `modeling/script.js`, `scripts/home/modeling-portfolio.js`, the Home Modeling window and its pinned row, the `modeling-portfolio-alert` random event, the matching pinned Substack row in Writing, release packaging, and the sitemap.
- Last verified: 2026-11-14

## Data contract

- `scripts/home/modeling-portfolio.js` is the single source for every shoot: id, title, date, selector icon, asset folder, ordered files, autoplay, links, and credits. It publishes `window.rohinModelingPortfolio` and loads before `scripts/home/main.js` on Home and before `script.js` on the route.
- Home's selector rows and viewer panels are static, crawlable HTML generated from the shared data by `node scripts/build-modeling-markup.mjs`. It rewrites only the lines between the `BEGIN generated modeling selector rows` / `modeling viewer panels` comments and their `END` comments in `home.html`, at each start marker's indentation; never edit those lines by hand. The first published shoot gets `is-active` and its panel stays visible; text is HTML-escaped and attributes also escape quotes.
- Each published shoot needs a non-empty `id`, `title`, `date`, and `icon`, unique ids, and a `files` array; `links` and `credits` are optional lists that Home, the route, the generator, and the data tests all treat as empty when omitted. The generator reports missing required fields, duplicate ids, an empty published list, and malformed generation boundaries.
- `npm run modeling:check` (release `verify` job) and `tests/build-modeling-markup.test.mjs` fail on stale Home markup. `tests/modeling-portfolio.test.mjs` independently parses Home and fails when order, titles, dates, icons, or credit lines drift from the data, and when a listed file, icon, or link icon is missing from disk. Its isolated regression omits both optional lists from one shoot in a temporary copy and requires generation, `--check`, completeness, and parity to pass.
- Add a shoot by inserting one entry in the shared data (newest first), then run the generator. Photos stay in `assets/modeling/<folder>/` at their original quality. A shoot whose `files` list is empty is unpublished: `/modeling/` skips it and the generator omits its Home row and panel; listing its files publishes it.
- When shoot data changes, update the shared script cache token together in `home.html`, the `index.html` preload list, and `modeling/index.html`. `tests/shared-literals.test.mjs` checks their parity.
- `instagram` and `dropbox` live in the same file. An empty Dropbox URL renders a disabled Highlights or Digitals button with a "Link coming soon" note; a value renders a new-tab link in its place.

## Route contract

- Canonical URL `https://rohin.shanker.me/modeling/`; the release workflow copies the `modeling` directory into the Pages artifact and `sitemap.xml` lists the route once.
- Header: the `Rohin Shanker Modeling Portfolio` heading; directly beneath it a Measurements list (Height, Weight, Shoe, Chest/Bust, Waist, Pant Waist, Hips, Inseam from the shared data) with a US/EU toggle (`aria-pressed` buttons named `US` and `EU`, US pressed by default). Each entry has exactly one source value: `inches` shows inches in US mode (Height as feet and inches) and centimetres at 2.54 in EU mode, rounded to one decimal except Height; `pounds` shows `135 lbs` in US mode and kilograms at 0.45359237 to one decimal in EU mode; `regional` carries explicit per-mode text (Shoe `US 11` / `EU 45`) and is never derived from a conversion. Every mode renders from the source figures, so round trips never accumulate rounding; then one sentence explaining fullscreen and download, an Instagram link showing the handle, the two Dropbox slots, a collapsed "Jump to a shoot" list linking to every shoot anchor, and a link back to `/`.
- Each shoot is a 98.css window whose title bar holds the shoot icon, the `h2` title, and a text `Expand` control that opens the fullscreen viewer at the current slide. The body holds the date, the carousel, labelled link buttons, and a collapsed `Credits` disclosure; shoots without credits render no disclosure.
- Below 900 pixels the body stacks date, carousel, links, credits. From 900 pixels the carousel occupies the left column and date, links, and credits the right column.
- The carousel is a snap-scrolling strip with Previous, Next, a live "n of N" readout, and Left/Right arrow keys. Previous and Next wrap. The readout is a raised download link with the Windows download icon: the whole control saves the current photo or clip as `<shoot-anchor>-<n>-of-<N>.<ext>` through the `download` attribute, and its `href`, name, and label follow the current slide. Only the current slide and its neighbours carry a `src`; the rest keep `data-src` until a carousel is within half a viewport or a slide is within half a strip width. Loading shows the Home hourglass over the slot and sets `aria-busy`. Video slides keep native controls, never open the viewer on click, and the Stand Still clip autoplays muted only while current and near the viewport.
- The fullscreen viewer is a 98.css window over an 85% black backdrop: title bar with a Close control whose glyph is scaled to fill it, black stage, Previous, the same download readout, Next. It opens from a photo or the Expand control, never changes the URL, locks page scroll by fixing `body` at the recorded offset, sets `inert` on the rest of the page, traps Tab, and answers Escape, Left/Right, backdrop clicks, and horizontal swipes. Closing restores the exact scroll offset and focuses the control that opened it. On phones the window fills the viewport.

## Home entry points

- Opening the Modeling window shows no prompt. Its selector list starts with a hand-written pinned row above the `BEGIN generated modeling selector rows` marker, so regeneration never moves it: an `<a class="selector-item selector-item--link">` to `/modeling/` with `target="_blank"` and `rel="noopener noreferrer"`, the Modeling icon (`accessibility_window_objs.ico`), the title `Modeling Portfolio Site`, and no date. It has no `data-view`, never becomes active, and leaves the current shoot selected.
- `resetWindowToFirstTab` in `scripts/home/core/windows.js` selects the first `.selector-item[data-view]`, so every open lands on the newest published shoot. A view-less link row is skipped by selection and by hidden-panel prewarming.
- Writing pins Substack the same way: a link row to `https://rohins.substack.com/` first, no Substack panel, and Structural Bioinformatics as the default view.
- The `modeling-portfolio-alert` random event (`scripts/home/events/prompts.js`, interactive) shows `#modeling-portfolio-alert-window`, a `random-alert-window` titled System Alert with a title-bar Close, the Modeling icon, `Check out my modeling portfolio!`, and a Sure! `.button-link` anchor to `/modeling/` in a new tab. Sure! follows the link and dismisses the alert; Close dismisses it. Both links are real anchors, so no pop-up blocker handling is needed.
- `NEW_TAB_LAUNCH_PROMPTS` now holds only the Video Editor prompt.

## Verification

```bash
npm run modeling:check
node --test tests/build-modeling-markup.test.mjs tests/modeling-portfolio.test.mjs tests/content-tool-placeholders.test.mjs tests/media-priority.test.mjs
npx playwright test --project=ui tests/ui/modeling-portfolio.spec.mjs tests/ui/modeling-portfolio-links.spec.mjs tests/ui/portfolio-content-items.spec.mjs
npx playwright test --project=ui tests/ui/accessibility.spec.mjs -g "modeling"
npm run test:visual
```

The route spec covers 375x812, 768x1024, 1280x800, and 1440x900 with stubbed photos: header content, shoot order, column placement, document overflow, neighbour-only loading, Previous/Next/arrow navigation with wrap, the download readout in the carousel and viewer with real download events, the hourglass, credits, the viewer's scroll lock, inert page, focus trap and restoration, keyboard and swipe navigation, video slides, a configured Dropbox link, deep links, the jump list, the Top link, and the phone-sized viewer. The links spec covers all four viewports: no prompt on open, the pinned row's link attributes, icon, missing date and geometry, the newest shoot active, the row by click and Enter opening a real `/modeling/` popup with no opener while the current shoot stays selected, reopening on the newest shoot, and the alert's name, description, icon, Sure!/Close controls, viewport containment, Close, and Sure! opening the popup and dismissing the alert. `portfolio-content-items.spec.mjs` covers the Writing default and the Substack row's popup. The accessibility matrix scans the route, its open viewer, the Home Modeling window, and the open alert with no expected violations. Visual baselines cover the route at desktop and mobile with stubbed media.

Changes to `scripts/home/core/windows.js`, `scripts/home/main.js`, or `scripts/home/core/dom.js` also require:

```bash
node scripts/update-game-integrity.mjs
npm run game-stats:integrity:check
```

For rendered inspection, serve the repository and open `/modeling/` at the four review viewports plus `/home.html` with the Modeling window open. Check the header wrap at 375 pixels, the two-column shoot layout from 900 pixels, an opened Credits list, the viewer at desktop and phone sizes, console output, page errors, and failed requests. A direct local Home load logs the known localhost CORS rejection from the production Game Stats Worker; it is unrelated to this route.

## Shared media helpers

`core/media.js` loads before the route script and publishes `window.homeMedia`.
Home and Modeling use its `isVideoSource`, `createLoadingIndicator`, and
`setLoading` helpers. Video detection accepts MP4, WebM, and Ogg extensions,
case-insensitively, before an optional query or fragment.

The loader selects the raw hourglass below 258 pixels wide or 272 pixels high;
at either exact boundary it uses the padded asset. `setLoading` owns the slot's
`aria-busy` and the decorative indicator's visibility, reuses one direct-child
indicator, and avoids reassigning an unchanged image source. Modeling passes
`assetRoot: "../"`; Home passes its gallery CSS block and loading class. Keep
route geometry and image completion/error handling in the callers.

Run `node --test tests/shared-media.test.mjs tests/shared-literals.test.mjs` for
these contracts. The literal check also keeps Home, the landing prefetch list,
Modeling, and Admin Controls preview stylesheet versions aligned.
