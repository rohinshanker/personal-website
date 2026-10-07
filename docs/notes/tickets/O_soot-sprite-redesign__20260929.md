# O_soot-sprite-redesign__20260929 — Open

- Scope: Redraw the sprite in the `soot-sprites` random event so it reads as a Studio Ghibli susuwatari. Build four original candidates, present them side by side for the owner to pick, then ship the chosen one. Trajectories, timing, star candy, puffs, and the System Alert prompt stay as they are unless the chosen design needs a hook such as limbs on the ground run.
- Status: open
- Opened: 2026-09-29
- Updated: 2026-10-07
- Current State: Candidate preparation remains queued. Stage 1 (candidates and review page) changes no shipped file; Stage 2 waits for the owner's pick. Owner explicitly said on 2026-10-06 to keep this ticket open after implementation for their own final review.
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

## Plan

1. Write the look spec (eye-to-body ratio, bristle length and count, limb thickness) under this heading from the film reference.
2. Stage 1: build the four candidates behind one `renderSootSprite(variant, size)` seam, used only by `docs/validation/assets/soot-sprite-candidates.html`. `docs/` is not part of the Pages artifact, so nothing ships.
3. The review page shows, per candidate: a 256 px still, the 24 px and 40 px production sizes on the desktop background, and a 32-sprite swarm running the real trajectory code, with a reduced-motion toggle. Save `soot-sprite-candidates.png` as the contact sheet.
4. Owner picks. Record `Decision (date): <id>` with any requested tweaks under this heading.
5. Stage 2: move the chosen renderer into `scripts/home/events/soot-sprites.js` and `random-events.css`, update the tests, regenerate/check the game-build metadata, bump the stylesheet token, and run the Stage 2 verification. Preserve review artifacts and keep the ticket open for the owner's final visual approval after implementation.
6. Cleanup as above.
