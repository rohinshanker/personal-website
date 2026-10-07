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
    let replayStages = null;
    const response = await handleRequest(request, env, context, {
      verification: {
        gameEngines: { minesweeper },
        onVerificationBatch(stages) {
          replayStages = stages;
        },
      },
    });
    if (replayStages) {
      response.headers.set(
        "X-Test-Replay-Preparation-Wall-Ms",
        String(replayStages.preparationWallMs)
      );
      response.headers.set("X-Test-Replay-Wall-Ms", String(replayStages.replayWallMs));
      response.headers.set(
        "X-Test-Replay-Serialization-Wall-Ms",
        String(replayStages.serializationWallMs)
      );
      response.headers.set(
        "X-Test-Replay-Synchronous-Wall-Ms",
        String(replayStages.synchronousWallMs)
      );
    }
    return response;
  },
};
