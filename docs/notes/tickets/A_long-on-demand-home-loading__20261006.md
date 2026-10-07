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
