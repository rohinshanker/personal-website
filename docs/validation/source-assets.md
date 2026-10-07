# Source Assets and Runtime Files

- Purpose: Keep editable originals available without packaging unused source files into the public site.
- Scope: `docs/assets-src/`, deployed derivatives/fonts, accompanying notices, regeneration references and the Pages package.
- Last verified: 2026-10-07

## Location contract

`docs/assets-src/` preserves originals and working files with their useful directory context. Pages packages only `assets/`, `styles/`, the public routes, `scripts/home/` and the listed root files; it excludes `docs/`. Do not add an archive path to shipped HTML/CSS/JS. An archive file that becomes public needs an intentional runtime asset and updated references.

Keep full-quality modeling media deployed. The live calendar uses `jan.jpg`, `mar-standstill.jpg` and `apr-sonder-lb2.jpg`; other archived calendar photos remain available for the owner's review and need explicit per-file decisions before deletion.

## Regeneration inputs

| Preserved source | Deployed output |
| --- | --- |
| `docs/assets-src/bio-pic.jpeg` | `assets/optimized/bio-pic-720.jpg` |
| `docs/assets-src/background.jpg` | `assets/optimized/background-2200.jpg` |
| `docs/assets-src/creative-work/lp-photo.png` | `assets/optimized/lp-photo-1600.jpg` |
| `docs/assets-src/minesweeper_assets/YOU-LOSE.png` | `assets/optimized/minesweeper-you-lose-640.png` |
| `docs/assets-src/modeling-icons/saturn-icon.png` and `saturn-icon-clear.png` | `assets/optimized/saturn-icon-96.png`; preserve its deployed transparency/crop when selecting a source variant. |
| `docs/assets-src/solitaire-cards/*.aseprite` | Editable card artwork; deployed card files retain their existing paths. |
| `docs/assets-src/fonts/src/ms-sans-serif/` | `assets/fonts/converted/ms_sans_serif.woff` and `.woff2` |
| `docs/assets-src/fonts/src/ms-sans-serif-bold/` | `assets/fonts/converted/ms_sans_serif_bold.woff` and `.woff2` |
| `docs/assets-src/fonts/src/digital-7/digital-7.ttf` | Byte-identical `assets/fonts/converted/digital-7/digital-7.ttf` |

Preserve output dimensions, orientation, transparency and visible appearance when regenerating. Review a real render before replacing an output. `scripts/optimize-media.mjs` separately owns its explicit animated-media manifest and does not regenerate these still images/fonts.

Keep each font family's original readme/license files in the source archive and accompanying runtime notices in `assets/fonts/converted/<family>/`. The Digital-7 runtime font uses the preserved bytes directly. Its CSS URL belongs in `styles/home/base.css`; update Home and entry-prewarm cache tokens together when that stylesheet changes. Upstream `style.css` and the existing MS Sans Serif WOFF paths stay intact.

`.gitattributes` preserves archived/runtime font bytes without line-ending conversion. Only the two copies of the upstream Digital-7 notice are exempt from whitespace checking because their original CRLF/spacing is retained; authored source checks remain unchanged.

## Validation

Before preserving/renaming a source, check exact paths, basenames, encoded URLs, dynamic manifests and non-shipped regeneration dependencies:

```bash
node docs/validation/assets/audit-assets.mjs . > /tmp/source-assets-audit.json
node --test tests/asset-references.test.mjs tests/optimized-media-references.test.mjs tests/entry-point-cache-tokens.test.mjs
npm run media:check
npm run app-icons:check
npm run study-resources:check
```

Compare every moved file's SHA-256 before/after; preserve all bytes and notices. Verify an actual Pages package contains required runtime assets and excludes `docs/assets-src/`. Load the real Home route with enforced request/runtime diagnostics after a runtime path change, and confirm Digital-7 resolves and renders. Run relevant browser/visual gates for changed appearance; do not replace baselines for a preservation-only move.
