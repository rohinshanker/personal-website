# Winnable Solitaire Deals

Purpose: Keep every newly generated Solitaire deal provably winnable without a runtime search.

Scope: Solitaire deal generation, draw-one unlimited-redeal rules, constructive solution proof, browser interaction, and game-build integrity.

Last verified: 2026-09-05

## Guarantee

Every initial deal has at least one legal path that moves all 52 cards to the
foundations. A player can still make choices that lose that path. The proof
depends on the current draw-one stock and unlimited redeals; changing either
rule requires a new construction and proof.

`solBuildWinnableDeal` preserves the standard 1–7-card tableau shape and a
24-card stock. It assigns the seven column lengths to the four suits with the
partitions `[7]`, `[1, 6]`, `[2, 5]`, and `[3, 4]`. Each tableau column is a
contiguous same-suit rank segment stored high-to-low, with only its lowest rank
face-up. Six randomly distributed rank gaps per suit remain in the stock, and
the 24 stock cards are shuffled.

To construct a winning path, process each suit from Ace through King. The next
rank is either:

- the exposed top of its tableau segment, where moving it reveals the next
  consecutive rank; or
- in the stock/waste cycle, where draw-one plus unlimited redeals makes it
  reachable as the waste top.

No tableau-building move or foundation backmove is required. Generation is
bounded and does not run a solver or rejection loop in the browser.

## Verification

Run the source proof and real-control browser replay:

```bash
node --test tests/solitaire-winnable-deals.test.mjs
npx playwright test tests/ui/solitaire-winnable-deals.spec.mjs
```

The source proof covers constant random boundaries and 2,000 seeded streams.
For every deal it verifies all 52 canonical cards, the standard tableau and
stock counts, face-up state, segment orientation, and one complete legal
foundation sequence under the production stock orientation. It also checks
determinism, diversity, and the fixed 53-call generation bound.

The browser replay wins a deterministic deal through the public stock and card
controls, reaches four King-topped foundations, triggers the normal victory
state, and verifies Reset. The responsive matrix covers 375×812, 768×1024,
1280×800, and 1440×900; the 640/641 CSS boundary should also be visually
inspected when Solitaire styling changes.

For repository-wide validation, run:

```bash
npm test
npm run test:ui
```

## Release Integrity

The generator remains in `scripts/home/main.js`, which is protected by the
game-build digest. After any deal or gameplay-rule change, regenerate and
verify the public browser and Worker metadata:

```bash
node scripts/update-game-integrity.mjs
npm run game-stats:integrity:check
node --test tests/game-stats-integrity.test.mjs
```

Deploy the rolling-compatible Worker before publishing the matching static
site, then run the release parity checks in `game-stats-backend.md`.
