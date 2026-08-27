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
const audioSyncName = "audio-sync-bursts.wav";
const administratorProofStorageKey = "personalSiteAdministratorProofV1";
const cursorModeStorageKey = "rohin-os-cursor-mode";
const cursorTextHoverClass = "is-custom-cursor-text-hover";
const cursorTextSelectingClass = "is-custom-cursor-text-selecting";
const administratorApiBaseUrl = "https://game-stats.test";
const administratorProof = `${"a".repeat(32)}.${"b".repeat(32)}`;
const administratorCredentials = Object.freeze({
  username: "test-only-administrator",
  password: "test-only-password",
});
const hourInMilliseconds = 60 * 60 * 1_000;
const authClockStart = Date.UTC(2026, 7, 11, 17, 0, 0);

const createPcmWavBuffer = ({ durationSeconds, sampleAt, sampleRate }) => {
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
      Math.max(-1, Math.min(1, sampleAt(sample / sampleRate))) * 30_000
    );
    wav.writeInt16LE(value, 44 + sample * bytesPerSample);
  }

  return wav;
};

const createWavBuffer = ({ durationSeconds = 2, frequency = 440 } = {}) =>
  createPcmWavBuffer({
    durationSeconds,
    sampleRate: 8_000,
    sampleAt: (time) => Math.sin(time * frequency * Math.PI * 2) * (4_000 / 30_000),
  });

const audioSyncBursts = Object.freeze([
  { amplitude: 0.9, end: 0.5, frequency: 120, start: 0.25 },
  { amplitude: 0.82, end: 1.5, frequency: 1_000, start: 1.25 },
  { amplitude: 0.95, end: 2.5, frequency: 3_000, start: 2.25 },
  { amplitude: 0.55, end: 3.5, frequency: 3_000, start: 3.25 },
  { amplitude: 0.44, end: 4.5, frequency: 1_000, start: 4.25 },
  { amplitude: 0.48, end: 5.75, frequency: 120, start: 5.5 },
]);

const createAudioSyncWavBuffer = () =>
  createPcmWavBuffer({
    durationSeconds: 6,
    sampleRate: 16_000,
    sampleAt: (time) => {
      const fadeSeconds = 0.02;
      return audioSyncBursts.reduce((value, burst) => {
        if (time < burst.start || time >= burst.end) return value;
        const edgeDistance = Math.min(time - burst.start, burst.end - time);
        const fadeProgress = Math.min(1, edgeDistance / fadeSeconds);
        const envelope = Math.sin((fadeProgress * Math.PI) / 2) ** 2;
        return (
          value +
          Math.sin((time - burst.start) * burst.frequency * Math.PI * 2) *
            burst.amplitude *
            envelope
        );
      }, 0);
    },
  });

const generatedAudio = () => ({
  name: audioName,
  mimeType: "audio/wav",
  buffer: createWavBuffer(),
});

const generatedAudioSync = () => ({
  name: audioSyncName,
  mimeType: "audio/wav",
  buffer: createAudioSyncWavBuffer(),
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
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
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

const cursorOf = (locator) =>
  locator.evaluate((element) => getComputedStyle(element).cursor);

const expectCursorImage = async (locator, imageName) => {
  await expect
    .poll(() => cursorOf(locator))
    .toContain(`/assets/cursor-assets/${imageName}`);
};

const textDragPoints = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  return locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode && !/\S/.test(textNode.textContent || "")) {
      textNode = walker.nextNode();
    }
    if (!textNode) throw new Error("The cursor test target has no visible text.");
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = Array.from(range.getClientRects()).find(
      (candidate) => candidate.width >= 20 && candidate.height > 0
    );
    if (!rect) throw new Error("The cursor test target has no usable text line.");
    const inset = Math.min(5, Math.max(2, rect.width / 10));
    return {
      end: { x: rect.right - inset, y: rect.top + rect.height / 2 },
      start: { x: rect.left + inset, y: rect.top + rect.height / 2 },
    };
  });
};

const expectCursorSelectionState = async (page, active) => {
  await expect
    .poll(() =>
      page.evaluate(
        (className) => ({
          body: document.body.classList.contains(className),
          root: document.documentElement.classList.contains(className),
        }),
        cursorTextSelectingClass
      )
    )
    .toEqual({ body: active, root: active });
};

const expectNoPageOverflow = async (page) => {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        horizontal: document.documentElement.scrollWidth > window.innerWidth,
        vertical: document.documentElement.scrollHeight > window.innerHeight,
      }))
    )
    .toEqual({ horizontal: false, vertical: false });
};

const expectReadablePixelText = async (locator) => {
  const metrics = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const textRects = Array.from(range.getClientRects(), (rect) => ({
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
    }));
    return {
      bounds: {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
      },
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      fontFamily: style.fontFamily,
      fontSize: Number.parseFloat(style.fontSize),
      letterSpacing: style.letterSpacing,
      lineHeight: Number.parseFloat(style.lineHeight),
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      textRects,
    };
  });

  expect(metrics.fontFamily).toContain("Pixelated MS Sans Serif");
  expect(metrics.fontSize).toBeGreaterThanOrEqual(11);
  expect(metrics.lineHeight).toBeGreaterThanOrEqual(14);
  expect(metrics.letterSpacing).not.toMatch(/^-/);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.textRects.length).toBeGreaterThan(0);
  for (const rect of metrics.textRects) {
    expect(rect.top).toBeGreaterThanOrEqual(metrics.bounds.top - 1);
    expect(rect.bottom).toBeLessThanOrEqual(metrics.bounds.bottom + 1);
    expect(rect.left).toBeGreaterThanOrEqual(metrics.bounds.left - 1);
    expect(rect.right).toBeLessThanOrEqual(metrics.bounds.right + 1);
  }
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

const audioSyncRuleCards = (page) =>
  page.locator("#audio-sync-rules [data-audio-sync-rule-id]");

const accessibleGuideposts = (rule) =>
  rule.locator("[data-audio-sync-marker-list] [data-guidepost-id]");

const addAudioSyncClip = async (page) => {
  await importMedia(page, [generatedAudioSync()]);
  await page
    .getByTestId("media-bin")
    .getByRole("button", { name: `Add ${audioSyncName} at the playhead` })
    .click();
  const clip = page
    .getByTestId("timeline-tier-audio-1")
    .locator("article[data-clip-id]");
  await expect(clip).toHaveCount(1);
  return clip;
};

const analyzeAudioSyncClip = async (page) => {
  await page.locator('[data-effect-tab-target][data-effect="audio-sync-cut"]').click();
  const panel = page.getByRole("tabpanel", { name: "Audio-Sync Cut" });
  await expect(panel).toBeVisible();
  const source = page.getByLabel("Audio timeline clip", { exact: true });
  await expect(source.locator("option")).toHaveCount(2);
  await source.selectOption({ index: 1 });
  const startedAt = Date.now();
  await panel.getByRole("button", { name: "Analyze source" }).click();
  await expect(panel.locator("[data-audio-sync-status]")).toContainText(
    new RegExp(`Analyzed ${audioSyncName}: 00:06\\.00 at \\d+ Hz\\.`),
    { timeout: 20_000 }
  );
  expect(Date.now() - startedAt, "six-second local analysis should remain responsive").toBeLessThan(
    15_000
  );
  return panel;
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

  await password.fill("mask-visual-test-value-1234");
  await expect(password).toHaveAttribute("type", "password");
  expect(
    await password.evaluate((input) => {
      const style = getComputedStyle(input);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontSmoothing: style.webkitFontSmoothing,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
      };
    })
  ).toEqual({
    fontFamily: "Arial, sans-serif",
    fontSize: "13px",
    fontSmoothing: "auto",
    letterSpacing: "1px",
    lineHeight: "normal",
  });

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
  const guidelinePlatform = page.locator("#video-editor-guidelines-platform");
  const guidelineInfo = page.locator("#video-editor-guidelines-info");
  await expect(guidelineInfo).toHaveAttribute("aria-label", /About UI guidelines/i);
  await expect(guidelinePlatform).toHaveValue("none");
  await expect(guidelinePlatform.click({ timeout: 750 })).rejects.toThrow();
  await expect(guidelinePlatform).toHaveValue("none");
  await expect(guidelineInfo.click({ timeout: 750 })).rejects.toThrow();
  await expect(page.locator("#video-editor-guidelines-note")).toBeHidden();
  await expect(page.locator("#video-editor-social-guidelines-overlay")).toBeHidden();
  for (const tool of ["audio-sync-cut", "audio"]) {
    const launcher = page.locator(
      `[data-effect-tab-target][data-effect="${tool}"]`
    );
    await expect(launcher).toBeVisible();
    await expect(launcher.click({ timeout: 750 })).rejects.toThrow();
  }
  await expect(page.locator("#effect-panel-audio-sync-cut")).toBeHidden();
  await expect(page.locator("#effect-panel-audio")).toBeHidden();

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
      await expect(page.locator("#video-editor-guidelines")).toBeHidden();
      await expect(page.locator("#video-editor-social-guidelines-overlay")).toBeHidden();
      await expect(
        page.locator('[data-effect-tab-target][data-effect="audio-sync-cut"]')
      ).toBeHidden();
      await expect(page.locator('[data-effect-tab-target][data-effect="audio"]')).toBeHidden();
      await page.screenshot({
        path: testInfo.outputPath(`video-editor-unauthenticated-${viewport.name}.png`),
      });
    });
  }

  runtime.expectClean();
});

test("loads the shared cursor resources and synchronizes saved light and dark modes", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());
  await expectAuthenticated(page);

  expect(
    await page.evaluate((key) => localStorage.getItem(key), cursorModeStorageKey)
  ).toBeNull();
  await expect(page.locator("html")).not.toHaveClass(/is-cursor-dark-mode/);
  await expect(page.locator("body")).not.toHaveClass(/is-cursor-dark-mode/);
  await expectCursorImage(
    page.locator("body"),
    "generated-png/normal-light.png"
  );
  await expectCursorImage(
    page.locator("#import-media-button"),
    "generated-png/select-light.png"
  );

  const peer = await page.context().newPage();
  await peer.goto(editorUrl, { waitUntil: "domcontentloaded" });
  await peer.evaluate((key) => localStorage.setItem(key, "dark"), cursorModeStorageKey);
  await expect(page.locator("html")).toHaveClass(/is-cursor-dark-mode/);
  await expect(page.locator("body")).toHaveClass(/is-cursor-dark-mode/);
  await expectCursorImage(
    page.locator("body"),
    "generated-png/normal-dark.png"
  );
  await expectCursorImage(
    page.locator("#import-media-button"),
    "generated-png/select-dark.png"
  );
  await page.screenshot({
    path: testInfo.outputPath("video-editor-cursors-dark-desktop.png"),
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectAuthenticated(page);
  await expect(page.locator("html")).toHaveClass(/is-cursor-dark-mode/);
  await expect(page.locator("body")).toHaveClass(/is-cursor-dark-mode/);
  await page.evaluate(() => {
    document.documentElement.classList.remove("is-cursor-dark-mode");
    document.body.classList.remove("is-cursor-dark-mode");
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });
  await expect(page.locator("html")).toHaveClass(/is-cursor-dark-mode/);
  await expect(page.locator("body")).toHaveClass(/is-cursor-dark-mode/);

  await peer.evaluate((key) => localStorage.setItem(key, "light"), cursorModeStorageKey);
  await expect(page.locator("html")).not.toHaveClass(/is-cursor-dark-mode/);
  await expect(page.locator("body")).not.toHaveClass(/is-cursor-dark-mode/);
  await expectCursorImage(
    page.locator("body"),
    "generated-png/normal-light.png"
  );

  const cursorResources = [
    "/styles/home/cursors.css?v=text-selection-cursor-20260810",
    "/scripts/home/text-selection-cursor.js?v=video-editor-cursor-guards-20260826",
    "/video-editor/cursor.js?v=video-editor-cursors-20260826",
    ...["light", "dark"].flatMap((mode) =>
      [
        "normal",
        "select",
        "text",
        "unavailable",
        "move",
        "precision",
        "resize-ew",
        "resize-ns",
      ].map(
        (name) => `/assets/cursor-assets/generated-png/${name}-${mode}.png`
      )
    ),
    "/assets/cursor-assets/Jeelh-Cursor-Light/working-in-background-frames/working-in-background-light-1.png",
    "/assets/cursor-assets/Jeelh-Cursor-Dark/working-in-background-frames/working-in-background-1.png",
  ];
  for (const resource of cursorResources) {
    const response = await page.request.get(new URL(resource, page.url()).href);
    expect(response.status(), `${resource} should load locally`).toBe(200);
  }

  await peer.evaluate((key) => localStorage.setItem(key, "dark"), cursorModeStorageKey);
  await expect(page.locator("body")).toHaveClass(/is-cursor-dark-mode/);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByTestId("desktop-required")).toBeVisible();
  await expect(page.getByTestId("video-editor")).toBeHidden();
  await expect(page.getByTestId("video-editor-auth-overlay")).toBeHidden();
  await expectCursorImage(
    page.locator("body"),
    "generated-png/normal-dark.png"
  );
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-cursors-dark-mobile.png"),
  });

  await peer.close();
  runtime.expectClean();
});

test("uses working cursors while authentication keeps the editor inert", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  let releaseSignIn;
  const signInGate = new Promise((resolve) => {
    releaseSignIn = resolve;
  });
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "${administratorApiBaseUrl}", buildVersion: "sha256-${"a".repeat(64)}" });`,
    })
  );
  await page.route(`${administratorApiBaseUrl}/administrator/sign-in`, async (route) => {
    await signInGate;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        expiresAt: new Date(Date.now() + hourInMilliseconds).toISOString(),
        ok: true,
        profile: {
          icon: "assets/neko-assets/sprites/yawn1.png",
          id: "player-rohin-neko",
          name: "rohin ^.^",
        },
        proof: administratorProof,
      }),
    });
  });

  await loadEditor(
    page,
    { width: 1280, height: 800 },
    { administratorAccess: "none" }
  );
  runtime.setOrigin(page.url());
  const editor = page.getByTestId("video-editor");
  const form = page.getByTestId("video-editor-auth-form");
  await expect(editor).toHaveAttribute("inert", "");
  await expectCursorImage(
    page.getByLabel("Username"),
    "generated-png/text-light.png"
  );
  await signIn(page);
  await expect(form).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("body")).toHaveClass(/is-custom-cursor-loading/);
  await expect(page.locator("body")).toHaveClass(
    /is-custom-cursor-loading-frame-[1-9]/
  );
  await expectCursorImage(
    form,
    "Jeelh-Cursor-Light/working-in-background-frames/working-in-background-light-"
  );
  await expectCursorImage(
    page.locator("body"),
    "Jeelh-Cursor-Light/working-in-background-frames/working-in-background-light-"
  );
  await expect(editor).toHaveAttribute("inert", "");
  await page.screenshot({
    path: testInfo.outputPath("video-editor-auth-working-cursor.png"),
  });

  releaseSignIn();
  await expectAuthenticated(page);
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await expect(page.locator("body")).not.toHaveClass(
    /is-custom-cursor-loading-frame-/
  );
  runtime.expectClean();
});

test("keeps semantic cursors through text selection, resizing, and native dragging", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());
  await expectAuthenticated(page);

  const selectableCopy = page.locator("#media-empty-state small");
  const textPoints = await textDragPoints(selectableCopy);
  await page.mouse.move(textPoints.start.x, textPoints.start.y);
  await expect(selectableCopy).toHaveClass(
    new RegExp(`(?:^|\\s)${cursorTextHoverClass}(?:\\s|$)`)
  );
  await expectCursorImage(
    selectableCopy,
    "generated-png/text-light.png"
  );
  await page.mouse.down();
  await page.mouse.move(textPoints.end.x, textPoints.end.y, { steps: 8 });
  await expectCursorSelectionState(page, true);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBeTruthy();
  await expectCursorImage(
    page.locator("body"),
    "generated-png/text-light.png"
  );
  await page.mouse.up();
  await expectCursorSelectionState(page, false);
  await page.locator("#import-media-button").hover();
  await expect(selectableCopy).not.toHaveClass(
    new RegExp(`(?:^|\\s)${cursorTextHoverClass}(?:\\s|$)`)
  );

  await expectCursorImage(
    page.locator("body"),
    "generated-png/normal-light.png"
  );
  await expectCursorImage(
    page.locator("#media-panel-title"),
    "generated-png/normal-light.png"
  );
  await expectCursorImage(
    page.locator("#import-media-button"),
    "generated-png/select-light.png"
  );
  await expectCursorImage(
    page.locator("#video-editor-guidelines-info"),
    "generated-png/help-light.png"
  );

  await page.locator("#video-editor-frame-preset").selectOption("custom");
  await expectCursorImage(
    page.locator("#video-editor-frame-custom-width"),
    "generated-png/text-light.png"
  );
  await expectCursorImage(
    page.locator("#playhead-scrubber"),
    "generated-png/precision-light.png"
  );
  await expectCursorImage(
    page.locator("#timeline-ruler"),
    "generated-png/precision-light.png"
  );
  const rulerLabel = page.locator("#timeline-ruler .timeline-ruler__label").first();
  const rulerLabelPoints = await textDragPoints(rulerLabel);
  await page.mouse.move(rulerLabelPoints.start.x, rulerLabelPoints.start.y);
  await expect
    .poll(() =>
      page.evaluate(
        (className) => document.querySelectorAll(`.${className}`).length,
        cursorTextHoverClass
      )
    )
    .toBe(0);
  await expectCursorImage(
    rulerLabel,
    "generated-png/precision-light.png"
  );
  await expectCursorImage(
    page.getByTestId("timeline-scale"),
    "generated-png/select-light.png"
  );
  await expectCursorImage(
    page.locator("#video-editor-media-compose-separator"),
    "generated-png/resize-ew-light.png"
  );
  await expectCursorImage(
    page.locator("#video-editor-preview-timeline-separator"),
    "generated-png/resize-ns-light.png"
  );

  await page.locator('[data-effect-tab-target][data-effect="audio-sync-cut"]').click();
  const analyze = page.getByRole("button", { name: "Analyze source" });
  await expect(analyze).toBeDisabled();
  await expectCursorImage(
    analyze,
    "generated-png/unavailable-light.png"
  );

  const standardLayout = page.locator(
    '[data-video-editor-workspace-layout-option="standard"]'
  );
  const standardBounds = await standardLayout.boundingBox();
  expect(standardBounds).not.toBeNull();
  await page.mouse.move(
    standardBounds.x + standardBounds.width / 2,
    standardBounds.y + standardBounds.height / 2
  );
  await page.mouse.down();
  await expectCursorImage(
    standardLayout,
    "generated-png/move-light.png"
  );
  await page.mouse.move(1, 1);
  await page.mouse.up();

  const mediaSeparator = page.locator("#video-editor-media-compose-separator");
  const mediaSeparatorBounds = await mediaSeparator.boundingBox();
  expect(mediaSeparatorBounds).not.toBeNull();
  await page.mouse.move(
    mediaSeparatorBounds.x + mediaSeparatorBounds.width / 2,
    mediaSeparatorBounds.y + mediaSeparatorBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(mediaSeparatorBounds.x + 20, mediaSeparatorBounds.y + 20, {
    steps: 4,
  });
  await expect(page.locator("body")).toHaveClass(/is-video-editor-resizing-ew/);
  await expectCursorImage(
    page.locator("body"),
    "generated-png/resize-ew-light.png"
  );
  await page.mouse.up();
  await expect(page.locator("body")).not.toHaveClass(/is-video-editor-resizing-ew/);

  const previewSeparator = page.locator("#video-editor-preview-timeline-separator");
  const previewSeparatorBounds = await previewSeparator.boundingBox();
  expect(previewSeparatorBounds).not.toBeNull();
  await page.mouse.move(
    previewSeparatorBounds.x + previewSeparatorBounds.width / 2,
    previewSeparatorBounds.y + previewSeparatorBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    previewSeparatorBounds.x + previewSeparatorBounds.width / 2,
    previewSeparatorBounds.y + 16,
    { steps: 4 }
  );
  await expect(page.locator("body")).toHaveClass(/is-video-editor-resizing-ns/);
  await expectCursorImage(
    page.locator("body"),
    "generated-png/resize-ns-light.png"
  );
  await page.mouse.up();
  await expect(page.locator("body")).not.toHaveClass(/is-video-editor-resizing-ns/);

  await page
    .locator('[data-video-editor-workspace-layout-option="side-by-side"]')
    .click();
  await expectCursorImage(
    previewSeparator,
    "generated-png/resize-ew-light.png"
  );

  await page.evaluate(() => {
    window.__videoEditorImportCursorStates = [];
    const app = document.querySelector("#video-editor-app");
    new MutationObserver(() => {
      const busy = app.getAttribute("aria-busy") === "true";
      const states = window.__videoEditorImportCursorStates;
      if (states.at(-1)?.busy === busy) return;
      states.push({
        bodyLoading: document.body.classList.contains("is-custom-cursor-loading"),
        busy,
        cursor: getComputedStyle(app).cursor,
      });
    }).observe(app, { attributes: true, attributeFilter: ["aria-busy"] });
  });
  await importMedia(page, [generatedAudio()]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__videoEditorImportCursorStates.map(({ busy }) => busy)
      )
    )
    .toEqual([true, false]);
  const importCursorStates = await page.evaluate(
    () => window.__videoEditorImportCursorStates
  );
  expect(importCursorStates[0].bodyLoading).toBe(true);
  expect(importCursorStates[0].cursor).toContain(
    "/assets/cursor-assets/Jeelh-Cursor-Light/working-in-background-frames/"
  );
  await expect(page.getByTestId("video-editor")).toHaveAttribute(
    "aria-busy",
    "false"
  );
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  const mediaItem = page.getByTestId("media-bin").locator('[data-media-id][draggable="true"]');
  await expectCursorImage(
    mediaItem,
    "generated-png/move-light.png"
  );
  const mediaName = mediaItem.locator("[data-media-name]");
  const mediaNamePoints = await textDragPoints(mediaName);
  await page.mouse.move(mediaNamePoints.start.x, mediaNamePoints.start.y);
  await expect
    .poll(() =>
      page.evaluate(
        (className) => document.querySelectorAll(`.${className}`).length,
        cursorTextHoverClass
      )
    )
    .toBe(0);
  await page.locator('[data-effect-tab-target][data-effect="audio"]').click();
  const draggableTab = page.getByRole("tab", { name: "Audio-Sync Cut" });
  const dragTarget = page.getByRole("tab", { name: "Audio", exact: true });
  const cancelledButtonDrag = await draggableTab
    .locator("[data-close-effect-tab]")
    .evaluate((button) => {
      const event = new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      button.dispatchEvent(event);
      return {
        defaultPrevented: event.defaultPrevented,
        holding: document.body.classList.contains("is-holding-pointer-item"),
      };
    });
  expect(cancelledButtonDrag).toEqual({ defaultPrevented: true, holding: false });
  await page.evaluate(() => {
    window.__videoEditorDragCursorStates = [];
    for (const eventName of ["dragstart", "dragend"]) {
      document.addEventListener(eventName, () => {
        window.__videoEditorDragCursorStates.push({
          cursor: getComputedStyle(document.body).cursor,
          eventName,
          holding: document.body.classList.contains("is-holding-pointer-item"),
        });
      });
    }
  });
  await draggableTab.dragTo(dragTarget, {
    sourcePosition: { x: 12, y: 13 },
    targetPosition: { x: 12, y: 13 },
  });
  const dragCursorStates = await page.evaluate(
    () => window.__videoEditorDragCursorStates
  );
  const dragStartCursor = dragCursorStates.find(
    ({ eventName }) => eventName === "dragstart"
  );
  expect(dragStartCursor?.holding).toBe(true);
  expect(dragStartCursor?.cursor).toContain(
    "/assets/cursor-assets/generated-png/move-light.png"
  );
  await expect(page.locator("body")).not.toHaveClass(/is-holding-pointer-item/);

  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-semantic-custom-cursors.png"),
  });
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

test("shows documented platform-specific UI guidelines only for fixed 9:16 frames", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  const controls = page.getByRole("group", { name: "UI Guidelines" });
  const platform = page.locator("#video-editor-guidelines-platform");
  const info = page.getByRole("button", { name: /About UI guidelines/i });
  const tooltip = page.locator("#video-editor-guidelines-note");
  const preset = page.getByLabel("Frame size", { exact: true });
  const overlay = page.locator("#video-editor-social-guidelines-overlay");
  const status = page.locator("#editor-status");
  await expect(controls).toBeVisible();
  await expect(controls).toHaveAttribute("data-guidelines-state", "off");
  await expect(controls.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(platform).toHaveValue("none");
  await expect(platform).toHaveAttribute("aria-describedby", "video-editor-guidelines-note");
  await expect(platform).toHaveAttribute(
    "aria-controls",
    "video-editor-social-guidelines-overlay"
  );
  await expect(platform.locator("option")).toHaveText([
    "None",
    "Instagram Reels",
    "TikTok",
  ]);
  await expect(info).toHaveAttribute("aria-describedby", "video-editor-guidelines-note");
  await expect(tooltip).toHaveAttribute("role", "tooltip");
  await expect(tooltip).toBeHidden();
  await expect(tooltip).toContainText(
    /rough.*iPhone 15 Pro screenshots.*updated.*August 2026.*UI varies/is
  );
  await info.hover();
  await expect(tooltip).toBeVisible();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  await info.focus();
  await expect(info).toBeFocused();
  await expect(tooltip).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("video-editor-guidelines-info-tooltip.png"),
  });
  await platform.focus();
  await expect(tooltip).toBeHidden();
  await expect(overlay).toBeHidden();
  await expect(overlay).toHaveAttribute("hidden", "");
  await expect(overlay).toHaveAttribute("aria-hidden", "true");

  await platform.selectOption("instagram-reels");
  await expect(platform).toHaveValue("instagram-reels");
  await expect(overlay).toBeHidden();
  await expect(controls).toHaveAttribute("data-guidelines-state", "paused");
  await expect(status).toContainText(/Instagram Reels.*UI guidelines/i);

  await preset.selectOption("9:16");
  await expect(overlay).toBeVisible();
  await expect(overlay).not.toHaveAttribute("hidden", "");
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(overlay).toHaveAttribute("data-guideline-platform", "instagram-reels");
  await expect(controls).toHaveAttribute("data-guidelines-state", "visible");
  for (const label of [
    "Top controls",
    "Like / comment / share",
    "Caption / audio / navigation",
    "Safe content area",
  ]) {
    await expect(overlay.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(overlay).toHaveCSS("pointer-events", "none");

  const readGeometry = () =>
    overlay.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const rectangle = (selector) =>
        element.querySelector(selector).getBoundingClientRect();
      const top = rectangle('[data-guideline-zone="top"]');
      const right = rectangle('[data-guideline-zone="right"]');
      const bottom = rectangle('[data-guideline-zone="bottom"]');
      const safe = element.querySelector("[data-guideline-safe-area]");
      return {
        bottomHeight: bottom.height / bounds.height,
        rightEdge: (bounds.right - right.right) / bounds.width,
        rightBottom: (bounds.bottom - right.bottom) / bounds.height,
        rightTop: (right.top - bounds.top) / bounds.height,
        rightWidth: right.width / bounds.width,
        safeClipPath: getComputedStyle(safe).clipPath,
        topLeft: (top.left - bounds.left) / bounds.width,
        topRight: (bounds.right - top.right) / bounds.width,
        topHeight: top.height / bounds.height,
      };
    });
  const expectGeometry = (actual, expected) => {
    for (const [name, value] of Object.entries(expected)) {
      expect(Math.abs(actual[name] - value), `${name} guideline ratio`).toBeLessThanOrEqual(
        0.015
      );
    }
  };

  expectGeometry(await readGeometry(), {
    bottomHeight: 0.32,
    rightBottom: 0.11,
    rightEdge: 0,
    rightTop: 0.4,
    rightWidth: 0.18,
    topHeight: 0.135,
    topLeft: 0,
    topRight: 0,
  });
  expect((await readGeometry()).safeClipPath).toBe(
    "polygon(5.5% 14%, 94.5% 14%, 94.5% 39%, 80% 39%, 80% 65%, 5.5% 65%)"
  );
  expect(
    await overlay.evaluate((element) => {
      const zone = element.querySelector('[data-guideline-zone="top"]');
      const bounds = zone.getBoundingClientRect();
      const hit = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2
      );
      return Boolean(hit?.closest("#video-editor-social-guidelines-overlay"));
    })
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-guidelines-instagram-reels.png"),
  });

  await platform.focus();
  await expect(platform).toBeFocused();
  await platform.selectOption("tiktok");
  await expect(platform).toHaveValue("tiktok");
  await expect(overlay).toHaveAttribute("data-guideline-platform", "tiktok");
  await expect(status).toHaveText("TikTok UI guidelines shown.");
  for (const label of [
    "Feed header",
    "Like / comment / save / share",
    "Caption / sound / navigation",
  ]) {
    await expect(overlay.getByText(label, { exact: true })).toBeVisible();
  }
  expectGeometry(await readGeometry(), {
    bottomHeight: 0.31,
    rightBottom: 0.1,
    rightEdge: 0,
    rightTop: 0.41,
    rightWidth: 0.18,
    topHeight: 0.13,
    topLeft: 0,
    topRight: 0,
  });
  expect((await readGeometry()).safeClipPath).toBe(
    "polygon(5% 13%, 95% 13%, 95% 40%, 81% 40%, 81% 68%, 5% 68%)"
  );
  await page.screenshot({
    path: testInfo.outputPath("video-editor-guidelines-tiktok.png"),
  });

  for (const unsupportedPreset of ["16:9", "4:5", "custom", "none"]) {
    await test.step(`guidelines pause for ${unsupportedPreset}`, async () => {
      await preset.selectOption(unsupportedPreset);
      await expect(platform).toHaveValue("tiktok");
      await expect(overlay).toBeHidden();
      await expect(overlay).toHaveAttribute("aria-hidden", "true");
      await expect(controls).toHaveAttribute("data-guidelines-state", "paused");
    });
  }

  await preset.selectOption("9:16");
  await expect(platform).toHaveValue("tiktok");
  await expect(overlay).toBeVisible();
  for (const viewport of [
    { width: 1024, height: 800, name: "minimum-desktop" },
    { width: 1280, height: 800, name: "desktop" },
    { width: 1440, height: 900, name: "wide" },
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await expect(overlay).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        )
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`video-editor-guidelines-${viewport.name}.png`),
      });
    });
  }

  await platform.selectOption("none");
  await expect(platform).toHaveValue("none");
  await expect(controls).toHaveAttribute("data-guidelines-state", "off");
  await expect(overlay).toBeHidden();
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(status).toContainText(/UI guidelines.*hidden/i);

  runtime.expectClean();
});

test("keeps small pixel-font labels readable without glyph clipping", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1024, height: 800 });
  runtime.setOrigin(page.url());
  await expectAuthenticated(page);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check('11px "Pixelated MS Sans Serif"'))
  ).toBe(true);

  const info = page.getByRole("button", { name: /About UI guidelines/i });
  const tooltip = page.locator("#video-editor-guidelines-note");
  const preset = page.getByLabel("Frame size", { exact: true });
  const platform = page.locator("#video-editor-guidelines-platform");

  for (const viewport of [
    { height: 800, name: "1024x800", width: 1024 },
    { height: 800, name: "1280x800", width: 1280 },
    { height: 900, name: "1440x900", width: 1440 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectReadablePixelText(page.locator("#preview-clip-name"));
    await expectReadablePixelText(page.locator("#media-empty-state small"));
    await expectReadablePixelText(page.locator("#timeline-ruler .timeline-ruler__label").first());
    await expectReadablePixelText(page.locator("[data-track-empty]").first());

    await info.focus();
    await expect(tooltip).toBeVisible();
    await expectReadablePixelText(tooltip);

    await platform.focus();
    await expect(tooltip).toBeHidden();
    await platform.selectOption("instagram-reels");
    await preset.selectOption("9:16");
    const guidelineLabels = page.locator(
      "#video-editor-social-guidelines-overlay [data-guideline-zone] > span, " +
        "#video-editor-social-guidelines-overlay [data-guideline-safe-area] > span"
    );
    await expect(guidelineLabels).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      await expectReadablePixelText(guidelineLabels.nth(index));
    }

    await expectNoPageOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`video-editor-readable-small-type-${viewport.name}.png`),
    });
    await platform.selectOption("none");
    await preset.selectOption("none");
  }

  runtime.expectClean();
});

test("loads local Pixelarticons and preserves semantic action-button states", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  const play = page.locator("#play-pause-button");
  const playbackIcon = play.locator("img");
  await expect(play).toHaveAccessibleName("Play");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(playbackIcon).toHaveAttribute("src", /assets\/pixelarticons\/play\.svg$/);
  await expect(playbackIcon).toHaveAttribute("alt", "");
  await expect(playbackIcon).toHaveAttribute("aria-hidden", "true");
  await play.click();
  const pause = page.locator("#play-pause-button");
  await expect(pause).toHaveAccessibleName("Pause");
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(playbackIcon).toHaveAttribute("src", /assets\/pixelarticons\/pause\.svg$/);
  await pause.click();
  await expect(play).toHaveAccessibleName("Play");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(playbackIcon).toHaveAttribute("src", /assets\/pixelarticons\/play\.svg$/);

  await expect(page.locator("#media-drop-zone img")).toHaveAttribute(
    "src",
    /assets\/pixelarticons\/download\.svg$/
  );
  await expect(page.locator("#video-editor-guidelines-info img")).toHaveAttribute(
    "src",
    /assets\/pixelarticons\/info-box\.svg$/
  );

  await importMedia(page, [generatedAudio()]);
  await page
    .getByTestId("media-bin")
    .getByRole("button", { name: `Add ${audioName} at the playhead` })
    .click();
  const clipDelete = page
    .getByTestId("timeline-tier-audio-1")
    .getByRole("button", { name: `Delete ${audioName}` });
  await expect(clipDelete.locator("img")).toHaveAttribute(
    "src",
    /assets\/pixelarticons\/delete\.svg$/
  );

  await page.locator('[data-effect-tab-target][data-effect="closed-captions"]').click();
  const closeTab = page.getByRole("button", { name: "Close Closed Captions tab" });
  await expect(closeTab.locator("img")).toHaveAttribute(
    "src",
    /assets\/pixelarticons\/close\.svg$/
  );
  await page
    .getByRole("tabpanel", { name: "Closed Captions" })
    .getByRole("button", { name: "Add to timeline" })
    .click();
  const effectDelete = page
    .getByTestId("effects-lane")
    .getByRole("button", { name: "Delete Closed Captions effect" });
  await expect(effectDelete.locator("img")).toHaveAttribute(
    "src",
    /assets\/pixelarticons\/delete\.svg$/
  );

  const icons = page.locator('img[src*="/assets/pixelarticons/"]');
  const iconStates = await icons.evaluateAll((images) =>
    images.map((image) => ({
      alt: image.getAttribute("alt"),
      ariaHidden: image.getAttribute("aria-hidden"),
      src: image.src,
    }))
  );
  expect(iconStates.length).toBeGreaterThanOrEqual(6);
  for (const icon of iconStates) {
    expect(icon.alt).toBe("");
    expect(icon.ariaHidden).toBe("true");
  }
  const iconUrls = ["play", "pause", "download", "info-box", "close", "delete"].map(
    (name) => new URL(`/assets/pixelarticons/${name}.svg`, page.url()).toString()
  );
  for (const src of iconUrls) {
    const response = await page.request.get(src);
    expect(response.status(), `${src} should be served locally`).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
  }
  expect(
    await page.locator("button").evaluateAll((buttons) =>
      buttons.some((button) => /[▶⏵►Ⅱ⏸⇩⬇ℹⓘ×✕✖]/u.test(button.textContent || ""))
    )
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-pixelarticon-controls.png"),
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
  await page.getByRole("button", { name: "Audio", exact: true }).focus();
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
  await expect(page.getByRole("button", { name: "Reopen closed tab" })).toHaveCount(0);
  const defaultEffectTab = page.getByRole("tab", { name: "Effect editor home" });
  await expect(page.getByTestId("effect-tab-list").getByRole("tab")).toHaveCount(1);
  await expect(defaultEffectTab).toHaveAttribute("aria-selected", "true");
  await expect(defaultEffectTab).toHaveAttribute("tabindex", "0");
  await expect(defaultEffectTab).toHaveAttribute("draggable", "false");
  await expect(page.getByRole("tabpanel", { name: "Effect editor home" })).toBeVisible();
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
  const homeTab = page.getByRole("tab", { name: "Effect editor home" });
  await expect(homeTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Effect editor home" })).toBeVisible();
  await launchEffect("closed-captions").click();
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Closed Captions" })).toBeVisible();
  await launchEffect("windows-98").click();
  await launchEffect("transitions").click();
  await expect(page.getByRole("tab", { name: "Transitions" })).toBeFocused();
  await expect(homeTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByTestId("effect-tab-list").getByRole("tab")).toHaveCount(4);
  expect(await tabLabels(page)).toEqual([
    "Closed Captions",
    "Windows 98",
    "Transitions",
  ]);

  await homeTab.focus();
  await homeTab.press("Delete");
  await homeTab.press("Control+ArrowRight");
  await expect(homeTab).toHaveCount(1);
  await expect(homeTab).toHaveAttribute("draggable", "false");
  expect(await tabLabels(page)).toEqual([
    "Closed Captions",
    "Windows 98",
    "Transitions",
  ]);
  await homeTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toBeFocused();
  await page.getByRole("tab", { name: "Closed Captions" }).press("ArrowLeft");
  await expect(homeTab).toBeFocused();
  await homeTab.press("End");
  await expect(page.getByRole("tab", { name: "Transitions" })).toBeFocused();
  await page.getByRole("tab", { name: "Transitions" }).press("Home");
  await expect(homeTab).toBeFocused();
  await homeTab.click();
  await expect(homeTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Effect editor home" })).toBeVisible();
  await launchEffect("transitions").click();

  const draggedTab = page.locator(
    '[data-effect-tab-wrapper][data-effect="windows-98"]'
  );
  const dragTarget = page.locator(
    '[data-effect-tab-wrapper][data-effect="closed-captions"]'
  );
  await page.locator(".effect-tab-scroll").evaluate((element) => {
    element.scrollLeft = 0;
  });
  await draggedTab.dragTo(dragTarget, {
    sourcePosition: { x: 12, y: 13 },
    targetPosition: { x: 12, y: 13 },
  });
  expect(await tabLabels(page)).toEqual([
    "Windows 98",
    "Closed Captions",
    "Transitions",
  ]);
  await expect(page.locator("#editor-status")).toContainText(
    "Windows 98 tab moved to position 2"
  );

  await launchEffect("closed-captions").click();
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toBeFocused();
  await expect(page.getByTestId("effect-tab-list").getByRole("tab")).toHaveCount(4);
  await page.getByRole("tab", { name: "Closed Captions" }).press("Control+ArrowRight");
  expect(await tabLabels(page)).toEqual([
    "Windows 98",
    "Transitions",
    "Closed Captions",
  ]);
  await expect(page.locator("#editor-status")).toContainText(
    "Closed Captions tab moved to position 4"
  );

  await page.getByRole("tab", { name: "Closed Captions" }).press("Delete");
  await expect(page.getByRole("tab", { name: "Closed Captions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reopen closed tab" })).toHaveCount(0);
  await launchEffect("closed-captions").click();
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
  await expect(
    effectsLane.locator('[data-effect="closed-captions"] [data-effect-item-icon]')
  ).toHaveAttribute(
    "src",
    /accessibility_window_speak\.ico$/
  );
  await expect(
    effectsLane.locator('[data-effect="windows-98"] [data-effect-item-icon]')
  ).toHaveAttribute(
    "src",
    /windows\.ico$/
  );
  await expect(
    effectsLane.locator('[data-effect="transitions"] [data-effect-item-icon]')
  ).toHaveAttribute(
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
  await expect(directTabs).toHaveCount(4);
  await expect(directTabs.last()).toHaveAttribute("aria-selected", "true");
  await expect(directTabs.first()).toHaveAttribute("aria-selected", "false");
  const defaultTab = tabList.locator(":scope > li[data-effect-default-tab]");
  await expect(defaultTab).toHaveAccessibleName("Effect editor home");
  await expect(defaultTab).toHaveAttribute("draggable", "false");
  await expect(defaultTab).not.toHaveAttribute("data-effect-tab-wrapper", "");
  await expect(defaultTab.locator("[data-close-effect-tab]")).toHaveCount(0);
  await expect(defaultTab.locator("[data-effect-tab-title-track]")).toHaveCount(0);
  await expect(defaultTab.locator("img")).toHaveAttribute(
    "src",
    /directory_program_group_cool\.ico$/
  );
  await expect(page.getByRole("button", { name: "Reopen closed tab" })).toHaveCount(0);
  await expect(page.getByText("Tabs", { exact: true })).toHaveCount(0);
  await expect(page.locator("#effects-panel > .title-bar")).toHaveCount(0);

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
    await expect(close.locator('img[aria-hidden="true"]')).toHaveAttribute(
      "src",
      /assets\/pixelarticons\/close\.svg$/
    );
  }

  const stripGeometry = await page.locator(".effect-tab-scroll").evaluate((scroll) => {
    const panel = scroll.closest("#effects-panel");
    const defaultItem = scroll.querySelector("[data-effect-default-tab]");
    const panelBounds = panel.getBoundingClientRect();
    const scrollBounds = scroll.getBoundingClientRect();
    const itemBounds = defaultItem.getBoundingClientRect();
    const firstDynamicBounds = scroll
      .querySelector("[data-effect-tab-wrapper]")
      .getBoundingClientRect();
    const style = getComputedStyle(scroll);
    const defaultStyle = getComputedStyle(defaultItem);
    return {
      clippedBottom: itemBounds.bottom > scrollBounds.bottom + 0.5,
      clippedTop: itemBounds.top < scrollBounds.top - 0.5,
      defaultBackground: defaultStyle.backgroundColor,
      defaultOverflow: defaultStyle.overflow,
      defaultZIndex: Number(defaultStyle.zIndex),
      dynamicTabBehindDefault:
        firstDynamicBounds.left < itemBounds.right &&
        firstDynamicBounds.right > itemBounds.left,
      homeLeftGap: itemBounds.left - scrollBounds.left,
      panelTopGap: scrollBounds.top - panelBounds.top,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollLeft: scroll.scrollLeft,
    };
  });
  expect(stripGeometry.clippedBottom).toBe(false);
  expect(stripGeometry.clippedTop).toBe(false);
  expect(stripGeometry.scrollLeft).toBeGreaterThan(0);
  expect(stripGeometry.homeLeftGap).toBeGreaterThanOrEqual(0);
  expect(stripGeometry.homeLeftGap).toBeLessThanOrEqual(1);
  expect(stripGeometry.dynamicTabBehindDefault).toBe(true);
  expect(stripGeometry.defaultBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(stripGeometry.defaultOverflow).toBe("hidden");
  expect(stripGeometry.defaultZIndex).toBeGreaterThan(0);
  expect(stripGeometry.panelTopGap).toBeGreaterThanOrEqual(2);
  expect(stripGeometry.panelTopGap).toBeLessThanOrEqual(4);
  expect(stripGeometry.overflowX).toBe("auto");
  expect(stripGeometry.overflowY).toBe("hidden");

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
  await expect(page.getByTestId("effect-tab-list").getByRole("tab")).toHaveCount(4);
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

test("analyzes a local Audio timeline clip and keeps accessible guideposts mapped to edits", async ({
  page,
}, testInfo) => {
  test.slow();
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());

  await page.locator('[data-effect-tab-target][data-effect="audio-sync-cut"]').click();
  let panel = page.getByRole("tabpanel", { name: "Audio-Sync Cut" });
  const source = page.getByLabel("Audio timeline clip", { exact: true });
  await expect(source).toHaveValue("");
  await expect(source.locator("option")).toHaveCount(1);
  await expect(panel.getByRole("button", { name: "Analyze source" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Generate guideposts" })).toBeDisabled();
  await expect(page.locator("[data-audio-sync-waveform]")).toHaveAttribute(
    "aria-label",
    /No audio has been analyzed/
  );
  await expect(page.locator("[data-audio-sync-spectrum]")).toHaveAttribute(
    "aria-label",
    /No audio has been analyzed/
  );
  for (const graph of ["waveform", "spectrum"]) {
    await expect(page.locator(`[data-audio-sync-${graph}] canvas`)).toHaveCSS(
      "pointer-events",
      "none"
    );
  }

  let audioClip = await addAudioSyncClip(page);
  await page.evaluate(() => {
    window.__videoEditorAudioAnalysisCursorStates = [];
    const status = document.querySelector("[data-audio-sync-status]");
    new MutationObserver(() => {
      window.__videoEditorAudioAnalysisCursorStates.push({
        bodyLoading: document.body.classList.contains("is-custom-cursor-loading"),
        cursor: getComputedStyle(status).cursor,
        state: status.getAttribute("data-state"),
      });
    }).observe(status, { attributes: true, attributeFilter: ["data-state"] });
  });
  panel = await analyzeAudioSyncClip(page);
  const audioAnalysisCursorStates = await page.evaluate(
    () => window.__videoEditorAudioAnalysisCursorStates
  );
  const analyzingCursor = audioAnalysisCursorStates.find(
    ({ state }) => state === "analyzing"
  );
  expect(analyzingCursor?.bodyLoading).toBe(true);
  expect(analyzingCursor?.cursor).toContain(
    "/assets/cursor-assets/Jeelh-Cursor-Light/working-in-background-frames/"
  );
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await expect(page.getByLabel("Graph view", { exact: true })).toHaveValue("combined");
  await expect(page.locator("[data-audio-sync-waveform]")).toHaveAttribute(
    "aria-label",
    /Waveform (?:graph )?for audio-sync-bursts\.wav/
  );
  await expect(page.locator("[data-audio-sync-spectrum]")).toHaveAttribute(
    "aria-label",
    /frequency spectrum for audio-sync-bursts\.wav/i
  );
  for (const graph of ["waveform", "spectrum"]) {
    expect(
      await page.locator(`[data-audio-sync-${graph}] canvas`).evaluate((canvas) =>
        Array.from(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data)
          .some((channel, index) => index % 4 !== 3 && channel !== 0)
      ),
      `${graph} canvas should contain rendered analysis pixels`
    ).toBe(true);
  }
  await page.getByLabel("Graph view", { exact: true }).selectOption("waveform");
  await expect(page.locator("[data-audio-sync-waveform]")).toBeVisible();
  await expect(page.locator("[data-audio-sync-spectrum]")).toBeHidden();
  await page.getByLabel("Graph view", { exact: true }).selectOption("frequency");
  await expect(page.locator("[data-audio-sync-waveform]")).toBeHidden();
  await expect(page.locator("[data-audio-sync-spectrum]")).toBeVisible();
  await page.getByLabel("Graph view", { exact: true }).selectOption("combined");

  await expect(page.getByLabel("Minimum Hz", { exact: true })).toHaveValue("40");
  await expect(page.getByLabel("Maximum Hz", { exact: true })).toHaveValue("2000");
  await expect(page.getByLabel("Threshold", { exact: true })).toHaveValue("65");
  await expect(page.getByLabel("Crossing direction", { exact: true })).toHaveValue(
    "rising"
  );
  await panel.getByRole("button", { name: "Mids", exact: true }).click();
  await expect(audioSyncRuleCards(page)).toHaveCount(1);
  const recommendedRule = audioSyncRuleCards(page).first();
  await expect(recommendedRule.locator("[data-audio-sync-rule-label]")).toHaveValue(
    /Mids/i
  );
  await expect
    .poll(() => accessibleGuideposts(recommendedRule).count())
    .toBeGreaterThanOrEqual(2);
  await expect(recommendedRule.locator('[data-guidepost-action="cut"]')).toHaveAttribute(
    "aria-pressed",
    "false"
  );

  await page.getByLabel("Minimum Hz", { exact: true }).fill("2000");
  await page.getByLabel("Maximum Hz", { exact: true }).fill("4000");
  await page.getByLabel("Threshold", { exact: true }).evaluate((input) => {
    input.value = "50";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByLabel("Crossing direction", { exact: true }).selectOption("both");
  await panel.getByRole("button", { name: "Generate guideposts" }).click();
  await expect(audioSyncRuleCards(page)).toHaveCount(2);
  const colors = await audioSyncRuleCards(page)
    .locator("[data-audio-sync-rule-color]")
    .evaluateAll((inputs) => inputs.map((input) => input.value));
  expect(new Set(colors).size).toBe(2);

  const marker = accessibleGuideposts(recommendedRule).first();
  const visual = page.locator(
    `[data-guidepost-visual-id="${await marker.getAttribute("data-guidepost-id")}"]`
  );
  await expect(visual).toHaveCount(1);
  const sourceTime = Number(await visual.getAttribute("data-guidepost-source-time"));
  const timelineTime = Number(await visual.getAttribute("data-guidepost-time"));
  expect(timelineTime).toBeCloseTo(sourceTime, 2);
  await expect(marker).toHaveAttribute(
    "aria-keyshortcuts",
    /ArrowLeft.*ArrowRight.*Delete.*Enter/
  );

  await audioClip.focus();
  await audioClip.press("ArrowRight");
  await expect
    .poll(async () => Number(await visual.getAttribute("data-guidepost-time")))
    .toBeCloseTo(timelineTime + 0.25, 2);

  const markerTimeBeforeNudge = Number(await marker.getAttribute("data-guidepost-time"));
  await marker.focus();
  await marker.press("ArrowRight");
  await expect(marker).toHaveAttribute(
    "data-guidepost-time",
    String(Number((markerTimeBeforeNudge + 0.05).toFixed(2)))
  );
  await marker.press("Shift+ArrowLeft");
  await expect(page.locator("#editor-status")).toContainText(/guidepost.*moved/i);
  const jumpedTime = Number(await marker.getAttribute("data-guidepost-time"));
  await marker.press("Enter");
  await expect(page.getByTestId("playhead-scrubber")).toHaveValue(String(jumpedTime));

  const visibleBeforeTrim = await accessibleGuideposts(recommendedRule).count();
  audioClip = page
    .getByTestId("timeline-tier-audio-1")
    .locator("article[data-clip-id]");
  const trimStart = audioClip.getByRole("button", {
    name: `Trim start of ${audioSyncName}`,
  });
  for (let index = 0; index < 6; index += 1) await trimStart.press("ArrowRight");
  await expect
    .poll(() => accessibleGuideposts(recommendedRule).count())
    .toBeLessThan(visibleBeforeTrim);

  const countBeforeDelete = await accessibleGuideposts(recommendedRule).count();
  const remainingMarker = accessibleGuideposts(recommendedRule).first();
  await remainingMarker.focus();
  await remainingMarker.press("Delete");
  await expect(accessibleGuideposts(recommendedRule)).toHaveCount(countBeforeDelete - 1);
  await recommendedRule.getByRole("button", { name: "Delete guidepost rule" }).click();
  await expect(audioSyncRuleCards(page)).toHaveCount(1);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-audio-sync-analysis.png"),
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#media-count")).toHaveText("0 items");
  await expect(audioSyncRuleCards(page)).toHaveCount(0);
  runtime.expectClean();
});

test("applies Audio-Sync flash, effect, and atomic video-cut actions at guideposts", async ({
  page,
}, testInfo) => {
  test.slow();
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());
  await addAudioSyncClip(page);
  const panel = await analyzeAudioSyncClip(page);
  await panel.getByRole("button", { name: "Mids", exact: true }).click();
  const rule = audioSyncRuleCards(page).first();
  await expect
    .poll(() => accessibleGuideposts(rule).count())
    .toBeGreaterThanOrEqual(2);
  const markerTimes = await accessibleGuideposts(rule).evaluateAll((markers) =>
    markers.map((marker) => Number(marker.getAttribute("data-guidepost-time")))
  );

  const flash = page.locator("#audio-sync-flash");
  await expect(flash).toHaveAttribute("aria-hidden", "true");
  await expect(flash).toHaveCSS("pointer-events", "none");
  await flash.evaluate((element) => {
    window.__audioSyncFlashEvents = [];
    window.__audioSyncFlashObserver = new MutationObserver(() => {
      if (element.dataset.flashActive === "true") {
        window.__audioSyncFlashEvents.push({
          color: element.dataset.guidepostColor,
          groupId: element.dataset.guidepostGroupId,
          guidepostId: element.dataset.guidepostId,
        });
      }
    });
    window.__audioSyncFlashObserver.observe(element, { attributes: true });
  });
  await setPlayhead(page, Math.max(0, markerTimes[0] - 0.08));
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__audioSyncFlashEvents.length), {
      intervals: [10, 20, 30, 50],
      timeout: 2_000,
    })
    .toBeGreaterThan(0);
  await expect(flash).toHaveAttribute("data-guidepost-group-id", /.+/);
  await expect(flash).toHaveAttribute("data-guidepost-id", /.+/);
  await expect(flash).toHaveAttribute("data-guidepost-color", /^#[0-9a-f]{6}$/i);
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await rule.getByLabel("Effect at guideposts").selectOption("windows-98");
  await rule.locator('[data-guidepost-action="effect"]').click();
  const effects = page
    .getByTestId("effects-lane")
    .locator('[data-effect-item-id][data-effect="windows-98"]');
  await expect(effects).toHaveCount(markerTimes.length);
  const effectRanges = await effects.evaluateAll((items) =>
    items.map((item) => item.getAttribute("aria-label"))
  );
  for (const label of effectRanges) expect(label).toMatch(/00:03\.00/);

  await page.getByTestId("media-file-input").setInputFiles({
    name: videoName,
    mimeType: "video/webm",
    buffer: await readFile(videoAsset),
  });
  await expect(page.locator("#media-count")).toHaveText("2 items", {
    timeout: 20_000,
  });
  await setPlayhead(page, 0);
  await page
    .getByTestId("media-bin")
    .getByRole("button", { name: `Add ${videoName} at the playhead` })
    .click();
  const videoTrack = page.getByTestId("timeline-tier-video-1");
  await expect(videoTrack.locator("article[data-clip-id]")).toHaveCount(1);
  const cutsInsideVideo = markerTimes.filter((time) => time > 0 && time < 5).length;
  await rule.locator('[data-guidepost-action="cut"]').click();
  await expect(videoTrack.locator("article[data-clip-id]")).toHaveCount(
    cutsInsideVideo + 1
  );
  const segments = await videoTrack.locator("article[data-clip-id]").evaluateAll((clips) =>
    clips.map((clip) => ({
      end: Number(clip.getAttribute("data-source-end")),
      start: Number(clip.getAttribute("data-source-start")),
    }))
  );
  expect(segments[0].start).toBe(0);
  for (let index = 1; index < segments.length; index += 1) {
    expect(segments[index - 1].end).toBeCloseTo(segments[index].start, 2);
  }
  await expect(page.locator("#editor-status")).toContainText(/split|cut/i);

  await page.screenshot({
    path: testInfo.outputPath("video-editor-audio-sync-actions.png"),
  });
  runtime.expectClean();
});

test("fills the first complete guide interval and rejects invalid Audio-Sync fills atomically", async ({
  page,
}) => {
  test.slow();
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());
  await addAudioSyncClip(page);
  const panel = await analyzeAudioSyncClip(page);
  await panel.getByRole("button", { name: "Mids", exact: true }).click();
  const midRule = audioSyncRuleCards(page).first();
  await expect
    .poll(() => accessibleGuideposts(midRule).count())
    .toBeGreaterThanOrEqual(2);
  const midTimes = await accessibleGuideposts(midRule).evaluateAll((markers) =>
    markers.map((marker) => Number(marker.getAttribute("data-guidepost-time")))
  );
  const videoTrack = page.getByTestId("timeline-tier-video-1");

  await midRule.locator('[data-guidepost-action="fill"]').click();
  await expect(page.locator("#editor-status")).toContainText(/select.*video/i);
  await expect(videoTrack.locator("article[data-clip-id]")).toHaveCount(0);

  await page.getByTestId("media-file-input").setInputFiles({
    name: videoName,
    mimeType: "video/webm",
    buffer: await readFile(videoAsset),
  });
  await expect(page.locator("#media-count")).toHaveText("2 items", {
    timeout: 20_000,
  });
  await page
    .locator('#media-bin [data-kind="video"] [data-select-media]')
    .click();
  await setPlayhead(page, 0);
  await midRule.locator('[data-guidepost-action="fill"]').click();
  const filledClip = videoTrack.locator("article[data-clip-id]");
  await expect(filledClip).toHaveCount(1);
  const firstInterval = midTimes[1] - midTimes[0];
  const fillState = await filledClip.evaluate((clip) => ({
    end: Number(clip.getAttribute("data-source-end")),
    label: clip.getAttribute("aria-label"),
    start: Number(clip.getAttribute("data-source-start")),
  }));
  expect(fillState.start).toBe(0);
  expect(fillState.end).toBeCloseTo(firstInterval, 2);
  expect(fillState.label).toContain("starts");
  await expect(page.locator("#editor-status")).toContainText(/fill|inserted/i);

  const snapshotBeforeConflict = await readProjectSnapshot(page);
  await setPlayhead(page, 0);
  await midRule.locator('[data-guidepost-action="fill"]').click();
  await expect(page.locator("#editor-status")).toContainText(
    /empty interval|occupied|overlap/i
  );
  expect(await readProjectSnapshot(page)).toEqual(snapshotBeforeConflict);

  await filledClip.focus();
  await filledClip.press("Delete");
  await panel.getByRole("button", { name: "Lows", exact: true }).click();
  const lowRule = audioSyncRuleCards(page).last();
  await expect
    .poll(() => accessibleGuideposts(lowRule).count())
    .toBeGreaterThanOrEqual(2);
  await setPlayhead(page, 0);
  const snapshotBeforeShortSource = await readProjectSnapshot(page);
  await lowRule.locator('[data-guidepost-action="fill"]').click();
  await expect(page.locator("#editor-status")).toContainText(/too short|source.*short/i);
  expect(await readProjectSnapshot(page)).toEqual(snapshotBeforeShortSource);
  runtime.expectClean();
});

test("uses rights-safe YouTube discovery and inserts trimmed local and procedural audio", async ({
  page,
}, testInfo) => {
  const runtime = monitorRuntime(page);
  await page.context().route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>YouTube results</title>" })
  );
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());
  await page.evaluate(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    window.__videoEditorPlayCalls = [];
    HTMLMediaElement.prototype.play = function trackedPlay() {
      window.__videoEditorPlayCalls.push({ src: this.src, time: this.currentTime });
      if (this.id === "audio-local-preview" || this.src.startsWith("blob:")) {
        return Promise.resolve();
      }
      return originalPlay.call(this);
    };
  });

  await page.locator('[data-effect-tab-target][data-effect="audio"]').click();
  const panel = page.getByRole("tabpanel", { name: "Audio", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/No audio is downloaded\s+or imported\./i);
  const searchOfficialYouTube = async (formName, query) => {
    const form = panel.getByRole("form", { name: formName });
    const queryInput = form.getByRole("searchbox");
    await queryInput.fill(query);
    const popupPromise = page.waitForEvent("popup");
    await form.getByRole("button", { name: "Search" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    const url = new URL(popup.url());
    expect(url.origin).toBe("https://www.youtube.com");
    expect(url.pathname).toBe("/results");
    expect(url.searchParams.get("search_query")).toBe(query);
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
    await expect(queryInput).toHaveValue(query);
  };
  await searchOfficialYouTube("Search official YouTube for music", "licensed synth loop");
  await searchOfficialYouTube(
    "Search official YouTube for sound effects",
    "royalty free keyboard click"
  );

  const localFile = page.locator("#audio-local-file");
  await localFile.setInputFiles(generatedAudioSync());
  const localSource = page.getByLabel("Local source", { exact: true });
  await expect(localSource.locator("option")).toHaveCount(2, { timeout: 20_000 });
  await expect(localSource).toContainText(audioSyncName);
  const localStart = page.getByLabel("Start", { exact: true });
  const localEnd = page.getByLabel("End", { exact: true });
  const localInsert = panel.getByRole("button", {
    name: "Insert local audio at playhead",
  });
  await expect(localStart).toBeEnabled();
  await expect(localEnd).toBeEnabled();
  await expect(localStart).toHaveValue("0");
  await expect(localEnd).toHaveValue("6");
  await localStart.fill("1");
  await localEnd.fill("1.1");
  const audioTrack = page.getByTestId("timeline-tier-audio-1");
  await expect(localInsert).toBeEnabled();
  await localInsert.click();
  const minimumRangeClip = audioTrack.locator("article[data-clip-id]");
  await expect(minimumRangeClip).toHaveCount(1);
  await expect(minimumRangeClip).toHaveAccessibleName(/00:00\.25/);
  await minimumRangeClip.focus();
  await minimumRangeClip.press("Delete");
  await localStart.fill("0.5");
  await localEnd.fill("2.25");
  await expect(localInsert).toBeEnabled();
  await page.locator("#audio-local-preview").evaluate((audio) => {
    audio.dispatchEvent(new Event("play", { bubbles: true }));
  });
  await page.locator("#audio-local-preview").evaluate((audio) => audio.play());
  await expect
    .poll(() => page.evaluate(() => window.__videoEditorPlayCalls.length))
    .toBeGreaterThan(0);
  await setPlayhead(page, 7);
  await localInsert.click();
  const localClip = audioTrack.locator("article[data-clip-id]").filter({
    hasText: audioSyncName,
  });
  await expect(localClip).toHaveCount(1);
  await expect(localClip).toHaveAttribute("data-source-start", "0.5");
  await expect(localClip).toHaveAttribute("data-source-end", "2.25");
  await expect(localClip).toHaveAccessibleName(/00:01\.75/);

  const clickPreset = panel.locator('[data-sound-effect-preset="click"]');
  const typingPreset = panel.locator('[data-sound-effect-preset="typing"]');
  const loop = page.getByLabel("Loop Typing", { exact: true });
  const duration = page.getByLabel("Duration", { exact: true });
  const soundPreview = panel.locator("[data-sound-effect-preview]");
  const soundInsert = panel.locator("[data-sound-effect-insert]");
  await expect(clickPreset).toHaveAttribute("aria-pressed", "true");
  await expect(typingPreset).toHaveAttribute("aria-pressed", "false");
  await expect(loop).toBeDisabled();
  await expect(duration).toBeDisabled();
  await soundPreview.click();
  await expect(panel.locator("[data-sound-effect-status]")).toContainText(/Previewing Click/i);
  await setPlayhead(page, 0);
  await soundInsert.click();
  const clickClip = audioTrack.locator("article[data-clip-id]").filter({ hasText: /Click/i });
  await expect(clickClip).toHaveCount(1);
  await expect(clickClip).toHaveAccessibleName(/00:00\.12/);

  await typingPreset.focus();
  await typingPreset.press("Enter");
  await expect(typingPreset).toHaveAttribute("aria-pressed", "true");
  await expect(clickPreset).toHaveAttribute("aria-pressed", "false");
  await expect(loop).toBeEnabled();
  await expect(duration).toBeDisabled();
  await soundPreview.click();
  await expect(panel.locator("[data-sound-effect-status]")).toContainText(/Previewing Typing/i);
  await setPlayhead(page, 2);
  await soundInsert.click();
  let typingClips = audioTrack.locator("article[data-clip-id]").filter({
    hasText: /Typing/i,
  });
  await expect(typingClips).toHaveCount(1);
  await expect(typingClips.first()).toHaveAccessibleName(/00:01\.20/);

  await page.getByText("Loop Typing", { exact: true }).click();
  await expect(loop).toBeChecked();
  await expect(duration).toBeEnabled();
  await duration.fill("2.5");
  await duration.press("Tab");
  await setPlayhead(page, 4);
  await soundInsert.click();
  typingClips = audioTrack.locator("article[data-clip-id]").filter({ hasText: /Typing/i });
  await expect(typingClips).toHaveCount(2);
  await expect(typingClips.last()).toHaveAccessibleName(/00:02\.50/);
  await clickPreset.click();
  await expect(loop).toBeDisabled();
  await expect(duration).toBeDisabled();
  await expect(soundPreview).toHaveText(/Preview Click/);
  await expect(panel.locator("[data-sound-effect-status]")).toContainText(/Click.*ready/i);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("video-editor-audio-tools.png") });
  runtime.expectClean();
});

test("retains a usable Audio-Sync error state when local decoding fails", async ({ page }) => {
  const runtime = monitorRuntime(page);
  await loadEditor(page, { width: 1280, height: 800 });
  runtime.setOrigin(page.url());
  await addAudioSyncClip(page);
  await page.locator('[data-effect-tab-target][data-effect="audio-sync-cut"]').click();
  await page.getByLabel("Audio timeline clip", { exact: true }).selectOption({ index: 1 });
  await page.evaluate(() => {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    Object.defineProperty(Constructor.prototype, "decodeAudioData", {
      configurable: true,
      value: () => Promise.reject(new Error("Synthetic decode failure.")),
    });
  });
  await page.getByRole("button", { name: "Analyze source" }).click();
  await expect(page.locator("[data-audio-sync-status]")).toHaveText(
    "Synthetic decode failure."
  );
  await expect(page.locator("[data-audio-sync-status]")).toHaveAttribute(
    "data-state",
    "error"
  );
  await expect(page.getByRole("button", { name: "Analyze source" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Generate guideposts" })).toBeDisabled();
  await expect(audioSyncRuleCards(page)).toHaveCount(0);
  runtime.expectClean();
});
