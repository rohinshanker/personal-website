# A_soot-sprite-redesign__20260929 — Active

- Scope: Redraw the sprite in the `soot-sprites` random event so it reads as a Studio Ghibli susuwatari. Build four original candidates, present them side by side for the owner to pick, then ship the chosen one. Trajectories, timing, star candy, puffs, and the System Alert prompt stay as they are unless the chosen design needs a hook such as limbs on the ground run.
- Status: active
- Opened: 2026-09-29
- Updated: 2026-10-17
- Current State: Stage 1 is complete (2026-10-17): four original candidates, the review page `docs/validation/assets/soot-sprite-candidates.html` and the contact sheet `docs/validation/assets/soot-sprite-candidates.png` are committed; no shipped file changed. Waiting for the owner's pick under "Decision" below before Stage 2. Owner explicitly said on 2026-10-06 to keep this ticket open after implementation for their own final review.
- Verification: Stage 1: the review page renders all four candidates at 375×812 and 1440×900 with no console errors, and a contact sheet PNG is saved beside it. Stage 2: `node scripts/update-game-integrity.mjs` then `--check`; `npm test` with `tests/gears-nest.test.mjs` updated; `npm run test:ui` (`deferred-window-media.spec.mjs` opens this event); trigger the event through Admin Controls at 375×812, 768×1024, 1280×800, and 1440×900 plus reduced motion; a 32-sprite swarm under 4× CPU throttling shows no long task over 50 ms; `npm run test:visual`.
- Owner Approval: Required both for candidate selection and final visual acceptance. Keep the ticket open and retain review artifacts after implementation until the owner reviews the completed event and explicitly approves closure.
- Cleanup: After the chosen design ships and the owner approves final review, delete the review page, contact sheet and three unchosen candidates; record the sprite's look contract in `docs/validation/system-alert-random-events.md`; delete this ticket and its index row.

## Current rendering

- `createSootSpriteElement` in `scripts/home/events/soot-sprites.js` builds `span.soot-sprite > span.soot-sprite-body > 2 × span.soot-sprite-eye`; the look is CSS only in `styles/home/random-events.css`. Sprites are 24–40 px, 32 on desktop and 20 on mobile.
- The body is a radial-gradient disc with a random 42–58% border radius and a grey highlight at 42%/36%. The fuzz is two fixed 28-point `clip-path` starbursts on the pseudo-elements plus six offset box-shadows.
- The eyes are 7–10 × 8–12 px ovals, each rotated at random, with a pupil fixed at 56%/52%.
- Why it reads wrong: the starbursts look like spikes rather than soft bristles, every sprite shares the same two fuzz shapes, the highlight makes a glossy ball, the eyes are small and tilted, and the pupils never move.

## Film reference

- *My Neighbor Totoro* (1988): matte black, round, a fringe of short irregular bristles, two large round white eyes set close together with small black pupils, no limbs, no mouth. They drift and scatter as a swarm.
- *Spirited Away* (2001): the same body and eyes with thin wiry arms and legs. They carry coal and are fed konpeitō star candy, which this event already drops.
- Shared traits to keep: flat black with no highlight, a soft bristly silhouette that differs per sprite, eyes that dominate the face, pupils that look around.

## Candidates

All four are film-faithful and differ by source film and drawing technique. The implementer may adjust a candidate that does not work, but the owner gets four distinct options.

| Id | Film | Technique | Distinguishing behaviour |
| --- | --- | --- | --- |
| A | Totoro | Vector SVG silhouette with a bristle fringe | Limbless; pupils follow the direction of travel. |
| B | Totoro | Procedural fur: strands generated per sprite so no two match | Limbless; occasional blink; fringe shivers while falling. |
| C | Spirited Away | Vector SVG with arms and legs | Legs scurry on the ground run; arms tuck in while falling. |
| D | Spirited Away | Procedural fur with limbs | After landing, some sprites lift a star candy overhead. |

## Constraints

- Original artwork only. Film stills are study references: no frames, traced stills, or third-party fan assets enter the repository.
- 32 sprites animate at once. Keep the per-sprite DOM small (a shared SVG `<symbol>` or one cached bitmap per variant), animate only `transform` and `opacity`, and keep today's reduced-motion behaviour.
- Keep the class names and registration shape asserted by the soot-sprite case in `tests/gears-nest.test.mjs`, or update that test with the change.
- A shipped change to `random-events.css` bumps its cache token on every entry point (`tests/entry-point-cache-tokens.test.mjs`).

## Look spec

Measured in body diameters (D). Both films share it; only the limbs differ.

- Body: a flat matte disc (`#060606`), no highlight, no gradient, no outline.
- Eyes: two white discs of 0.30 D, centres 0.32 D apart and 0.06 D above the body centre, so they nearly touch and dominate the face. Pupils are black discs of 0.10 D resting at the eye centres and travelling up to 0.06 D toward the direction of travel.
- Fur: a dense coat of 84–120 short hairs (0.05–0.15 D long) plus 18–34 stray hairs (0.10–0.23 D), each a thin tapered quad (0.02–0.03 D at the base) bent by up to 0.3 rad, rooted 0.03 D inside the body edge so no clean circle edge shows. Fixed fringes (A, C) use the same generator with a fixed seed and vary per sprite by rotation and mirroring; procedural fur (B, D) regenerates per sprite.
- Limbs (Spirited Away only): 0.03 D strokes with round caps, never thinner than 1 px. Arms 0.30 D long from shoulders at 0.44 D either side of centre and 0.06 D below it, with a two-prong hand; rest pose 12–30° below horizontal, tucked 62° while falling, raised to −135° when lifting candy. Legs 0.28 D long from hips 0.28 D apart at the body's underside, with a 0.10 D foot pointing outward; scurry ±25° every 110 ms on the ground run.

## Stage 1 record (2026-10-17)

- Files (none shipped; `docs/` is outside the Pages artifact): `docs/validation/assets/soot-sprite-candidates.html`, `docs/validation/assets/soot-sprite-candidates.png`, and `docs/validation/assets/soot-sprite-candidates/` holding `soot-sprite-renderers.js` (the `renderSootSprite(variant, size)` / `applySootSpriteTimeline(body, timeline)` seam), `soot-sprite-candidates.css`, `review-runtime-stubs.js` (stand-ins for `homeDom`, `homeUtil`, `homeEventRuntime`) and `review.js`.
- The review page loads the real `scripts/home/events/soot-sprites.js`, so the alert, the 120 ms reveal, the 1 s hold, the 32-sprite desktop / 20-sprite mobile swarm, candies, puffs, trajectories and timing are production code. The page swaps each `.soot-sprite-body` for the chosen candidate while the swarm is staged and reads each sprite's fall/run timeline from its Web Animations keyframes to drive the behaviours. A "Current sprite" option runs today's design for comparison, and a reduced-motion toggle renders the candidates in their resting poses.
- Renderer structure: one inline SVG per sprite draws the static coat (fur or `<use>` of a shared fringe symbol plus the disc); eyes, pupils, limbs and the held candy are HTML spans sized from `--soot-candidate-size`, so every behaviour animation is a composited `transform`/`opacity` on an HTML element. An earlier draft animated SVG child elements, which Chromium runs on the main thread; keep this split in Stage 2.
- Verified 2026-10-17 with headless Chromium: the page renders at 375×812 and 1440×900 with no console errors or warnings, no page errors and no horizontal overflow; each candidate swarm released 32 dressed bodies at 1440×900 (20 at 375×812) with zero leftover production bodies. Contact sheet captured from the four cards at 1440×900.
- Measured cost at 1× CPU, 1440×900, for Stage 2 planning: the production swarm creation alone is one ≈50 ms task (the "Current sprite" run), and the first composited frame after release costs ≈40 ms. Dressing a candidate adds ≈15–25 ms of JS inside the creation task (fur path generation for B/D ≈10 ms, 32–190 paused animations ≈1–13 ms) plus ≈60 ms at release when its layers first composite. So the 50 ms long-task budget under 4× throttling will need the swarm built in chunks during the 1 s hold regardless of which candidate wins; a candidate without limbs (A, B) composites about a third as many layers as C or D.

## Decision

Owner pick pending. Record `Decision (date): <id>` with any requested tweaks here.

## Plan

1. Look spec: written above.
2. Stage 1: done, see the record above.
3. Review page: done; the contact sheet is `docs/validation/assets/soot-sprite-candidates.png`.
4. Owner picks. Record `Decision (date): <id>` with any requested tweaks under "Decision".
5. Stage 2: move the chosen renderer into `scripts/home/events/soot-sprites.js` and `random-events.css`, update the tests, regenerate/check the game-build metadata, bump the stylesheet token, and run the Stage 2 verification. Preserve review artifacts and keep the ticket open for the owner's final visual approval after implementation.
6. Cleanup as above.
