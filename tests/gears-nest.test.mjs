import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [mainSource, eventStyles, homeSource, indexSource] = await Promise.all([
  readFile(new URL("scripts/home/main.js", root), "utf8"),
  readFile(new URL("styles/home/random-events.css", root), "utf8"),
  readFile(new URL("home.html", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
]);

const getCssBlock = (selector) => {
  const start = eventStyles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing CSS block: ${selector}`);
  const end = eventStyles.indexOf("\n}", start);
  assert.notEqual(end, -1, `Unterminated CSS block: ${selector}`);
  return eventStyles.slice(start, end + 2);
};

test("enemy health is reduced by ten percent from the prior scaling", () => {
  assert.match(
    mainSource,
    /const GEARS_NEST_ENEMY_HEALTH_MULTIPLIER = 3 \* 0\.9;/
  );
  const templates = mainSource.slice(
    mainSource.indexOf("const GEARS_NEST_ENEMY_TEMPLATES"),
    mainSource.indexOf("const applyGearsNestEnemyCoverSlot")
  );
  const baseHealth = [...templates.matchAll(/baseHealth: (\d+)/g)].map((match) =>
    Number(match[1])
  );
  assert.deepEqual(baseHealth.map((health) => Math.ceil(health * 3 * 0.9)), [
    81, 92, 76, 81, 157,
  ]);
});

test("nest character assets are local for localhost reliability", async () => {
  const expectedAssets = [
    "assets/random%20events/gears-nest/cog-gear.webp",
    "assets/random%20events/gears-nest/locust-drone.webp",
    "assets/random%20events/gears-nest/boomer.webp",
    "assets/random%20events/gears-nest/lancer.webp",
  ];

  for (const asset of expectedAssets) {
    const escapedAsset = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(mainSource, new RegExp(escapedAsset));
    await access(new URL(asset.replaceAll("%20", " "), root));
  }

  assert.doesNotMatch(
    mainSource,
    /static\.wikia\.nocookie\.net\/gearsofwar\/images\/(?:5\/50|a\/a8|3\/3f|b\/b6)/
  );
  assert.doesNotMatch(
    homeSource,
    /static\.wikia\.nocookie\.net\/gearsofwar\/images\/(?:5\/50|b\/b6)/
  );
  assert.match(homeSource, /data-src="assets\/random%20events\/gears-nest\/lancer\.webp"/);
  assert.match(homeSource, /data-src="assets\/random%20events\/gears-nest\/cog-gear\.webp"/);
});

test("nest event is not registered in debug mode", () => {
  const registrationStart = mainSource.indexOf('id: "gears-nest-clear"');
  const registrationEnd = mainSource.indexOf("});", registrationStart);
  assert.notEqual(registrationStart, -1, "Missing gears nest registration");
  assert.notEqual(registrationEnd, -1, "Missing gears nest registration end");
  const registration = mainSource.slice(registrationStart, registrationEnd);

  assert.match(registration, /debug: false,/);
  assert.doesNotMatch(registration, /debug: true,/);
});

test("blade lock event is not registered in debug mode", () => {
  const registrationStart = mainSource.indexOf('id: "lancer-battle"');
  const registrationEnd = mainSource.indexOf("});", registrationStart);
  assert.notEqual(registrationStart, -1, "Missing lancer battle registration");
  assert.notEqual(registrationEnd, -1, "Missing lancer battle registration end");
  const registration = mainSource.slice(registrationStart, registrationEnd);

  assert.match(registration, /debug: false,/);
  assert.doesNotMatch(registration, /debug: true,/);
});

test("player attack damage is increased by ten percent and stays readable", () => {
  assert.match(mainSource, /const GEARS_NEST_PLAYER_ATTACK_MULTIPLIER = 1\.1;/);
  assert.match(
    mainSource,
    /const GEARS_NEST_DRONE_DAMAGE = 3\.5 \* GEARS_NEST_PLAYER_ATTACK_MULTIPLIER;/
  );
  assert.match(
    mainSource,
    /const GEARS_NEST_BOOMER_DAMAGE = 4 \* GEARS_NEST_PLAYER_ATTACK_MULTIPLIER;/
  );
  assert.match(
    mainSource,
    /Number\(\(enemy\.health - damage\)\.toFixed\(2\)\)/
  );
  assert.equal(3.5 * 1.1, 3.8500000000000005);
  assert.equal(Number((81 - 3.5 * 1.1).toFixed(2)), 77.15);
  assert.equal(Number((157 - 4 * 1.1).toFixed(2)), 152.6);
});

test("enemy health meters are positioned above the sprites", () => {
  const healthBlock = getCssBlock(".gears-nest-enemy-health");
  assert.match(healthBlock, /bottom: calc\(100% \+ 6px\);/);
  assert.doesNotMatch(healthBlock, /bottom:\s*-\d/);
});

test("cover warnings accelerate throughout the projectile fuse", () => {
  assert.match(mainSource, /y: target\.y - 12,/);
  assert.match(
    getCssBlock(".gears-nest-hazard"),
    /animation: gears-nest-hazard-countdown var\(--flight-ms\) steps\(1, end\) both;/
  );

  const keyframesStart = eventStyles.indexOf(
    "@keyframes gears-nest-hazard-countdown"
  );
  const keyframesEnd = eventStyles.indexOf("\n}\n", keyframesStart);
  const keyframes = eventStyles.slice(keyframesStart, keyframesEnd + 3);
  const milestones = [...keyframes.matchAll(/(?:^|\n)\s*(\d+(?:\.\d+)?)% \{/g)].map(
    (match) => Number(match[1])
  );
  assert.deepEqual(milestones, [0, 14, 27, 39, 50, 60, 69, 77, 84, 90, 95, 98, 99.5, 100]);
  const gaps = milestones.slice(1).map((value, index) => value - milestones[index]);
  assert.ok(gaps.every((gap, index) => index === 0 || gap < gaps[index - 1]));
});

test("grenade projectile travels in one continuous arc", () => {
  assert.match(
    getCssBlock(".gears-nest-projectile--grenade .gears-nest-projectile-body"),
    /animation: gears-nest-grenade-arc var\(--flight-ms\) linear both;/
  );

  const keyframesStart = eventStyles.indexOf("@keyframes gears-nest-grenade-arc");
  const keyframesEnd = eventStyles.indexOf("\n}\n", keyframesStart);
  const keyframes = eventStyles.slice(keyframesStart, keyframesEnd + 3);
  const peakStart = keyframes.indexOf("50% {");
  const peakEnd = keyframes.indexOf("\n  }", peakStart);
  const peakBlock = keyframes.slice(peakStart, peakEnd);

  assert.match(keyframes, /0% \{[\s\S]*left: var\(--start-x\);/);
  assert.match(keyframes, /100% \{[\s\S]*left: var\(--end-x\);/);
  assert.match(peakBlock, /top: var\(--arc-y\);/);
  assert.doesNotMatch(peakBlock, /left:/);
});

test("every projectile resolution creates and cleans up a pixel explosion", () => {
  assert.match(
    mainSource,
    /explosion: "assets\/random%20events\/pixel-explosion\.gif"/
  );
  assert.match(mainSource, /y: target\.y - 6,/);
  assert.match(mainSource, /gearsNestState\.explosions\.push\(explosion\);/);
  assert.match(
    mainSource,
    /candidate\.id !== explosion\.id[\s\S]*GEARS_NEST_EXPLOSION_DURATION_MS/
  );
  assert.match(getCssBlock(".gears-nest-explosion"), /image-rendering: pixelated;/);
});

test("boomer only uses rocket hazards for enemy attacks", () => {
  const attackStart = mainSource.indexOf("const chooseGearsNestEnemyAttack = () => {");
  const attackEnd = mainSource.indexOf("const startGearsNestEnemyAttacks", attackStart);
  assert.notEqual(attackStart, -1, "Missing chooseGearsNestEnemyAttack");
  assert.notEqual(attackEnd, -1, "Missing startGearsNestEnemyAttacks");
  const attackSource = mainSource.slice(attackStart, attackEnd);

  assert.match(
    attackSource,
    /const boomer = aliveEnemies\.find\(\(enemy\) => enemy\.type === "boomer"\);/
  );
  assert.match(attackSource, /launchGearsNestHazard\("rocket", boomer\);/);
  assert.match(attackSource, /const drones = aliveEnemies\.filter/);
  assert.match(attackSource, /if \(!drones\.length\) return;/);
  assert.match(
    attackSource,
    /applyGearsNestBulletDamage\(drones\[Math\.floor\(Math\.random\(\) \* drones\.length\)\]\);/
  );
  assert.doesNotMatch(attackSource, /applyGearsNestBulletDamage\(\s*aliveEnemies/);
});

test("failed combat tips only the player sprite", () => {
  const failedBlock = getCssBlock(
    ".gears-nest-window.is-failed .gears-nest-player img"
  );
  assert.match(failedBlock, /rotate\(88deg\)/);
  assert.match(mainSource, /classList\.toggle\("is-failed", outcome === "failed"\)/);
});

test("HTML entry points use the updated cache key", () => {
  for (const source of [homeSource, indexSource]) {
    assert.match(source, /random-events\.css\?v=nest-local-assets-20260706/);
    assert.match(source, /main\.js\?v=nest-local-assets-20260706/);
  }
});
