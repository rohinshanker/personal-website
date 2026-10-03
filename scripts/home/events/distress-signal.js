(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
  debounceTimer,
} = window.homeUtil;
const {
  nextWindowZIndex,
  registerViewportObserver,
} = window.homeWindows;
const {
  clearNoiseCanvas,
  drawDisplayGrain,
  drawNoiseCanvas,
  drawStatic,
  thermalNoise,
} = window.homeStaticNoise;

const distressSignalWindow = byId("distress-signal-window");
const distressSignalClose = byId("distress-signal-close");
const distressRadioPanel = byId("distress-radio-panel");
const distressPowerButton = byId("distress-power-button");
const distressPowerProgressBar = byId("distress-power-progress-bar");
const distressSignalCanvas = byId("distress-signal-canvas");
const distressFrequencyDial = byId("distress-frequency-dial");
const distressPhaseDial = byId("distress-phase-dial");
const distressNavPanel = byId("distress-nav-panel");
const distressMinimapArrow = byId("distress-minimap-arrow");
const distressNavState = byId("distress-nav-state");
const distressBearingReadout = byId("distress-bearing-readout");
const distressRangeReadout = byId("distress-range-readout");
const distressStrengthReadout = byId("distress-strength-readout");
const distressLockStatusText = byId("distress-lock-status-text");
const distressNavNoiseCanvas = byId("distress-nav-noise-canvas");
const distressStatusNoiseCanvas = byId("distress-status-noise-canvas");
const distressUploadWindow = byId("distress-upload-window");
const distressUploadOk = byId("distress-upload-ok");

let distressTargetFrequency = 50;

let distressTargetPhase = 50;

let distressSignalSolved = false;

let distressUploadTimer = null;

let distressNoiseAnimationFrame = null;

let distressPowerTimer = null;

let distressPoweredOn = false;

let distressPowerVisibleProgress = 0;

let distressSignalBearing = 0;

let distressSignalRange = 0;

const DISTRESS_ALIGNMENT_TOLERANCE = 3.2;

const DISTRESS_UPLOAD_DELAY_MS = 420;

const DISTRESS_POWER_DURATION_MS = 2600;

const DISTRESS_POWER_TICK_MS = 40;

const DISTRESS_CANVAS_WIDTH = 420;

const DISTRESS_CANVAS_HEIGHT = 152;

const DISTRESS_WAVE_NOISE = 0.058;

const DISTRESS_NOISE_SAMPLE_STEP = 1;



const isDistressWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isDistressSignalVisible = () =>
  isDistressWindowVisible(distressSignalWindow) ||
  isDistressWindowVisible(distressUploadWindow);

const getDistressPhaseDelta = (value, target) => {
  const delta = Math.abs(value - target);
  return Math.min(delta, 100 - delta);
};

const getDistressAlignment = () => {
  const frequency = distressFrequencyDial ? Number(distressFrequencyDial.value) : 0;
  const phase = distressPhaseDial ? Number(distressPhaseDial.value) : 0;
  return {
    frequencyDelta: Math.abs(frequency - distressTargetFrequency),
    phaseDelta: getDistressPhaseDelta(phase, distressTargetPhase),
  };
};

const setDistressDialsDisabled = (disabled) => {
  if (distressFrequencyDial) distressFrequencyDial.disabled = disabled;
  if (distressPhaseDial) distressPhaseDial.disabled = disabled;
};

const setDistressStatus = (text) => {
  if (distressLockStatusText) distressLockStatusText.textContent = text;
};

const setDistressNavigationMode = (mode) => {
  if (!distressNavPanel) return;
  distressNavPanel.classList.toggle("is-off", mode === "off");
  distressNavPanel.classList.toggle("is-scanning", mode === "scanning");
  distressNavPanel.classList.toggle("is-locked", mode === "locked");
};

const setDistressNavigationReadout = (
  state,
  bearing = "--",
  range = "--",
  strength = "--"
) => {
  if (distressNavState) distressNavState.textContent = state;
  if (distressBearingReadout) distressBearingReadout.textContent = `BRG ${bearing}`;
  if (distressRangeReadout) distressRangeReadout.textContent = `RNG ${range}`;
  if (distressStrengthReadout) distressStrengthReadout.textContent = `SIG ${strength}`;
};

const resetDistressNavigation = () => {
  setDistressNavigationMode("off");
  if (distressMinimapArrow) {
    distressMinimapArrow.style.setProperty("--distress-bearing", "0deg");
    distressMinimapArrow.style.setProperty("--distress-arrow-x", "0px");
    distressMinimapArrow.style.setProperty("--distress-arrow-y", "0px");
  }
  setDistressNavigationReadout("Map offline");
};

const scanDistressNavigation = () => {
  setDistressNavigationMode("scanning");
  setDistressNavigationReadout("Triangulating");
};

const lockDistressNavigation = () => {
  setDistressNavigationMode("locked");
  const bearing = Math.round(distressSignalBearing);
  const range = `${distressSignalRange.toFixed(1)}km`;
  if (distressMinimapArrow) {
    const bearingRadians = (bearing * Math.PI) / 180;
    const arrowRadius = 27;
    distressMinimapArrow.style.setProperty("--distress-bearing", `${bearing}deg`);
    distressMinimapArrow.style.setProperty(
      "--distress-arrow-x",
      `${Math.sin(bearingRadians) * arrowRadius}px`
    );
    distressMinimapArrow.style.setProperty(
      "--distress-arrow-y",
      `${Math.cos(bearingRadians) * -arrowRadius}px`
    );
  }
  setDistressNavigationReadout(
    "Signal acquired",
    `${String(bearing).padStart(3, "0")} deg`,
    range,
    "100%"
  );
};

const setDistressPowerProgress = (progress) => {
  if (!distressPowerProgressBar) return;
  distressPowerProgressBar.style.width = `${clampNumber(progress, 0, 1) * 100}%`;
};

const drawDistressPanelNoise = () => {
  if (!distressPoweredOn) {
    clearNoiseCanvas(distressNavNoiseCanvas);
    clearNoiseCanvas(distressStatusNoiseCanvas);
    return;
  }
  drawNoiseCanvas(distressNavNoiseCanvas);
  drawNoiseCanvas(distressStatusNoiseCanvas);
};

const drawDistressOffDisplay = (ctx, width, height, random = Math.random) => {
  ctx.fillStyle = "#020403";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(41, 92, 50, 0.32)";
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }
  drawDisplayGrain(ctx, width, height, random);
  ctx.fillStyle = "rgba(98, 255, 120, 0.34)";
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RECEIVER OFFLINE", width / 2, height / 2);
};

const drawDistressWave = (
  ctx,
  width,
  height,
  frequencyValue,
  phaseValue,
  color,
  lineWidth
) => {
  const centerY = height * 0.52;
  const amplitude = height * 0.28;
  const noiseAmplitude = height * DISTRESS_WAVE_NOISE;
  const cycles = 1.15 + (frequencyValue / 100) * 3.1;
  const phase = (phaseValue / 100) * Math.PI * 2;
  let thermal = thermalNoise();
  ctx.beginPath();
  for (let x = 0; x <= width; x += DISTRESS_NOISE_SAMPLE_STEP) {
    const signal = Math.sin((x / width) * cycles * Math.PI * 2 + phase) * amplitude;
    thermal = thermal * 0.04 + thermalNoise() * 0.96;
    const fineStatic = thermalNoise() * noiseAmplitude * 1.05;
    const jitter = thermal * noiseAmplitude + fineStatic;
    const y = centerY + signal + jitter;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
};

const drawDistressSignals = () => {
  drawDistressPanelNoise();
  if (!distressSignalCanvas) return;
  const ctx = distressSignalCanvas.getContext("2d");
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(
    1,
    Math.round(distressSignalCanvas.clientWidth || DISTRESS_CANVAS_WIDTH)
  );
  const height = Math.max(
    1,
    Math.round(distressSignalCanvas.clientHeight || DISTRESS_CANVAS_HEIGHT)
  );
  if (
    distressSignalCanvas.width !== Math.round(width * ratio) ||
    distressSignalCanvas.height !== Math.round(height * ratio)
  ) {
    distressSignalCanvas.width = Math.round(width * ratio);
    distressSignalCanvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!distressPoweredOn) {
    drawDistressOffDisplay(ctx, width, height);
    return;
  }
  ctx.fillStyle = "#020403";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(95, 255, 122, 0.14)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  drawStatic(ctx, width, height);
  const frequency = distressFrequencyDial ? Number(distressFrequencyDial.value) : 0;
  const phase = distressPhaseDial ? Number(distressPhaseDial.value) : 0;
  drawDistressWave(
    ctx,
    width,
    height,
    distressTargetFrequency,
    distressTargetPhase,
    "#8f1d1d",
    2
  );
  drawDistressWave(ctx, width, height, frequency, phase, "#2f9a4b", 2);
  drawDisplayGrain(ctx, width, height);
};

const stopDistressNoiseAnimation = () => {
  if (!distressNoiseAnimationFrame) return;
  cancelAnimationFrame(distressNoiseAnimationFrame);
  distressNoiseAnimationFrame = null;
};

const startDistressNoiseAnimation = () => {
  if (!distressPoweredOn) return;
  if (distressNoiseAnimationFrame) return;
  const animate = () => {
    if (!distressPoweredOn || !isDistressWindowVisible(distressSignalWindow)) {
      distressNoiseAnimationFrame = null;
      return;
    }
    drawDistressSignals();
    distressNoiseAnimationFrame = requestAnimationFrame(animate);
  };
  distressNoiseAnimationFrame = requestAnimationFrame(animate);
};

const updateDistressTuning = () => {
  drawDistressSignals();
  if (
    !distressPoweredOn ||
    distressSignalSolved ||
    !isDistressWindowVisible(distressSignalWindow)
  ) {
    return;
  }
  const alignment = getDistressAlignment();
  const aligned =
    alignment.frequencyDelta <= DISTRESS_ALIGNMENT_TOLERANCE &&
    alignment.phaseDelta <= DISTRESS_ALIGNMENT_TOLERANCE;
  const signalStrength = clampNumber(
    Math.round(100 - alignment.frequencyDelta * 1.4 - alignment.phaseDelta * 1.4),
    0,
    99
  );
  if (aligned) {
    distressSignalSolved = true;
    setDistressDialsDisabled(true);
    setDistressStatus("Signal locked");
    lockDistressNavigation();
    distressUploadTimer = debounceTimer(distressUploadTimer, () => {
      distressUploadTimer = null;
      showDistressUploadWindow();
    }, DISTRESS_UPLOAD_DELAY_MS);
    return;
  }
  const closeEnough = alignment.frequencyDelta <= 9 && alignment.phaseDelta <= 9;
  setDistressStatus(closeEnough ? "Signal stabilizing" : "Signal drifting");
  if (closeEnough) {
    setDistressNavigationReadout("Bearing resolving", "--", "--", `${signalStrength}%`);
  } else {
    setDistressNavigationReadout("Triangulating", "--", "--", `${signalStrength}%`);
  }
};

const clearDistressPowerTimer = () => {
  if (!distressPowerTimer) return;
  clearInterval(distressPowerTimer);
  distressPowerTimer = null;
};

const finishDistressPowerOn = () => {
  clearDistressPowerTimer();
  distressPoweredOn = true;
  if (distressRadioPanel) distressRadioPanel.classList.remove("is-off");
  if (distressPowerButton) distressPowerButton.disabled = true;
  setDistressPowerProgress(1);
  setDistressDialsDisabled(false);
  setDistressStatus("Signal drifting");
  scanDistressNavigation();
  updateDistressTuning();
  startDistressNoiseAnimation();
  requestAnimationFrame(() => {
    if (distressFrequencyDial) distressFrequencyDial.focus();
  });
};

const startDistressPowerSequence = () => {
  if (distressPoweredOn || distressPowerTimer) return;
  const startedAt = performance.now();
  distressPowerVisibleProgress = 0;
  if (distressPowerButton) distressPowerButton.disabled = true;
  setDistressStatus("Receiver warming up");
  setDistressPowerProgress(0);
  drawDistressSignals();
  distressPowerTimer = setInterval(() => {
    const progress = (performance.now() - startedAt) / DISTRESS_POWER_DURATION_MS;
    const targetProgress = Math.min(1, progress);
    const shouldJump =
      targetProgress >= 1 ||
      Math.random() < 0.44 ||
      targetProgress - distressPowerVisibleProgress > 0.09;
    if (shouldJump) {
      const jumpSize = 0.018 + Math.random() * 0.09;
      distressPowerVisibleProgress = Math.min(
        1,
        Math.max(
          distressPowerVisibleProgress,
          Math.min(targetProgress + Math.random() * 0.035, distressPowerVisibleProgress + jumpSize)
        )
      );
    }
    setDistressPowerProgress(distressPowerVisibleProgress);
    drawDistressSignals();
    if (progress >= 1) finishDistressPowerOn();
  }, DISTRESS_POWER_TICK_MS);
};

const resetDistressSignal = () => {
  if (distressUploadTimer) {
    clearTimeout(distressUploadTimer);
    distressUploadTimer = null;
  }
  clearDistressPowerTimer();
  stopDistressNoiseAnimation();
  distressPoweredOn = false;
  distressSignalSolved = false;
  distressSignalBearing = Math.random() * 360;
  distressSignalRange = 3.5 + Math.random() * 48;
  if (distressRadioPanel) distressRadioPanel.classList.add("is-off");
  if (distressPowerButton) distressPowerButton.disabled = false;
  distressPowerVisibleProgress = 0;
  setDistressPowerProgress(0);
  resetDistressNavigation();
  distressTargetFrequency = 20 + Math.random() * 60;
  distressTargetPhase = Math.random() * 100;
  if (distressFrequencyDial) {
    const offset = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 24);
    distressFrequencyDial.value = String(
      clampNumber(Math.round(distressTargetFrequency + offset), 0, 100)
    );
  }
  if (distressPhaseDial) {
    distressPhaseDial.value = String(Math.round((distressTargetPhase + 35 + Math.random() * 30) % 100));
  }
  setDistressDialsDisabled(true);
  setDistressStatus("Receiver offline");
  drawDistressSignals();
};

const showDistressUploadWindow = () => {
  showManagedRandomEventWindow(distressUploadWindow, {
    isVisible: () => false,
    afterShow: () => {
      requestAnimationFrame(() => {
        if (distressUploadOk) distressUploadOk.focus();
      });
    },
  });
};

const showDistressSignalWindow = () => {
  if (!distressSignalWindow) return;
  if (isDistressSignalVisible()) {
    [distressUploadWindow, distressSignalWindow].some((win) => {
      if (!isDistressWindowVisible(win)) return false;
      win.style.zIndex = String(nextWindowZIndex());
      return true;
    });
    return;
  }
  showManagedRandomEventWindow(distressSignalWindow, {
    beforeShow: resetDistressSignal,
    afterShow: () => requestAnimationFrame(drawDistressSignals),
  });
};

const closeDistressWindow = (win) => {
  closeManagedRandomEventWindow(win, {
    beforeClose: () => {
      if (win !== distressSignalWindow) return;
      clearDistressPowerTimer();
      stopDistressNoiseAnimation();
    },
  });
};

const closeDistressSignalEvent = () => {
  if (distressUploadTimer) {
    clearTimeout(distressUploadTimer);
    distressUploadTimer = null;
  }
  closeDistressWindow(distressSignalWindow);
  closeDistressWindow(distressUploadWindow);
};

registerRandomEvent({
  id: "distress-signal",
  preloadTargets: () => [distressSignalWindow, distressUploadWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isDistressSignalVisible,
  canTrigger: () => !isDistressSignalVisible(),
  run: () => {
    showDistressSignalWindow();
  },
  bind: () => {
    if (distressPowerButton) {
      distressPowerButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startDistressPowerSequence();
      });
    }

    if (distressSignalClose) {
      distressSignalClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeDistressSignalEvent();
      });
    }

    [distressFrequencyDial, distressPhaseDial].forEach((dial) => {
      if (!dial) return;
      dial.addEventListener("input", () => {
        updateDistressTuning();
      });
    });

    if (distressUploadOk) {
      distressUploadOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeDistressSignalEvent();
      });
    }

    [distressSignalWindow, distressUploadWindow].forEach((win) => bindManagedRandomEventWindowAnimation(win));
  },
});

const drawDistressSignalPreview = (preview) => {
  const canvas = preview?.querySelector("#distress-signal-canvas");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  canvas.width = DISTRESS_CANVAS_WIDTH;
  canvas.height = DISTRESS_CANVAS_HEIGHT;
  let randomState = 0x51f15e;
  const deterministicRandom = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, DISTRESS_CANVAS_WIDTH, DISTRESS_CANVAS_HEIGHT);
  drawDistressOffDisplay(
    context,
    DISTRESS_CANVAS_WIDTH,
    DISTRESS_CANVAS_HEIGHT,
    deterministicRandom
  );
};

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  distressSignalWindow,
  distressUploadWindow,
]);

registerViewportObserver({
  onFrame: () => {
    if (isDistressWindowVisible(distressSignalWindow)) drawDistressSignals();
  },
});

window.homeEventDistressSignal = Object.freeze({
  distressSignalWindow,
  distressUploadWindow,
  drawDistressSignalPreview,
  drawDistressSignals,
  isDistressWindowVisible,
});
})();
