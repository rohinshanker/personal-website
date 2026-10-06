import { readFile } from "node:fs/promises";

import { expect, test } from "./deterministic.mjs";
import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";

const [minesweeperRulesSource, snakeRulesSource] = await Promise.all([
  readFile(new URL("../../scripts/home/games/minesweeper.js", import.meta.url), "utf8"),
  readFile(new URL("../../scripts/home/games/snake.js", import.meta.url), "utf8"),
]);

const installStatsHookFixture = async (page) => {
  await page.addInitScript(() => {
    const createCalls = () => ({
      issued: [],
      inputs: [],
      pauses: 0,
      resumes: 0,
      events: [],
      drops: 0,
      hasIssued: false,
    });
    const calls = {
      minesweeper: createCalls(),
      snake: createCalls(),
    };
    const hooksFor = (game) => ({
      async issueGame(config, options = {}) {
        const gameCalls = calls[game];
        gameCalls.issued.push({ config, options });
        gameCalls.inputs = [];
        gameCalls.hasIssued = true;
        const rules = game === "minesweeper"
          ? window.homeMinesweeperRules
          : window.homeSnakeRules;
        const generated = game === "minesweeper"
          ? rules.generate(config, { seed: 0x24724724, firstCell: options.firstCell })
          : rules.generate(config, { seed: 0x2475a4e });
        return { initial: generated };
      },
      recordInput(input) {
        calls[game].inputs.push({ seq: calls[game].inputs.length + 1, ...input });
      },
      async pauseGame() {
        calls[game].pauses += 1;
      },
      async resumeGame() {
        calls[game].resumes += 1;
      },
      recordEvent(payload, options = {}) {
        calls[game].events.push({
          payload,
          terminalTick: options.terminalTick ?? null,
        });
        options.onCanonicalMetric?.({
          metric: payload.metric,
          metricKind: game === "minesweeper" ? "seconds" : "score",
          elapsedMs: game === "minesweeper" ? payload.metric * 1000 : undefined,
        });
      },
      dropSession() {
        calls[game].drops += 1;
        calls[game].hasIssued = false;
        calls[game].inputs = [];
      },
      hasIssuedGame() {
        return calls[game].hasIssued;
      },
      ensureSession() {
        throw new Error("verified controller used the legacy session path");
      },
    });
    window.__verifiedGameHooks = Object.freeze({ calls, hooksFor });
  });
};

const installControllerFixtures = async (page) => {
  await routeHomeScript(page, "minesweeper", (source) =>
    `${minesweeperRulesSource}\n${source.replace(
      'const msStats = createGameStatsHooks("minesweeper", msState);',
      'const msStats = window.__verifiedGameHooks.hooksFor("minesweeper");'
    ).replace(/\n\}\)\(\);\s*$/, `
window.__verifiedMinesweeperController = Object.freeze({
  finish: () => {
    for (let index = 0; index < msState.cells.length && !msState.gameOver; index += 1) {
      if (!msState.cells[index].mine && !msState.cells[index].revealed) msRevealCell(index);
    }
    return { gameOver: msState.gameOver, won: msState.engineState?.won };
  },
  read: () => ({
    gameOver: msState.gameOver,
    hasEngine: Boolean(msState.engineState),
    started: msState.started,
  }),
});
})();`)}`
  );
  await routeHomeScript(page, "snake", (source) =>
    `${snakeRulesSource}\n${source.replace(
      'const snakeStats = createGameStatsHooks("snake", () => snakeState);',
      'const snakeStats = window.__verifiedGameHooks.hooksFor("snake");'
    ).replace(/\n\}\)\(\);\s*$/, `
window.__verifiedSnakeController = Object.freeze({
  direction: setSnakeDirection,
  finish: () => {
    clearSnakeCountdown();
    clearSnakeTick();
    snakeState.running = true;
    snakeState.hasStarted = true;
    while (!snakeState.gameOver) {
      snakeStep();
      clearSnakeTick();
    }
    return {
      gameOver: snakeState.gameOver,
      score: snakeState.score,
      terminalTick: snakeState.engineState.tick,
    };
  },
  pause: pauseSnakeGame,
  resume: startSnakeGame,
});
})();`)}`
  );
};

const preparePage = async (page, app) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installStatsHookFixture(page);
  await installControllerFixtures(page);
  await page.goto("/home.html", { waitUntil: "load" });
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.locator(`.desktop-icon[data-app="${app}"]`).click();
  const appWindow = page.locator(`[data-app-window="${app}"]`);
  await expect(appWindow).toBeVisible();
  return appWindow;
};

test("Minesweeper binds issuance to the first reveal and records an exact winning replay", async ({
  page,
}, testInfo) => {
  const minesweeper = await preparePage(page, "minesweeper");
  const before = await page.evaluate(() => ({
    calls: window.__verifiedGameHooks.calls.minesweeper,
    state: window.__verifiedMinesweeperController.read(),
  }));
  expect(before.calls.issued).toHaveLength(0);
  expect(before.state).toEqual({ gameOver: false, hasEngine: false, started: false });

  await minesweeper.locator('.ms-cell[data-index="40"]').click();
  await expect.poll(() => page.evaluate(
    () => window.__verifiedGameHooks.calls.minesweeper.inputs.length
  )).toBeGreaterThan(0);
  const issued = await page.evaluate(() => window.__verifiedGameHooks.calls.minesweeper.issued);
  expect(issued).toEqual([{
    config: { difficulty: "beginner" },
    options: { firstCell: 40 },
  }]);
  const firstInput = await page.evaluate(
    () => window.__verifiedGameHooks.calls.minesweeper.inputs[0]
  );
  expect(firstInput).toEqual({ seq: 1, op: "reveal", cell: 40 });
  expect(await page.evaluate(
    () => window.__verifiedGameHooks.calls.minesweeper.resumes
  )).toBe(1);

  expect(await page.evaluate(() => window.__verifiedMinesweeperController.finish())).toEqual({
    gameOver: true,
    won: true,
  });
  const completed = await page.evaluate(() => window.__verifiedGameHooks.calls.minesweeper);
  expect(completed.inputs.map((input) => input.seq)).toEqual(
    completed.inputs.map((_, index) => index + 1)
  );
  expect(completed.events).toHaveLength(1);
  expect(completed.events[0].payload).toMatchObject({
    type: "win",
    difficulty: "beginner",
  });

  await minesweeper.locator("#ms-reset").click();
  expect(await page.evaluate(() => window.__verifiedGameHooks.calls.minesweeper.issued.length)).toBe(1);
  await minesweeper.locator('.ms-cell[data-index="1"]').click({ button: "right" });
  await minesweeper.locator('.ms-cell[data-index="0"]').click();
  await expect.poll(() => page.evaluate(
    () => window.__verifiedGameHooks.calls.minesweeper.issued.length
  )).toBe(2);
  await expect.poll(() => page.evaluate(
    () => window.__verifiedGameHooks.calls.minesweeper.inputs.length
  )).toBe(2);
  expect(await page.evaluate(
    () => window.__verifiedGameHooks.calls.minesweeper.inputs
  )).toEqual([
    { seq: 1, op: "mark", cell: 1, mark: "flag" },
    { seq: 2, op: "reveal", cell: 0 },
  ]);
  expect(await scanForViolations(page, testInfo, "verified-minesweeper")).toEqual([]);
});

test("Snake records tick-indexed directions, pause timing, and verifier-generated terminal ticks", async ({
  page,
}, testInfo) => {
  const snake = await preparePage(page, "snake");
  await expect(snake.locator("#snake-loading-panel")).toHaveAttribute("aria-hidden", "true", {
    timeout: 6_000,
  });
  await snake.locator('[data-snake-board-size="10"]').click();
  await snake.locator("#snake-start").click();
  await expect.poll(() => page.evaluate(
    () => window.__verifiedGameHooks.calls.snake.resumes
  )).toBe(1);
  await page.evaluate(() => window.__verifiedSnakeController.direction("up"));
  await page.evaluate(() => window.__verifiedSnakeController.pause());
  await expect.poll(() => page.evaluate(
    () => window.__verifiedGameHooks.calls.snake.pauses
  )).toBe(1);
  await page.evaluate(() => window.__verifiedSnakeController.direction("left"));
  expect(await page.evaluate(
    () => window.__verifiedGameHooks.calls.snake.inputs.length
  )).toBe(1);
  await page.evaluate(() => window.__verifiedSnakeController.resume());
  await expect.poll(() => page.evaluate(
    () => window.__verifiedGameHooks.calls.snake.resumes
  )).toBe(2);

  const finished = await page.evaluate(() => window.__verifiedSnakeController.finish());
  expect(finished.gameOver).toBe(true);
  expect(finished.terminalTick).toBeGreaterThan(0);
  const calls = await page.evaluate(() => window.__verifiedGameHooks.calls.snake);
  expect(calls.issued).toEqual([{
    config: { boardSize: "10" },
    options: {},
  }]);
  expect(calls.inputs).toEqual([
    { seq: 1, op: "direction", tick: 0, direction: "up" },
    { seq: 2, op: "direction", tick: 0, direction: "left" },
  ]);
  expect(calls.events).toHaveLength(1);
  expect(calls.events[0]).toMatchObject({
    payload: {
      type: "gamePlayed",
      boardSize: "10",
      metric: finished.score,
    },
    terminalTick: finished.terminalTick,
  });
  expect(await scanForViolations(page, testInfo, "verified-snake")).toEqual([]);
});
