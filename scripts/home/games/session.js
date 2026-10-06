(() => {
const window = globalThis.window || globalThis;
const {
  RESULT_PROTOCOL, RULES_VERSION, REPLAY_VERSION, GENERATOR_VERSION,
  GAME_RULE_LIMITS, GameRuleError, assertInteger, canonicalJson, cloneState,
} = window.homeGameRules;

const replayHash = async (inputs) => {
  const bytes = new TextEncoder().encode(canonicalJson(inputs));
  const digest = await (window.crypto || globalThis.crypto).subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const normalizeIssuedTiming = (timing) => {
  if (!timing || !["ready", "running", "paused", "finished"].includes(timing.phase)) {
    throw new GameRuleError("invalid-response", "Invalid game timing acknowledgment");
  }
  return {
    revision: assertInteger(timing.revision, 0, 1_000_000, "timing revision"),
    phase: timing.phase,
    elapsedMs: assertInteger(timing.elapsedMs, 0, 6 * 60 * 60 * 1000, "elapsed time"),
  };
};

const normalizeIssuedGame = (raw, game, config) => {
  const descriptor = cloneState(raw);
  if (
    !descriptor || descriptor.game !== game ||
    !/^[a-z0-9-]{8,80}$/.test(descriptor.id || "") ||
    descriptor.gameId !== descriptor.id ||
    typeof descriptor.token !== "string" || !descriptor.token ||
    descriptor.resultProtocol !== RESULT_PROTOCOL ||
    descriptor.rulesVersion !== RULES_VERSION ||
    descriptor.replayVersion !== REPLAY_VERSION ||
    descriptor.generatorVersion !== GENERATOR_VERSION ||
    !/^[a-f0-9]{64}$/.test(descriptor.initialCommitment || "") ||
    !Number.isFinite(Date.parse(descriptor.expiresAt)) ||
    canonicalJson(descriptor.config) !== canonicalJson(config) ||
    !descriptor.initial || typeof descriptor.initial !== "object"
  ) {
    throw new GameRuleError("invalid-response", "Invalid server-issued game");
  }
  descriptor.timing = normalizeIssuedTiming(descriptor.timing);
  const limits = descriptor.limits || {};
  descriptor.limits = {
    inputs: assertInteger(limits.inputs, 1, GAME_RULE_LIMITS[game].inputs, "input limit"),
    work: assertInteger(limits.work, 1, GAME_RULE_LIMITS[game].work, "work limit"),
    ticks: assertInteger(limits.ticks, 0, GAME_RULE_LIMITS[game].ticks, "tick limit"),
    bytes: assertInteger(limits.bytes, 1, GAME_RULE_LIMITS[game].bytes, "body limit"),
    continuations: limits.continuations === undefined ? 8192 :
      assertInteger(limits.continuations, 1, 8192, "continuation limit"),
  };
  return descriptor;
};

/**
 * One controller's issued game. Explicit request injection keeps authentication,
 * HTTP errors and local recording with Game Stats; this owner keeps the replay.
 */
const createGameSession = ({ game, getState, request, buildVersion, reportFailure }) => {
  if (!GAME_RULE_LIMITS[game] || typeof getState !== "function" || typeof request !== "function") {
    throw new TypeError("Game sessions require a game, state getter and request adapter");
  }
  let current = null;
  let sequence = 0;

  const active = (entry) => current === entry && getState()?.statsSession === entry.key;
  const proof = (entry) => ({ id: entry.descriptor.id, token: entry.descriptor.token });
  const expired = (entry) => Date.parse(entry.descriptor.expiresAt) <= Date.now();
  const fail = (entry, error) => {
    entry.eligible = false;
    entry.error = error;
    if (active(entry)) reportFailure?.(error);
  };
  const detach = () => {
    if (current) current.controller.abort();
    current = null;
    const state = getState();
    if (state) state.statsSession = "";
  };
  const makeEntry = () => {
    const state = getState();
    if (!state || typeof state !== "object") throw new TypeError("Game state is unavailable");
    const entry = {
      key: `${game}-issued-${++sequence}`,
      descriptor: null, inputs: [], bufferedInputs: [], eligible: true,
      controller: new AbortController(), pending: null, timingQueue: Promise.resolve(),
      error: null, claimed: false,
    };
    current = entry;
    state.statsSession = entry.key;
    return entry;
  };
  const append = (entry, action) => {
    const maximum = entry.descriptor.limits.inputs;
    if (entry.inputs.length >= maximum) {
      fail(entry, new GameRuleError("replay-limit", "Game replay input limit exceeded"));
      return false;
    }
    entry.inputs.push({ ...action, seq: entry.inputs.length + 1 });
    return true;
  };

  const issueGame = async (config, { firstCell } = {}) => {
    detach();
    const entry = makeEntry();
    const normalizedConfig = cloneState(config);
    entry.pending = (async () => {
      try {
        const payload = {
          game, config: normalizedConfig, buildVersion, resultProtocol: RESULT_PROTOCOL,
          rulesVersion: RULES_VERSION, replayVersion: REPLAY_VERSION,
          generatorVersion: GENERATOR_VERSION,
          ...(firstCell === undefined ? {} : { firstCell }),
        };
        const response = await request("/sessions", payload, { signal: entry.controller.signal });
        if (!active(entry)) return null;
        const descriptor = normalizeIssuedGame(response, game, normalizedConfig);
        if (await replayHash(descriptor.initial) !== descriptor.initialCommitment) {
          throw new GameRuleError("invalid-response", "Issued game commitment does not match");
        }
        if (!active(entry)) return null;
        if (expired({ descriptor })) throw new GameRuleError("session-expired", "Game session expired");
        entry.descriptor = descriptor;
        return cloneState({ ...descriptor, sessionKey: entry.key });
      } catch (error) {
        if (active(entry)) fail(entry, error);
        return null;
      }
    })();
    return entry.pending;
  };

  const recordInput = (action) => {
    const entry = current;
    if (!entry || !active(entry) || !entry.eligible || !entry.descriptor) return false;
    const input = cloneState(action);
    if (!input || Array.isArray(input) || typeof input.op !== "string" || "seq" in input) {
      throw new GameRuleError("invalid-input", "Replay actions require an operation without a sequence");
    }
    if (entry.descriptor.timing.phase !== "running") {
      if (entry.inputs.length + entry.bufferedInputs.length >= entry.descriptor.limits.inputs) {
        fail(entry, new GameRuleError("replay-limit", "Game replay input limit exceeded"));
        return false;
      }
      entry.bufferedInputs.push(input);
      return true;
    }
    return append(entry, input);
  };

  const changeTiming = (operation) => {
    const entry = current;
    if (!entry || !active(entry) || !entry.eligible) return Promise.resolve(null);
    entry.timingQueue = entry.timingQueue.then(async () => {
      await entry.pending;
      if (!entry.descriptor || !entry.eligible || (!active(entry) && !entry.claimed)) return null;
      try {
        if (expired(entry)) throw new GameRuleError("session-expired", "Game session expired");
        const timing = entry.descriptor.timing;
        if ((operation === "pause" && timing.phase !== "running") ||
            (operation === "resume" && timing.phase === "running")) return cloneState(timing);
        const response = await request(`/sessions/${entry.descriptor.id}/timing`, {
          session: proof(entry), operation, expectedRevision: timing.revision,
          inputCount: entry.inputs.length, inputHash: await replayHash(entry.inputs),
        }, { signal: entry.controller.signal, keepalive: operation === "pause" });
        const next = normalizeIssuedTiming(response.timing);
        if (next.revision <= timing.revision || next.phase !== (operation === "pause" ? "paused" : "running")) {
          throw new GameRuleError("invalid-response", "Game timing acknowledgment is out of order");
        }
        entry.descriptor.timing = next;
        if (operation === "resume") {
          for (const input of entry.bufferedInputs.splice(0)) if (!append(entry, input)) break;
        }
        return cloneState(next);
      } catch (error) {
        fail(entry, error);
        return null;
      }
    });
    return entry.timingQueue;
  };

  const exportGame = () => {
    if (!current?.descriptor || !active(current) || !current.eligible) return null;
    return cloneState({
      descriptor: current.descriptor, inputs: current.inputs,
      bufferedInputs: current.bufferedInputs, eligible: current.eligible,
    });
  };

  const restoreGame = async (saved) => {
    detach();
    if (saved?.eligible !== true || !saved.descriptor || !Array.isArray(saved.inputs)) return null;
    const entry = makeEntry();
    entry.pending = (async () => {
      try {
        const candidate = normalizeIssuedGame(saved.descriptor, game, saved.descriptor.config);
        if (saved.inputs.length > candidate.limits.inputs || expired({ descriptor: candidate })) {
          throw new GameRuleError("session-expired", "Saved game is no longer eligible");
        }
        const inputs = cloneState(saved.inputs);
        inputs.forEach((input, index) => {
          if (input.seq !== index + 1 || typeof input.op !== "string") {
            throw new GameRuleError("invalid-input", "Saved replay is out of order");
          }
        });
        const response = await request(`/sessions/${candidate.id}/restore`, {
          session: { id: candidate.id, token: candidate.token },
          inputCount: inputs.length, inputHash: await replayHash(inputs),
        }, { signal: entry.controller.signal });
        if (!active(entry)) return null;
        const descriptor = normalizeIssuedGame(response, game, candidate.config);
        if (descriptor.id !== candidate.id || descriptor.token !== candidate.token ||
            descriptor.expiresAt !== candidate.expiresAt ||
            descriptor.initialCommitment !== candidate.initialCommitment ||
            await replayHash(descriptor.initial) !== descriptor.initialCommitment ||
            !["ready", "paused"].includes(descriptor.timing.phase)) {
          throw new GameRuleError("invalid-response", "Saved game timing cannot be restored");
        }
        entry.descriptor = descriptor;
        entry.inputs = inputs;
        const bufferedInputs = saved.bufferedInputs || [];
        if (!Array.isArray(bufferedInputs) || bufferedInputs.some((input) =>
          !input || Array.isArray(input) || typeof input.op !== "string" || "seq" in input
        )) throw new GameRuleError("invalid-input", "Saved buffered inputs are invalid");
        entry.bufferedInputs = cloneState(bufferedInputs);
        if (entry.inputs.length + entry.bufferedInputs.length > descriptor.limits.inputs) {
          throw new GameRuleError("replay-limit", "Saved replay input limit exceeded");
        }
        return cloneState({ ...descriptor, inputs, sessionKey: entry.key });
      } catch (error) {
        if (active(entry)) fail(entry, error);
        return null;
      }
    })();
    return entry.pending;
  };

  /** Removes ownership immediately; resets cannot abort the claimed finish. */
  const claimCompletion = () => {
    const entry = current;
    if (!entry || !active(entry)) return null;
    current = null;
    entry.claimed = true;
    getState().statsSession = "";
    let finishPromise = null;
    let finishIdentity = null;
    return Object.freeze({
      descriptor: entry.descriptor ? cloneState(entry.descriptor) : null,
      finish(eventId, { terminalTick } = {}) {
        const identity = canonicalJson({ eventId, ...(terminalTick === undefined ? {} : { terminalTick }) });
        if (finishPromise) {
          if (identity !== finishIdentity) {
            throw new GameRuleError("completion-conflict", "A claimed game cannot record a different result");
          }
          return finishPromise;
        }
        finishIdentity = identity;
        finishPromise = (async () => {
          await entry.pending;
          await entry.timingQueue;
          if (!entry.descriptor || !entry.eligible || entry.error) {
            throw entry.error || new GameRuleError("session-unavailable", "No issued game is available");
          }
          if (expired(entry)) throw new GameRuleError("session-expired", "Game session expired");
          if (entry.descriptor.timing.phase !== "running" || entry.bufferedInputs.length) {
            throw new GameRuleError("timing-unavailable", "Game timing was not acknowledged");
          }
          const payload = {
            eventId, session: proof(entry), gameId: entry.descriptor.gameId,
            rulesVersion: RULES_VERSION, replayVersion: REPLAY_VERSION,
            inputs: cloneState(entry.inputs), timingRevision: entry.descriptor.timing.revision,
            ...(terminalTick === undefined ? {} : { terminalTick }),
          };
          if (new TextEncoder().encode(canonicalJson(payload)).byteLength > entry.descriptor.limits.bytes) {
            throw new GameRuleError("replay-limit", "Game replay body limit exceeded");
          }
          let response = await request(`/sessions/${entry.descriptor.id}/finish`, payload);
          let continuations = 0;
          while (response.progress) {
            const progress = response.progress;
            if (!/^[a-z0-9-]{8,80}$/.test(progress.id || "") ||
                typeof progress.token !== "string" || !progress.token ||
                progress.token.length > 2048) {
              throw new GameRuleError("invalid-response", "Invalid verification progress receipt");
            }
            if (++continuations > entry.descriptor.limits.continuations) {
              throw new GameRuleError("replay-limit", "Game verification continuation limit exceeded");
            }
            response = await request(`/sessions/${entry.descriptor.id}/finish/continue`, {
              session: proof(entry), progress: { id: progress.id, token: progress.token },
            });
          }
          const completion = cloneState(response.completion);
          if (!completion || typeof completion.id !== "string" || typeof completion.token !== "string" ||
              !completion.id || !completion.token || completion.expiresAt !== entry.descriptor.expiresAt ||
              completion.event?.id !== eventId || completion.event?.game !== game ||
              !Number.isSafeInteger(completion.event.metric) || completion.event.metric < 0) {
            throw new GameRuleError("invalid-response", "Invalid game completion receipt");
          }
          assertInteger(completion.elapsedMs, 0, 6 * 60 * 60 * 1000, "finished time");
          return completion;
        })();
        return finishPromise;
      },
    });
  };

  return Object.freeze({
    issueGame,
    recordInput,
    pauseGame: () => changeTiming("pause"),
    resumeGame: () => changeTiming("resume"),
    exportGame,
    restoreGame,
    claimCompletion,
    dropSession: detach,
    hasIssuedGame: () => Boolean(current?.descriptor && current.eligible && active(current)),
  });
};

window.homeGameSession = Object.freeze({
  replayHash,
  normalizeIssuedTiming,
  normalizeIssuedGame,
  createGameSession,
});
})();
