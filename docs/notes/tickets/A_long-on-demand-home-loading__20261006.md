# A_long-on-demand-home-loading__20261006 — Active

- Scope: Measure Home loading, preserve ordered initialization while deferring scripts, load hidden-event CSS later, and load Admin Controls resources only when needed with a loading cursor.
- Status: active
- Opened: 2026-10-06
- Updated: 2026-10-07
- Current State: Owner approved measured loading and on-demand Admin resources with a loading cursor. Quick fixes are committed and accepted; controlled baseline measurement and dependency mapping are now underway. The leaderboard implementation is closed at `f77f42a` and its coordinator released the clean checkout. Coordinator: Agent Deck `1c881e50-1791344233`; canonical repository: `/Users/Rohin/Desktop/coding_stuff/personal-website`; branch: `codex/home-loading-followup`. Owner decisions are now integrated here.
- Verification: Measure the unchanged baseline first using the existing repository Playwright tooling and Chrome traces; compare the final patch under the same conditions. Exercise cold/warm/slow/failing loads, duplicate launches, auth expiry/rejection, activation and event loading at 375×812, 768×1024, 1280×800 and 1440×900. Run relevant behavior/UI/accessibility checks, the full affected browser gate, pinned visual baselines, syntax, generated integrity, secrets and ticket checks. Review the exact patch independently and inspect renders.
- Cleanup: Distill reusable loading/activation/resource-lifetime guidance into the relevant indexed validation guides. Resolve and remove this ticket/index row after acceptance; retain no one-off performance/test logs in permanent documentation.

## Contracts

- Measurement decision (2026-10-07): owner explicitly chose repository Playwright timings and Chrome traces because Chrome DevTools MCP tools are not exposed. This overrides the `web-perf` skill's MCP-only stop for this assignment; no agent configuration or new inspection dependency is needed. Report controlled laboratory observations accurately rather than claiming field Core Web Vitals or a Lighthouse score.

- Preserve dependencies and first-use activation; a deferred chain must remain ordered. Measure before claiming performance gains.
- Styles must be ready before a hidden event/app appears. Avoid unstyled flashes and preserve preloading, media cleanup and reduced-motion behavior.
- A missing/expired/rejected Administrator proof keeps the full Admin dashboard inaccessible. Load only the resources needed for an authorized launch.
- Use the existing custom loading cursor while Admin resources are pending; restore it on success, failure, cancellation and page exit. Prevent duplicate loads/initializations and provide a usable retry/error state.
- Use existing components and testing infrastructure. Do not add dependencies merely for inspection.
- Preserve the unpublished verified-games implementation and published compatibility history when regenerating build tokens. Commit only local changes; no push, deployment or rollout deadline is authorized by this ticket.
- The separately pending Admin promotional-workflow review cannot be silently treated as owner acceptance. Loading/access behavior can be implemented and verified independently.

## Controlled baseline

- Baseline source: `59024ae`; Chromium 149.0.7827.55; local Python HTTP server, 1440×900, reduced motion, deterministic random draw; external requests blocked through CDP. No Playwright routes (which disable HTTP caching). Three fresh-context measurements per profile, 700 ms settling after load. Warm measurements prime the same context before reloading.
- Cold median: FCP/LCP 84 ms, DOMContentLoaded 395 ms, load 409 ms, 3,969,541 local encoded bytes. Warm median: FCP/LCP 316 ms, DOMContentLoaded 601 ms, load 602 ms, 280 encoded bytes. These are laboratory observations, not field Core Web Vitals.
- Slow cold (150 ms latency, 1.6 Mbps down, 750 Kbps up, 4× CPU): median FCP/LCP 4,340 ms, DOMContentLoaded 15,826 ms, load 22,053 ms; about 3.97 MB. Admin scripts/styles and hidden-event stylesheet are requested initially.
- Temporary evidence/harness: `.playwright-cli/pw-home-loading-20261007/`, including Chrome slow-cold trace, network/timing JSON, and inspected wide Home PNG/semantic snapshot. Compare the final patch with this same harness/conditions; do not retain one-off result logs as permanent validation docs.
- Read-only Multica map DEM-276 confirms classic-script order, optional absent Admin controller, and shared event show/style and auth/window launch seams. Coordinator owns measurement and integration; one scoped implementer will own a separate worktree.
