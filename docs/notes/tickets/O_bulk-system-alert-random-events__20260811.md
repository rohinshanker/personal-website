# O_bulk-system-alert-random-events__20260811 — Open

Scope: Data-driven bulk creation of basic random events that all render through the shared system-alert window.

Status: open

Opened: 2026-08-11

Updated: 2026-08-11

Current State: Basic system-alert random events already share a managed alert window, but their configuration is not yet a complete copy/paste authoring contract. Button creation is fixed to the existing `OK` control, and defaults, supported choices, alignment, validation, and bulk authoring guidance are not expressed by one reusable template.

Verification: Pending implementation. Before resolution, validate the configuration contract with source tests and render the real alert shell across supported desktop and mobile viewports, long and multiline body text, every supported button arrangement, keyboard focus, dismissal, and reduced-motion behavior.

Cleanup: When resolved, distill the reusable authoring and validation contract into `docs/validation/`, add it to `docs/validation/INDEX.md`, then remove this ticket and its live-queue row.

## Product Requirement

Provide one small, documented configuration list where many basic random events can be created by copying and pasting a single system-alert template. Adding an alert must not require new HTML, CSS, DOM bindings, event-registration boilerplate, or a bespoke rendering function.

Every configured entry is a normal probability-gated random event and uses the existing accessible managed system-alert shell, random-event cooldown, visibility lock, animation lifecycle, responsive positioning, and Administrator event preview.

## Copy/Paste Contract

The finished implementation must expose a canonical template equivalent to:

```js
Object.freeze({
  id: "replace-with-unique-event-id",
  icon: "assets/app-icons/ico/msg_information.ico",
  body: "Replace with the system-alert body text.",
  buttons: Object.freeze([
    Object.freeze({ label: "OK", action: "dismiss" }),
  ]),
  buttonAlignment: "right",
})
```

The exact internal property names may be adjusted once for consistency with the repository, but the author-facing template must retain these capabilities:

- `id`: a unique stable random-event identifier.
- `icon`: selection of an existing local icon; missing or invalid assets fail validation.
- `body`: plain body text with safe multiline and long-text rendering.
- `buttons`: an ordered selection of one or more supported buttons. Button definitions are declarative and cannot execute arbitrary configuration-supplied code.
- `buttonAlignment`: an explicit supported alignment such as `left`, `center`, or `right`.

Optional title configuration may be supported, but omitting it must preserve the standard `System Alert` title.

## Defaults And Behavior

- Omitting `buttons` creates exactly one `OK` button whose action dismisses the alert.
- Omitting `buttonAlignment` aligns the buttons to the right.
- The default `OK` button receives initial keyboard focus and works with mouse, touch, Enter, and Space through native button behavior.
- Every supported button selection has a deterministic, tested action and accessible label. Basic dismiss-only choices may share the close action.
- Escape and title-bar close behavior remain consistent with the shared system-alert shell.
- One alert being visible prevents another alert using the same shell from opening over it.
- Production entries participate in normal random selection and are not enabled through developer/debug flags.

## Required Work

1. Replace the current fixed alert-button assumptions with a validated configuration normalizer that supplies the default `OK`/right-aligned contract.
2. Render the configured buttons and alignment through the existing managed system-alert shell without duplicating window markup.
3. Keep one clearly marked copy/paste template adjacent to the bulk alert list, and make each new entry require configuration data only.
4. Register and expose every entry automatically, including preload targets and Administrator event-preview labels.
5. Reject duplicate IDs, empty body text, invalid icon paths, unsupported alignments, empty or malformed button selections, duplicate button identifiers where applicable, and unknown actions.
6. Preserve local assets, focus restoration, accessibility relationships, responsive bounds, motion preferences, cooldown behavior, and cleanup.
7. Add full source coverage for defaults, every supported choice, normalization failures, registration, and dismissal behavior, plus rendered UI coverage for representative configurations.

## Acceptance Criteria

- Copying the canonical template, changing only its configuration values, and adding it to the list creates a working normal random-event system alert.
- An entry containing only `id`, `icon`, and `body` renders one right-aligned `OK` button that dismisses the alert.
- Explicit button selections render once, in configured order, with their declared deterministic behavior.
- `left`, `center`, and `right` button alignment render correctly without changing the body/icon layout or overflowing the alert.
- Long and multiline body text, multiple buttons, keyboard focus, touch input, repeated opening, and viewport clamping are rendered and inspected in the real application.
- Invalid bulk entries fail a deterministic automated check rather than silently registering a broken event.
- No event requires one-off HTML, CSS, DOM bindings, registration code, or renderer code.
- The full source suite, focused system-alert tests, relevant Administrator preview tests, and rendered Playwright matrix pass.
