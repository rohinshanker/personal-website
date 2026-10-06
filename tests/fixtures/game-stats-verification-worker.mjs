import { handleRequest } from "../../workers/game-stats/src/router.mjs";

const TARGET_INPUTS = 8_000;

const minesweeper = Object.freeze({
  generate(config, { firstCell, budget }) {
    budget.spend(1_000);
    return { config, firstCell, applied: 0, target: TARGET_INPUTS };
  },
  initial(raw) {
    if (!raw || raw.target !== TARGET_INPUTS || !Number.isSafeInteger(raw.applied)) {
      throw new Error("Invalid runtime fixture state");
    }
    return structuredClone(raw);
  },
  transition(state, input, budget) {
    budget.spend(200);
    if (input.seq !== state.applied + 1 || input.op !== "a") {
      throw new Error("Invalid runtime fixture replay");
    }
    state.applied += 1;
    return state;
  },
  result(state) {
    return {
      terminal: state.applied === state.target,
      won: state.applied === state.target,
    };
  },
});

export default {
  async fetch(request, env, context) {
    let replayWallMs = null;
    const response = await handleRequest(request, env, context, {
      verification: {
        gameEngines: { minesweeper },
        onVerificationBatch({ wallMs }) {
          replayWallMs = wallMs;
        },
      },
    });
    if (replayWallMs !== null) {
      response.headers.set("X-Test-Replay-Wall-Ms", String(replayWallMs));
    }
    return response;
  },
};
