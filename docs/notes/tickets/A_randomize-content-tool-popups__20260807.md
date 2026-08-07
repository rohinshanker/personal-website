# A_randomize-content-tool-popups__20260807 — Active

Scope: Image Tools and Video Editor Coming soon window placement, responsive containment, and regression coverage.

Status: active

Opened: 2026-08-07

Updated: 2026-08-07

Current State: Image Tools and Video Editor now resample an obstacle-aware, taskbar-safe viewport position on each closed-to-open launch. They also use the shared full-window clamp after resizing and dragging; the Admin stand-in remains centered. Rendered execution is pending because browser launch still requires explicit approval.

Verification: `npm test` passed 234/234. Focused content-tool, Administrator, and context tests passed; the UI spec is syntactically valid and discoverable. Generated Game Stats integrity, the app-icon manifest, the secret scan, JavaScript syntax, and `git diff --check` pass. The browser spec covers eight responsive viewports, repeated launches with controlled random values, desktop-to-compact resize clamping, drag-release clamping, simultaneous non-overlap, focus/dismissal, native button styling, accessibility semantics, console/page errors, and the centered Admin exception, but could not be executed under the current browser-launch policy.

Cleanup: Resolve and remove this ticket after rendered browser verification; keep the separate open Image Tools and Video Editor feature tickets unchanged.

## Requirements

- Give Image Tools and Video Editor a fresh random position each time they are opened from a closed state.
- Keep each complete window within the usable viewport above the taskbar.
- Preserve dragging, native button styling, keyboard dismissal, focus restoration, accessibility, and simultaneous-window behavior.
- Keep the unauthenticated Admin Controls stand-in on its existing centered placement.
