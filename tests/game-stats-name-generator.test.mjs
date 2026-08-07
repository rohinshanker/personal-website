import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const getNameGeneratorSource = (source) => {
  const generatorStart = source.indexOf("const gameStatsRandomIndex = (length) =>");
  const generatorEnd = source.indexOf("\nconst setGameProfilePromptVisible", generatorStart);
  assert.ok(generatorStart >= 0 && generatorEnd > generatorStart, "Missing name generator runtime");
  return source.slice(generatorStart, generatorEnd);
};

const getCooldownSecondsSource = (source) => {
  const cooldownStart = source.indexOf("const getGameStatsNameRollCooldownSeconds = () =>");
  const cooldownEnd = source.indexOf("\nconst stopGameStatsNameRollCooldown", cooldownStart);
  assert.ok(cooldownStart >= 0 && cooldownEnd > cooldownStart, "Missing cooldown helper");
  return source.slice(cooldownStart, cooldownEnd);
};

const getProfileRollStateSource = (source) => {
  const stateStart = source.indexOf("const getGameStatsNameRollCooldownSeconds = () =>");
  const stateEnd = source.indexOf("\nconst getGameStatsProfileNameFromIcon", stateStart);
  assert.ok(stateStart >= 0 && stateEnd > stateStart, "Missing profile name-roll state runtime");
  return source.slice(stateStart, stateEnd);
};

const getIconPickerSource = (source) => {
  const pickerStart = source.indexOf("const getGameStatsProfileNameFromIcon = (filename) =>");
  const pickerEnd = source.indexOf("\nconst resolveGameStatsProfilePrompt", pickerStart);
  assert.ok(pickerStart >= 0 && pickerEnd > pickerStart, "Missing profile icon-picker runtime");
  return source.slice(pickerStart, pickerEnd);
};

const skyGeneratorDefinition = `title = Sky Name Generator

names
  [vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels]
  [vowels][consonants][vowels][consonants][vowels]
  [consonants][vowels][consonants][vowels][consonants]
  [vowels][consonants][vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels][consonants][vowels]
  [vowels][consonants][vowels][consonants][vowels][consonants][vowels]
  [consonants][vowels][consonants][vowels][consonants][vowels][consonants]
  [vowels][consonants][vowels][consonants][vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels][consonants][vowels][consonants][vowels]

vowels
  a
  e
  i
  o
  u

consonants
  b
  c
  d
  f
  g
  h ^0.5
  j
  k
  l
  m
  n
  p
  q ^0.5
  r
  s
  t
  v
  w ^0.5
  x ^0.5
  y
  z ^0.5`;

const createNameGeneratorRuntime = (source, responses) => {
  let entropy = 0;
  const calls = [];
  const runtime = {
    AbortController,
    Math: {
      floor: Math.floor,
      random: () => {
        throw new Error("Secure browser entropy should be used when available");
      },
    },
    Number,
    Uint32Array,
    window: {
      clearTimeout: () => {},
      crypto: {
        getRandomValues: (values) => {
          values[0] = entropy;
          entropy += 1;
          return values;
        },
      },
      fetch: async (url, options) => {
        calls.push({ url, options });
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response;
      },
      setTimeout: () => 1,
    },
  };
  const declarations = [
    'const GAME_STATS_SKY_NAME_GENERATOR_URL = "https://perchance.org/api/downloadGenerator?generatorName=sky-cotl-namegen&listsOnly=true";',
    "const GAME_STATS_NAME_GENERATOR_TIMEOUT_MS = 8000;",
    "const GAME_STATS_NAME_SUGGESTION_COUNT = 5;",
    'const GAME_STATS_PROFILE_EDITOR_MODES = Object.freeze({ create: "create", icon: "icon" });',
    getNameGeneratorSource(source),
    "globalThis.fetchGeneratedName = fetchGameStatsName;",
    "globalThis.fetchGeneratedNames = fetchGameStatsNameSuggestions;",
  ].join("\n");
  vm.runInNewContext(declarations, runtime);
  return { calls, runtime };
};

const textResponse = (text, ok = true) => ({
  ok,
  text: async () => text,
});

const isSkyGrammarName = (name) => {
  if (!/^[A-Z][a-z]{3,7}$/.test(name)) return false;
  const isVowel = (character) => "aeiou".includes(character);
  return [...name.toLowerCase()].every(
    (character, index, letters) => index === 0 || isVowel(character) !== isVowel(letters[index - 1])
  );
};

test("the profile name generator uses the live Sky COTL grammar and caches it per page", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const { calls, runtime } = createNameGeneratorRuntime(source, [textResponse(skyGeneratorDefinition)]);

  assert.equal(isSkyGrammarName(await runtime.fetchGeneratedName()), true);
  assert.equal(isSkyGrammarName(await runtime.fetchGeneratedName()), true);
  const suggestions = await runtime.fetchGeneratedNames();
  assert.equal(suggestions.length, 5);
  assert.equal(new Set(suggestions).size, 5);
  suggestions.forEach((name) => assert.equal(isSkyGrammarName(name), true));
  assert.deepEqual(calls.map(({ url }) => url), [
    "https://perchance.org/api/downloadGenerator?generatorName=sky-cotl-namegen&listsOnly=true",
  ]);
  for (const { options } of calls) {
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.ok(options.signal);
  }
  assert.match(source, /const parseGameStatsSkyNameGrammar = \(source\) =>/);
  assert.match(source, /const createGameStatsSkyName = \(grammar\) =>/);
  assert.doesNotMatch(source, /fantasyname\.lukewh\.com|fantasynamegenerators\.com|Skywalker/);
});

test("the profile name generator rejects unavailable, malformed, and failed Sky API responses", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const { runtime } = createNameGeneratorRuntime(source, [
    textResponse("", true),
    textResponse("unavailable", false),
    new Error("network unavailable"),
  ]);

  await assert.rejects(runtime.fetchGeneratedName(), /definition is invalid/);
  await assert.rejects(runtime.fetchGeneratedName(), /request failed/);
  await assert.rejects(runtime.fetchGeneratedName(), /network unavailable/);
});

test("a failed roll keeps API Error inside the name field and allows saving", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const runtime = {
    Date: { now: () => 50_000 },
    Math,
    window: {
      clearInterval: () => {},
      setInterval: () => 1,
    },
  };
  const declarations = [
    'const GAME_STATS_API_ERROR_NAME = "API Error";',
    "const GAME_STATS_MAX_NAME_REROLLS = 10;",
    "const GAME_STATS_NAME_ROLL_COOLDOWN_MS = 3000;",
    "const GAME_STATS_NAME_SUGGESTION_COUNT = 5;",
    "let gameStatsDraftProfile = { name: \"\", rerollCount: 0 };",
    "let gameStatsNameRollInFlight = false;",
    "let gameStatsNameRollId = 0;",
    "let gameStatsNameRollCooldownEndsAt = 0;",
    "let gameStatsNameRollCooldownTimer = null;",
    "let gameStatsDraftNameSuggestions = [];",
    "let gameStatsNameSuggestionsOpen = false;",
    "let gameStatsNameSuggestionActiveIndex = -1;",
    "const isGameStatsProfileIconEditor = () => false;",
    "const gameProfileName = { value: \"\", removeAttribute: () => {}, setAttribute: () => {}, focus: () => {} };",
    "const gameProfileNameToggle = { disabled: false, setAttribute: () => {} };",
    "const gameProfileNameOptions = { classList: { toggle: () => {} }, setAttribute: () => {}, querySelectorAll: () => [], replaceChildren: () => {}, append: () => {} };",
    "const gameProfileReroll = { disabled: false, setAttribute: () => {} };",
    "const gameProfileRerollLabel = { textContent: \"\" };",
    "const gameProfileSave = { disabled: true };",
    "const gameProfileRerollCount = { textContent: \"\" };",
    "const fetchGameStatsNameSuggestions = async () => { throw new Error(\"network unavailable\"); };",
    getProfileRollStateSource(source),
    "globalThis.rollName = rollGameStatsDraftName;",
    "globalThis.profileState = () => ({ name: gameStatsDraftProfile.name, output: gameProfileName.value, saveDisabled: gameProfileSave.disabled, rerollCount: gameProfileRerollCount.textContent });",
  ].join("\n");
  vm.runInNewContext(declarations, runtime);

  assert.equal(await runtime.rollName(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.profileState())), {
    name: "API Error",
    output: "API Error",
    saveDisabled: false,
    rerollCount: "10 left",
  });
});

test("icon selection replaces API Error only and keeps successful names unchanged", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const runtime = {
    document: {
      createElement: () => ({
        attributes: {},
        children: [],
        classList: {
          values: new Set(),
          contains(name) {
            return this.values.has(name);
          },
          toggle(name, force) {
            if (force) this.values.add(name);
            else this.values.delete(name);
          },
        },
        listeners: {},
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
        append(...children) {
          this.children.push(...children);
        },
        setAttribute(name, value) {
          this.attributes[name] = String(value);
        },
      }),
    },
  };
  const declarations = [
    'const GAME_STATS_API_ERROR_NAME = "API Error";',
    "const GAME_STATS_ICON_MANIFEST = [{ filename: \"address_book_user.ico\", src: \"assets/app-icons/ico/address_book_user.ico\" }, { filename: \"Roland_GS.ico\", src: \"assets/app-icons/ico/Roland_GS.ico\" }];",
    "let gameStatsDraftProfile = { name: \"API Error\", icon: \"\" };",
    "let iconEditorOpen = false;",
    "const isGameStatsProfileIconEditor = () => iconEditorOpen;",
    "const gameProfileIconSearch = { value: \"\" };",
    "const gameProfileIconGallery = { children: [], replaceCount: 0, scrollTop: 0, replaceChildren() { this.children = []; this.replaceCount += 1; this.scrollTop = 0; }, append(child) { this.children.push(child); }, querySelectorAll() { return this.children; } };",
    "let profileStateUpdates = 0;",
    "const updateGameProfileRerollState = () => { profileStateUpdates += 1; };",
    getIconPickerSource(source),
    "globalThis.renderPicker = renderGameProfileIconGallery;",
    "globalThis.selectIcon = (index) => gameProfileIconGallery.children[index].listeners.click();",
    "globalThis.iconNode = (index) => gameProfileIconGallery.children[index];",
    "globalThis.setGalleryScrollTop = (value) => { gameProfileIconGallery.scrollTop = value; };",
    "globalThis.galleryState = () => ({ replaceCount: gameProfileIconGallery.replaceCount, scrollTop: gameProfileIconGallery.scrollTop, selectedIndexes: gameProfileIconGallery.children.map((option, index) => option.attributes['aria-selected'] === 'true' && option.classList.contains('is-selected') ? index : -1).filter((index) => index >= 0) });",
    "globalThis.setName = (name) => { gameStatsDraftProfile.name = name; };",
    "globalThis.setIconEditorOpen = (open) => { iconEditorOpen = open; };",
    "globalThis.profile = () => ({ ...gameStatsDraftProfile, profileStateUpdates });",
  ].join("\n");
  vm.runInNewContext(declarations, runtime);

  runtime.renderPicker();
  const firstIconNode = runtime.iconNode(0);
  runtime.setGalleryScrollTop(137);
  runtime.selectIcon(0);
  assert.equal(runtime.iconNode(0), firstIconNode);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.galleryState())), {
    replaceCount: 1,
    scrollTop: 137,
    selectedIndexes: [0],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.profile())), {
    name: "address book user",
    icon: "assets/app-icons/ico/address_book_user.ico",
    profileStateUpdates: 1,
  });

  runtime.setName("Ayla");
  runtime.renderPicker();
  const secondIconNode = runtime.iconNode(1);
  runtime.setGalleryScrollTop(83);
  runtime.selectIcon(1);
  assert.equal(runtime.iconNode(1), secondIconNode);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.galleryState())), {
    replaceCount: 2,
    scrollTop: 83,
    selectedIndexes: [1],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.profile())), {
    name: "Ayla",
    icon: "assets/app-icons/ico/Roland_GS.ico",
    profileStateUpdates: 2,
  });

  runtime.setName("API Error");
  runtime.setIconEditorOpen(true);
  runtime.renderPicker();
  runtime.selectIcon(0);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.profile())), {
    name: "API Error",
    icon: "assets/app-icons/ico/address_book_user.ico",
    profileStateUpdates: 3,
  });
});

test("a user reroll has a fixed three-second cooldown and blocks duplicate fetches", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  let now = 50_000;
  const createOption = () => ({
    classList: { toggle: () => {} },
    addEventListener: () => {},
    setAttribute: () => {},
  });
  const runtime = {
    Date: { now: () => now },
    Math,
    document: { createElement: createOption },
    window: {
      clearInterval: () => {},
      setInterval: () => 1,
    },
  };
  const declarations = [
    "const GAME_STATS_API_ERROR_NAME = \"API Error\";",
    "const GAME_STATS_MAX_NAME_REROLLS = 10;",
    "const GAME_STATS_NAME_ROLL_COOLDOWN_MS = 3000;",
    "const GAME_STATS_NAME_SUGGESTION_COUNT = 5;",
    "let gameStatsNameRollCooldownEndsAt = 0;",
    "let gameStatsNameRollCooldownTimer = null;",
    "let gameStatsDraftProfile = { name: \"\", rerollCount: 0 };",
    "let gameStatsNameRollInFlight = false;",
    "let gameStatsNameRollId = 0;",
    "let gameStatsDraftNameSuggestions = [];",
    "let gameStatsNameSuggestionsOpen = false;",
    "let gameStatsNameSuggestionActiveIndex = -1;",
    "const isGameStatsProfileIconEditor = () => false;",
    "let fetchCount = 0;",
    "const gameProfileName = { value: \"\", removeAttribute: () => {}, setAttribute: () => {}, focus: () => {} };",
    "const gameProfileNameToggle = { disabled: false, setAttribute: () => {} };",
    "const gameProfileNameOptions = { classList: { toggle: () => {} }, setAttribute: () => {}, querySelectorAll: () => [], replaceChildren: () => {}, append: () => {} };",
    "const gameProfileReroll = { disabled: false, setAttribute: () => {} };",
    "const gameProfileRerollLabel = { textContent: \"\" };",
    "const gameProfileSave = { disabled: false };",
    "const gameProfileRerollCount = { textContent: \"\" };",
    "const fetchGameStatsNameSuggestions = async () => { fetchCount += 1; return [\"Rolan\", \"Sera\", \"Tovin\", \"Ayla\", \"Nemi\"]; };",
    getProfileRollStateSource(source),
    "globalThis.getCooldownSeconds = getGameStatsNameRollCooldownSeconds;",
    "globalThis.rollName = rollGameStatsDraftName;",
    "globalThis.getFetchCount = () => fetchCount;",
  ].join("\n");
  vm.runInNewContext(declarations, runtime);

  assert.equal(await runtime.rollName(), true);
  assert.equal(runtime.getCooldownSeconds(), 0);
  assert.equal(await runtime.rollName({ isReroll: true }), true);
  assert.equal(runtime.getCooldownSeconds(), 3);
  assert.equal(await runtime.rollName({ isReroll: true }), false);
  assert.equal(runtime.getFetchCount(), 2);

  now += 2999;
  assert.equal(runtime.getCooldownSeconds(), 1);
  now += 1;
  assert.equal(runtime.getCooldownSeconds(), 0);
});

test("name suggestions preserve the selected favorite while replacing the five-choice dropdown", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  let now = 50_000;
  const createOption = () => ({
    classList: { toggle: () => {} },
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    focus: () => {},
    setAttribute: () => {},
  });
  const runtime = {
    Date: { now: () => now },
    Math,
    document: { createElement: createOption },
    window: {
      clearInterval: () => {},
      setInterval: () => 1,
    },
  };
  const declarations = [
    "const GAME_STATS_API_ERROR_NAME = \"API Error\";",
    "const GAME_STATS_MAX_NAME_REROLLS = 10;",
    "const GAME_STATS_NAME_ROLL_COOLDOWN_MS = 3000;",
    "const GAME_STATS_NAME_SUGGESTION_COUNT = 5;",
    "let gameStatsNameRollCooldownEndsAt = 0;",
    "let gameStatsNameRollCooldownTimer = null;",
    "let gameStatsDraftProfile = { name: \"\", rerollCount: 0 };",
    "let gameStatsNameRollInFlight = false;",
    "let gameStatsNameRollId = 0;",
    "let gameStatsDraftNameSuggestions = [];",
    "let gameStatsNameSuggestionsOpen = false;",
    "let gameStatsNameSuggestionActiveIndex = -1;",
    "const isGameStatsProfileIconEditor = () => false;",
    "const gameProfileName = { value: \"\", removeAttribute: () => {}, setAttribute: () => {}, focus: () => {} };",
    "const gameProfileNameToggle = { disabled: false, setAttribute: () => {} };",
    "const gameProfileNameOptions = { children: [], classList: { toggle: () => {} }, setAttribute: () => {}, querySelectorAll() { return this.children; }, replaceChildren() { this.children = []; }, append(child) { this.children.push(child); } };",
    "const gameProfileReroll = { disabled: false, setAttribute: () => {} };",
    "const gameProfileRerollLabel = { textContent: \"\" };",
    "const gameProfileSave = { disabled: false };",
    "const gameProfileRerollCount = { textContent: \"\" };",
    "const batches = [[\"Ayla\", \"Bryn\", \"Cora\", \"Dara\", \"Eryn\"], [\"Fawn\", \"Galen\", \"Hali\", \"Iven\", \"Jora\"], null];",
    "const fetchGameStatsNameSuggestions = async () => { const batch = batches.shift(); if (!batch) throw new Error(\"offline\"); return batch; };",
    getProfileRollStateSource(source),
    "globalThis.rollName = rollGameStatsDraftName;",
    "globalThis.clickSuggestion = (index) => gameProfileNameOptions.children[index].listeners.click();",
    "globalThis.profileState = () => ({ name: gameStatsDraftProfile.name, value: gameProfileName.value, open: gameStatsNameSuggestionsOpen, suggestions: [...gameStatsDraftNameSuggestions] });",
  ].join("\n");
  vm.runInNewContext(declarations, runtime);

  assert.equal(await runtime.rollName(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.profileState())), {
    name: "Ayla",
    value: "Ayla",
    open: true,
    suggestions: ["Ayla", "Bryn", "Cora", "Dara", "Eryn"],
  });

  runtime.clickSuggestion(2);
  assert.equal(runtime.profileState().name, "Cora");
  assert.equal(runtime.profileState().value, "Cora");
  assert.equal(runtime.profileState().open, false);

  assert.equal(await runtime.rollName({ isReroll: true }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.profileState())), {
    name: "Cora",
    value: "Cora",
    open: true,
    suggestions: ["Fawn", "Galen", "Hali", "Iven", "Jora"],
  });

  now += 3000;
  assert.equal(await runtime.rollName({ isReroll: true }), false);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.profileState())), {
    name: "Cora",
    value: "Cora",
    open: true,
    suggestions: ["Fawn", "Galen", "Hali", "Iven", "Jora"],
  });
});

test("profile rolling uses five Sky API choices in a persistent Windows-style picker", async () => {
  const [source, home, css, dom] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
  ]);

  assert.match(source, /let gameStatsNameRollInFlight = false;/);
  assert.match(source, /let gameStatsNameRollId = 0;/);
  assert.match(source, /const GAME_STATS_NAME_ROLL_COOLDOWN_MS = 3000;/);
  assert.match(source, /const GAME_STATS_NAME_SUGGESTION_COUNT = 5;/);
  assert.match(source, /const fetchGameStatsNameSuggestions = async \(\) =>/);
  assert.match(source, /suggestions\.length !== GAME_STATS_NAME_SUGGESTION_COUNT/);
  assert.match(source, /let gameStatsDraftNameSuggestions = \[\];/);
  assert.match(source, /const getGameStatsNameRollCooldownSeconds = \(\) =>/);
  assert.match(source, /const startGameStatsNameRollCooldown = \(\) =>/);
  assert.match(source, /const rollGameStatsDraftName = async \(\{ isReroll = false \} = \{\}\) =>/);
  assert.match(source, /isReroll && getGameStatsNameRollCooldownSeconds\(\) > 0/);
  assert.match(source, /rollGameStatsDraftName\(\{ isReroll: true \}\)/);
  assert.match(source, /rollId !== gameStatsNameRollId/);
  assert.match(source, /const rolled = await rollGameStatsDraftName\(\{ isReroll: true \}\);/);
  assert.match(source, /if \(rolled && gameStatsDraftProfile\) gameStatsDraftProfile\.rerollCount \+= 1;/);
  assert.match(source, /gameProfileName\.value = gameStatsDraftProfile\.name;/);
  assert.match(source, /gameProfileName\.placeholder = gameStatsNameRollInFlight/);
  assert.match(source, /const setGameProfileNameSuggestionsVisible = \(visible\) =>/);
  assert.match(source, /const selectGameStatsDraftName = \(name\) =>/);
  assert.match(source, /const renderGameProfileNameSuggestions = \(\) =>/);
  assert.match(source, /gameStatsDraftProfile\.name = GAME_STATS_API_ERROR_NAME;/);
  assert.match(source, /gameProfileRerollCount\.textContent = `\$\{remaining\} left`;/);
  assert.doesNotMatch(source, /gameStatsNameRollError|Could not generate a name\. Try Reroll\./);
  assert.match(source, /if \(gameStatsDraftProfile\.name === GAME_STATS_API_ERROR_NAME\) \{[\s\S]*?getGameStatsProfileNameFromIcon\(icon\.filename\);/);
  assert.match(source, /updateGameProfileRerollState\(\);[\s\S]*?updateGameProfileIconOptionSelection\(button\);/);
  assert.doesNotMatch(source, /name: gameProfileName\?\.value/);
  assert.match(home, /<input[\s\S]*class="game-profile-generated-name"[\s\S]*id="game-profile-name"[\s\S]*readonly[\s\S]*role="combobox"/);
  assert.match(home, /id="game-profile-name-toggle"[\s\S]*aria-controls="game-profile-name-options"/);
  assert.match(home, /id="game-profile-name-options"[\s\S]*role="listbox"/);
  assert.match(home, /id="game-profile-reroll-label">Reroll</);
  assert.match(home, /src="assets\/app-icons\/ico\/charmap_w2k\.ico" alt=""/);
  assert.match(home, /id="game-profile-reroll-count" aria-live="polite">10 left</);
  assert.match(home, /href="https:\/\/perchance\.org\/sky-cotl-namegen"/);
  assert.match(home, /href="https:\/\/perchance\.org\/"[^>]*>Perchance<\//);
  assert.match(
    home,
    /<p class="game-profile-name-credit"(?:\s+[^>]*)?>\s*via\s*<a href="https:\/\/perchance\.org\/sky-cotl-namegen"/
  );
  assert.doesNotMatch(home, /Names via/);
  assert.doesNotMatch(home, /Sky-style names|fantasynamegenerators\.com|lukewh\.com/);
  assert.match(dom, /gameProfileNamePicker: byId\("game-profile-name-picker"\),/);
  assert.match(dom, /gameProfileNameToggle: byId\("game-profile-name-toggle"\),/);
  assert.match(dom, /gameProfileNameOptions: byId\("game-profile-name-options"\),/);
  assert.match(css, /\.game-profile-generated-name/);
  assert.match(css, /\.game-profile-generated-name[\s\S]*background: #fff;/);
  assert.match(css, /\.game-profile-generated-name[\s\S]*color: #000;/);
  assert.match(css, /\.game-profile-generated-name[\s\S]*var\(--border-field\)/);
  assert.match(css, /\.game-profile-generated-name[\s\S]*padding: 2px 25px 2px 4px;/);
  assert.match(css, /\.game-profile-name-toggle[\s\S]*position: absolute;/);
  assert.match(css, /\.game-profile-name-toggle[\s\S]*right: 1px;[\s\S]*top: 1px;/);
  assert.match(css, /\.game-profile-reroll \{/);
  assert.match(css, /inline-size: 86px;/);
  assert.match(css, /\.game-profile-reroll[\s\S]*justify-content: flex-start;/);
  assert.match(css, /\.game-profile-name-credit/);
  assert.match(css, /\.game-profile-name-options \{/);
  assert.match(css, /\.game-profile-name-option[\s\S]*box-shadow: none;/);
  assert.match(css, /\.game-profile-name-option:hover,[\s\S]*?background: #000080;[\s\S]*?color: #fff;/);
});

test("the profile icon gallery does not truncate the manifest", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");

  assert.doesNotMatch(source, /GAME_STATS_ICON_MANIFEST[\s\S]{0,220}\.slice\(0, 180\)/);
  assert.match(
    source,
    /const icons = GAME_STATS_ICON_MANIFEST\.filter\([\s\S]*?\n  \);\n  gameProfileIconGallery\.replaceChildren\(\);/
  );
});
