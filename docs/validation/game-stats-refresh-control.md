# Game Stats Refresh Control

- Purpose: Review and regression-test the shared Game Stats refresh, publishing, and Administrator-authentication control.
- Scope: The status/action row in the Minesweeper, Solitaire, Snake, and Sudoku stats windows.
- Last verified: 2026-10-17

[Open the complete, responsive Game Stats state review](assets/game-stats-refresh-review.html).
It shows every exact status/action state, animated and reduced-motion loading
indicators, cursor rules, local-result notice, the Administrator success popup,
multiplayer rank edge cases, and the Sudoku `99:99` empty value in one page.

The [rendered production-state contact sheet](assets/game-stats-refresh-states.png)
remains a representative screenshot sample.

## State Contract

| State | Status copy | Button behavior | Custom loading cursor |
| --- | --- | --- | --- |
| Initial | `Global stats will sync automatically.` | Refresh enabled when the backend is configured. | Off |
| Fetching | `Fetching latest stats...` | Disabled and `aria-busy="true"`. | On only for a manual request |
| Publishing | `Publishing saved results...` | Disabled and `aria-busy="true"`. | On only for a manual request |
| Authentication required | `Sign in as Administrator to publish your verified Rohin result.` | Opens the Administrator dialog directly. | Off |
| Authentication waiting | `Waiting for authentication...` | Disabled and `aria-busy="true"`. | On |
| Ready | `Global stats are up to date.` | Refresh enabled. | Off |
| Request failed | `Request failed. Try again later.` | Retries the failed refresh, or reopens Administrator directly when authentication failed. | Off |
| Retry scheduled | `Publishing failed. Retrying once in a moment.` | Refresh enabled; a click cancels the pending timer and publishes now. | Off |
| Unconfigured | `Automatic global tracking is not configured yet; local stats stay on this device.` | Disabled because no useful network action exists. | Off |

All visible Game Stats windows render the same state and share one coalesced
request. Only the initiating visible status uses `aria-live="polite"`; duplicate
visible copies use `aria-live="off"`. Animated dots are decorative, remain one
atomic announcement, and become static under reduced motion.

Automatic reads may use the Worker's five-second protocol-2 cache. Manual
Refresh and the first read after any accepted publication always add `fresh=1`
and use browser `cache: "no-store"`. A publication read also sends the bounded
confirmed event IDs for explicit acknowledgment; a missing acknowledgment
keeps the optimistic totals until a later authoritative response confirms them.

The refresh action stays right-aligned inside the shared sunken status strip
and uses the bundled Solitaire undo icon.

## Local Result and Reset Notices

| Situation | Exact status copy | Network action |
| --- | --- | --- |
| Queued result has no verified session | `Local stats are saved. A result without a verified game session cannot be published.` | Refresh remains available. |
| Completion replay exceeds a verification limit | `Saved on this device. This game's replay exceeds verification limits, so this result can't be published.` | Refresh remains available; no partial publication or renewal. |
| Completion verification fails | `Local stats are saved, but this game's result could not be verified for publication.` | Refresh remains available; result stays local. |
| Server verification rejects a result | `Local stats are saved, but a result could not pass server verification.` | Refresh remains available. |
| Session expired before completion or queued publication | `Saved on this device. This game's online session expired, so this result can't be published. Start a new game to publish a new result.` | Refresh remains available; no replacement session or expired event POST. |
| Game began without a verified session | `Local stats are saved. This result started without a verified game session.` | Refresh remains available. |
| Administrator sign-in resets local progress | `Local progress was reset. Published and queued leaderboard results remain available.` | Refresh remains available. |
| The 100-result publication queue overflowed | Any settled state's copy followed by `3 unpublished results were dropped because the publishing queue was full.` (`1 unpublished result was dropped …` for one) | Refresh remains available and acknowledges the count. |

## Automatic Retry and Queue Overflow

A publication that fails transiently (no response, timeout, `5xx`, `408`,
`425` or `429`) stays queued and books exactly one automatic retry. The status
row shows `Publishing failed. Retrying once in a moment.` unless a
higher-priority notice (missing session, sign-in, expiry, rejection) owns the
row, in which case the retry still runs underneath. The delay is
`GAME_STATS_PUBLICATION_RETRY_DELAY_MS` (5 s), stretched to the Worker's
`retryAfterMs` and capped at 60 s. Every sync pass cancels a pending timer
before it publishes, so a manual Refresh, the `online` event, opening a stats
or Game Progress window, or a newly recorded result never runs beside the
retry; `pagehide` cancels it too. A trigger that arrives during the wait
replaces the retry rather than adding to it: the pass it starts is the one
automatic attempt, so if that pass also fails transiently the row settles on
`Request failed. Try again later.`. The retry is restored by a published result,
a manual Refresh, or a newly queued result, and by nothing else: a second
transient failure ends in `Request failed. Try again later.` with no further
timer. A result waiting for Administrator credentials schedules nothing
because sign-in owns the next attempt. A retry can never renew an expired
proof or turn a `4xx` rejection into a success; those classifications run
before the transient branch.

When a queued result pushes the bounded queue past 100 entries, or a stored
queue loads with more than 100 valid entries, the oldest are dropped and the
count is added to `personalSiteGameStatsDroppedResultsV1`. The count stays in
memory when the storage write fails. Every settled state appends the sentence
above; busy states keep their animated ellipsis and hide it. The count
survives reloads, automatic reads and later publications, and is cleared by
the explicit manual Refresh or Reset Local Stats (including the reset inside
Administrator sign-in). `[data-game-stats-sync-status]` carries the live
count in `data-game-stats-dropped-results`.

Expiry uses the separate `session-expired` state. Automatic fetching/ready
updates preserve local-only notices for expiry, replay limits, and verification
failures. A transient automatic failure shows its request
error, then restores the expiry notice after recovery. Manual Refresh, a new
publication, or Reset Local Stats clears the saved notice. The existing win
screen and local aggregates remain; no renewal button or extra modal is added. An expired queued
proof is removed from the publication queue after classification; its locally
saved result remains.

Canceling Administrator sign-in restores the initiating refresh button when it
is still visible, otherwise focus moves to another visible refresh action or
the Start button. Closing the dialog also aborts and invalidates its request, so
a delayed response cannot grant access, reset local data, or open the success
alert.

When an automatic completed-game sync finds that a protected Rohin result needs
fresh authentication, it opens and focuses the Administrator sign-in dialog
without discarding the queued result. Fresh authentication is needed only when
the `POST /events` request carried no proof or the Worker answered `403` with
`code: "administrator-authorization"`. Every coded rejection of a presented
proof clears that proof; sign-in is renewed at most once per queued result, and
a second coded rejection drops the result instead. A `403` without that code
(a rejected game session) keeps the current proof. A queued result whose
protected identity is not canonical is dropped before any request. Each dropped
result shows `Local stats are saved, but a result could not pass server
verification.` so a rejection can never become a sign-in loop. The dialog remains above
game-completion effects, stays fully inside the viewport after a resize, and retries the queued
publication after sign-in. If Sudoku's solved modal is still open, the sign-in
dialog waits until that modal closes so focus never escapes an active modal.

A successful Administrator sign-in clears this browser's saved profile and
local game aggregates, clears Snake high scores, replaces any prior Sudoku save
with a fresh easy puzzle, then installs the protected profile. It deliberately
keeps already published global data and the verified-result sync queue, so a
pending protected result can still publish. The opaque proof remains only in
the current tab's session storage. The centered success alert uses the annoying
popup shape and bundled `msg_warning.ico` warning-triangle icon, contains only
`Administrator access granted.`, and provides one right-aligned `OK` button.

## Repeatable Verification

Run the source contracts and the rendered state suite:

```bash
node --test tests/game-stats-refresh-control.test.mjs \
  tests/game-stats-frontend-contract.test.mjs \
  tests/game-stats-administrator-publish.test.mjs \
  tests/game-stats-publication-retry.test.mjs \
  tests/game-stats-session-failure.test.mjs \
  tests/administrator-sign-in.test.mjs
npx playwright test tests/ui/game-stats-refresh-control.spec.mjs \
  tests/ui/administrator-sign-in.spec.mjs \
  tests/ui/game-stats-refresh-review.spec.mjs \
  tests/ui/solitaire-publish-flow.spec.mjs \
  tests/ui/snake-publish-flow.spec.mjs \
  tests/ui/game-stats-session-policy.spec.mjs
```

`tests/game-stats-publication-retry.test.mjs` drives the real sync region with
scripted `/events` answers and a fake timer: transient/permanent/credential/
expiry classification, the one-retry bound, Retry-After stretching and its
cap, duplicate triggers cancelling the timer, budget restoration, overflow
accounting with a failing storage write, and the wiring of Refresh, reset and
`pagehide`. The browser spec serves Game Stats through `routeHomeScript` with
a short retry delay to watch the retry publish, prove a second failure stays
failed, prove Refresh cancels the pending timer, and render the dropped-result
count at 375×812, 768×1024, 1280×800 and 1440×900 before and after Refresh
acknowledges it. The Snake flow keeps the production delay and waits for the
automatic retry of a real `425`.

The rendered suite covers 375×812 and 1280×800, exact copy, animated/busy
semantics, the loading cursor, queue publication, request failure, backend
absence, shared/coalesced requests, automatic Administrator reauthentication,
cancel/success races, focus, resize containment, and horizontal overflow. The
completed-Solitaire publication flow also exercises the reauthentication dialog
at 375×812, 768×1024, 1280×800, and 1440×900, plus the rejected-session and
rejected-proof guard states at 375×812 and 1280×800. The review artifact
additionally renders at 768×1024 and 1440×900.
