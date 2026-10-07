# A_long-on-demand-home-loading__20261006 — Active

- Scope: Measure Home loading, preserve ordered initialization while deferring scripts, load hidden-event CSS later, and load Admin Controls resources only when needed with a loading cursor.
- Status: active
- Opened: 2026-10-06
- Updated: 2026-10-07
- Current State: Candidate26bfd08 is committed and measured but not accepted. Same author owns bounded repairs in `/Users/Rohin/.cache/pw-home-loading-repair-20261007`; independent review reproduced startup/reset/visibility/coverage/spacing gaps, and pinned visuals exposed a static overlay hiding defect. Coordinator: Agent Deck `1c881e50-1791344233`; canonical repository `/Users/Rohin/Desktop/coding_stuff/personal-website`, integration branch `codex/home-loading-followup`. No push/deployment.
- Verification: Measure the unchanged baseline first using the existing repository Playwright tooling and Chrome traces; compare the final patch under the same conditions. Exercise cold/warm/slow/failing loads, duplicate launches, auth expiry/rejection, activation and event loading at 375×812, 768×1024, 1280×800 and 1440×900. Run relevant behavior/UI/accessibility checks, the full affected browser gate, pinned visual baselines, syntax, generated integrity, secrets and ticket checks. Review the exact patch independently and inspect renders.
- Cleanup: Distill reusable loading/activation/resource-lifetime guidance into the relevant indexed validation guides. Resolve and remove this ticket/index row after acceptance; retain no one-off performance/test logs in permanent documentation.

## Contracts

- Measurement decision (2026-10-07): owner explicitly chose repository Playwright timings and Chrome traces because Chrome DevTools MCP tools are not exposed. This overrides the `web-perf` skill's MCP-only stop for this assignment; no agent configuration or new inspection dependency is needed. Report controlled laboratory observations accurately rather than claiming field Core Web Vitals or a Lighthouse score.

- Preserve dependencies and first-use activation; a deferred chain must remain ordered. Measure before claiming performance gains.
- Styles must be ready before a hidden event/app appears. Avoid unstyled flashes and preserve preloading, media cleanup and reduced-motion behavior.
- A missing/expired/rejected Administrator proof keeps the full Admin dashboard inaccessible. Load only the resources needed for authorized use, including an existing active restored Admin session; default stored settings alone are not a need.
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

- Implementation boundary (coordinator, 2026-10-07): preserve authorized restored active capture settings, promo mode and seeded bindings without requiring a dashboard launch. Those settings are an existing need for runtime resources; detect the narrow active-state case and keep ordinary/default/unauthorized visits free of Admin downloads. Restored loading must not open the dashboard or steal focus. Preserve reset-reload suppression with cheap bootstrap state. This refines the launch-only seam, not the owner’s on-demand requirement.

## Candidate verification

- Candidate `26bfd080da88686f9a41e451f9d11029f52e4aa2` in exclusive worktree `/private/tmp/pw-home-loading-20261007`, branch `codex/home-loading-20261007`; Multica implementation DEM-277 complete, cross-provider exact-patch review DEM-278 underway. Author gates: 775 Node, 571 full UI, syntax, generated manifests/media/integrity, secret scan, Worker dry-run, context and whitespace passed. Both published compatibility lists remain byte-identical. Candidate is not integrated or accepted yet.
- Same three-run Chromium149 laboratory comparison: slow-cold median FCP 4,340→1,908 ms, observed LCP 4,340→3,244 ms, DOMContentLoaded 15,825.5→13,431.3 ms and load 22,053→20,312.3 ms. Ordinary cold median FCP remains84 ms, observed LCP84→120 ms, DOMContentLoaded395→113.7 ms, load408.8→146.8 ms. Warm median FCP316→60 ms and load601.9→78.6 ms. Report this full scope, not a universal or field-performance claim.
- Ordinary cold local requests206→175 and encoded bytes3,969,541→3,653,898. All nine candidate captures omit Admin resources and random-event CSS initially. Candidate trace/JSON/inspected Home PNG are temporary under `.playwright-cli/pw-home-loading-20261007/candidate-26bfd08/`; copied24-state render matrix is in `render-26bfd08/`.
- Pinned visual validation and review acceptance remain pending. Residual review focus includes cheap reset suppression, restored-session eager-runtime/activation readiness, cancellation races and preserving early app-open coverage while a module is held.

- Pinned candidate visual result: 8/9 pass; Home desktop differs459pixels because static Lost Grace overlay fallback text is visible before lazy CSS. Baselines are unchanged. Initial Docker run could not see the private/tmp worktree; a clean detached snapshot under `/Users/Rohin/.cache/pw-home-loading-visual-20261007` resolved the mount/setup issue and exposed the real visual failure.
- Same author repair continuation DEM-277 now owns exclusive `/Users/Rohin/.cache/pw-home-loading-repair-20261007`, branch `codex/home-loading-repair-20261007`, baseline26bfd08. It must fix critical overlay hiding, cheap reset suppression, restored eager-runtime/activation readiness and preserve early app-open regression coverage. DEM-278 continues read-only review of the immutable original candidate; no writers share a worktree. Exact repair confirmation and final gates remain required.

- Independent DEM-278 verdict on26bfd08: not accepted. Browser-reproduced high startup dependency/execution-readiness race; medium hidden-session restore, reset-marker suppression and weakened late-module first-use coverage; low self-love paragraph margin12px versusbaseline0. Same author repair must cover these and the independently detected LostGraceghost, then same reviewer confirms exact newcommit. Review also verified46focusedNode, preserved32-entry compatibility strings, token/hash coherence, cancellation races and all7afterShow sites.
