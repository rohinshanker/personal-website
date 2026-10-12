# O_modeling-measurements-us-eu__20261012 — Open

- Scope: Add inseam and weight to the personal website's `/modeling/` Measurements section and replace the in/cm selector with US/EU modes.
- Status: open
- Opened: 2026-10-12
- Updated: 2026-10-12
- Current State: Requested by the owner; queued for implementation. The current selector switches lengths only and displays both shoe sizes in either mode.
- Verification: Ticket requirements checked against the existing measurement data and UI test; implementation and rendered validation are pending. Validate both modes, conversions, keyboard operation, selected state, and responsive layout using the existing modeling tests and the `ui-render-inspect-repair` skill.
- Cleanup: Once implemented and verified, update the measurement contract in `docs/validation/modeling-portfolio.md` and its index entry as needed; resolve and remove this ticket and its live index row.

## Acceptance criteria

- Add an Inseam measurement with a source value of 32 inches and a Weight measurement with a source value of 135 lbs.
- Rename the selector's visible options from `in` and `cm` to `US` and `EU`. Keep US selected by default and preserve accessible button names, keyboard operation, and `aria-pressed` state.
- US mode shows lengths in inches (retaining the existing feet/inches height presentation), Inseam as `32"`, Weight as `135 lbs`, and Shoe as `US 11`.
- EU mode shows lengths in centimetres, including Inseam as `81.3 cm` at the existing one-decimal precision, and Shoe as `EU 45`. Use the existing explicit shoe sizes rather than deriving a shoe size from a length conversion.
- Regional-weight assumption: EU mode shows the equivalent weight in kilograms, `61.2 kg`; the owner explicitly supplied 135 lbs but did not specify EU weight formatting.
- Switching US → EU → US updates every affected measurement and restores the original US values without cumulative rounding. Preserve the other source measurements and the header's placement and styling.

## Implementation and validation scope

- Shared measurement data: `scripts/home/modeling-portfolio.js`.
- Selector, rendering, and layout: `modeling/index.html`, `modeling/script.js`, and `modeling/style.css` as needed. Maintain shared-script cache-token parity where applicable.
- Update the affected assertions in `tests/modeling-portfolio.test.mjs` and `tests/ui/modeling-portfolio.spec.mjs`; cover the new measurements, regional shoe sizes, weight conversion, defaults, round trips, and keyboard selection.
- Run the affected behavior, browser, accessibility, visual, and shared-literal checks from `docs/validation/modeling-portfolio.md`.
- Render and inspect `/modeling/` in both modes at 375×812, 768×1024, 1280×800, and 1440×900. Confirm readable wrapping, no horizontal overflow, and no new console or page errors.
