import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Minesweeper stats retain their semantic window and referenced image assets", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");
  assert.match(
    home,
    /data-app-window="game-stats-minesweeper"[\s\S]*?data-game-stats-window="minesweeper"[\s\S]*?data-game-stats-content/
  );
  assert.match(home, /data-game-stats-refresh="minesweeper"/);
  assert.match(home, /data-game-stats-sync-status/);

  await Promise.all([
    ...["gold-medal.png", "silver-medal.png", "bronze-medal.png"].map((filename) =>
      access(new URL(`assets/minesweeper_assets/${filename}`, root))
    ),
    access(new URL("assets/app-icons/ico/user_card.ico", root)),
    access(new URL("assets/app-icons/ico/address_book_user.ico", root)),
  ]);
});
