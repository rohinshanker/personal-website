import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Don't Starve darkness result sends Charlie's regards", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");

  assert.match(
    home,
    /<div class="window dst-darkness-window[\s\S]*?<p>You don't survive the night\. Charlie sends her regards\.<\/p>/
  );
  assert.doesNotMatch(home, /Maxwell sends his regards/);
});
