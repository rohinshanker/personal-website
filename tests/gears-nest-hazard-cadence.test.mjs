import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const createAttackRuntime = (source) => {
  const helperStart = source.indexOf("const getGearsNestRocketMinGapMs = (aliveEnemies) => {");
  const helperEnd = source.indexOf("\n\nconst clearGearsNestAttackTimer", helperStart);
  const attackStart = source.indexOf("const chooseGearsNestEnemyAttack = () => {");
  const attackEnd = source.indexOf("\nconst startGearsNestEnemyAttacks", attackStart);
  assert.ok(
    helperStart >= 0 && helperEnd > helperStart && attackStart >= 0 && attackEnd > attackStart,
    "Missing Gears Nest attack runtime"
  );

  const runtime = {
    Date: { now: () => 0 },
    Math: { floor: Math.floor, random: () => 0.99 },
  };
  const declarations = [
    "const GEARS_NEST_GRENADE_MIN_GAP_MS = 3000;",
    "const GEARS_NEST_ROCKET_MIN_GAP_MS = 4200;",
    "const GEARS_NEST_GRENADE_CHANCE = 0.4;",
    "const GEARS_NEST_ROCKET_CHANCE = 0.46;",
    "const GEARS_NEST_LONE_BOOMER_ROCKET_SPEED_MULTIPLIER = 2;",
    "let gearsNestState = { active: true, completed: false, enemies: [], hazards: [], lastGrenadeAt: 0, lastRocketAt: 0 };",
    "let now = 0;",
    "let randomValues = [];",
    "const Date = { now: () => now };",
    "const Math = { floor: globalThis.Math.floor, random: () => randomValues.shift() ?? 0.99 };",
    "const launches = [];",
    "const bullets = [];",
    "const gearsNestAliveEnemies = () => gearsNestState.enemies.filter((enemy) => enemy.health > 0);",
    "const completeGearsNestEvent = () => { gearsNestState.completed = true; };",
    "const launchGearsNestHazard = (type, enemy) => launches.push({ type, enemyId: enemy.id });",
    "const applyGearsNestBulletDamage = (enemy) => bullets.push(enemy.id);",
    source.slice(helperStart, helperEnd),
    source.slice(attackStart, attackEnd),
    "globalThis.runAttack = ({ enemies, lastGrenadeAt = 0, lastRocketAt = 0, nowValue, randoms }) => { gearsNestState = { active: true, completed: false, enemies, hazards: [], lastGrenadeAt, lastRocketAt }; now = nowValue; randomValues = [...randoms]; launches.length = 0; bullets.length = 0; chooseGearsNestEnemyAttack(); return { launches: JSON.parse(JSON.stringify(launches)), bullets: [...bullets] }; };",
    "globalThis.rocketGap = (enemies) => getGearsNestRocketMinGapMs(enemies);",
  ].join("\n");
  vm.runInNewContext(declarations, runtime);
  return runtime;
};

test("Gears Nest hazards are slightly more frequent and lone Boomers halve rocket cooldown", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const runtime = createAttackRuntime(source);
  const boomer = { id: "boomer", type: "boomer", health: 1 };
  const drone = { id: "drone", type: "drone", health: 1 };

  assert.equal(runtime.rocketGap([boomer, drone]), 4200);
  assert.equal(runtime.rocketGap([boomer]), 2100);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        runtime.runAttack({
          enemies: [boomer, drone],
          nowValue: 5000,
          randoms: [0.45],
        })
      )
    ).launches,
    [{ type: "rocket", enemyId: "boomer" }]
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        runtime.runAttack({
          enemies: [boomer, drone],
          nowValue: 5000,
          randoms: [0.99, 0.39, 0],
        })
      )
    ).launches,
    [{ type: "grenade", enemyId: "drone" }]
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        runtime.runAttack({
          enemies: [boomer],
          nowValue: 2200,
          randoms: [0.45],
        })
      )
    ).launches,
    [{ type: "rocket", enemyId: "boomer" }]
  );
  assert.match(source, /const GEARS_NEST_GRENADE_CHANCE = 0\.4;/);
  assert.match(source, /const GEARS_NEST_ROCKET_CHANCE = 0\.46;/);
  assert.match(source, /const GEARS_NEST_LONE_BOOMER_ROCKET_SPEED_MULTIPLIER = 2;/);
});
