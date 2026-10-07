import { handleRequest } from "../../workers/game-stats/src/router.mjs";
import { generateIssuedInitial } from "../../workers/game-stats/src/issued-game-catalog.mjs";

// Test-only clock/seed control. Engines, catalog, signatures and SQL are real.
export default {
  async fetch(request, env, context) {
    let stages = null;
    const response = await handleRequest(request, env, context, {
      verification: {
        now: () => Number(request.headers.get("X-Test-Now")),
        generateIssuedInitial: (game, config) => generateIssuedInitial(game, config, 0),
        onVerificationBatch: (sample) => { stages = sample; },
      },
    });
    if (stages) response.headers.set("X-Test-Synchronous-Stages-Wall-Ms", String(stages.synchronousWallMs));
    return response;
  },
};
