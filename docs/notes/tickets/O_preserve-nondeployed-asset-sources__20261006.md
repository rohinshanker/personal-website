# O_preserve-nondeployed-asset-sources__20261006 — Open

- Scope: Preserve unused calendar photos, regeneration originals, other confirmed unused images, Aseprite working files and source fonts under non-deployed `docs/assets-src/`, updating source/regeneration references.
- Status: open
- Opened: 2026-10-06
- Updated: 2026-10-06
- Current State: Owner approved content decision items 2–4. Queued as work between the current leaderboard ticket and the next long loading ticket. No assets have moved yet. Canonical repository: `/Users/Rohin/Desktop/coding_stuff/personal-website`; coordinator: Agent Deck `1c881e50-1791344233`.
- Verification: Re-audit exact paths/basenames/dynamic references, inspect and record the explicit move list, compare byte hashes before/after, preserve licenses and generated derivatives, and verify source/regeneration tooling plus the actual Pages package exclusion. Run affected tests/manifests/media checks and ticket/link checks; render any affected routes if shipped references change.
- Cleanup: Add only reusable regeneration/source-location guidance to indexed validation docs. After accepted moves, update the owner calendar-review ticket with real paths, then resolve and delete this implementation ticket/index row.

## Constraints

- Source inventory is in content decision items 2–4. Preserve every file byte-for-byte; deletion is not authorized.
- Confirm each file remains unused by shipped HTML/CSS/JS and dynamic manifests before moving it. A regeneration dependency is preserved by updating its source path, not by dropping it.
- Keep used calendar images and full-quality modeling assets deployed. Preserve generated derivatives and all licenses.
- Calendar archive target: `docs/assets-src/calendar-pics/`. The owner will decide separately whether any archived photos can be deleted.
- Preserve the ongoing leaderboard work; canonical edits begin only after its resolved commit and checkout release. No push/deployment is authorized.
