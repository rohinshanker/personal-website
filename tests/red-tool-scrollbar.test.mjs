import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Red Tool chat keeps exactly one native arrow at each scrollbar end", async () => {
  const [css, globalCss, home, index] = await Promise.all([
    readFile(new URL("styles/home/random-events.css", root), "utf8"),
    readFile(new URL("style.css", root), "utf8"),
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);

  assert.match(
    css,
    /\.red-tool-chat-log \{[\s\S]*?height: 150px;[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/
  );
  assert.match(
    css,
    /\.red-tool-chat-log::-webkit-scrollbar-button:vertical:start:increment,\n\.red-tool-chat-log::-webkit-scrollbar-button:vertical:end:decrement \{\n  display: none;\n  height: 0;\n\}/
  );
  assert.match(
    css,
    /\.red-tool-chat-log::-webkit-scrollbar-button:vertical:start:decrement,\n\.red-tool-chat-log::-webkit-scrollbar-button:vertical:end:increment \{\n  display: block;\n  height: 17px;\n\}/
  );
  assert.match(
    css,
    /\.red-tool-chat-log::-webkit-scrollbar-button:vertical:start:decrement \{\n  background-image: url\("\.\.\/\.\.\/assets\/icon\/button-up\.svg"\);\n\}/
  );
  assert.match(
    css,
    /\.red-tool-chat-log::-webkit-scrollbar-button:vertical:end:increment \{\n  background-image: url\("\.\.\/\.\.\/assets\/icon\/button-down\.svg"\);\n\}/
  );
  assert.doesNotMatch(
    css,
    /\.red-tool-chat-log::-webkit-scrollbar-button:vertical:(?:start|end) \{/
  );
  assert.deepEqual(
    [
      ...css.matchAll(
        /\.red-tool-chat-log::-webkit-scrollbar-button[^,{\n]*/g
      ),
    ].map((match) => match[0].trim()),
    [
      ".red-tool-chat-log::-webkit-scrollbar-button:vertical:start:increment",
      ".red-tool-chat-log::-webkit-scrollbar-button:vertical:end:decrement",
      ".red-tool-chat-log::-webkit-scrollbar-button:vertical:start:decrement",
      ".red-tool-chat-log::-webkit-scrollbar-button:vertical:end:increment",
      ".red-tool-chat-log::-webkit-scrollbar-button:vertical:start:decrement",
      ".red-tool-chat-log::-webkit-scrollbar-button:vertical:end:increment",
    ],
    "Red Tool must define only the two hidden mirrored slots and two conventional arrow slots"
  );
  assert.match(
    globalCss,
    /::-webkit-scrollbar-button:vertical:start:decrement,[\s\S]*?::-webkit-scrollbar-button:vertical:end:increment \{\n  display: block;/
  );

  const expectedReference =
    "styles/home/random-events.css?v=bulk-system-alerts-20260811";
  assert.ok(home.includes(expectedReference));
  assert.ok(index.includes(expectedReference));
  const globalStyleIndex = home.indexOf('href="style.css?');
  const randomEventStyleIndex = home.indexOf(`href="${expectedReference}"`);
  const cursorStyleIndex = home.indexOf('href="styles/home/cursors.css?');
  assert.ok(globalStyleIndex >= 0);
  assert.ok(globalStyleIndex < randomEventStyleIndex);
  assert.ok(randomEventStyleIndex < cursorStyleIndex);
});
