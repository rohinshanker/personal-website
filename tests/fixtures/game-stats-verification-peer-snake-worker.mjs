import "../../scripts/home/games/rules.js";
import "../../scripts/home/games/snake.js";

import { handleRequest } from "../../workers/game-stats/src/router.mjs";

export default {
  async fetch(request, env, context) {
    const observedAt = Number(request.headers.get("X-Test-Now"));
    let replayWallMs = null;
    const response = await handleRequest(request, env, context, {
      verification: {
        gameEngines: { snake: globalThis.homeSnakeRules },
        now: () => observedAt,
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
