# Managed random-event windows

- Purpose: Keep random-event window lifecycle and event-local wiring consistent.
- Scope: Home event visibility, animation, deferred media, focus, geometry, dynamic windows, binding order, and regression checks.
- Last verified: 2026-10-07

## Lifecycle contract

Use the helpers in `scripts/home/main.js` rather than copying their class,
ARIA, media, animation, or stacking operations into a new event:

| Helper | Contract |
| --- | --- |
| `isManagedRandomEventWindowVisible(win)` | Requires a window without `is-hidden` and with `aria-hidden="false"`. |
| `showManagedRandomEventWindow(win, options)` | Returns whether it opened. Loads deferred media, clears hidden/closing state, updates ARIA, places and raises the window, and starts its opening animation. An already visible window is raised without resetting it. |
| `closeManagedRandomEventWindow(win, options)` | Returns whether closing started. Runs teardown, sets hidden ARIA state, and starts the closing animation. Actual hiding waits for animation completion. |
| `bindManagedRandomEventWindowAnimation(win, options)` | Stops click propagation, handles only the root's own open/close animations, clears animation classes, and hides/unloads a closed window. |
| `bindRandomEventButton(button, action)` | Prevents the default action and desktop click propagation before invoking an event action. |

Show options preserve exceptional event behavior: `isVisible` replaces the
visibility check; `onFront` handles an already visible window; `beforeShow`
prepares state; `position` replaces placement; `afterShow` handles focus or
post-open setup; `clearClasses` removes extra state; `animate: false` opts out
of the shared animation; and `clampAfterMediaLoad` handles changing media size.

Close options are `beforeClose` for timers or other teardown and `force` for
windows whose own state controls the hidden guard. Binder options are
`afterOpen`, `closingClasses`, `unloadImages`, and `afterClose`. Media unloads
before `afterClose`. Dynamic windows use `onClose` to replace default cleanup
with removal from both the DOM and their owning collection. Their removal must
release visibility guards so the event can trigger again.

## Registration and binding

Keep event-owned DOM listeners in its `registerRandomEvent` definition's
`bind()` field, after `run()`. Preserve the `id` then `forceOnStart` field order used
by the production-policy isolator for the Neko registration. Real developer debug flags stay separate; the data-driven alert family must not contain an armed `debug` or `forceOnStart` policy. Registration queues bindings; the single late
`bindRegisteredRandomEvents()` call runs them in registration order, then
empties the queue. This preserves initialization and document-listener order.
Do not invoke binding eagerly during registration.

The data-driven system alerts share one shell and bind it once outside their
individual registrations. Standalone and conditional events, including Feliz
Jueves, retain their dedicated binding sites. A new event must not attach a
second listener set to a shared shell.

## Style and cache contract

Static and dynamically created event roots carry `random-event-window`.
The base owns fixed placement, stacking, width defaults, hidden state and the
opening/closing rules. Override geometry with `--event-window-width`,
`--event-window-max-width`, and `--event-window-z`; override timing with
`--event-window-open-duration` and `--event-window-close-duration`.

Keep body and image presentation scoped to the event. The original generic
image window uses `random-event-image-window`; its centered body and constrained
image styles must not leak into other windows through the shared base.
Brand's smaller windows retain their faster timing, and Biden Blast retains
its custom animation opt-out. App dialogs using `random-alert-window` also
carry the base class, so shared-shell changes need app-dialog regression checks.

A stylesheet-token change must reach Home, the entry warm-up list and the
Administrator preview stylesheet list. If `admin-controls.js` changes, bump
its own token in Home and the warm-up list too. Regenerate game integrity after
changing `main.js`; follow [site-quality-gates.md](site-quality-gates.md).

## Regression checks

```bash
node --test tests/managed-random-event-windows.test.mjs \
  tests/random-event-lifecycle.test.mjs tests/random-event-cooldown.test.mjs \
  tests/gears-nest.test.mjs tests/random-event-debug-fixture.test.mjs
UI_TEST_PORT=4321 UI_TEST_OUTPUT_DIR=test-results/managed-events \
  npx playwright test --project=ui tests/ui/managed-random-event-windows.spec.mjs
```

The Node contracts cover migration completeness, binding placement and the
shared CSS rules. Behavioral helper tests exercise guards, hook ordering,
visibility overrides, media cleanup, custom removal, and ordered one-time
binding. The browser spec records animation starts before sampling their
properties, waits for natural completion, and enforces runtime diagnostics.
It checks four viewports, ordinary and interactive windows, focus, stacking,
clamping, chained placement, and dynamic Word/Brand creation and removal.

Complement those checks with the existing event suites:

| Behavior | Browser coverage |
| --- | --- |
| Shared alerts, conditional Feliz Jueves, event guards and previews | `admin-controls.spec.mjs` |
| Cold show callbacks, loaded media and chained result windows | `deferred-window-media.spec.mjs` |
| Media playback and teardown | `loop-video-lifecycle.spec.mjs` |
| Event-specific interaction and layout | `neko-stream.spec.mjs`, `lain-wired-chat.spec.mjs`, `red-tool-scrollbar.spec.mjs`, `nataraja-layout.spec.mjs` |

For a broad migration, compare resolved styles of every root and descendant
against the baseline at 375×812, 768×1024, 1280×800 and 1440×900. Include hidden,
opening and closing rules under both motion preferences. This catches cascade
changes but does not replace real triggers, dynamic-window checks or visual
inspection. Keep screenshots and comparison output with temporary validation
artifacts, not in permanent task histories. Finish with the full site gates.
