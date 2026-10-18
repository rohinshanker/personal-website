# A_soot-sprite-redesign__20260929 — Active

- Scope: Redraw the sprite in the `soot-sprites` random event so it reads as a Studio Ghibli susuwatari in the site's pixel style: fuzzy, limbless, black. Build original candidates, present them side by side for the owner to pick, then ship the chosen one. Trajectories, timing, star candy, puffs, and the System Alert prompt stay as they are unless the chosen design needs a hook such as limbs on the ground run.
- Status: active
- Opened: 2026-09-29
- Updated: 2026-10-18
- Current State: After declining round 1, the owner reviewed E–H on 2026-10-18 and asked for candidate I: a random mixture of F, G and H with H's boil and blink on every sprite, plus pixel-art smoke and candy. I is on the review page `docs/validation/assets/soot-sprite-candidates.html` (default selection, with a "Pixel-art smoke and candy" toggle) and the contact sheet `docs/validation/assets/soot-sprite-candidates.png`; no shipped file changed. Waiting for the owner's approval of I (or tweaks) under "Decision" before Stage 2. Owner explicitly said on 2026-10-06 to keep this ticket open after implementation for their own final review.
- Verification: Stage 1: the review page renders every candidate at 375×812 and 1440×900 with no console errors, and a contact sheet PNG is saved beside it. Stage 2: `node scripts/update-game-integrity.mjs` then `--check`; `npm test` with `tests/gears-nest.test.mjs` updated; `npm run test:ui` (`deferred-window-media.spec.mjs` opens this event); trigger the event through Admin Controls at 375×812, 768×1024, 1280×800, and 1440×900 plus reduced motion; a 32-sprite swarm under 4× CPU throttling shows no long task over 50 ms; `npm run test:visual`.
- Owner Approval: Required both for candidate selection and final visual acceptance. Keep the ticket open and retain review artifacts after implementation until the owner reviews the completed event and explicitly approves closure.
- Cleanup: After the chosen design ships and the owner approves final review, delete the review page, contact sheet and the unchosen candidates; record the sprite's look contract in `docs/validation/system-alert-random-events.md`; delete this ticket and its index row.

## Current rendering

- `createSootSpriteElement` in `scripts/home/events/soot-sprites.js` builds `span.soot-sprite > span.soot-sprite-body > 2 × span.soot-sprite-eye`; the look is CSS only in `styles/home/random-events.css`. Sprites are 24–40 px, 32 on desktop and 20 on mobile.
- The body is a radial-gradient disc with a random 42–58% border radius and a grey highlight at 42%/36%. The fuzz is two fixed 28-point `clip-path` starbursts on the pseudo-elements plus six offset box-shadows.
- The eyes are 7–10 × 8–12 px ovals, each rotated at random, with a pupil fixed at 56%/52%.
- Why it reads wrong: the starbursts look like spikes rather than soft bristles, every sprite shares the same two fuzz shapes, the highlight makes a glossy ball, the eyes are small and tilted, and the pupils never move.

## Reference

- The owner's reference (2026-10-18) is a Spirited Away still of a crowd of susuwatari holding konpeitō: round bodies with a dense radial coat of thin hairs, two large white eyes nearly touching with small pupils looking in different directions, no mouth. The owner wants them "just more black", without arms or legs, and slightly pixelated to match the site.
- Shared traits to keep: flat black with no highlight, a bristly silhouette that differs per sprite, eyes that dominate the face, per-sprite gaze.

## Candidates (round 2)

All four are limbless pixel art drawn cell by cell on a shared canvas sheet. The first round (A–D, vector and procedural SVG fur, two with limbs) was declined on 2026-10-18 and removed.

| Id | Name | Cells, coat and eyes | Distinguishing behaviour |
| --- | --- | --- | --- |
| E | Chunky | 3 px cells; short dense coat (0.08–0.16 D); eyes 0.36 D | Static coat; fixed random gaze per sprite. |
| F | Reference | 2 px cells; medium coat (0.10–0.22 D); eyes 0.36 D | Static coat with the reference's proportions; fixed random gaze. |
| G | Urchin | 1.5 px cells; long bent hairs (0.14–0.30 D), sparser; eyes 0.36 D | Static coat with the sea-urchin silhouette; fixed random gaze. |
| H | Boil | F's cells and coat drawn twice plus a blink frame | Coat flickers between two drawings every 160 ms while moving; eyes blink every few seconds. |
| I | Mix | Each sprite draws F's, G's or H's cells and coat at random (H's coat is F's) | Every sprite boils and blinks like H; pixel-art smoke and candy replace the blurred puffs and vector stars. |

## Constraints

- Original artwork only. Film stills are study references: no frames, traced stills, or third-party fan assets enter the repository.
- 32 sprites animate at once. Keep the per-sprite DOM small (one span showing a slice of a shared sprite sheet), animate only `transform`, `opacity` and stepped `background-position`, and keep today's reduced-motion behaviour.
- Keep the class names and registration shape asserted by the soot-sprite case in `tests/gears-nest.test.mjs`, or update that test with the change.
- A shipped change to `random-events.css` bumps its cache token on every entry point (`tests/entry-point-cache-tokens.test.mjs`).

## Look spec

Measured in body diameters (D) on a cell grid of `round(size / unit)` cells per D, never fewer than 8.

- Body: a filled black disc (`#000`), no highlight, no gradient, no outline.
- Eyes: two white ovals 0.36 D wide and 1.15× as tall, centres 0.38 D apart and 0.05 D above the body centre, corner cells trimmed. Pupils are black squares of `max(1, round(0.07 × cells))` cells, kept at least one cell inside the white, offset in a random direction per sprite (the baked gaze).
- Coat: `π × cells × density` single-cell hairs rooted one cell inside the body edge, evenly spaced with ±40% jitter, each with its own length in the candidate's range and a bend of up to the candidate's curl. Drawn before the disc so the body covers the roots.
- Sheet: every frame of every sprite in a swarm is drawn side by side on one canvas with one 2D context and encoded once to a PNG data URL; each sprite's span shows its slice through `background-position`, scaled with `image-rendering: pixelated` so one cell is `size / cells` CSS px.
- Boil and blink (H, I): three frames per sprite (two coats with the same gaze, one with closed-eye slits); one stepped `background-position` animation per sprite alternates the coats every 160 ms over the whole fall and run and shows the blink frame for one step every 2.4–4.8 s.
- Pixel smoke: six 96×48-cell blobs on one sheet, each a union of six to nine discs in three translucent shades of black (0.5 core, 0.32 body with 15% dropout, 0.16 rim with 60% dropout). A puff keeps its production drift, scale and fade animations and shows one blob through `background-position` with `image-rendering: pixelated`; the blur filter is removed.
- Pixel candy: the five production candy colours in two 9×9-cell star shapes on one sheet, with a white highlight cell and a darker lower-right edge; a candy keeps its fall, spin and fade animations, drops the clip-path star, and shows the slot matching its `--candy-color`.

## Round 2 record (2026-10-18)

- Files (none shipped; `docs/` is outside the Pages artifact): `docs/validation/assets/soot-sprite-candidates.html`, `docs/validation/assets/soot-sprite-candidates.png`, and `docs/validation/assets/soot-sprite-candidates/` holding `soot-sprite-renderers.js` (the `renderSootSprites(variant, [{ size, nominalSize }])` / `applySootSpriteTimeline(body, timeline)` seam), `soot-sprite-candidates.css`, `review-runtime-stubs.js` (stand-ins for `homeDom`, `homeUtil`, `homeEventRuntime`) and `review.js`.
- The review page loads the real `scripts/home/events/soot-sprites.js`, so the alert, the 120 ms reveal, the 1 s hold, the 32-sprite desktop / 20-sprite mobile swarm, candies, puffs, trajectories and timing are production code. The page swaps each `.soot-sprite-body` for the chosen candidate while the swarm is staged and reads each sprite's fall/run timeline from its Web Animations keyframes to drive H's boil. The card still is the production 32 px drawing shown at 8× so the cells are visible; the size row shows real 24 px and 40 px sprites. A "Current sprite" option runs today's design for comparison, and a reduced-motion toggle renders every candidate still.
- Verified 2026-10-18 with headless Chromium: the page renders at 375×812 and 1440×900 with no console errors or warnings, no page errors and no horizontal overflow; each candidate swarm released 32 dressed bodies at 1440×900 (20 at 375×812) with zero leftover production bodies. Contact sheet captured from the four cards at 1440×900.
- Measured cost at 1× CPU, 1440×900, for Stage 2 planning: drawing and encoding the whole 32-sprite sheet costs ≈5 ms (E), ≈10 ms (F), ≈16 ms (G), ≈27 ms (H, three frames per sprite) and ≈31 ms (I) of JavaScript inside the swarm-creation task; the 32 stepped animations add ≈2–4 ms. The smoke and candy sheets are drawn once per page (≈10 ms) and dressing the ≈200 puffs and candies is a style write per element. An earlier H draft with three stacked layers and 96 opacity animations added ≈80 ms at staging and ≈90 ms at release; the single-layer `background-position` form removed both. The production swarm creation itself remains a ≈50–90 ms task, so the 50 ms long-task budget under 4× throttling still needs the swarm built in chunks during the 1 s hold whatever the pick; the sheet can be drawn during the same hold.

## Decision

- Decision (2026-10-18): candidates A–D declined. Direction: match the film still, "just more black", no arms or legs, slightly pixelated to fit the site. Round 2 (E–H) built in response.
- Decision (2026-10-18): from E–H, ship a randomized mixture of F, G and H with H's blink and boil on every sprite, pixelated smoke if possible, and pixelated candy. Built as candidate I for a final look before Stage 2.
- Owner approval of I pending. Record `Decision (date): I` with any requested tweaks here.

## Plan

1. Look spec: written above.
2. Stage 1: round 1 declined; round 2 done, see the record above.
3. Review page: done; the contact sheet is `docs/validation/assets/soot-sprite-candidates.png`.
4. Owner approves I or asks for tweaks. Record it under "Decision".
5. Stage 2: move the I renderer, the effect sheets and the dressing into `scripts/home/events/soot-sprites.js` and `random-events.css` (draw the sheets during the 1 s hold), update the tests, regenerate/check the game-build metadata, bump the stylesheet token, and run the Stage 2 verification. Runs after the Biome normalization pass so the new code lands in the normalized style. Preserve review artifacts and keep the ticket open for the owner's final visual approval after implementation.
6. Cleanup as above.
