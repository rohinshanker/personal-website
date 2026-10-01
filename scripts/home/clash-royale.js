const CLASH_ENDPOINT_PATH = "/clash-royale";
const CLASH_PLAYER_TAG = "28CYYU08P";
const CLASH_REQUEST_TIMEOUT_MS = 10_000;
const CLASH_CACHE_TTL_SECONDS = 300;
const EMPTY_VALUE = "—";

const elements =
  typeof document === "undefined"
    ? {}
    : {
        app: document.getElementById("cr-app"),
        arena: document.getElementById("cr-arena"),
        battleCount: document.getElementById("cr-battle-count"),
        battleLog: document.getElementById("cr-battle-log"),
        bestTrophies: document.getElementById("cr-best-trophies"),
        careerRecord: document.getElementById("cr-career-record"),
        careerWinRate: document.getElementById("cr-career-win-rate"),
        clan: document.getElementById("cr-clan"),
        currentDeck: document.getElementById("cr-current-deck"),
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

const isFiniteNonnegative = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isParticipant = (value) =>
  Boolean(value && typeof value === "object" && normalizeClashTag(value.tag));

const findParticipant = (participants, playerTag) =>
  Array.isArray(participants)
    ? participants.find(
        (participant) =>
          isParticipant(participant) && normalizeClashTag(participant.tag) === playerTag
      )
    : undefined;

const findOpponent = (participants, playerTag) =>
  Array.isArray(participants)
    ? participants.find(
        (participant) =>
          isParticipant(participant) && normalizeClashTag(participant.tag) !== playerTag
      )
    : undefined;

export const resolveClashBattle = (battle, rawPlayerTag) => {
  if (!battle || typeof battle !== "object") return null;
  const playerTag = normalizeClashTag(rawPlayerTag);
  if (!playerTag) return null;

  const teamPlayer = findParticipant(battle.team, playerTag);
  const opponentPlayer = findParticipant(battle.opponent, playerTag);
  const player = teamPlayer ?? opponentPlayer;
  const opponent = teamPlayer
    ? findOpponent(battle.opponent, playerTag)
    : findOpponent(battle.team, playerTag);
  if (!player || !opponent) return null;

  const hasCrowns =
    isFiniteNonnegative(player.crowns) && isFiniteNonnegative(opponent.crowns);
  const outcome = !hasCrowns
    ? "unknown"
    : player.crowns > opponent.crowns
      ? "win"
      : player.crowns < opponent.crowns
        ? "loss"
        : "draw";

  return { battle, hasCrowns, opponent, outcome, player };
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
    .slice(0, 10);
  const currentDeck = payload.player.currentDeck.filter(
    (card) => card && typeof card === "object" && String(card.name ?? "").trim()
  );

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

const formatInteger = (value) =>
  isFiniteNonnegative(value) ? Math.trunc(value).toLocaleString() : EMPTY_VALUE;

const formatClan = (clan) => {
  if (!clan || typeof clan !== "object" || !String(clan.name ?? "").trim()) {
    return "No clan";
  }
  const tag = String(clan.tag ?? "").trim();
  return `${String(clan.name).trim()}${tag ? ` (${tag})` : ""}`;
};

const formatBattleTime = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "Time unavailable";
  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  const timestamp = compactMatch
    ? `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}T${compactMatch[4]}:${compactMatch[5]}:${compactMatch[6]}Z`
    : text;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
};

const formatMode = (battle) =>
  String(battle?.gameMode?.name ?? battle?.type ?? "Battle").trim() || "Battle";

const createElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const renderEmptyItem = (container, message) => {
  container.replaceChildren(createElement("li", "cr-empty", message));
};

const renderDeck = (cards) => {
  if (!elements.currentDeck) return;
  if (!cards.length) {
    renderEmptyItem(elements.currentDeck, "No current deck was returned.");
    return;
  }

  const items = cards.map((card) => {
    const item = createElement("li", "cr-deck-card");
    item.appendChild(createElement("span", "cr-deck-card-name", String(card.name).trim()));
    return item;
  });
  elements.currentDeck.replaceChildren(...items);
};

const renderBattles = (battles) => {
  if (!elements.battleLog) return;
  if (!battles.length) {
    renderEmptyItem(elements.battleLog, "No recent battles were returned.");
    return;
  }

  const items = battles.map(({ battle, hasCrowns, opponent, outcome, player }) => {
    const item = createElement("li", "cr-battle-item");
    const summary = createElement("div", "cr-battle-summary");
    const labels = { draw: "DRAW", loss: "LOSS", unknown: "N/A", win: "WIN" };
    summary.appendChild(createElement("span", `cr-result is-${outcome}`, labels[outcome]));
    summary.appendChild(createElement("span", "cr-battle-mode", formatMode(battle)));
    summary.appendChild(
      createElement(
        "span",
        "cr-battle-crowns",
        hasCrowns ? `${player.crowns}–${opponent.crowns} crowns` : "Crowns unavailable"
      )
    );
    summary.appendChild(
      createElement(
        "span",
        "cr-battle-trophies",
        typeof player.trophyChange === "number" && Number.isFinite(player.trophyChange)
          ? `${player.trophyChange > 0 ? "+" : ""}${player.trophyChange} trophies`
          : ""
      )
    );
    summary.appendChild(
      createElement(
        "span",
        "cr-battle-opponent",
        `vs. ${String(opponent.name ?? opponent.tag).trim() || "Unknown player"}`
      )
    );
    const time = createElement("time", "cr-battle-time", formatBattleTime(battle.battleTime));
    const parsedTime = new Date(battle.battleTime);
    if (!Number.isNaN(parsedTime.getTime())) time.dateTime = parsedTime.toISOString();
    summary.appendChild(time);
    item.appendChild(summary);
    return item;
  });
  elements.battleLog.replaceChildren(...items);
};

const renderPlayer = (snapshot) => {
  const { player } = snapshot;
  elements.playerName.textContent = String(player.name ?? "Unnamed player").trim() || "Unnamed player";
  elements.playerTag.textContent = `#${snapshot.playerTag}`;
  elements.trophies.textContent = formatInteger(player.trophies);
  elements.bestTrophies.textContent = formatInteger(player.bestTrophies);
  elements.arena.textContent = String(player.arena?.name ?? "Unavailable").trim() || "Unavailable";
  elements.clan.textContent = formatClan(player.clan);

  const hasWins = isFiniteNonnegative(player.wins);
  const hasLosses = isFiniteNonnegative(player.losses);
  elements.careerRecord.textContent =
    hasWins && hasLosses
      ? `${Math.trunc(player.wins).toLocaleString()}–${Math.trunc(player.losses).toLocaleString()}`
      : EMPTY_VALUE;
  const decidedBattles = hasWins && hasLosses ? player.wins + player.losses : 0;
  elements.careerWinRate.textContent =
    decidedBattles > 0 ? `${((player.wins / decidedBattles) * 100).toFixed(1)}%` : EMPTY_VALUE;
  elements.battleCount.textContent = formatInteger(player.battleCount);
  elements.threeCrownWins.textContent = formatInteger(player.threeCrownWins);
  elements.lastUpdated.textContent = snapshot.fetchedAt.toLocaleString();
  elements.lastUpdated.dateTime = snapshot.fetchedAt.toISOString();
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

if (typeof window !== "undefined") {
  window.ClashRoyaleApp = Object.freeze({ cancel, load });
}
