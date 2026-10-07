# A_server-verified-leaderboard-results__20261003 — Active

- Scope: Server verification of Minesweeper, Solitaire, Snake and Sudoku results using issued games, bounded legal replays, server-derived metrics and internal provenance.
- Status: active
- Opened: 2026-10-03
- Updated: 2026-10-06
- Current State: Latest canonical `213cf11` integrates the initial late-issuance and carried-note-mode repairs (`a46ca6e`, `d2ef2ad`) and candidate SHA `4a930...`. DEM-258 accepted those exact fixes but found pending restore can overwrite logical mode changes; same B owner has a finite repair in the existing isolated race worktree. Combined UI at `213cf11` completed 551/552 passing; the sole failure is the new pristine-issuance test asserting post-publication refresh before awaiting it. B is repairing that fixture wait in the same owned file. Full Node 768 and pinned visuals 9 pass; final source confirmation and affected/full gates follow B integration. No push/deploy or deadline selection.
- Verification: Root at `243d52f`: full Node 768/768 (zero skips); 500-seed Solitaire slow corpus 4/4; pinned Colima visual suite 9/9 (no baseline changes); syntax, app-icon/study manifests, media, generated integrity, full catalog and credential-free strict Wrangler dry run passed. Secret guard and ticket context passed. Full combined browser suite has **not** run. Controller review still has two findings below. Production CPU and live deployment parity are unqualified; read-only parity reports the expected candidate/live difference. These results do not validate the unfinished checkpoint branches.
- Cleanup: After all findings/final gates pass, distill only reusable contracts to indexed validation docs, resolve and delete this ticket/index row, and remove only terminal, clean, integrated writer worktrees. Preserve requested render artifacts. No deployment is authorized by this pass.

## Canonical repository and decisions

- Canonical: `/Users/Rohin/Desktop/coding_stuff/personal-website`, remote `git@github.com:rohinshanker/personal-website.git`; coordinator Agent Deck `ac3d79cf-1791158960`. Original source baseline `877085d`; last published source `0c67877852b97281857782194d69369083b70774`. Reuse the Desktop checkout.
- Published timings should reflect the display. Minesweeper includes hidden tabs/sleep and caps display/ranking at 999; Sudoku excludes server-acknowledged pauses. Server-derived canonical metrics reconcile only the finished board and cannot resurrect local statistics cleared after finish.
- Completion-only replays validate legal transitions, with hidden mines/deck and the full Sudoku solution delivered by owner choice. Do not claim human play or absence of external solving. One combined leaderboard, no visible verification badges/tabs; historical rows remain legacy internally.
- Design for Free-plan 10 ms CPU. `limits.cpu_ms` stays 10. Local instrumented spans exclude parse/crypto/commit/finalization and are lower bounds, not full billed CPU or headroom; cold/warm JIT affects wall maxima. Production limits are not enforced locally and require an authorized deployed qualification.
- Original six-hour session/completion expiry; expired results remain locally saved with explicit session-expired feedback, no end renewal. Legacy unconsumed/unexpired same-config session reuse retains the original timestamp and 120 new sessions/IP/hour. Verified boards require their own issued initial state.
- Keep initial `RULES_VERSION = 1`: protocol 2 has never been deployed, so no production sessions rely on earlier unpublished behavior. The legacy issuance cutoff is unrelated to rules compatibility. Future deployed rule changes need an appropriate version change.

## Integrated and accepted scope

- All four portable engines/catalog are imported by the production Worker and ordered browser scripts. The build closure/contract registry includes them (`c2b86c0`). Real production-entry SQLite tests and actual workerd replay/publish tests exist for all games.
- Shared client accepted at `9e4775d` (DEM-250). Worker core/default wiring accepted at `c2b86c0` and private JSON candidate clone optimization at `2cab0a7` (DEM-251), including per-action rollback and reachable-state equivalence. Rollout preflight accepted at `16063ac` (DEM-255).
- B source `751b210` was integrated as `94eca67`; controller/fixture delta `a3494ad` as `aefed6d`; exact Sudoku digit/grid repair `850248f` as `238f740`. DEM-258 accepted strict digits and the full catalog gate (`4703e96`) at exact `238f740`, but controller acceptance remains open.
- Root metadata `f4e92ac`: candidate SHA `bae192836d142082317c3d9a983a52bde29abfc3c04fe62ac4d29d56b59cb447`, compatibility history restored from the published baseline, capped to the existing 32 prior-build limit. Unpublished local hashes no longer evict published clients. Rebuild from that published baseline again if completion sources change.
- Root `243d52f` fixes the Clash Royale Miniflare module root to the repository so shared-engine imports resolve; both affected runtime tests and the full Node suite pass.
- Arthaus photo request is independently complete at `0cbc054`; preserve it. Original Desktop JPEG was removed only after committed-copy verification; both carousels show it second. Nothing has been deployed.

## Remaining findings and precise resume work

1. **Sudoku issuance race (P2):** `requestIssuedSudokuPuzzle` guards moves/undo/solved but not `confirmErrors`, `setHintMode` or `setNoteMode`, which can change logical state without move count. Hold `/sessions`, accept Errors, release issuance (UI resets Off), accept Errors again: actual replay becomes `confirmErrors → setHintMode(errors) → confirmErrors`; engine/production SQLite refuse input 3. Track all logical changes or correctly reconcile adoption; locally edited boards must drop the unadopted proof. Cover mode changes, stale/new puzzle and completion ownership, with real controls/hooks and network-only mocks.
2. **Sudoku publication fixture (P2):** `tests/ui/sudoku-publish-flow.spec.mjs:493` expects only API URL/build hash; generated config also has `resultProtocol: 2`. Repair exact expectation and execute solved → undo → reload → New Game to the latch assertions.
3. Finish/validate the preserved Minesweeper/Snake publication fixture repair; old tests fabricated/staged outcomes and legacy-shaped sessions. The draft drives issued board clicks/keyboard and extends accurate network helpers. It is **not accepted or integrated**.
4. Review/finish the preserved documentation draft, fixing proposed/separated-ranking and fresh-session-on-restore claims, then integrate only the reviewed docs delta. The steward wrote the draft into canonical by mistake; Root moved the exact bytes to its assigned branch and restored canonical docs. On resume enforce absolute paths to the assigned writer worktree.
5. Send the B race repair to the same DEM-258 reviewer for exact-patch confirmation, preserve previous accepted scope, integrate owned deltas only, regenerate final metadata from published history, and run the full combined browser/accessibility suite plus affected final Node/visual/integrity/security/context checks. Rerun slow/catalog only if relevant code/artifact changes or failures justify it. Full UI uses a unique port/output directory and real diagnostics; do not hide unexpected requests/errors.
6. Complete ticket lifecycle only after acceptance. This local development pass does not authorize push/deploy or selecting the first-rollout cutoff deadline.

## Preserved worker branches and stopped runs

| Scope | Branch / checkpoint | Worktree / baseline | Issue and stopped run |
| --- | --- | --- | --- |
| A publication fixtures | `codex/verified-publish-fixtures`, **`4f756df` WIP** | `/private/tmp/pw-verified-publish-fixtures-20261006`, `238f740`, port 4418 | DEM-247 `01a1133a-f83a-7c71-bdaa-b4b58b9fbf8f`; run `01a11426-3771-74f6-a081-234ddfb7e7a7` cancelled |
| B Sudoku race/config repair, not implemented before pause | `codex/verified-sudoku-race`, `243d52f` clean | `/private/tmp/pw-verified-sudoku-race-20261006`, `243d52f`, port 4460 | DEM-248 `01a1133a-fae7-7787-afbf-2882da353fc3`; run `01a1142d-b451-76a6-af1f-3014a003158f` cancelled |
| Documentation draft | `codex/verified-game-docs`, **`a1d88b9` WIP** | `/private/tmp/pw-verified-game-docs-20261006`, `238f740` | DEM-264 `01a11427-792c-781a-b2a3-e8b138c71cc2`; run `01a11427-793f-719d-a01e-ab48019d14f2` cancelled |
| Controller/engine review | Read-only exact `238f740`; findings above | Review archive `review-238f740` / `review-checks` in managed workspace, port 4452 stopped | DEM-258 `01a113f1-71eb-725a-a49e-9eecf98a568e`; run `01a11426-3a83-72e7-9262-38485cf07a80` completed |

Cancellation and no queued/running runs were verified for all four issues. WIP checkpoints are durable Git refs in the canonical repository even if `/private/tmp` is cleared. The owner resumed work on 2026-10-06. Recreate worktrees from those branches if needed; reuse installed dependencies without adding packages. Read latest issue comments before dispatch, verify original runs remain terminal, and resume the same owners rather than duplicating assignments.

Other already-integrated clean writer worktrees remain preserved: `codex/verified-ms-snake` (`e6d46fe`), `codex/verified-sol-sudoku` (`850248f`), `codex/verified-worker` (`3db59c9`), `codex/verified-game-rollout` (`97d4095`). Their commits are cherry-picked under different root hashes; verify patch identity before cleanup, never blindly merge prerequisite histories.

## Validation artifacts and release boundaries

- Root logs: `/tmp/pw-verified-final-{fast,slow,visual,catalog,dry-run}.log`; expected parity mismatch was printed by `npm run game-stats:deployment:local-check`. Logs are transient; commands/counts above are the checkpoint evidence.
- Root inspected failure/completion renders: `.playwright-cli/pw-server-verification-20261006/replay-{expired,rejected,limit,result-complete}-{mobile,tablet,desktop,wide}.png`. Arthaus evidence: `.playwright-cli/pw-arthaus-photo-20261006/`. Preserve these for owner visual review.
- Full catalog verifies 48 Solitaire base deals / 384 suit variants and 96 unique Sudoku puzzles, generated offline; no request-time solving.
- Verify limits from source: replay/body **256 KiB**, action 16 KiB; 16,384 inputs; 183,050 Snake ticks; per-action 20k/per-batch 32 operations and 40k work; 64 KiB canonical preparation, 512 KiB clone preparation, 256 KiB checkpoint; Snake cumulative 120M work versus 2M for other games; 8,192 continuations and 900 timing revisions. Failed cumulative jobs remain immutable terminal failures.
- First verified Worker rollout needs an operator-selected future UTC `LEGACY_RESULT_ISSUANCE_CUTOFF` while live clients remain legacy. Empty is closed steady state; do not invent a deadline. Worker → transition → Pages → release gate; protocol-2 public metadata does not prove every cached legacy tab drained. Original proofs retain expiry. No static-first release or deployment is authorized here.
- Migration `0005` is local/unreleased; after deployment, change schemas through a new migration. Health table counts alone do not validate all columns; never reset historical data to repair migration/config problems.

## Resumed acceptance streams

- A resumed run `01a11452-a3db-7bf4-9848-5879427ebf46` and clarification `01a11458-9fad-7e04-8dac-7263c809ea59` are completed; final branch `c126019` is clean and integrated. Initial CLI CORS baseline was discarded; fresh offline CLI context and hermetic repository renders have clean diagnostics. Root preserved and inspected 18 distinct images in `.playwright-cli/pw-verified-final-20261007/`, including four viewports and 479/481 Minesweeper breakpoint.
- B resumed run `01a11452-a565-793f-8a70-cf65af83d6ca` remains active in `/private/tmp/pw-verified-sudoku-race-20261006`; queued same-owner comment `01a1145b-7a37-7a09-8e50-5c480d6d5f7e` addresses preserving the existing note-mode preference across pristine new issuance. Read current comments before final handoff; cancel an already-incorporated queued turn only after confirming it is redundant. No other writer owns Sudoku files.
- Documentation `a1d88b9` plus Root `4da53e5` is integrated as one final net patch `3c1547e`; do not cherry-pick these draft commits again. Root owns docs/ticket/index. Final Node/browser/visual/metadata gates remain required after B integration. Existing slow/catalog evidence may be reused if their relevant sources do not change.

## Final restore confirmation

- DEM-258 run `01a11470-6b4b-724e-ae8f-e6b8804ca0a1` completed: issuance/config and carried-note fixes accepted at exact `d2ef2ad`; 17 Node/7 repository UI pass. Held restore repro preserves a digit but loses Notes/Errors changes because the old replay's values/notes still match. B repair run `01a11479-a5ce-7763-8554-6ae6015d2e0d` is active; same-owner trigger comment `01a1147e-7126-7d5d-9977-0c6f9bb62a5f` may have a queued turn (query actual run ID) for the genuine awaited refresh fixture fix. No Root code edits while this writer owns Sudoku.
- Root full browser log `/tmp/pw-verified-resumed-ui.log`, 551/552 pass in14.4m. Failing case `sudoku-publish-flow.spec.mjs` pristine late issuance at1584/1633 checks synchronous `expectPublishedRequestContract` before the refreshed stats response. Preserve assertions and await the real condition. Intentional diagnostics-negative tests print crosses but count as expected passes.
- Source at `213cf11`: full Node768/768, visuals9/9 without baseline changes, syntax/integrity/manifests/media/secret/credential-free dry-run pass. Do not attribute these to the later restore repair.
