export { createEmptyGameStatsData, compareLeaderboardEntries } from "./data.mjs";
export { normalizeGameStatsEvent } from "./events.mjs";
export { handleRequest, purgeExpiredGameStatsRows } from "./router.mjs";
export {
  CLASH_ROYALE_CACHE_TTL_SECONDS,
  CLASH_ROYALE_PLAYER_TAG,
  normalizeClashRoyalePayload,
} from "./clash-royale.mjs";

import { handleRequest, scheduled } from "./router.mjs";

export default {
  fetch: handleRequest,
  scheduled,
};
