const CLASH_ENDPOINT_PATH = "/clash-royale";
const CLASH_PLAYER_TAG = "28CYYU08P";
const CLASH_REQUEST_TIMEOUT_MS = 10_000;
const CLASH_CACHE_TTL_SECONDS = 300;
const CLASH_MAX_CURRENT_DECK_CARDS = 8;
const CLASH_MAX_PARTICIPANT_DECK_CARDS = 16;
const CLASH_MAX_BATTLES = 20;
const CLASH_CARD_ASSET_HOSTNAME = "api-assets.clashroyale.com";
const CLASH_MIRROR_CARD_ID = "28000006";
const CLASH_CARD_RARITIES = Object.freeze(["common", "rare", "epic", "legendary", "champion"]);
const CLASH_CARD_VARIANTS = Object.freeze(["evo", "hero"]);
const EMPTY_VALUE = "—";
const CLASH_TROPHY_ICON = "assets/icon/trophy.svg";
const CLASH_CROWN_ICON = "assets/pixelarticons/crown.svg";
const CLASH_DIGIT_SOURCES = Object.freeze(
  Object.fromEntries(
    [..."0123456789-"].map((digit) => [
      digit,
      `assets/minesweeper_assets/digital_digits/digital_${digit === "-" ? "minus" : digit}.png`,
    ])
  )
);

const elements =
  typeof document === "undefined"
    ? {}
    : {
        app: document.getElementById("cr-app"),
        arena: document.getElementById("cr-arena"),
        battleCount: document.getElementById("cr-battle-count"),
        battleLog: document.getElementById("cr-battle-log"),
        battleScroll: document.getElementById("cr-battle-scroll"),
        bestTrophies: document.getElementById("cr-best-trophies"),
        careerRecord: document.getElementById("cr-career-record"),
        careerWinRate: document.getElementById("cr-career-win-rate"),
        clan: document.getElementById("cr-clan"),
        currentDeck: document.getElementById("cr-current-deck"),
        deckAverage: document.getElementById("cr-deck-average"),
        deckStyleInputs: [...document.querySelectorAll('input[name="cr-deck-style"]')],
        historyFooter: document.getElementById("cr-history-footer"),
        lastUpdated: document.getElementById("cr-last-updated"),
        playerName: document.getElementById("cr-player-name"),
        playerTag: document.getElementById("cr-player-tag"),
        refresh: document.getElementById("cr-refresh"),
        sampleSummary: document.getElementById("cr-sample-summary"),
        status: document.getElementById("cr-status"),
        threeCrownWins: document.getElementById("cr-three-crown-wins"),
        trophies: document.getElementById("cr-trophies"),
      };

let activeRequest = null;
let hasSnapshot = false;

export const normalizeClashTag = (tag) =>
  String(tag ?? "")
    .trim()
    .replace(/^#/, "")
    .toUpperCase();

export const normalizeClashCardIconUrl = (value) => {
  try {
    const url = new URL(String(value ?? "").trim());
    if (
      url.protocol !== "https:" ||
      url.hostname !== CLASH_CARD_ASSET_HOSTNAME ||
      url.username ||
      url.password ||
      !url.pathname.toLowerCase().endsWith(".png")
    ) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
};

export const normalizeClashCardRarity = (value) => {
  const rarity = String(value ?? "").trim().toLowerCase();
  return CLASH_CARD_RARITIES.includes(rarity) ? rarity : "";
};

export const normalizeClashCardVariant = (value) => {
  const variant = String(value ?? "").trim().toLowerCase();
  return CLASH_CARD_VARIANTS.includes(variant) ? variant : "";
};

export const isVariableClashElixirCard = (card) =>
  String(card?.id ?? "").trim() === CLASH_MIRROR_CARD_ID;

export const calculateAverageElixir = (cards) => {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  if (cards.some(isVariableClashElixirCard)) return null;
  const costs = cards.map((card) => card?.elixirCost);
  if (!costs.every(isValidElixirCost)) return null;
  return costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
};

const isFiniteNonnegative = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isValidElixirCost = (value) => isFiniteNonnegative(value) && Number.isInteger(value);

const isParticipant = (value) =>
  Boolean(value && typeof value === "object" && normalizeClashTag(value.tag));

const findParticipant = (participants, playerTag) =>
  Array.isArray(participants)
    ? participants.find(
        (participant) =>
          isParticipant(participant) && normalizeClashTag(participant.tag) === playerTag
      )
    : undefined;

export const resolveClashBattle = (battle, rawPlayerTag) => {
  if (!battle || typeof battle !== "object") return null;
  const playerTag = normalizeClashTag(rawPlayerTag);
  if (!playerTag) return null;

  const team = Array.isArray(battle.team) ? battle.team.filter(isParticipant) : [];
  const opponentTeam = Array.isArray(battle.opponent)
    ? battle.opponent.filter(isParticipant)
    : [];
  const teamPlayer = findParticipant(team, playerTag);
  const opponentPlayer = findParticipant(opponentTeam, playerTag);
  const player = teamPlayer ?? opponentPlayer;
  const playerSide = teamPlayer ? team : opponentTeam;
  const opponents = teamPlayer ? opponentTeam : team;
  const opponent = opponents[0];
  if (!player || !opponent) return null;
  const allies = playerSide.filter(
    (participant) => normalizeClashTag(participant.tag) !== playerTag
  );

  const hasCrowns =
    isFiniteNonnegative(player.crowns) && isFiniteNonnegative(opponent.crowns);
  const outcome = !hasCrowns
    ? "unknown"
    : player.crowns > opponent.crowns
      ? "win"
      : player.crowns < opponent.crowns
        ? "loss"
        : "draw";

  return { allies, battle, hasCrowns, opponent, opponents, outcome, player, playerSide };
};

export const prepareClashSnapshot = (payload) => {
  if (!payload || payload.ok !== true || !payload.player || typeof payload.player !== "object") {
    throw new TypeError("Invalid Clash Royale response");
  }
  const playerTag = normalizeClashTag(payload.player.tag);
  if (playerTag !== CLASH_PLAYER_TAG) throw new TypeError("Invalid Clash Royale player tag");
  if (
    typeof payload.fetchedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      payload.fetchedAt.trim()
    )
  ) {
    throw new TypeError("Invalid Clash Royale fetch timestamp");
  }
  const fetchedAt = new Date(payload.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime())) {
    throw new TypeError("Invalid Clash Royale fetch timestamp");
  }

  if (!Array.isArray(payload.battles) || !Array.isArray(payload.player.currentDeck)) {
    throw new TypeError("Invalid Clash Royale collections");
  }
  if (payload.cacheTtlSeconds !== CLASH_CACHE_TTL_SECONDS) {
    throw new TypeError("Invalid Clash Royale cache lifetime");
  }
  const battles = payload.battles
    .map((battle) => resolveClashBattle(battle, playerTag))
    .filter(Boolean)
    .slice(0, CLASH_MAX_BATTLES);
  const currentDeck = payload.player.currentDeck.filter(
    (card) => card && typeof card === "object" && String(card.name ?? "").trim()
  ).slice(0, CLASH_MAX_CURRENT_DECK_CARDS);

  return {
    battles,
    currentDeck,
    fetchedAt,
    player: payload.player,
    playerTag,
  };
};

export const summarizeClashBattles = (battles) => {
  const resolved = Array.isArray(battles) ? battles : [];
  const known = resolved.filter((battle) => battle.hasCrowns);
  const wins = known.filter((battle) => battle.outcome === "win").length;
  const losses = known.filter((battle) => battle.outcome === "loss").length;
  const draws = known.filter((battle) => battle.outcome === "draw").length;
  const crownDifference = known.reduce(
    (total, battle) => total + battle.player.crowns - battle.opponent.crowns,
    0
  );
  return { crownDifference, draws, known: known.length, losses, total: resolved.length, wins };
};

const normalizeBackendBaseUrl = (rawConfig) => {
  const rawUrl = String(rawConfig?.apiBaseUrl ?? "").trim();
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
      return "";
    }
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const formatClan = (clan) => {
  if (!clan || typeof clan !== "object" || !String(clan.name ?? "").trim()) {
    return "No clan";
  }
  const tag = String(clan.tag ?? "").trim();
  return `${String(clan.name).trim()}${tag ? ` (${tag})` : ""}`;
};

export const parseClashBattleTime = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d{1,3})?Z$/);
  const timestamp = compactMatch
    ? `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}T${compactMatch[4]}:${compactMatch[5]}:${compactMatch[6]}${compactMatch[7] ?? ""}Z`
    : text;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatMode = (battle) =>
  String(battle?.gameMode?.name ?? battle?.type ?? "Battle").trim() || "Battle";

const CLASH_MODE_BY_ID = new Map([
  [72000007, Object.freeze({ key: "friendly", label: "Friendly" })],
  [72000014, Object.freeze({ key: "two-v-two", label: "2v2" })],
  [72000023, Object.freeze({ key: "two-v-two", label: "2v2" })],
  [72000098, Object.freeze({ key: "clan-war", label: "Clan War" })],
  [72000101, Object.freeze({ key: "clan-war", label: "Clan War" })],
  [72000102, Object.freeze({ key: "clan-war", label: "Clan War" })],
  [72000266, Object.freeze({ key: "clan-war", label: "Clan War" })],
]);

export const classifyClashBattleMode = (battle) => {
  const type = String(battle?.type ?? "").trim();
  if (type === "pathOfLegend") {
    return Object.freeze({ key: "ranked", label: "Ranked" });
  }
  if (type === "challenge") {
    return Object.freeze({ key: "challenge", label: "Challenge" });
  }
  if (type === "PvP" && battle?.gameMode?.id === 72000006) {
    return Object.freeze({ key: "ladder", label: "Ladder" });
  }
  const mode = CLASH_MODE_BY_ID.get(battle?.gameMode?.id);
  if (mode) return mode;
  return Object.freeze({ key: "other", label: "Other" });
};

const createElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const createDecorativeIcon = (source, className) => {
  const image = document.createElement("img");
  image.className = className;
  image.src = source;
  image.alt = "";
  return image;
};

const createDigitValue = (value, accessibleText, minimumLength = 1) => {
  const wrapper = createElement("span", "cr-digit-value");
  const numericText = String(value);
  const digits = numericText.padStart(minimumLength, " ");
  const strip = createElement("span", "game-stats-digit-strip cr-digit-strip");
  strip.setAttribute("aria-hidden", "true");
  [...digits].forEach((digit) => {
    if (digit === " ") {
      const spacer = createElement("span", "cr-digit-space");
      strip.appendChild(spacer);
      return;
    }
    const source = CLASH_DIGIT_SOURCES[digit];
    if (!source) return;
    strip.appendChild(createDecorativeIcon(source, "cr-digit-image"));
  });
  wrapper.appendChild(strip);
  wrapper.appendChild(createElement("span", "visually-hidden", accessibleText));
  return wrapper;
};

const renderDigitValue = (container, value, minimumLength) => {
  if (!isFiniteNonnegative(value)) {
    container.textContent = EMPTY_VALUE;
    return;
  }
  const integer = Math.trunc(value);
  container.replaceChildren(
    createDigitValue(String(integer), integer.toLocaleString(), minimumLength)
  );
};

const createBattleMetric = ({ accessibleText, icon, sign = "", value, minimumLength = 1 }) => {
  const metric = createElement("span", "cr-battle-metric");
  metric.appendChild(createDecorativeIcon(icon, "cr-battle-metric-icon"));
  if (sign) {
    const signElement = createElement("span", "cr-battle-metric-sign", sign);
    signElement.setAttribute("aria-hidden", "true");
    metric.appendChild(signElement);
  }
  metric.appendChild(createDigitValue(value, accessibleText, minimumLength));
  return metric;
};

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const handleCardImageError = (image, item) => {
  const fallbackUrl = image.dataset.fallbackSrc;
  if (fallbackUrl) {
    delete image.dataset.fallbackSrc;
    image.src = fallbackUrl;
    return;
  }
  image.remove();
  item.classList.add("is-image-unavailable");
};

const createCardItem = (card, { compact = false, deferImage = false } = {}) => {
  const cardName = String(card?.name ?? "").trim() || "Unnamed card";
  const rarity = normalizeClashCardRarity(card?.rarity);
  const variant = normalizeClashCardVariant(card?.variant);
  const regularIconUrl = normalizeClashCardIconUrl(card?.iconUrl);
  const variantIconUrl = variant
    ? normalizeClashCardIconUrl(card?.variantIconUrl)
    : "";
  const item = createElement(
    "li",
    [
      "cr-deck-card",
      compact ? "cr-deck-card--compact" : "",
      `is-rarity-${rarity || "unknown"}`,
      variant ? `is-variant-${variant}` : "",
    ]
      .filter(Boolean)
      .join(" ")
  );
  const media = createElement("span", "cr-deck-card-media");
  const imageUrl = variantIconUrl || regularIconUrl;
  if (imageUrl) {
    const image = document.createElement("img");
    image.className = "cr-deck-card-image";
    image.alt = "";
    image.width = compact ? 36 : 72;
    image.height = compact ? 44 : 88;
    image.decoding = "async";
    if (variantIconUrl && regularIconUrl && variantIconUrl !== regularIconUrl) {
      image.dataset.fallbackSrc = regularIconUrl;
    }
    if (deferImage) {
      image.dataset.crCardSrc = imageUrl;
    } else {
      image.src = imageUrl;
    }
    image.addEventListener("error", () => handleCardImageError(image, item));
    media.appendChild(image);
  } else {
    item.classList.add("is-image-unavailable");
  }

  if (variant && compact) {
    media.appendChild(
      createElement(
        "span",
        `cr-card-variant cr-card-variant--${variant}`,
        variant.toUpperCase()
      )
    );
  }
  const name = createElement("span", "cr-deck-card-name", cardName);
  name.title = cardName;
  const title = createElement("span", "cr-deck-card-title");
  title.appendChild(name);
  if (variant && !compact) {
    title.appendChild(
      createElement(
        "span",
        `cr-card-variant cr-card-variant--inline cr-card-variant--${variant}`,
        variant.toUpperCase()
      )
    );
  }
  const metadata = createElement("span", "cr-card-metadata");
  const hasElixir = isValidElixirCost(card?.elixirCost);
  const isVariableElixir = isVariableClashElixirCard(card);
  metadata.appendChild(
    createElement(
      "span",
      "cr-card-elixir",
      isVariableElixir
        ? "+1 variable elixir"
        : hasElixir
          ? `${card.elixirCost} elixir`
          : "Elixir unavailable"
    )
  );
  metadata.appendChild(
    createElement(
      "span",
      "visually-hidden cr-card-rarity",
      rarity ? capitalize(rarity) : "Rarity unavailable"
    )
  );
  item.append(title, media, metadata);
  return item;
};

const hydrateDeferredCardImages = (container) => {
  container.querySelectorAll("img[data-cr-card-src]").forEach((image) => {
    image.src = image.dataset.crCardSrc;
    delete image.dataset.crCardSrc;
  });
};

const renderEmptyItem = (container, message) => {
  container.replaceChildren(createElement("li", "cr-empty", message));
};

const renderDeck = (cards) => {
  if (!elements.currentDeck) return;
  if (!cards.length) {
    renderEmptyItem(elements.currentDeck, "No current deck was returned.");
    if (elements.deckAverage) elements.deckAverage.textContent = "Average elixir: unavailable";
    return;
  }
  const items = cards.map((card) => createCardItem(card));
  elements.currentDeck.replaceChildren(...items);
  const averageElixir = calculateAverageElixir(cards);
  if (elements.deckAverage) {
    elements.deckAverage.textContent = averageElixir === null
      ? "Average elixir: unavailable"
      : `Average elixir: ${averageElixir.toFixed(1)}`;
  }
};

const participantName = (participant) =>
  String(participant?.name ?? participant?.tag ?? "Unknown player").trim() || "Unknown player";

const createParticipantDecks = ({ opponents, playerSide }) => {
  const groups = [
    { label: "Your team", participants: playerSide },
    { label: "Opponents", participants: opponents },
  ]
    .map((group) => ({
      ...group,
      participants: group.participants.filter(
        (participant) =>
          Array.isArray(participant.cards) &&
          participant.cards.some((card) => String(card?.name ?? "").trim())
      ),
    }))
    .filter((group) => group.participants.length);
  if (!groups.length) return null;

  const disclosure = createElement("details", "cr-battle-disclosure");
  disclosure.appendChild(createElement("summary", "cr-battle-disclosure-summary", "View participant decks"));
  const content = createElement("div", "cr-battle-decks");
  groups.forEach((group) => {
    const side = createElement("section", "cr-battle-side");
    side.appendChild(createElement("h3", "cr-battle-side-title", group.label));
    group.participants.forEach((participant) => {
      const participantDeck = createElement("div", "cr-participant-deck-group");
      participantDeck.appendChild(
        createElement("h4", "cr-participant-name", participantName(participant))
      );
      const cards = createElement("ul", "cr-participant-deck");
      cards.append(
        ...participant.cards
          .filter((card) => String(card?.name ?? "").trim())
          .slice(0, CLASH_MAX_PARTICIPANT_DECK_CARDS)
          .map((card) => createCardItem(card, { compact: true, deferImage: true }))
      );
      participantDeck.appendChild(cards);
      side.appendChild(participantDeck);
    });
    content.appendChild(side);
  });
  disclosure.appendChild(content);
  disclosure.addEventListener("toggle", () => {
    if (disclosure.open) hydrateDeferredCardImages(disclosure);
  });
  return disclosure;
};

const createBattleTime = (value) => {
  const parsedTime = parseClashBattleTime(value);
  const time = createElement("time", "cr-battle-time");
  if (!parsedTime) {
    time.textContent = "Time unavailable";
    return time;
  }
  time.dateTime = parsedTime.toISOString();
  time.append(
    createElement("span", "cr-battle-date", parsedTime.toLocaleDateString()),
    createElement(
      "span",
      "cr-battle-clock",
      parsedTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    )
  );
  return time;
};

const renderBattles = (battles) => {
  if (!elements.battleLog) return;
  if (!battles.length) {
    renderEmptyItem(elements.battleLog, "No recent battles were returned.");
    if (elements.battleScroll) elements.battleScroll.scrollTop = 0;
    return;
  }

  const items = battles.map((resolvedBattle) => {
    const { battle, hasCrowns, opponent, opponents, outcome, player, playerSide } = resolvedBattle;
    const item = createElement("li", `cr-battle-item is-${outcome}`);
    item.dataset.outcome = outcome;
    const summary = createElement("div", "cr-battle-summary");
    const labels = { draw: "DRAW", loss: "LOSS", unknown: "N/A", win: "WIN" };
    summary.appendChild(createElement("span", `cr-result is-${outcome}`, labels[outcome]));
    const details = createElement("span", "cr-battle-details");
    const mode = classifyClashBattleMode(battle);
    const modeBadge = createElement(
      "span",
      `cr-battle-mode is-${mode.key}`,
      mode.label
    );
    const rawModeName = String(battle?.gameMode?.name ?? "").trim();
    modeBadge.title = formatMode(battle);
    if (mode.key === "other" && rawModeName) {
      modeBadge.tabIndex = 0;
      modeBadge.setAttribute("aria-label", `Other mode: ${rawModeName}`);
      modeBadge.appendChild(createElement("span", "cr-mode-hint", rawModeName));
    }
    details.appendChild(modeBadge);
    details.appendChild(
      createElement(
        "strong",
        "cr-battle-opponent",
        `${playerSide.map(participantName).join(" & ")} vs. ${opponents.map(participantName).join(" & ")}`
      )
    );
    details.appendChild(createBattleTime(battle.battleTime));
    summary.appendChild(details);

    const metrics = createElement("span", "cr-battle-metrics");
    if (hasCrowns) {
      const playerCrowns = Math.trunc(player.crowns);
      const opponentCrowns = Math.trunc(opponent.crowns);
      metrics.appendChild(
        createBattleMetric({
          accessibleText: `${playerCrowns} to ${opponentCrowns} crowns`,
          icon: CLASH_CROWN_ICON,
          value: `${playerCrowns}-${opponentCrowns}`,
          minimumLength: 3,
        })
      );
    } else {
      metrics.appendChild(
        createElement(
          "span",
          "cr-battle-metric cr-battle-metric--unknown",
          "Crowns unavailable"
        )
      );
    }

    if (typeof player.trophyChange === "number" && Number.isFinite(player.trophyChange)) {
      const trophyChange = Math.trunc(player.trophyChange);
      metrics.appendChild(
        createBattleMetric({
          accessibleText: `${trophyChange > 0 ? "+" : ""}${trophyChange} trophies`,
          icon: CLASH_TROPHY_ICON,
          sign: trophyChange > 0 ? "+" : "",
          value: String(trophyChange),
          minimumLength: 2,
        })
      );
    }
    summary.appendChild(metrics);
    item.appendChild(summary);
    const participantDecks = createParticipantDecks(resolvedBattle);
    if (participantDecks) item.appendChild(participantDecks);
    return item;
  });
  elements.battleLog.replaceChildren(...items);
  if (elements.battleScroll) elements.battleScroll.scrollTop = 0;
};

const renderPlayer = (snapshot) => {
  const { player } = snapshot;
  elements.playerName.textContent = String(player.name ?? "Unnamed player").trim() || "Unnamed player";
  elements.playerTag.textContent = `#${snapshot.playerTag}`;
  renderDigitValue(elements.trophies, player.trophies, 4);
  renderDigitValue(elements.bestTrophies, player.bestTrophies, 4);
  elements.arena.textContent = String(player.arena?.name ?? "Unavailable").trim() || "Unavailable";
  elements.clan.textContent = formatClan(player.clan);

  const hasWins = isFiniteNonnegative(player.wins);
  const hasLosses = isFiniteNonnegative(player.losses);
  if (hasWins && hasLosses) {
    elements.careerRecord.replaceChildren(
      createElement(
        "span",
        "cr-career-wins",
        `${Math.trunc(player.wins).toLocaleString()} wins`
      ),
      createElement("span", "cr-career-separator", " · "),
      createElement(
        "span",
        "cr-career-losses",
        `${Math.trunc(player.losses).toLocaleString()} losses`
      )
    );
  } else {
    elements.careerRecord.textContent = EMPTY_VALUE;
  }
  const decidedBattles = hasWins && hasLosses ? player.wins + player.losses : 0;
  elements.careerWinRate.textContent =
    decidedBattles > 0 ? `${((player.wins / decidedBattles) * 100).toFixed(1)}%` : EMPTY_VALUE;
  renderDigitValue(elements.battleCount, player.battleCount, 4);
  renderDigitValue(elements.threeCrownWins, player.threeCrownWins, 3);
  elements.lastUpdated.textContent = snapshot.fetchedAt.toLocaleString();
  elements.lastUpdated.dateTime = snapshot.fetchedAt.toISOString();
};

const renderHistoryFooter = (battleCount) => {
  if (!elements.historyFooter) return;
  const prefix = battleCount === CLASH_MAX_BATTLES
    ? `Most recent ${CLASH_MAX_BATTLES} battles loaded. View `
    : battleCount > 0
      ? `Most recent ${battleCount} battle${battleCount === 1 ? "" : "s"} loaded. View `
      : "No recent battles loaded. View ";
  const link = createElement("a", "", "Royale API");
  link.href = "https://royaleapi.com/player/28CYYU08P";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  elements.historyFooter.replaceChildren(prefix, link, " for full list.");
};

const renderSampleSummary = (battles) => {
  const summary = summarizeClashBattles(battles);
  if (summary.total === 0) {
    elements.sampleSummary.textContent = "No usable battles";
    return;
  }
  if (summary.known === 0) {
    elements.sampleSummary.textContent = `${summary.total} battle${summary.total === 1 ? "" : "s"}; results unavailable`;
    return;
  }
  elements.sampleSummary.textContent =
    `${summary.wins}W–${summary.losses}L–${summary.draws}D · ` +
    `${summary.crownDifference > 0 ? "+" : ""}${summary.crownDifference} crowns`;
};

const renderSnapshot = (snapshot) => {
  renderPlayer(snapshot);
  renderDeck(snapshot.currentDeck);
  renderBattles(snapshot.battles);
  renderSampleSummary(snapshot.battles);
  renderHistoryFooter(snapshot.battles.length);
};

const setStatus = (message, state = "idle") => {
  if (!elements.status) return;
  elements.status.textContent = message;
  elements.status.dataset.state = state;
};

const setLoading = (loading) => {
  if (elements.app) elements.app.setAttribute("aria-busy", String(loading));
  if (!elements.refresh) return;
  elements.refresh.disabled = loading;
  elements.refresh.textContent = loading ? "Refreshing…" : "Refresh";
};

const errorMessageFor = (status, payload) => {
  if (status === 429) {
    const retryAfterMs = Number(payload?.retryAfterMs);
    const retryText = Number.isFinite(retryAfterMs) && retryAfterMs > 0
      ? ` Try again in ${Math.max(1, Math.ceil(retryAfterMs / 1000))} seconds.`
      : " Try again shortly.";
    return `Too many refreshes.${retryText}`;
  }
  if (status === 503) return "Player data is temporarily unavailable. Try again later.";
  if (status === 504) return "The player data request timed out. Try again.";
  if (status === 502) return "Clash Royale returned an error. Try again later.";
  return "Player data could not be loaded. Try again.";
};

const readResponseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const requestSnapshot = async (controller) => {
  const baseUrl = normalizeBackendBaseUrl(window.rohinGameStatsBackend);
  if (!baseUrl) {
    const error = new Error("Backend unavailable");
    error.userMessage = "Player data is temporarily unavailable. Try again later.";
    throw error;
  }

  const timeout = window.setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, CLASH_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${CLASH_ENDPOINT_PATH}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await readResponseJson(response);
    if (!response.ok || payload?.ok !== true) {
      const error = new Error("Clash Royale endpoint failed");
      error.userMessage = errorMessageFor(response.status, payload);
      throw error;
    }
    return prepareClashSnapshot(payload);
  } catch (error) {
    if (controller.signal.reason?.name === "TimeoutError") {
      const timeoutError = new Error("Clash Royale request timed out");
      timeoutError.userMessage = "The player data request timed out. Try again.";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

const load = (force = false) => {
  if (activeRequest) return activeRequest.promise;
  if (hasSnapshot && !force) return Promise.resolve();

  setLoading(true);
  setStatus(hasSnapshot ? "Refreshing player data…" : "Loading player data…", "loading");
  const request = { controller: new AbortController(), promise: null };
  request.promise = requestSnapshot(request.controller)
    .then((snapshot) => {
      if (activeRequest !== request) return;
      renderSnapshot(snapshot);
      hasSnapshot = true;
      const battleCount = snapshot.battles.length;
      setStatus(
        battleCount
          ? `Player data loaded with ${battleCount} recent battle${battleCount === 1 ? "" : "s"}.`
          : "Player data loaded. No recent battles were returned.",
        "success"
      );
    })
    .catch((error) => {
      if (activeRequest !== request) return;
      if (error?.name === "AbortError") return;
      setStatus(error?.userMessage ?? "Player data could not be loaded. Try again.", "error");
    })
    .finally(() => {
      if (activeRequest !== request) return;
      activeRequest = null;
      setLoading(false);
    });
  activeRequest = request;
  return request.promise;
};

const cancel = () => {
  const request = activeRequest;
  activeRequest = null;
  request?.controller.abort(new DOMException("Window closed", "AbortError"));
  setStatus(hasSnapshot ? "Showing the last loaded player data." : "Refresh cancelled.");
  setLoading(false);
};

if (elements.refresh) {
  elements.refresh.addEventListener("click", () => load(true));
}

elements.deckStyleInputs?.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked || !elements.currentDeck) return;
    elements.currentDeck.classList.toggle("is-raised", input.value === "raised");
  });
});

if (typeof window !== "undefined") {
  window.ClashRoyaleApp = Object.freeze({ cancel, load });
  if (document.getElementById("clash-royale-window")?.getAttribute("aria-hidden") === "false") {
    load(false);
  }
}
