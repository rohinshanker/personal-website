import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

test.setTimeout(120_000);

const editorUrl = process.env.PLAYWRIGHT_VIDEO_EDITOR_URL || "/video-editor/";
const videoAsset = fileURLToPath(
  new URL("../../assets/solitaire-cards/victory-royale.webm", import.meta.url)
);
const videoName = "victory-royale.webm";
const audioName = "timeline-tone.wav";
const administratorProofStorageKey = "personalSiteAdministratorProofV1";
const administratorApiBaseUrl = "https://game-stats.test";
const administratorProof = `${"a".repeat(32)}.${"b".repeat(32)}`;
const administratorCredentials = Object.freeze({
  username: "administrator",
  password: "password",
});
const hourInMilliseconds = 60 * 60 * 1_000;
const authClockStart = Date.UTC(2026, 7, 11, 17, 0, 0);

const createWavBuffer = ({ durationSeconds = 2, frequency = 440 } = {}) => {
  const sampleRate = 8_000;
  const channelCount = 1;
  const bytesPerSample = 2;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channelCount, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  wav.writeUInt16LE(channelCount * bytesPerSample, 32);
  wav.writeUInt16LE(bytesPerSample * 8, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataSize, 40);

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const value = Math.round(
      Math.sin((sample / sampleRate) * frequency * Math.PI * 2) * 4_000
    );
    wav.writeInt16LE(value, 44 + sample * bytesPerSample);
  }

  return wav;
};

const generatedAudio = () => ({
  name: audioName,
  mimeType: "audio/wav",
  buffer: createWavBuffer(),
});

const monitorRuntime = (page) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedLocalResources = [];
  let pageOrigin = null;

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (pageOrigin && request.url().startsWith(pageOrigin)) {
      failedLocalResources.push(
        `${request.method()} ${request.url()} ${request.failure()?.errorText || "failed"}`
      );
    }
  });
  page.on("response", (response) => {
    if (
      pageOrigin &&
      response.url().startsWith(pageOrigin) &&
      response.status() >= 400
    ) {
      failedLocalResources.push(`${response.status()} ${response.url()}`);
    }
  });

  return {
    setOrigin(url) {
      pageOrigin = new URL(url).origin;
    },
    expectClean({ allowedConsoleErrors = [] } = {}) {
      const unexpectedConsoleErrors = consoleErrors.filter(
        (message) => !allowedConsoleErrors.some((pattern) => pattern.test(message))
      );
      expect(unexpectedConsoleErrors, "unexpected browser console errors").toEqual([]);
      for (const pattern of allowedConsoleErrors) {
        expect(
          consoleErrors.some((message) => pattern.test(message)),
          `expected browser console diagnostic ${pattern}`
        ).toBe(true);
      }
      expect(pageErrors, "uncaught page errors").toEqual([]);
      expect(failedLocalResources, "failed local resources").toEqual([]);
    },
  };
};

const seedAdministratorAccess = (page) =>
  page.addInitScript(
    ({ proof, proofStorageKey }) => {
      if (sessionStorage.getItem(proofStorageKey)) return;
      sessionStorage.setItem(
        proofStorageKey,
        JSON.stringify({
          proof,
          expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
        })
      );
    },
    { proof: administratorProof, proofStorageKey: administratorProofStorageKey }
  );

const configureAdministratorApi = async (
  page,
  { responses = ["success"], expiresAtForAttempt } = {}
) => {
  const requests = [];
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "${administratorApiBaseUrl}", buildVersion: "sha256-${"a".repeat(64)}" });`,
    })
  );
  await page.route(`${administratorApiBaseUrl}/administrator/sign-in`, async (route) => {
    const request = route.request();
    const credentials = JSON.parse(request.postData() || "{}");
    requests.push({ credentials, method: request.method() });
    const attempt = requests.length;
    const response = responses[Math.min(attempt - 1, responses.length - 1)];

    if (response === "network-error") {
      await route.abort("connectionfailed");
      return;
    }
    if (response === "invalid") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Invalid administrator credentials",
        }),
      });
      return;
    }

    const expiresAt = expiresAtForAttempt
      ? expiresAtForAttempt(attempt)
      : new Date(Date.now() + hourInMilliseconds).toISOString();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        profile: {
          id: "player-rohin-neko",
          name: "rohin ^.^",
          icon: "assets/neko-assets/sprites/yawn1.png",
        },
        proof: administratorProof,
        expiresAt,
      }),
    });
  });
  return requests;
};

const loadEditor = async (
  page,
  viewport = { width: 1280, height: 800 },
  { administratorAccess = "valid" } = {}
) => {
  if (administratorAccess === "valid") await seedAdministratorAccess(page);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(editorUrl, { waitUntil: "domcontentloaded" });
};

const signIn = async (page) => {
  await page.getByLabel("Username").fill(administratorCredentials.username);
  await page.getByLabel("Password").fill(administratorCredentials.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
};

const expectAuthenticated = async (page) => {
  await expect(page.getByTestId("video-editor-auth-overlay")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute(
    "data-video-editor-auth-state",
    "authenticated"
  );
  await expect(page.getByTestId("video-editor")).not.toHaveAttribute("inert", "");
  await expect(page.getByTestId("video-editor")).not.toHaveAttribute(
    "aria-hidden",
    "true"
  );
};

const importMedia = async (page, files) => {
  const uploadFiles = await Promise.all(
    files.map(async (file) =>
      typeof file === "string"
        ? {
            name: videoName,
            mimeType: "video/webm",
            buffer: await readFile(file),
          }
        : file
    )
  );
  await page.getByTestId("media-file-input").setInputFiles(uploadFiles);
  await expect(page.locator("#media-count")).toHaveText(
    `${files.length} ${files.length === 1 ? "item" : "items"}`,
    { timeout: 20_000 }
  );
  await expect(page.locator("#editor-status")).toContainText(
    `Imported ${files.length} local ${files.length === 1 ? "file" : "files"}`
  );
};

const setPlayhead = async (page, seconds) => {
  const scrubber = page.getByTestId("playhead-scrubber");
  await scrubber.evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, seconds);
};

const tabLabels = async (page) =>
  page
    .getByTestId("effect-tab-list")
    .getByRole("tab")
    .locator("[data-effect-tab-label]")
    .allTextContents()
    .then((labels) => labels.map((label) => label.trim()));

const readProjectSnapshot = (page) =>
  page.evaluate(() => ({
    media: Array.from(document.querySelectorAll("#media-bin [data-media-id]"), (item) => ({
      id: item.getAttribute("data-media-id"),
      name: item.querySelector("[data-media-name]")?.textContent,
    })),
    clips: Array.from(document.querySelectorAll("article[data-clip-id]"), (clip) => ({
      id: clip.getAttribute("data-clip-id"),
      label: clip.getAttribute("aria-label"),
    })),
    effects: Array.from(document.querySelectorAll("[data-effect-item-id]"), (effect) => ({
      id: effect.getAttribute("data-effect-item-id"),
      label: effect.getAttribute("aria-label"),
    })),
    previewSource: document.querySelector("#preview-video")?.src,
  }));

const expectPreviewAspect = async (stage, width, height) => {
  await expect
    .poll(() =>
      stage.evaluate((element) =>
        getComputedStyle(element).aspectRatio.replaceAll(" ", "")
      )
    )
    .toBe(`${width}/${height}`);
  await expect
    .poll(() =>
      stage.evaluate((element, expectedRatio) => {
        const bounds = element.getBoundingClientRect();
        return Math.abs(bounds.width / bounds.height - expectedRatio);
      }, width / height)
    )
    .toBeLessThanOrEqual(0.002);
};

const clickRangeAtValue = async (range, targetValue) => {
  const bounds = await range.boundingBox();
  expect(bounds, "range input is rendered").not.toBeNull();
  const { max, min, step, thumbWidth } = await range.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      max: Number(element.max),
      min: Number(element.min),
      step: Number(element.step) || 1,
      thumbWidth: Number.parseFloat(
        style.getPropertyValue("--video-editor-range-thumb-width")
      ),
    };
  });
  const fraction = (targetValue - min) / (max - min);
  const trackStart = thumbWidth / 2;
  const trackWidth = bounds.width - thumbWidth;
  await range.click({
    position: {
      x: trackStart + trackWidth * fraction,
      y: bounds.height / 2,
    },
  });
  const actualValue = Number(await range.inputValue());
  expect(Math.abs(actualValue - targetValue)).toBeLessThanOrEqual(step / 2 + 0.011);
  return actualValue;
};

const readRulerMetrics = (page) =>
  page.locator("#timeline-ruler").evaluate((ruler) => {
    const rulerBounds = ruler.getBoundingClientRect();
    return {
      height: rulerBounds.height,
      left: rulerBounds.left,
      right: rulerBounds.right,
      ticks: Array.from(ruler.querySelectorAll(".timeline-ruler__tick"), (tick) => {
        const tickBounds = tick.getBoundingClientRect();
        const label = tick.querySelector(".timeline-ruler__label");
        const labelBounds = label?.getBoundingClientRect();
        return {
          kind: tick.getAttribute("data-ruler-tick"),
          time: Number(tick.getAttribute("data-time-seconds")),
          height: tickBounds.height,
          left: tickBounds.left,
          label: labelBounds
            ? { left: labelBounds.left, right: labelBounds.right }
            : null,
        };
      }),
    };
  });

test("blocks the dimmed editor with a trapped, non-dismissible sign-in dialog", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 }, { administratorAccess: "none" });
  runtime.setOrigin(page.url());

  const overlay = page.getByTestId("video-editor-auth-overlay");
  const dialog = page.getByRole("dialog", { name: "Sign In" });
  const editor = page.getByTestId("video-editor");
  const username = page.getByLabel("Username");
  const password = page.getByLabel("Password");
  const submit = page.getByRole("button", { name: "Sign In", exact: true });

  await expect(overlay).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAccessibleDescription(/credentials.*Video Editor/i);
  await expect(editor).toHaveAttribute("inert", "");
  await expect(editor).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("body")).toHaveAttribute(
    "data-video-editor-auth-state",
    "unauthenticated"
  );
  await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0.32)");
  await expect(username).toBeFocused();
  await expect(page.getByTestId("video-editor-auth-status")).toHaveText(
    "Sign in to begin."
  );
  await expect(dialog.getByRole("button", { name: /close|cancel/i })).toHaveCount(0);

  await username.press("Shift+Tab");
  await expect(submit).toBeFocused();
  await submit.press("Tab");
  await expect(username).toBeFocused();
  await password.focus();
  await password.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(username).toBeFocused();
  await expect(page.getByTestId("video-editor-auth-status")).toHaveText(
    "Sign in to begin."
  );

  await expect(
    page.getByRole("button", { name: "Choose Video or Audio…" }).click({
      timeout: 750,
    })
  ).rejects.toThrow();
  await expect(dialog).toBeVisible();
  await expect(page.locator("#media-count")).toHaveText("0 items");

  for (const separatorId of [
    "#video-editor-media-compose-separator",
    "#video-editor-compose-effects-separator",
  ]) {
    const separator = page.locator(separatorId);
    const valueBefore = await separator.getAttribute("aria-valuenow");
    await expect(separator.click({ timeout: 750 })).rejects.toThrow();
    await expect(separator).toHaveAttribute("aria-valuenow", valueBefore);
  }
  const sideBySideLayout = page.locator(
    '[data-video-editor-workspace-layout-option="side-by-side"]'
  );
  await expect(sideBySideLayout).toHaveAttribute("aria-pressed", "false");
  await expect(sideBySideLayout.click({ timeout: 750 })).rejects.toThrow();
  await expect(sideBySideLayout).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".compose-panel__body")).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "standard"
  );

  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-required-desktop.png"),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-required-wide.png"),
  });

  runtime.expectClean();
});

test("shows only Desktop Required below 1024px even without authentication", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 375, height: 812 }, { administratorAccess: "none" });
  runtime.setOrigin(page.url());

  for (const viewport of [
    { width: 375, height: 812, name: "mobile" },
    { width: 768, height: 1024, name: "tablet" },
    { width: 1023, height: 800, name: "below-breakpoint" },
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("desktop-required")).toBeVisible();
      await expect(page.getByTestId("video-editor-auth-overlay")).toBeHidden();
      await expect(page.getByTestId("video-editor-auth-dialog")).toBeHidden();
      await expect(page.getByTestId("video-editor")).toBeHidden();
      await expect(page.locator("[data-video-editor-side-separator]")).toHaveCount(2);
      await expect(page.locator("#video-editor-media-compose-separator")).toBeHidden();
      await expect(page.locator("#video-editor-compose-effects-separator")).toBeHidden();
      await expect(page.locator("#video-editor-workspace-layout")).toBeHidden();
      await expect(page.locator("#video-editor-preview-timeline-separator")).toBeHidden();
      await page.screenshot({
        path: testInfo.outputPath(`video-editor-unauthenticated-${viewport.name}.png`),
      });
    });
  }

  runtime.expectClean();
});

test("stores a one-hour server proof and reuses it after reload", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  const signInStartedAt = Date.now();
  const requests = await configureAdministratorApi(page);
  await loadEditor(page, { width: 1280, height: 800 }, { administratorAccess: "none" });
  runtime.setOrigin(page.url());

  await signIn(page);
  await expectAuthenticated(page);
  expect(requests).toEqual([
    { credentials: administratorCredentials, method: "POST" },
  ]);
  const storedProof = await page.evaluate((proofStorageKey) => {
    const value = sessionStorage.getItem(proofStorageKey);
    return value ? JSON.parse(value) : null;
  }, administratorProofStorageKey);
  expect(storedProof?.proof).toBe(administratorProof);
  expect(Date.parse(storedProof?.expiresAt)).toBeGreaterThanOrEqual(
    signInStartedAt + hourInMilliseconds - 1_000
  );
  expect(Date.parse(storedProof?.expiresAt)).toBeLessThanOrEqual(
    Date.now() + hourInMilliseconds + 1_000
  );
  await page.screenshot({
    path: testInfo.outputPath("video-editor-authenticated.png"),
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectAuthenticated(page);
  expect(requests).toHaveLength(1);
  await expect(page.getByTestId("media-bin")).toContainText("No media imported");
  runtime.expectClean();
});

test("keeps the gate after invalid credentials and a network failure", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  const requests = await configureAdministratorApi(page, {
    responses: ["invalid", "network-error"],
  });
  await loadEditor(page, { width: 1280, height: 800 }, { administratorAccess: "none" });
  runtime.setOrigin(page.url());
  const overlay = page.getByTestId("video-editor-auth-overlay");
  const editor = page.getByTestId("video-editor");
  const authStatus = page.getByTestId("video-editor-auth-status");

  await signIn(page);
  await expect(overlay).toBeVisible();
  await expect(authStatus).toContainText(/sign-in failed|invalid|username and password/i);
  await expect(authStatus).toHaveAttribute("data-state", "error");
  await expect(editor).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Password")).toHaveValue("");
  expect(
    await page.evaluate((proofStorageKey) => sessionStorage.getItem(proofStorageKey), administratorProofStorageKey)
  ).toBeNull();
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-invalid.png"),
  });

  await signIn(page);
  await expect(overlay).toBeVisible();
  await expect(authStatus).toContainText(/could not|unable|failed|try again/i);
  await expect(editor).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByLabel("Password")).toBeFocused();
  expect(requests).toEqual([
    { credentials: administratorCredentials, method: "POST" },
    { credentials: administratorCredentials, method: "POST" },
  ]);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-network-error.png"),
  });

  runtime.expectClean({
    allowedConsoleErrors: [
      /401 \(Unauthorized\)/,
      /net::ERR_CONNECTION_FAILED/,
    ],
  });
});

test("expires or deauthenticates without discarding the project and restores it after reauthentication", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await page.clock.install({ time: new Date(authClockStart) });
  const requests = await configureAdministratorApi(page, {
    responses: ["success", "success"],
    expiresAtForAttempt: (attempt) =>
      new Date(authClockStart + attempt * hourInMilliseconds).toISOString(),
  });
  await loadEditor(page, { width: 1280, height: 800 }, { administratorAccess: "none" });
  runtime.setOrigin(page.url());

  await signIn(page);
  await expectAuthenticated(page);
  await importMedia(page, [videoAsset]);
  await page
    .getByTestId("media-bin")
    .getByRole("button", { name: `Add ${videoName} at the playhead` })
    .click();
  await page.locator('[data-effect-tab-target][data-effect="closed-captions"]').click();
  await page
    .getByRole("tabpanel", { name: "Closed Captions" })
    .getByRole("button", { name: "Add to timeline" })
    .click();

  const projectBeforeExpiry = await readProjectSnapshot(page);
  expect(projectBeforeExpiry.media).toHaveLength(1);
  expect(projectBeforeExpiry.clips).toHaveLength(1);
  expect(projectBeforeExpiry.effects).toHaveLength(1);
  expect(projectBeforeExpiry.previewSource).toMatch(/^blob:/);

  await page.clock.fastForward(hourInMilliseconds + 1_000);
  const overlay = page.getByTestId("video-editor-auth-overlay");
  const editor = page.getByTestId("video-editor");
  await expect(overlay).toBeVisible();
  await expect(editor).toHaveAttribute("inert", "");
  await expect(editor).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByLabel("Username")).toBeFocused();
  await expect(page.getByTestId("video-editor-auth-status")).toContainText(
    "Sign in again to continue using the Video Editor."
  );
  expect(
    await page.evaluate((proofStorageKey) => sessionStorage.getItem(proofStorageKey), administratorProofStorageKey)
  ).toBeNull();
  await expect(
    page.getByRole("button", { name: "Choose Video or Audio…" }).click({ timeout: 750 })
  ).rejects.toThrow();
  expect(
    await page.evaluate(() => ({
      mediaCount: document.querySelectorAll("#media-bin [data-media-id]").length,
      clipCount: document.querySelectorAll("article[data-clip-id]").length,
      effectCount: document.querySelectorAll("[data-effect-item-id]").length,
    }))
  ).toEqual({ mediaCount: 1, clipCount: 1, effectCount: 1 });
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-expired-project-preserved.png"),
  });

  await signIn(page);
  await expectAuthenticated(page);
  expect(requests).toHaveLength(2);
  expect(await readProjectSnapshot(page)).toEqual(projectBeforeExpiry);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-reauthenticated-project.png"),
  });

  await page.evaluate(
    (proofStorageKey) => sessionStorage.removeItem(proofStorageKey),
    administratorProofStorageKey
  );
  await page.clock.fastForward(1_000);
  await expect(overlay).toBeVisible();
  await expect(editor).toHaveAttribute("inert", "");
  await expect(page.getByTestId("video-editor-auth-status")).toContainText(
    /session ended.*Sign in again to continue using the Video Editor/i
  );
  expect(await readProjectSnapshot(page)).toEqual(projectBeforeExpiry);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-storage-deauthenticated.png"),
  });

  await signIn(page);
  await expectAuthenticated(page);
  expect(requests).toHaveLength(3);
  expect(await readProjectSnapshot(page)).toEqual(projectBeforeExpiry);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-reauthenticated-after-storage-removal.png"),
  });

  runtime.expectClean();
});

test("updates the preview frame presets and contains imported video", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1440, height: 900 });
  runtime.setOrigin(page.url());

  const preset = page.locator("#video-editor-frame-preset");
  const stage = page.getByTestId("preview-stage");
  const customSize = page.locator("#video-editor-frame-custom-size");
  const optionValues = await preset.locator("option").evaluateAll((options) =>
    options.map((option) => ({ text: option.textContent.trim(), value: option.value }))
  );
  expect(optionValues.map(({ value }) => value)).toEqual([
    "none",
    "9:16",
    "16:9",
    "1:1",
    "4:5",
    "4:3",
    "21:9",
    "3:2",
    "custom",
  ]);
  expect(optionValues[0].text).toBe("N/A");
  await expect(preset).toHaveValue("none");
  await expect(customSize).toBeHidden();
  await expect(stage).toHaveAttribute("data-frame-preset", "none");
  await expect(stage).toHaveClass(/is-frame-flexible/);
  await expect(stage).toHaveAttribute("data-frame-width", "auto");
  await expect(stage).toHaveAttribute("data-frame-height", "auto");
  await expect(stage).toHaveAttribute(
    "aria-label",
    "Composed timeline preview, flexible frame (N/A)"
  );
  const flexibleViewport = page.locator("#video-editor-preview-stage-viewport");
  const emptyFlexibleLayout = await Promise.all(
    [stage, flexibleViewport].map((element) =>
      element.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return { height: bounds.height, width: bounds.width };
      })
    )
  );
  expect(emptyFlexibleLayout[0].width).toBeCloseTo(emptyFlexibleLayout[1].width, 0);
  expect(emptyFlexibleLayout[0].height).toBeCloseTo(emptyFlexibleLayout[1].height, 0);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-frame-flexible-na.png"),
  });

  for (const [value, width, height] of [
    ["9:16", 9, 16],
    ["16:9", 16, 9],
    ["1:1", 1, 1],
    ["4:5", 4, 5],
    ["4:3", 4, 3],
    ["21:9", 21, 9],
    ["3:2", 3, 2],
  ]) {
    await test.step(value, async () => {
      await preset.selectOption(value);
      await expect(stage).toHaveAttribute("data-frame-preset", value);
      await expectPreviewAspect(stage, width, height);
      await expect(page.locator("#editor-status")).toContainText("Frame size set to");
    });
  }

  await preset.selectOption("custom");
  await expect(customSize).toBeVisible();
  const customWidth = page.getByLabel("Width");
  const customHeight = page.getByLabel("Height");
  await expect(customWidth).toHaveValue("1080");
  await expect(customHeight).toHaveValue("1920");
  await customWidth.fill("2000");
  await customHeight.fill("1000");
  await customHeight.press("Tab");
  await expect(stage).toHaveAttribute("data-frame-preset", "custom");
  await expect(stage).toHaveCSS("--video-editor-frame-width", "2000");
  await expect(stage).toHaveCSS("--video-editor-frame-height", "1000");
  await expectPreviewAspect(stage, 2000, 1000);
  await expect(page.locator("#editor-status")).toContainText(/2000.*1000/);

  await preset.selectOption("none");
  await expect(stage).toHaveAttribute(
    "aria-label",
    "Composed timeline preview, flexible frame (N/A)"
  );
  await importMedia(page, [videoAsset]);
  await page
    .getByTestId("media-bin")
    .getByRole("button", { name: `Add ${videoName} at the playhead` })
    .click();
  const previewVideo = page.locator("#preview-video");
  await expect(previewVideo).toBeVisible();
  await expect(previewVideo).toHaveCSS("object-fit", "contain");
  const containment = await previewVideo.evaluate((video) => {
    const videoBounds = video.getBoundingClientRect();
    const stageBounds = video.parentElement.getBoundingClientRect();
    return {
      naturalHeight: video.videoHeight,
      naturalWidth: video.videoWidth,
      withinStage:
        videoBounds.left >= stageBounds.left &&
        videoBounds.top >= stageBounds.top &&
        videoBounds.right <= stageBounds.right &&
        videoBounds.bottom <= stageBounds.bottom,
    };
  });
  expect(containment.naturalWidth).toBeGreaterThan(0);
  expect(containment.naturalHeight).toBeGreaterThan(0);
  expect(containment.withinStage).toBe(true);
  const importedFlexibleLayout = await Promise.all(
    [stage, flexibleViewport].map((element) =>
      element.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return { height: bounds.height, width: bounds.width };
      })
    )
  );
  expect(importedFlexibleLayout[0].width).toBeCloseTo(
    importedFlexibleLayout[1].width,
    0
  );
  expect(importedFlexibleLayout[0].height).toBeCloseTo(
    importedFlexibleLayout[1].height,
    0
  );
  await page.screenshot({
    path: testInfo.outputPath("video-editor-frame-contained-video.png"),
  });

  runtime.expectClean();
});

test("switches workspace layouts automatically for 9:16 and preserves manual choices", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  const composeBody = page.locator(".compose-panel__body");
  const preset = page.locator("#video-editor-frame-preset");
  const stage = page.getByTestId("preview-stage");
  const viewport = page.locator("#video-editor-preview-stage-viewport");
  const layoutGroup = page.locator("#video-editor-workspace-layout");
  const standard = page.getByRole("button", { name: "Standard", exact: true });
  const sideBySide = page.getByRole("button", { name: "Side by side", exact: true });
  await expect(layoutGroup).toHaveAttribute("role", "group");
  await expect(layoutGroup).toHaveAttribute("aria-label", "Workspace layout");
  for (const control of [standard, sideBySide]) {
    await expect(control).toHaveAttribute(
      "aria-controls",
      "video-editor-preview-section video-editor-timeline-section"
    );
  }
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "standard"
  );
  await expect(standard).toHaveAttribute("aria-pressed", "true");
  await expect(sideBySide).toHaveAttribute("aria-pressed", "false");

  const readPreviewGeometry = async () => {
    const [stageBounds, viewportBounds] = await Promise.all(
      [stage, viewport].map((element) =>
        element.evaluate((node) => {
          const bounds = node.getBoundingClientRect();
          return { height: bounds.height, width: bounds.width };
        })
      )
    );
    const stageArea = stageBounds.width * stageBounds.height;
    const viewportArea = viewportBounds.width * viewportBounds.height;
    return {
      fill: stageArea / viewportArea,
      height: stageBounds.height,
      stageArea,
      width: stageBounds.width,
    };
  };

  await preset.selectOption("9:16");
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "side-by-side"
  );
  await expect(sideBySide).toHaveAttribute("aria-pressed", "true");
  await expect(standard).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#editor-status")).toHaveText(
    "Frame size set to Reel / TikTok (9:16). Workspace layout changed to Side by side."
  );
  await expectPreviewAspect(stage, 9, 16);
  const sideBySidePortrait = await readPreviewGeometry();
  await page.screenshot({
    path: testInfo.outputPath("video-editor-portrait-side-by-side-1280x800.png"),
  });

  await standard.click();
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "standard"
  );
  await expect(page.locator("#editor-status")).toHaveText(
    "Workspace layout set to Standard."
  );
  await expect
    .poll(async () => (await readPreviewGeometry()).stageArea)
    .toBeLessThan(sideBySidePortrait.stageArea * 0.9);
  const standardPortrait = await readPreviewGeometry();
  expect(sideBySidePortrait.stageArea).toBeGreaterThan(standardPortrait.stageArea * 1.5);
  expect(sideBySidePortrait.height).toBeGreaterThan(standardPortrait.height * 1.25);
  expect(sideBySidePortrait.fill).toBeGreaterThan(standardPortrait.fill + 0.2);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-portrait-standard-1280x800.png"),
  });

  await sideBySide.focus();
  await sideBySide.press("Space");
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "side-by-side"
  );
  await preset.selectOption("16:9");
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "side-by-side"
  );
  await expect(page.locator("#editor-status")).toHaveText(
    "Frame size set to Widescreen (16:9)."
  );

  await standard.focus();
  await standard.press("Enter");
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "standard"
  );
  await preset.selectOption("custom");
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "standard"
  );
  await expect(page.locator("#video-editor-frame-custom-size")).toBeVisible();

  await preset.selectOption("9:16");
  await expect(composeBody).toHaveAttribute(
    "data-video-editor-workspace-layout",
    "side-by-side"
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(stage).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-portrait-side-by-side-1440x900.png"),
  });

  runtime.expectClean();
});

test("resizes the preview and timeline with pointer and keyboard controls", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  const separator = page.getByRole("separator", {
    name: "Resize preview and timeline",
  });
  const composeBody = page.locator(".compose-panel__body");
  const previewSection = page.locator("#video-editor-preview-section");
  const timelineSection = page.locator("#video-editor-timeline-section");
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  await expect(separator).toHaveAttribute(
    "aria-controls",
    "video-editor-preview-section video-editor-timeline-section"
  );
  const standardMinimum = Number(await separator.getAttribute("aria-valuemin"));
  const standardMaximum = Number(await separator.getAttribute("aria-valuemax"));
  expect(standardMinimum).toBeGreaterThanOrEqual(25);
  expect(standardMinimum).toBeLessThan(44);
  expect(standardMaximum).toBeGreaterThan(44);
  expect(standardMaximum).toBeLessThanOrEqual(75);
  await expect(separator).toHaveAttribute("aria-valuenow", "44");
  await expect(separator).toHaveAttribute(
    "aria-valuetext",
    "Preview height 44%, timeline height 56%"
  );
  await expect(composeBody).toHaveCSS("--video-editor-preview-split", "44fr");
  await expect(composeBody).toHaveCSS("--video-editor-timeline-split", "56fr");
  const standardRail = await separator.evaluate((element) => {
    const railStyle = getComputedStyle(element);
    const grip = element.querySelector(
      ".video-editor-preview-timeline-separator__grip"
    );
    const gripBounds = grip.getBoundingClientRect();
    return {
      backgroundColor: railStyle.backgroundColor,
      boxShadow: railStyle.boxShadow,
      gripBackground: getComputedStyle(grip).backgroundImage,
      gripHeight: gripBounds.height,
      gripWidth: gripBounds.width,
    };
  });
  expect(standardRail.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(standardRail.boxShadow).toBe("none");
  expect(standardRail.gripBackground).toContain("repeating-linear-gradient");
  expect(standardRail.gripWidth).toBeGreaterThan(standardRail.gripHeight);

  await separator.focus();
  await expect(separator).toHaveCSS("outline-style", "none");
  await expect(
    separator.locator(".video-editor-preview-timeline-separator__grip")
  ).toHaveCSS("outline-style", "dotted");
  await separator.press("ArrowUp");
  await expect(separator).toHaveAttribute("aria-valuenow", "39");
  await expect(composeBody).toHaveCSS("--video-editor-preview-split", "39fr");
  await expect(composeBody).toHaveCSS("--video-editor-timeline-split", "61fr");
  await separator.press("ArrowDown");
  await expect(separator).toHaveAttribute("aria-valuenow", "44");
  await expect(page.locator("#editor-status")).toHaveText(
    "Preview area set to 44 percent."
  );

  await separator.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", String(standardMinimum));
  const minimumSizes = {
    preview: await previewSection.evaluate((element) => element.getBoundingClientRect().height),
    timeline: await timelineSection.evaluate((element) => element.getBoundingClientRect().height),
  };
  await separator.press("End");
  await expect(separator).toHaveAttribute("aria-valuenow", String(standardMaximum));
  const maximumSizes = {
    preview: await previewSection.evaluate((element) => element.getBoundingClientRect().height),
    timeline: await timelineSection.evaluate((element) => element.getBoundingClientRect().height),
  };
  expect(maximumSizes.preview).toBeGreaterThan(minimumSizes.preview);
  expect(maximumSizes.timeline).toBeLessThan(minimumSizes.timeline);

  const bodyBounds = await composeBody.boundingBox();
  const separatorBounds = await separator.boundingBox();
  expect(bodyBounds).not.toBeNull();
  expect(separatorBounds).not.toBeNull();
  await page.mouse.move(
    separatorBounds.x + separatorBounds.width / 2,
    separatorBounds.y + separatorBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    separatorBounds.x + separatorBounds.width / 2,
    bodyBounds.y + bodyBounds.height * 0.6,
    { steps: 5 }
  );
  await page.mouse.up();
  const pointerValue = Number(await separator.getAttribute("aria-valuenow"));
  expect(pointerValue).toBeGreaterThanOrEqual(59);
  expect(pointerValue).toBeLessThanOrEqual(61);
  await expect(composeBody).toHaveCSS(
    "--video-editor-preview-split",
    `${pointerValue}fr`
  );
  await expect(composeBody).toHaveCSS(
    "--video-editor-timeline-split",
    `${100 - pointerValue}fr`
  );
  await expect(page.locator("#editor-status")).toHaveText(
    `Preview area set to ${pointerValue} percent.`
  );
  await expect(separator).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("video-editor-preview-timeline-splitter.png"),
  });

  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(separator).toHaveAttribute("aria-orientation", "vertical");
  const sideInitialValue = Number(await separator.getAttribute("aria-valuenow"));
  expect(sideInitialValue).toBe(44);
  const sideMinimum = Number(await separator.getAttribute("aria-valuemin"));
  const sideMaximum = Number(await separator.getAttribute("aria-valuemax"));
  expect(sideMinimum).toBeGreaterThanOrEqual(25);
  expect(sideMinimum).toBeLessThanOrEqual(sideInitialValue);
  expect(sideMaximum).toBeGreaterThanOrEqual(sideInitialValue);
  expect(sideMaximum).toBeLessThanOrEqual(75);
  await expect(separator).toHaveAttribute(
    "aria-valuetext",
    `Preview width ${sideInitialValue}%, timeline width ${100 - sideInitialValue}%`
  );
  const sideRail = await separator.evaluate((element) => {
    const railStyle = getComputedStyle(element);
    const grip = element.querySelector(
      ".video-editor-preview-timeline-separator__grip"
    );
    const gripBounds = grip.getBoundingClientRect();
    return {
      backgroundColor: railStyle.backgroundColor,
      boxShadow: railStyle.boxShadow,
      gripBackground: getComputedStyle(grip).backgroundImage,
      gripHeight: gripBounds.height,
      gripWidth: gripBounds.width,
    };
  });
  expect(sideRail.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(sideRail.boxShadow).toBe("none");
  expect(sideRail.gripBackground).toContain("repeating-linear-gradient");
  expect(sideRail.gripHeight).toBeGreaterThan(sideRail.gripWidth);

  await separator.focus();
  await separator.press("ArrowLeft");
  await expect(separator).toHaveAttribute("aria-valuenow", String(sideInitialValue - 5));
  await separator.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", String(sideInitialValue));
  await separator.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", String(sideMinimum));
  const sideMinimumSizes = {
    preview: await previewSection.evaluate((element) => element.getBoundingClientRect().width),
    timeline: await timelineSection.evaluate((element) => element.getBoundingClientRect().width),
  };
  await separator.press("End");
  await expect(separator).toHaveAttribute("aria-valuenow", String(sideMaximum));
  const sideMaximumSizes = {
    preview: await previewSection.evaluate((element) => element.getBoundingClientRect().width),
    timeline: await timelineSection.evaluate((element) => element.getBoundingClientRect().width),
  };
  expect(sideMaximumSizes.preview).toBeGreaterThan(sideMinimumSizes.preview);
  expect(sideMaximumSizes.timeline).toBeLessThan(sideMinimumSizes.timeline);
  expect(sideMinimumSizes.preview).toBeGreaterThanOrEqual(179);
  expect(sideMaximumSizes.timeline).toBeGreaterThanOrEqual(199);

  const sideBodyBounds = await composeBody.boundingBox();
  const sideSeparatorBounds = await separator.boundingBox();
  expect(sideBodyBounds).not.toBeNull();
  expect(sideSeparatorBounds).not.toBeNull();
  await page.mouse.move(
    sideSeparatorBounds.x + sideSeparatorBounds.width / 2,
    sideSeparatorBounds.y + sideSeparatorBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    sideBodyBounds.x + sideBodyBounds.width * 0.6,
    sideSeparatorBounds.y + sideSeparatorBounds.height / 2,
    { steps: 5 }
  );
  await page.mouse.up();
  const sidePointerValue = Number(await separator.getAttribute("aria-valuenow"));
  expect(sidePointerValue).toBeGreaterThanOrEqual(59);
  expect(sidePointerValue).toBeLessThanOrEqual(61);
  await expect(page.locator("#editor-status")).toHaveText(
    `Preview area set to ${sidePointerValue} percent.`
  );

  await page.getByRole("button", { name: "Standard", exact: true }).click();
  await expect(separator).toHaveAttribute("aria-valuenow", String(pointerValue));
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(separator).toHaveAttribute("aria-valuenow", String(sidePointerValue));

  for (const sideSeparator of [
    page.locator("#video-editor-media-compose-separator"),
    page.locator("#video-editor-compose-effects-separator"),
  ]) {
    const rail = await sideSeparator.evaluate((element) => {
      const style = getComputedStyle(element);
      const grip = element.querySelector(".video-editor-side-separator__grip");
      const gripBounds = grip.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        gripBackground: getComputedStyle(grip).backgroundImage,
        gripHeight: gripBounds.height,
        gripWidth: gripBounds.width,
      };
    });
    expect(rail.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(rail.boxShadow).toBe("none");
    expect(rail.gripBackground).toContain("repeating-linear-gradient");
    expect(rail.gripHeight).toBeGreaterThan(rail.gripWidth);
  }
  const mediaSeparator = page.locator("#video-editor-media-compose-separator");
  await page.getByRole("button", { name: "Transitions", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(mediaSeparator).toBeFocused();
  await expect(mediaSeparator).toHaveCSS(
    "outline-style",
    "none"
  );
  await expect(
    mediaSeparator.locator(".video-editor-side-separator__grip")
  ).toHaveCSS("outline-style", "dotted");
  await page.screenshot({
    path: testInfo.outputPath("video-editor-preview-timeline-splitter-side-by-side.png"),
  });

  runtime.expectClean();
});

test("aligns range clicks and renders bounded major and minor ruler ticks", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  const playhead = page.getByTestId("playhead-scrubber");
  const timelineTrack = page.getByTestId("timeline-tier-video-1");
  const timelinePlayhead = page.locator("#timeline-playhead");
  for (const target of [0, 7.5, 15, 22.5, 30]) {
    await test.step(`playhead ${target}`, async () => {
      const actual = await clickRangeAtValue(playhead, target);
      await expect(page.locator("#current-time")).toHaveText(
        `00:${actual.toFixed(2).padStart(5, "0")}`
      );
      const alignment = await Promise.all([
        timelineTrack.evaluate((element) => element.getBoundingClientRect().left),
        timelinePlayhead.evaluate((element) => element.getBoundingClientRect().left),
      ]);
      expect(alignment[1] - alignment[0]).toBeCloseTo(actual * 64, 0);
    });
  }

  const scale = page.getByTestId("timeline-scale");
  for (const target of [20, 55, 90, 125, 160]) {
    await test.step(`scale ${target}`, async () => {
      const actual = await clickRangeAtValue(scale, target);
      await expect(page.locator("#editor-status")).toHaveText(
        `Timeline scale set to ${actual} pixels per second.`
      );
    });
  }

  for (const targetScale of [20, 160]) {
    await test.step(`ruler at scale ${targetScale}`, async () => {
      await clickRangeAtValue(scale, targetScale);
      const ruler = await readRulerMetrics(page);
      const majorTicks = ruler.ticks.filter(({ kind }) => kind === "major");
      const minorTicks = ruler.ticks.filter(({ kind }) => kind === "minor");
      expect(majorTicks.length).toBeGreaterThan(1);
      expect(minorTicks.length).toBeGreaterThan(1);
      for (const tick of majorTicks) {
        expect(tick.height / ruler.height).toBeCloseTo(1, 2);
        expect(tick.label).not.toBeNull();
        expect(tick.label.left).toBeGreaterThanOrEqual(tick.left - 0.5);
        expect(tick.label.right).toBeLessThanOrEqual(ruler.right + 0.5);
        expect(tick.left - ruler.left).toBeCloseTo(tick.time * targetScale, 0);
      }
      for (const tick of minorTicks) {
        expect(tick.height / ruler.height).toBeCloseTo(0.5, 2);
        expect(tick.label).toBeNull();
        expect(tick.left - ruler.left).toBeCloseTo(tick.time * targetScale, 0);
      }
      expect(majorTicks[0].time).toBe(0);
      expect(majorTicks[0].label.left).toBeGreaterThanOrEqual(ruler.left);
      expect(majorTicks.at(-1).time).toBe(30);
      expect(majorTicks.at(-1).label.right).toBeLessThanOrEqual(ruler.right + 0.5);
      await page.screenshot({
        path: testInfo.outputPath(`video-editor-ruler-scale-${targetScale}.png`),
      });
    });
  }

  runtime.expectClean();
});

test("switches exactly at the desktop breakpoint and starts with an empty project", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  const viewports = [
    { width: 375, height: 812, name: "mobile" },
    { width: 768, height: 1024, name: "tablet" },
    { width: 1023, height: 800, name: "below-breakpoint" },
    { width: 1024, height: 800, name: "at-breakpoint" },
    { width: 1280, height: 800, name: "desktop" },
    { width: 1440, height: 900, name: "wide" },
  ];

  await loadEditor(page, viewports[0]);
  runtime.setOrigin(page.url());

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      const editor = page.getByTestId("video-editor");
      const desktopRequired = page.getByTestId("desktop-required");

      if (viewport.width < 1024) {
        await expect(desktopRequired).toBeVisible();
        await expect(desktopRequired).toHaveAccessibleName("Desktop Required");
        await expect(desktopRequired).toContainText("at least 1024 pixels wide");
        await expect(editor).toBeHidden();
      } else {
        await expect(desktopRequired).toBeHidden();
        await expect(editor).toBeVisible();
        await expect(editor).toHaveAccessibleName("Video editor workspace");
        await expect(page.locator('[data-panel="media"]')).toBeVisible();
        await expect(page.locator('[data-panel="compose"]')).toBeVisible();
        await expect(page.locator('[data-panel="effects"]')).toBeVisible();
      }

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`video-editor-${viewport.name}.png`),
      });
    });
  }

  await expect(page.getByTestId("media-bin")).toContainText("No media imported");
  await expect(page.locator("#media-count")).toHaveText("0 items");
  await expect(page.getByTestId("timeline-tier-video-1")).toContainText(
    "Drop video clips here"
  );
  await expect(page.getByTestId("timeline-tier-audio-1")).toContainText(
    "Drop audio clips here"
  );
  await expect(page.getByTestId("effects-lane")).toContainText("Effects appear here");
  await expect(page.locator("#preview-empty-state")).toContainText(
    "Nothing at the playhead"
  );
  await expect(page.getByRole("button", { name: "Reopen closed tab" })).toBeDisabled();
  await expect(page.getByTestId("effect-tab-list").getByRole("tab")).toHaveCount(0);
  await expect(page.locator("#editor-status")).toContainText("Empty project ready");

  runtime.expectClean();
});

test("imports local video and generated audio, validates tier drops, and composes the preview", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page);
  runtime.setOrigin(page.url());
  await importMedia(page, [videoAsset, generatedAudio()]);

  const mediaBin = page.getByTestId("media-bin");
  const videoMedia = mediaBin.locator('[data-media-id][data-kind="video"]');
  const audioMedia = mediaBin.locator('[data-media-id][data-kind="audio"]');
  const videoTrack = page.getByTestId("timeline-tier-video-1");
  const audioTrack = page.getByTestId("timeline-tier-audio-1");

  await expect(videoMedia).toHaveAccessibleName(
    new RegExp(`${videoName}, video, 00:05\\.0`)
  );
  await expect(audioMedia).toHaveAccessibleName(`${audioName}, audio, 00:02.00`);
  await expect(mediaBin.getByRole("listitem")).toHaveCount(2);

  await videoMedia
    .getByRole("button", { name: `Add ${videoName} at the playhead` })
    .click();
  await expect(videoTrack.getByRole("listitem")).toHaveCount(1);
  await expect(page.locator("#editor-status")).toContainText(
    `${videoName} added to Video 1 at 00:00.00`
  );
  await expect(page.locator("#preview-video")).toBeVisible();
  await expect(page.locator("#preview-video")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("#preview-clip-name")).toHaveText(videoName);

  await audioMedia.dragTo(videoTrack);
  await expect(page.locator("#editor-status")).toContainText(
    `${audioName} is audio; choose a audio tier`
  );
  await expect(videoTrack.getByRole("listitem")).toHaveCount(1);
  await expect(audioTrack.getByRole("listitem")).toHaveCount(0);

  await audioMedia.dragTo(audioTrack);
  const audioClip = audioTrack.getByRole("listitem");
  await expect(audioClip).toHaveCount(1);
  await expect(page.locator("#editor-status")).toContainText(
    `${audioName} added to Audio 1`
  );
  const audioStart = await audioClip.getAttribute("aria-label").then((label) => {
    const match = label?.match(/starts 00:(\d{2}\.\d{2})/);
    expect(match, "audio clip exposes its timeline start").not.toBeNull();
    return Number(match[1]);
  });

  await setPlayhead(page, audioStart + 0.25);
  await expect(page.locator('#preview-audio-mix audio[data-audio-clip-id]')).toHaveCount(1);
  await expect(page.locator("#preview-clip-name")).toContainText(audioName);

  await setPlayhead(page, 0.75);
  await expect(page.locator("#current-time")).toHaveText("00:00.75");
  await expect(page.locator("#editor-status")).toContainText(
    "Playhead moved to 00:00.75"
  );
  await expect(page.locator("#preview-video")).toBeVisible();
  await expect(page.locator("#preview-clip-name")).toHaveText(videoName);

  const play = page.getByRole("button", { name: "Play", exact: true });
  await play.click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.waitForTimeout(250);
  const playingTime = Number(await page.getByTestId("playhead-scrubber").inputValue());
  expect(playingTime).toBeGreaterThan(0.75);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  );

  await page.screenshot({ path: testInfo.outputPath("video-editor-imported-media.png") });
  runtime.expectClean();
});

test("snaps and reorders clips, adds typed tiers, and supports keyboard editing and scale", async ({
  page,
}) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page);
  runtime.setOrigin(page.url());
  await importMedia(page, [videoAsset]);

  const addVideo = page
    .getByTestId("media-bin")
    .getByRole("button", { name: `Add ${videoName} at the playhead` });
  await addVideo.click();
  await addVideo.click();

  let videoOne = page.getByTestId("timeline-tier-video-1");
  await expect(videoOne.getByRole("listitem")).toHaveCount(2);
  await expect(page.locator("#editor-status")).toContainText(
    "snapped to avoid an overlap"
  );
  await expect(videoOne.locator('[data-clip-id="clip-1"]')).toHaveAttribute(
    "aria-label",
    /starts 00:00\.00/
  );
  await expect(videoOne.locator('[data-clip-id="clip-2"]')).toHaveAttribute(
    "aria-label",
    /starts 00:05\.0/
  );

  const targetBounds = await videoOne.boundingBox();
  expect(targetBounds).not.toBeNull();
  await videoOne.locator('[data-clip-id="clip-1"]').dragTo(videoOne, {
    targetPosition: {
      x: Math.min(480, targetBounds.width - 10),
      y: targetBounds.height / 2,
    },
  });
  await expect(page.locator("#editor-status")).toContainText(
    `${videoName} moved to Video 1`
  );
  await expect(page.locator("#editor-status")).toContainText(
    "snapped to avoid an overlap"
  );
  await expect(videoOne.locator('[data-clip-id="clip-1"]')).toHaveAttribute(
    "aria-label",
    /starts 00:10\.0/
  );
  expect(
    await videoOne.locator("[data-clip-id]").evaluateAll((clips) =>
      clips.map((clip) => clip.dataset.clipId)
    )
  ).toEqual(["clip-2", "clip-1"]);

  await page.getByRole("button", { name: "Add video tier" }).click();
  await expect(page.getByTestId("timeline-tier-video-2")).toBeFocused();
  await page.getByRole("button", { name: "Add audio tier" }).click();
  await expect(page.getByTestId("timeline-tier-audio-2")).toBeFocused();
  await expect(page.locator('[data-tier-id="video-2"][data-kind="video"]')).toHaveCount(2);
  await expect(page.locator('[data-tier-id="audio-2"][data-kind="audio"]')).toHaveCount(2);

  let clipOne = page.locator('article[data-clip-id="clip-1"]');
  await clipOne.focus();
  await clipOne.press("ArrowDown");
  await expect(page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]')).toBeVisible();
  await expect(page.locator("#editor-status")).toContainText("moved to Video 2");

  clipOne = page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]');
  const beforeMove = await clipOne.getAttribute("aria-label");
  await clipOne.press("ArrowLeft");
  await expect(clipOne).not.toHaveAttribute("aria-label", beforeMove);
  await expect(page.locator("#editor-status")).toContainText("moved to Video 2");

  await clipOne.dragTo(page.getByTestId("timeline-tier-audio-1"));
  await expect(page.locator("#editor-status")).toContainText(
    `${videoName} cannot move to Audio 1; it accepts audio clips`
  );
  await expect(page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]')).toBeVisible();

  clipOne = page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]');
  const pointerTrimBefore = await clipOne.getAttribute("aria-label");
  const pointerTrimHandle = clipOne.getByRole("button", {
    name: `Trim end of ${videoName}`,
  });
  const pointerTrimBounds = await pointerTrimHandle.boundingBox();
  expect(pointerTrimBounds).not.toBeNull();
  await page.mouse.move(
    pointerTrimBounds.x + pointerTrimBounds.width / 2,
    pointerTrimBounds.y + pointerTrimBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(pointerTrimBounds.x - 32, pointerTrimBounds.y + 4, {
    steps: 4,
  });
  await page.mouse.up();
  clipOne = page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]');
  await expect(clipOne).not.toHaveAttribute("aria-label", pointerTrimBefore);
  await expect(page.locator("#editor-status")).toContainText("end edge trimmed");

  let startTrim = clipOne.getByRole("button", {
    name: `Trim start of ${videoName}`,
  });
  const durationBeforeTrim = await clipOne.getAttribute("aria-label");
  await startTrim.press("ArrowRight");
  clipOne = page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]');
  await expect(clipOne).not.toHaveAttribute("aria-label", durationBeforeTrim);
  await expect(page.locator("#editor-status")).toContainText("start edge trimmed");

  const durationAfterStartTrim = await clipOne.getAttribute("aria-label");
  await clipOne
    .getByRole("button", { name: `Trim end of ${videoName}` })
    .press("ArrowLeft");
  clipOne = page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]');
  await expect(clipOne).not.toHaveAttribute("aria-label", durationAfterStartTrim);
  await expect(page.locator("#editor-status")).toContainText("end edge trimmed");

  videoOne = page.getByTestId("timeline-tier-video-1");
  const remainingClip = videoOne.locator('[data-clip-id="clip-2"]');
  const widthBeforeScale = await remainingClip.evaluate((element) =>
    element.getBoundingClientRect().width
  );
  await page.getByTestId("timeline-scale").evaluate((element) => {
    element.value = "160";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const widthAfterScale = await remainingClip.evaluate((element) =>
    element.getBoundingClientRect().width
  );
  expect(widthAfterScale).toBeGreaterThan(widthBeforeScale * 2);
  await expect(page.locator("#editor-status")).toContainText(
    "Timeline scale set to 160 pixels per second"
  );

  clipOne = page.getByTestId("timeline-tier-video-2").locator('[data-clip-id="clip-1"]');
  await clipOne.focus();
  await clipOne.press("Delete");
  await expect(page.locator('article[data-clip-id="clip-1"]')).toHaveCount(0);
  await expect(page.locator("#editor-status")).toContainText(
    `${videoName} deleted from the timeline`
  );

  runtime.expectClean();
});

test("opens, focuses, reorders, closes, and reopens effect tabs and edits effect bars", async ({
  page,
}) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page);
  runtime.setOrigin(page.url());

  const launchEffect = (type) =>
    page.locator(`[data-effect-tab-target][data-effect="${type}"]`);
  await launchEffect("closed-captions").click();
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Closed Captions" })).toBeVisible();
  await launchEffect("windows-98").click();
  await launchEffect("transitions").click();
  await expect(page.getByRole("tab", { name: "Transitions" })).toBeFocused();
  expect(await tabLabels(page)).toEqual([
    "Closed Captions",
    "Windows 98",
    "Transitions",
  ]);

  const draggedTab = page.locator(
    '[data-effect-tab-wrapper][data-effect="windows-98"]'
  );
  const dragTarget = page.locator(
    '[data-effect-tab-wrapper][data-effect="closed-captions"]'
  );
  await dragTarget.scrollIntoViewIfNeeded();
  await draggedTab.scrollIntoViewIfNeeded();
  const [draggedBounds, targetBounds] = await Promise.all([
    draggedTab.boundingBox(),
    dragTarget.boundingBox(),
  ]);
  expect(draggedBounds).not.toBeNull();
  expect(targetBounds).not.toBeNull();
  await page.mouse.move(draggedBounds.x + 10, draggedBounds.y + 13);
  await page.mouse.down();
  await page.mouse.move(draggedBounds.x + 22, draggedBounds.y + 13, { steps: 4 });
  await page.mouse.move(targetBounds.x + 10, targetBounds.y + 13, { steps: 12 });
  await page.mouse.up();
  expect(await tabLabels(page)).toEqual([
    "Windows 98",
    "Closed Captions",
    "Transitions",
  ]);
  await expect(page.locator("#editor-status")).toContainText(
    "Windows 98 tab moved to position 1"
  );

  await launchEffect("closed-captions").click();
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toBeFocused();
  await expect(page.getByTestId("effect-tab-list").getByRole("tab")).toHaveCount(3);
  await page.getByRole("tab", { name: "Closed Captions" }).press("Control+ArrowRight");
  expect(await tabLabels(page)).toEqual([
    "Windows 98",
    "Transitions",
    "Closed Captions",
  ]);
  await expect(page.locator("#editor-status")).toContainText(
    "Closed Captions tab moved to position 3"
  );

  await page.getByRole("tab", { name: "Closed Captions" }).press("Delete");
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toHaveCount(0);
  const reopen = page.getByRole("button", { name: "Reopen closed tab" });
  await expect(reopen).toBeEnabled();
  await reopen.click();
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toBeFocused();
  expect(await tabLabels(page)).toEqual([
    "Windows 98",
    "Transitions",
    "Closed Captions",
  ]);

  await page.getByRole("button", { name: "Close Windows 98 tab" }).click();
  await expect(page.getByRole("tab", { name: "Windows 98" })).toHaveCount(0);
  await launchEffect("windows-98").click();
  await expect(page.getByRole("tab", { name: "Windows 98" })).toBeFocused();
  expect(await tabLabels(page)).toEqual([
    "Transitions",
    "Closed Captions",
    "Windows 98",
  ]);

  await setPlayhead(page, 2);
  for (const name of ["Closed Captions", "Windows 98", "Transitions"]) {
    await page.getByRole("tab", { name }).click();
    await page
      .getByRole("tabpanel", { name })
      .getByRole("button", { name: "Add to timeline" })
      .click();
  }

  const effectsLane = page.getByTestId("effects-lane");
  await expect(effectsLane.getByRole("listitem")).toHaveCount(3);
  await expect(effectsLane.locator('[data-effect="closed-captions"] img')).toHaveAttribute(
    "src",
    /accessibility_window_speak\.ico$/
  );
  await expect(effectsLane.locator('[data-effect="windows-98"] img')).toHaveAttribute(
    "src",
    /windows\.ico$/
  );
  await expect(effectsLane.locator('[data-effect="transitions"] img')).toHaveAttribute(
    "src",
    /movie_maker\.ico$/
  );

  let captions = effectsLane.locator('[data-effect="closed-captions"]');
  await expect(captions).toHaveAccessibleName(/00:03\.00, starts 00:02\.00/);
  await captions.focus();
  await captions.press("ArrowRight");
  captions = effectsLane.locator('[data-effect="closed-captions"]');
  await expect(captions).toHaveAccessibleName(/starts 00:02\.25/);
  await expect(page.locator("#editor-status")).toContainText(
    "Closed Captions effect moved to 00:02.25"
  );

  await captions
    .getByRole("button", { name: "Resize end of Closed Captions effect" })
    .press("ArrowRight");
  captions = effectsLane.locator('[data-effect="closed-captions"]');
  await expect(captions).toHaveAccessibleName(/00:03\.25, starts 00:02\.25/);
  await captions
    .getByRole("button", { name: "Resize start of Closed Captions effect" })
    .press("ArrowRight");
  captions = effectsLane.locator('[data-effect="closed-captions"]');
  await expect(captions).toHaveAccessibleName(/00:03\.00, starts 00:02\.50/);
  await expect(page.locator("#editor-status")).toContainText(
    "Closed Captions effect resized to 00:03.00"
  );

  const effectBeforePointerMove = await captions.getAttribute("aria-label");
  const effectsLaneBounds = await effectsLane.boundingBox();
  expect(effectsLaneBounds).not.toBeNull();
  await captions.dragTo(effectsLane, {
    targetPosition: {
      x: Math.min(420, effectsLaneBounds.width - 12),
      y: effectsLaneBounds.height / 2,
    },
  });
  captions = effectsLane.locator('[data-effect="closed-captions"]');
  await expect(captions).not.toHaveAttribute("aria-label", effectBeforePointerMove);
  await expect(page.locator("#editor-status")).toContainText(
    "Closed Captions effect moved to"
  );

  await captions.focus();
  await captions.press("Delete");
  await expect(effectsLane.locator('[data-effect="closed-captions"]')).toHaveCount(0);
  await expect(effectsLane.getByRole("listitem")).toHaveCount(2);
  await expect(page.locator("#editor-status")).toContainText(
    "Closed Captions effect deleted from the timeline"
  );

  runtime.expectClean();
});

test("renders semantic 98.css effect tabs with restrained close controls and marquee overflow", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  const effects = [
    {
      type: "closed-captions",
      label: "Closed Captions",
      icon: "accessibility_window_speak.ico",
    },
    { type: "windows-98", label: "Windows 98", icon: "windows.ico" },
    { type: "transitions", label: "Transitions", icon: "movie_maker.ico" },
  ];
  for (const { type } of effects) {
    await page.locator(`[data-effect-tab-target][data-effect="${type}"]`).click();
  }

  const tabList = page.getByTestId("effect-tab-list");
  expect(await tabList.evaluate((element) => element.tagName)).toBe("MENU");
  await expect(tabList).toHaveAttribute("role", "tablist");
  const directTabs = tabList.locator(":scope > li[role=tab]");
  await expect(directTabs).toHaveCount(3);
  await expect(directTabs.last()).toHaveAttribute("aria-selected", "true");
  await expect(directTabs.first()).toHaveAttribute("aria-selected", "false");

  for (const { icon, label, type } of effects) {
    const tab = tabList.locator(`:scope > li[data-effect="${type}"]`);
    await expect(tab).toHaveAttribute("role", "tab");
    await expect(tab.locator("[data-effect-tab-title-viewport]")).toHaveAttribute(
      "title",
      label
    );
    await expect(tab.locator("[data-effect-tab-label]")).toHaveText(label);
    await expect(tab.locator("[data-effect-tab-icon]")).toHaveAttribute(
      "src",
      new RegExp(`${icon.replaceAll(".", "\\.")}$`)
    );
    const close = tab.getByRole("button", { name: `Close ${label} tab` });
    await expect(close.locator('[aria-hidden="true"]')).toHaveText("×");
  }

  const close = tabList
    .locator(':scope > li[data-effect="closed-captions"]')
    .getByRole("button", { name: "Close Closed Captions tab" });
  const restShadow = await close.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(restShadow).toBe("none");
  await close.hover();
  await expect(close).toHaveCSS("box-shadow", "none");
  await close.focus();
  await expect(close).toHaveCSS("box-shadow", "none");
  const closeBounds = await close.boundingBox();
  expect(closeBounds).not.toBeNull();
  await page.mouse.move(
    closeBounds.x + closeBounds.width / 2,
    closeBounds.y + closeBounds.height / 2
  );
  await page.mouse.down();
  expect(await close.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
    "none"
  );
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect(close).toHaveCSS("box-shadow", "none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const longTitle = `${"Transitions and Motion Effects ".repeat(8)}Transitions`;
  const transitionsTab = tabList.locator(':scope > li[data-effect="transitions"]');
  const titleViewport = transitionsTab.locator("[data-effect-tab-title-viewport]");
  const titleTrack = transitionsTab.locator("[data-effect-tab-title-track]");
  await titleTrack.evaluate((element, title) => {
    element.textContent = title;
    element.parentElement.title = title;
    window.dispatchEvent(new Event("resize"));
  }, longTitle);
  await expect(transitionsTab).toHaveClass(/is-title-overflowing/);
  const overflow = await titleViewport.evaluate((viewport) => {
    const track = viewport.querySelector("[data-effect-tab-title-track]");
    const titledElement = viewport.closest("[title]") || viewport.querySelector("[title]");
    return {
      clientWidth: viewport.clientWidth,
      scrollDistance: Number.parseFloat(
        getComputedStyle(viewport.closest("[role=tab]")).getPropertyValue(
          "--effect-tab-title-scroll-distance"
        )
      ),
      scrollWidth: track?.scrollWidth || 0,
      title: titledElement?.getAttribute("title") || viewport.getAttribute("title"),
    };
  });
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
  expect(overflow.scrollDistance).toBeGreaterThan(0);
  expect(overflow.title).toBe(longTitle);

  await transitionsTab.evaluate((element) =>
    element.style.setProperty("--effect-tab-title-scroll-duration", "0.8s")
  );
  await transitionsTab.hover();
  await expect
    .poll(
      () =>
        titleTrack.evaluate((element) => {
          const transform = getComputedStyle(element).transform;
          return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
        }),
      { timeout: 5_000 }
    )
    .toBeLessThan(-0.5);
  expect(await titleTrack.evaluate((element) => getComputedStyle(element).animationName)).not.toBe(
    "none"
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(titleTrack).toHaveCSS("animation-name", "none");
  await expect(titleTrack).toHaveCSS("transform", "none");
  await expect(titleTrack).toHaveText(longTitle);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-effect-tabs-overflow-reduced-motion.png"),
  });

  runtime.expectClean();
});

test("resizes both side panels independently while preserving the center workspace", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  const editor = page.getByTestId("video-editor");
  const mediaSeparator = page.locator("#video-editor-media-compose-separator");
  const effectsSeparator = page.locator("#video-editor-compose-effects-separator");
  const mediaPanel = page.locator("#media-panel");
  const composePanel = page.locator("#compose-panel");
  const effectsPanel = page.locator("#effects-panel");
  for (const [separator, controls, minimum, maximum] of [
    [mediaSeparator, "media-panel compose-panel", "220", 360],
    [effectsSeparator, "compose-panel effects-panel", "240", 420],
  ]) {
    await expect(separator).toHaveAttribute("role", "separator");
    await expect(separator).toHaveAttribute("aria-orientation", "vertical");
    await expect(separator).toHaveAttribute("aria-controls", controls);
    await expect(separator).toHaveAttribute("aria-valuemin", minimum);
    expect(Number(await separator.getAttribute("aria-valuemax"))).toBeLessThanOrEqual(
      maximum
    );
  }
  await expect(mediaSeparator).toHaveAttribute("aria-valuenow", "260");
  await expect(effectsSeparator).toHaveAttribute("aria-valuenow", "300");
  await expect(editor).toHaveCSS("--video-editor-media-panel-width", "260px");
  await expect(editor).toHaveCSS("--video-editor-effects-panel-width", "300px");

  await mediaSeparator.focus();
  await mediaSeparator.press("ArrowRight");
  await expect(mediaSeparator).toHaveAttribute("aria-valuenow", "276");
  await expect(effectsSeparator).toHaveAttribute("aria-valuenow", "300");
  await expect(page.locator("#editor-status")).toHaveText(
    "Project Media panel set to 276 pixels."
  );
  await effectsSeparator.focus();
  await effectsSeparator.press("ArrowLeft");
  await expect(effectsSeparator).toHaveAttribute("aria-valuenow", "316");
  await expect(mediaSeparator).toHaveAttribute("aria-valuenow", "276");
  await expect(page.locator("#editor-status")).toHaveText(
    "Effect Editor panel set to 316 pixels."
  );

  await mediaSeparator.press("Home");
  await expect(mediaSeparator).toHaveAttribute("aria-valuenow", "220");
  await mediaSeparator.press("End");
  await expect(mediaSeparator).toHaveAttribute(
    "aria-valuenow",
    await mediaSeparator.getAttribute("aria-valuemax")
  );
  await mediaSeparator.press("Home");
  await effectsSeparator.press("Home");
  await expect(effectsSeparator).toHaveAttribute("aria-valuenow", "240");
  await effectsSeparator.press("End");
  await expect(effectsSeparator).toHaveAttribute(
    "aria-valuenow",
    await effectsSeparator.getAttribute("aria-valuemax")
  );
  await effectsSeparator.press("Home");

  const mediaBounds = await mediaSeparator.boundingBox();
  expect(mediaBounds).not.toBeNull();
  await page.mouse.move(
    mediaBounds.x + mediaBounds.width / 2,
    mediaBounds.y + mediaBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    mediaBounds.x + mediaBounds.width / 2 + 32,
    mediaBounds.y + mediaBounds.height / 2,
    { steps: 4 }
  );
  await page.mouse.up();
  const mediaPointerValue = Number(await mediaSeparator.getAttribute("aria-valuenow"));
  expect(mediaPointerValue).toBeGreaterThanOrEqual(251);
  expect(mediaPointerValue).toBeLessThanOrEqual(253);
  await expect(effectsSeparator).toHaveAttribute("aria-valuenow", "240");

  const effectsBounds = await effectsSeparator.boundingBox();
  expect(effectsBounds).not.toBeNull();
  await page.mouse.move(
    effectsBounds.x + effectsBounds.width / 2,
    effectsBounds.y + effectsBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    effectsBounds.x + effectsBounds.width / 2 - 32,
    effectsBounds.y + effectsBounds.height / 2,
    { steps: 4 }
  );
  await page.mouse.up();
  const effectsPointerValue = Number(await effectsSeparator.getAttribute("aria-valuenow"));
  expect(effectsPointerValue).toBeGreaterThanOrEqual(271);
  expect(effectsPointerValue).toBeLessThanOrEqual(273);
  await expect(mediaSeparator).toHaveAttribute(
    "aria-valuenow",
    String(mediaPointerValue)
  );
  await expect(page.locator("#editor-status")).toHaveText(
    `Effect Editor panel set to ${effectsPointerValue} pixels.`
  );

  const layout = await Promise.all(
    [mediaPanel, composePanel, effectsPanel].map((panel) =>
      panel.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { height: bounds.height, width: bounds.width };
      })
    )
  );
  expect(layout[0].width).toBeCloseTo(mediaPointerValue, 0);
  expect(layout[1].width).toBeGreaterThanOrEqual(420);
  expect(layout[2].width).toBeCloseTo(effectsPointerValue, 0);
  await expect(page.locator("#video-editor-preview-section")).toBeVisible();
  await expect(page.locator("#video-editor-timeline-section")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-side-panel-separators.png"),
  });

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect
    .poll(() =>
      composePanel.evaluate((element) => element.getBoundingClientRect().width)
    )
    .toBeGreaterThanOrEqual(420);
  const dynamicMaximums = {
    effects: Number(await effectsSeparator.getAttribute("aria-valuemax")),
    media: Number(await mediaSeparator.getAttribute("aria-valuemax")),
  };
  expect(dynamicMaximums.media).toBeGreaterThanOrEqual(220);
  expect(dynamicMaximums.media).toBeLessThanOrEqual(360);
  expect(dynamicMaximums.effects).toBeGreaterThanOrEqual(240);
  expect(dynamicMaximums.effects).toBeLessThanOrEqual(420);
  await mediaSeparator.press("End");
  await expect(mediaSeparator).toHaveAttribute(
    "aria-valuenow",
    await mediaSeparator.getAttribute("aria-valuemax")
  );
  await effectsSeparator.press("End");
  await expect(effectsSeparator).toHaveAttribute(
    "aria-valuenow",
    await effectsSeparator.getAttribute("aria-valuemax")
  );
  expect(
    await composePanel.evaluate((element) => element.getBoundingClientRect().width)
  ).toBeGreaterThanOrEqual(420);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-side-panel-separators-1024x800.png"),
  });

  runtime.expectClean();
});

test("contains long names, a busy timeline, and every effect tab at the minimum desktop width", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1024, height: 800 });
  runtime.setOrigin(page.url());

  const longName = `${"local-session-video-editor-".repeat(6)}timeline-tone.wav`;
  await importMedia(page, [
    {
      name: longName,
      mimeType: "audio/wav",
      buffer: createWavBuffer({ durationSeconds: 1 }),
    },
  ]);
  const add = page
    .getByTestId("media-bin")
    .getByRole("button", { name: `Add ${longName} at the playhead` });
  for (let index = 0; index < 12; index += 1) await add.click();

  for (const type of ["closed-captions", "windows-98", "transitions"]) {
    await page.locator(`[data-effect-tab-target][data-effect="${type}"]`).click();
  }

  await expect(page.getByTestId("timeline-tier-audio-1").getByRole("listitem")).toHaveCount(12);
  await expect(page.getByTestId("effect-tab-list").getByRole("tab")).toHaveCount(3);
  const containment = await page.evaluate(() => {
    const mediaName = document.querySelector("[data-media-name]");
    const timeline = document.querySelector("#timeline-scroll");
    return {
      pageOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      longNameContained: mediaName.scrollWidth >= mediaName.clientWidth,
      timelineScrollable: timeline.scrollWidth > timeline.clientWidth,
    };
  });
  expect(containment).toEqual({
    pageOverflow: false,
    longNameContained: true,
    timelineScrollable: true,
  });
  await page.screenshot({
    path: testInfo.outputPath("video-editor-content-stress-1024x800.png"),
  });
  runtime.expectClean();
});
