import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Death Note input rejects content beyond its visible ruled lines", async () => {
  const [source, css, home] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/random-events.css", root), "utf8"),
    readFile(new URL("home.html", root), "utf8"),
  ]);

  assert.match(home, /<textarea[\s\S]*?class="death-note-entry"[\s\S]*?id="death-note-entry"/);
  assert.match(css, /\.death-note-entry \{[\s\S]*?line-height: 26px;[\s\S]*?overflow: hidden;/);
  assert.match(source, /const limitDeathNoteEntryToVisibleLines = \(\) => \{/);
  assert.match(source, /while \(deathNoteEntry\.scrollHeight > deathNoteEntry\.clientHeight && value\) \{/);
  assert.match(source, /deathNoteEntry\?\.addEventListener\("input", limitDeathNoteEntryToVisibleLines\);/);
});
