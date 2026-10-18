export { compareLeaderboardEntries, createEmptyGameStatsData } from "./data.mjs";
export { normalizeGameStatsEvent } from "./events.mjs";
export { handleRequest, purgeExpiredGameStatsRows } from "./router.mjs";

import { handleRequest, scheduled } from "./router.mjs";

export default {
  fetch: handleRequest,
  scheduled,
};
