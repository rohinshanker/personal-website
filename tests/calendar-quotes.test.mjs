import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const mainSource = await readFile(new URL("../scripts/home/main.js", import.meta.url), "utf8");
const quotesStart = mainSource.indexOf("const calendarQuotes = {");
const quotesEnd = mainSource.indexOf("\n\nconst calendarEvents = {", quotesStart);

assert.notEqual(quotesStart, -1, "Missing calendarQuotes declaration");
assert.notEqual(quotesEnd, -1, "Missing calendarEvents boundary");

const quotesDeclaration = mainSource.slice(quotesStart, quotesEnd);
const context = {};
vm.runInNewContext(
  quotesDeclaration + "; globalThis.calendarQuotesForTest = calendarQuotes;",
  context
);

const septemberQuoteParts = [
  "A human being should be able to change a diaper, plan an invasion, butcher a hog, conn a ship,",
  "design a building, write a sonnet, balance accounts, build a wall, set a bone,",
  "comfort the dying, take orders, give orders, cooperate, act alone, solve equations,",
  "analyze a new problem, pitch manure, program a computer, cook a tasty meal,",
  "fight efficiently, die gallantly. Specialization is for insects.",
];
const septemberQuote = septemberQuoteParts.join(" ") + "<br>—Robert A. Heinlein";
const octoberQuote =
  "“I have no special talents. I am only passionately curious.”<br>—Albert Einstein";

test("September and October calendar quotes exactly match the requested copy", () => {
  assert.equal(context.calendarQuotesForTest[8], septemberQuote);
  assert.equal(context.calendarQuotesForTest[9], octoberQuote);
  assert.doesNotMatch(quotesDeclaration, /Olivie Blake|Peter Drucker/);
});
