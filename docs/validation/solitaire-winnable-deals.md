# Winnable Solitaire Deals

- Purpose: Generate random Solitaire deals and verify winning paths with a bounded runtime search.
- Scope: Solitaire deal generation, draw-one unlimited-redeal rules, solver verification, browser interaction, and game-build integrity.
- Last verified: 2026-09-10

## Guarantee

`solBuildWinnableDeal` Fisher-Yates shuffles all 52 cards, deals standard
1–7-card tableau columns with only each top card face-up, and leaves 24 cards
face-down in the stock. It then asks `solFindWinningMoves` for a legal winning
line. A verified deal has at least one path to all four King-topped
foundations, although a player can still make choices that lose that path.

The perfect-information solver treats the draw-one, unlimited-redeal
stock/waste cycle as an unordered set because every remaining stock card is
reachable. It uses safe automatic foundation moves, prioritized tableau flips,
sound move pruning, canonical visited-state keys, and depth-first search with a
12,000-node cap per attempt. All attempts also consume a shared 40,000-node
generation allowance, so repeated inconclusive searches cannot accumulate
unbounded synchronous work. Foundation-to-tableau moves are deliberately
omitted, so the solver can reject a winnable shuffle but cannot certify an
illegal win.

Generation rejection-samples up to 12 independent shuffles, stopping early
when the shared allowance is exhausted. If every bounded search is
inconclusive, the last uniform random deal is returned with `verified: false`
and `solution: null`; the old shaped constructive fallback is not used.

## Verification

Run the source proof and real-control browser replay:

```bash
node --test tests/solitaire-winnable-deals.test.mjs
npx playwright test tests/ui/solitaire-winnable-deals.spec.mjs
```

The Node suite covers constant random boundaries and 500 seeded streams. It
verifies all 52 canonical cards, standard tableau and stock shape, determinism,
diversity, random-looking columns, first-shuffle and capped acceptance floors,
the bounded unverified fallback, and every certified move with an independent
draw-one/redeal rules simulator.

The browser replay computes a seeded production deal and solution in Node,
then wins through public stock, card, tableau, and foundation controls. It
reaches four King-topped foundations and verifies move tracking, Undo, Reset,
the victory overlay, session requests, and the responsive matrix at 375×812,
640×900, 641×900, 768×1024, 1280×800, and 1440×900. The replay move limit
counts every solution move plus every stock draw or redeal and matches that
total against the rendered move counter.

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
