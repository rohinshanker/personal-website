import "../../scripts/home/games/rules.js";
import "../../scripts/home/games/snake.js";

import { handleRequest } from "../../workers/game-stats/src/router.mjs";

export default {
  async fetch(request, env, context) {
    const observedAt = Number(request.headers.get("X-Test-Now"));
    let replayStages = null;
    const response = await handleRequest(request, env, context, {
      verification: {
        gameEngines: { snake: globalThis.homeSnakeRules },
        now: () => observedAt,
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
