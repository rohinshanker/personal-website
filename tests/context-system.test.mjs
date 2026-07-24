import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const notesDirectory = new URL("docs/notes/", root);
const ticketsDirectory = new URL("docs/notes/tickets/", root);
const validationDirectory = new URL("docs/validation/", root);
const ticketName = /^([AO])_([a-z0-9]+(?:-[a-z0-9]+)*)__([0-9]{8})\.md$/;
const ticketStatus = Object.freeze({ A: "active", O: "open" });
const requiredTicketFields = [
  "Scope",
  "Status",
  "Opened",
  "Updated",
  "Verification",
  "Cleanup",
];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const markdownFilenames = async (directory) =>
  (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

test("repository context uses only indexed open or active tickets", async () => {
  const noteEntries = await readdir(notesDirectory, { withFileTypes: true });
  assert.deepEqual(
    noteEntries.map((entry) => entry.name).sort(),
    ["tickets"],
    "Retired task history must not remain in the root note directory"
  );

  const ticketFiles = (await markdownFilenames(ticketsDirectory)).filter(
    (filename) => filename !== "INDEX.md"
  );

  for (const filename of ticketFiles) {
    const match = filename.match(ticketName);
    assert.ok(match, `Invalid live-ticket filename: ${filename}`);
    const [, state] = match;
    const identifier = filename.slice(0, -".md".length);
    const content = await readFile(new URL(`docs/notes/tickets/${filename}`, root), "utf8");
    const expectedStatus = ticketStatus[state];

    assert.match(content, new RegExp(`^# ${identifier} — ${expectedStatus[0].toUpperCase()}${expectedStatus.slice(1)}$`, "m"));
    for (const field of requiredTicketFields) {
      assert.match(content, new RegExp(`^${field}:\\s+\\S`, "m"), `${filename} is missing ${field}`);
    }
    assert.match(content, /^Current (State|Outcome):\s+\S/m, `${filename} needs current state or outcome`);
    assert.match(content, new RegExp(`^Status:\\s+${expectedStatus}$`, "m"));
  }

  const ticketIndex = await readFile(new URL("docs/notes/tickets/INDEX.md", root), "utf8");
  assert.match(ticketIndex, /^# Live Tickets$/m);
  const indexedTickets = [...ticketIndex.matchAll(/\]\(([^)]+\.md)\)/g)]
    .map(([, filename]) => filename)
    .sort();
  assert.deepEqual(indexedTickets, ticketFiles, "The live index must list every and only live tickets");
});

test("validation documents are indexed and use the shared metadata", async () => {
  const validationFiles = (await markdownFilenames(validationDirectory)).filter(
    (filename) => filename !== "INDEX.md"
  );
  const validationIndex = await readFile(new URL("docs/validation/INDEX.md", root), "utf8");

  for (const filename of validationFiles) {
    const content = await readFile(new URL(`docs/validation/${filename}`, root), "utf8");
    assert.match(content, /^Purpose:\s+\S/m, `${filename} is missing Purpose`);
    assert.match(content, /^Scope:\s+\S/m, `${filename} is missing Scope`);
    assert.match(content, /^Last verified:\s+\d{4}-\d{2}-\d{2}$/m, `${filename} is missing Last verified`);
    assert.match(
      validationIndex,
      new RegExp(`\\]\\(${escapeRegExp(filename)}\\)`),
      `${filename} is missing from the validation index`
    );
  }
});
