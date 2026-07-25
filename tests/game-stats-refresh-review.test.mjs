import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reviewHtml = readFileSync(
  new URL(
    "../docs/validation/assets/game-stats-refresh-review.html",
    import.meta.url
  ),
  "utf8"
);
const normalizedReviewHtml = reviewHtml.replace(/\s+/g, " ");

const stateContract = Object.freeze({
  initial: "Global stats will sync automatically.",
  fetching: "Fetching latest stats",
  publishing: "Publishing saved results",
  "auth-required":
    "Sign in as Administrator to publish your verified Rohin result.",
  "auth-waiting": "Waiting for authentication",
  ready: "Global stats are up to date.",
  "request-failed": "Request failed. Try again later.",
  "auth-request-failed": "Request failed. Try again later.",
  unconfigured:
    "Automatic global tracking is not configured yet; local stats stay on this device.",
  "ready-missing-verified-session":
    "Local stats are saved. A result without a verified game session cannot be published.",
  "ready-verification-rejected":
    "Local stats are saved, but a result could not pass server verification.",
  "ready-started-without-session":
    "Local stats are saved. This result started without a verified game session.",
  "ready-local-reset":
    "Local progress was reset. Published and queued leaderboard results remain available.",
});

test("review artifact contains every refresh and informational state once", () => {
  for (const [state, message] of Object.entries(stateContract)) {
    assert.equal(
      reviewHtml.match(new RegExp(`data-review-state="${state}"`, "g"))?.length,
      1,
      `${state} should appear exactly once`
    );
    assert.ok(
      normalizedReviewHtml.includes(message),
      `${state} should use the production copy`
    );
  }
});

test("review artifact captures the success, multiplayer, and empty-data contract", () => {
  assert.match(
    reviewHtml,
    /\.score-row \{[\s\S]*?gap: 2px;[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\) auto;/
  );
  assert.match(
    reviewHtml,
    /src="\.\.\/\.\.\/\.\.\/assets\/app-icons\/ico\/msg_warning\.ico"/
  );
  assert.equal(
    reviewHtml.match(/<p>Administrator access granted\.<\/p>/g)?.length,
    1
  );
  assert.match(
    reviewHtml,
    /<div class="popup-actions">\s*<button type="button">OK<\/button>/
  );
  assert.match(reviewHtml, />Administrator<\/span><strong>00:44<\/strong>/);
  assert.match(reviewHtml, /<strong>#12<\/strong>/);
  assert.match(reviewHtml, /<strong>#—<\/strong>/);
  assert.equal(
    reviewHtml.match(/class="sudoku-placeholder"/g)?.length,
    6
  );
  assert.equal(
    reviewHtml.match(/<strong>99:99<\/strong>/g)?.length,
    7
  );
});

test("review artifact is static, private to search, and uses repository assets", () => {
  assert.match(
    reviewHtml,
    /<meta name="robots" content="noindex, nofollow" \/>/
  );
  assert.match(
    reviewHtml,
    /src="\.\.\/\.\.\/\.\.\/assets\/solitaire-cards\/undo-button\.png"/
  );
  assert.doesNotMatch(reviewHtml, /<(?:form|input|script)\b/i);
  assert.doesNotMatch(reviewHtml, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
});
