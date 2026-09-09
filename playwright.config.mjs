import { defineConfig } from "@playwright/test";

import {
  resolveUiTestBaseUrl,
  resolveUiTestOutputDir,
  resolveUiTestPort,
} from "./tests/ui/server-config.mjs";

const port = resolveUiTestPort();
const baseURL = resolveUiTestBaseUrl();

/** Pixel baselines are generated and compared in one pinned Linux container. */
const VISUAL_SPEC = /visual-baselines\.spec\.mjs$/;

export default defineConfig({
  testDir: "./tests/ui",
  outputDir: resolveUiTestOutputDir(),
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The architecture is part of the path: a run on another platform reports a
  // missing baseline instead of an unexplainable pixel diff.
  snapshotPathTemplate: `{testDir}/__screenshots__/{platform}-${process.arch}/{projectName}/{arg}{ext}`,
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "ui",
      testIgnore: VISUAL_SPEC,
    },
    {
      name: "visual",
      testMatch: VISUAL_SPEC,
      use: {
        // Deterministic rendering inputs. The frozen clock lives in the spec so
        // each page controls when time is pinned.
        locale: "en-US",
        timezoneId: "UTC",
        reducedMotion: "reduce",
        colorScheme: "light",
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    // http.server logs every request to stderr, so surface it only when a
    // startup problem is being diagnosed.
    stderr: process.env.UI_TEST_SERVER_LOGS === "1" ? "pipe" : "ignore",
    stdout: "ignore",
    url: `${baseURL}/home.html`,
    // The suite always owns its server. A responding URL does not prove which
    // checkout is being served, so an occupied port is an error: give each
    // worktree its own UI_TEST_PORT.
    reuseExistingServer: false,
  },
});
