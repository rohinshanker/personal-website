# Agent Context System

- Purpose: Keep repository context actionable, compact, and safe for agents across turns.
- Scope: Root `NOTES.md`, live task tickets, ticket indexes, and reusable validation/runbook documents.
- Last verified: 2026-09-21

## Operating Contract

- Use root `NOTES.md` only for durable, high-priority instructions. Do not use it for task logs, project history, or transient working context.
- For non-trivial work that changes code or configuration, spans turns or agents, or needs recorded verification, create one ticket in the narrowest applicable `docs/notes/tickets/` directory.
- Name live tickets `O_short-kebab-name__YYYYMMDD.md` or `A_short-kebab-name__YYYYMMDD.md`. Their H1 repeats the identifier and spells out the matching status. Begin every ticket with one-line bullets for Scope, Status, Opened, Updated, Current State or Outcome, Verification, and Cleanup (`- Scope: …`), the format the home-level `scripts/check-ticket-context.mjs` audits across every workspace scope.
- Keep `tickets/INDEX.md` as a live queue of only open and active tickets, with the status letter (`O` or `A`) in the first column. Update it when ticket status changes.
- Validation documents open with one-line bullets for Purpose, Scope, and Last verified, and their `validation/INDEX.md` row carries the same Last verified date.
- On resolution, move reusable validation, integrity, or runbook guidance to `docs/validation/`, update `docs/validation/INDEX.md`, then remove the resolved ticket and its queue row. Do not retain completion ledgers or task histories.

## Verification

Run the structural guard after changing repository context:

```bash
node --test tests/context-system.test.mjs
```

It verifies the live-ticket schema, queue parity and status letters, legacy-ledger retirement, and validation-index coverage with matching dates. The home-level audit, `node /Users/Rohin/scripts/check-ticket-context.mjs`, must also report `PASS: personal-website`.
