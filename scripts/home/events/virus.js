(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  RANDOM_EVENT_OBSTACLE_GAP,
  RANDOM_EVENT_PLACEMENT_ATTEMPTS,
  RANDOM_EVENT_TASKBAR_CLEARANCE,
  RANDOM_EVENT_VIEWPORT_PADDING,
  animateWindowExplode,
  bindManagedRandomEventWindowAnimation,
  clampRandomEventPosition,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  positionRandomEventWindowInViewport,
  randomEventCandidateRect,
  randomEventPlacementObstacles,
  registerRandomEvent,
  registerRandomEventWindows,
  sampleRandomEventPosition,
  scoreRandomEventPlacement,
  setRandomEventWindowPosition,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
} = window.homeUtil;
const {
  generateFateBoltPath,
} = window.homeEventLightning;

const virusWindow = byId("virus-window");
const virusBorderLightningCanvas = byId("virus-border-lightning-canvas");
const virusYes = byId("virus-yes");
const virusNo = byId("virus-no");
const virusRescueWindow = byId("virus-rescue-window");
const virusRescueText = byId("virus-rescue-text");
const virusRescueThanks = byId("virus-rescue-thanks");

let virusExploding = false;

let virusRescueAnchor = null;

let virusStrikeTimer = null;

let virusStrikeFrame = null;

let virusStrikeCanvas = null;

const isVirusWindowVisible = (win) =>
  Boolean(win && !win.classList.contains("is-hidden"));

const virusEventWindows = () => [virusWindow, virusRescueWindow].filter(Boolean);

const isVirusVisible = () => virusEventWindows().some(isVirusWindowVisible);

const setVirusEventWindowPosition = (win, left, top) => {
  setRandomEventWindowPosition(win, left, top);
};

const chooseVirusRescueAnchor = () => {
  if (!virusWindow) return { left: 12, top: 12 };
  const initialRect = virusWindow.getBoundingClientRect();
  const padding = RANDOM_EVENT_VIEWPORT_PADDING;
  const width = Math.max(initialRect.width, 260);
  const height = Math.max(initialRect.height, 140);
  const maxLeft = Math.max(
    padding,
    window.innerWidth - width - padding
  );
  const maxTop = Math.max(
    padding,
    window.innerHeight - height - RANDOM_EVENT_TASKBAR_CLEARANCE
  );
  const gap = RANDOM_EVENT_OBSTACLE_GAP + 28;
  const bounds = { width, height, padding, maxLeft, maxTop };
  const initialObstacle = {
    left: initialRect.left,
    top: initialRect.top,
    right: initialRect.right,
    bottom: initialRect.bottom,
  };
  const obstacles = [
    initialObstacle,
    ...randomEventPlacementObstacles(virusRescueWindow),
  ];
  const preferredPositions = [
    { left: initialRect.right + gap, top: initialRect.top },
    { left: initialRect.left - width - gap, top: initialRect.top },
    { left: initialRect.left, top: initialRect.bottom + gap },
    { left: initialRect.left, top: initialRect.top - height - gap },
    { left: padding, top: padding },
    { left: maxLeft, top: padding },
    { left: padding, top: maxTop },
    { left: maxLeft, top: maxTop },
  ];
  let bestPosition = null;
  let bestScore = Infinity;

  const considerPosition = (position) => {
    const clamped = clampRandomEventPosition(bounds, position);
    const rect = randomEventCandidateRect(bounds, clamped.left, clamped.top);
    const score = scoreRandomEventPlacement(rect, obstacles);
    if (score < bestScore) {
      bestScore = score;
      bestPosition = clamped;
    }
    return score === 0;
  };

  for (const position of preferredPositions) {
    if (considerPosition(position)) break;
  }

  if (bestScore > 0) {
    for (let attempt = 0; attempt < RANDOM_EVENT_PLACEMENT_ATTEMPTS; attempt += 1) {
      if (considerPosition(sampleRandomEventPosition(bounds))) break;
    }
  }

  const anchor = bestPosition || clampRandomEventPosition(bounds, {
    left: initialRect.right + gap,
    top: initialRect.top,
  });

  return {
    left: Math.round(anchor.left),
    top: Math.round(anchor.top),
    width,
    height,
  };
};

const VIRUS_RESCUE_READY_TEXT = "Fear not, I am here to protect you!";

const VIRUS_RESCUE_ATTACK_TEXT =
  "McAfee Antivirus uses lightning bolt. It is super effective!";

const VIRUS_STRIKE_DURATION_MS = 1000;

const setVirusRescueMessage = (message) => {
  if (virusRescueText) virusRescueText.textContent = message;
};

const setVirusRescueButtonDisabled = (disabled) => {
  if (virusRescueThanks) virusRescueThanks.disabled = disabled;
};

const setVirusInstallButtonsDisabled = (disabled) => {
  if (virusYes) virusYes.disabled = disabled;
  if (virusNo) virusNo.disabled = disabled;
};

const removeVirusStrikeCanvas = () => {
  if (virusStrikeCanvas) {
    virusStrikeCanvas.remove();
    virusStrikeCanvas = null;
  }
};

const clearVirusStrikeEffect = () => {
  if (virusStrikeTimer) {
    clearTimeout(virusStrikeTimer);
    virusStrikeTimer = null;
  }
  if (virusStrikeFrame) {
    cancelAnimationFrame(virusStrikeFrame);
    virusStrikeFrame = null;
  }
  removeVirusStrikeCanvas();
  clearVirusBorderLightningCanvas();
  if (virusWindow) virusWindow.classList.remove("is-virus-struck");
  setVirusInstallButtonsDisabled(false);
};

const createVirusStrikeCanvas = () => {
  removeVirusStrikeCanvas();
  virusStrikeCanvas = document.createElement("canvas");
  virusStrikeCanvas.className = "virus-lightning-canvas";
  virusStrikeCanvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(virusStrikeCanvas);
  return virusStrikeCanvas;
};

const resizeVirusStrikeCanvas = () => {
  if (!virusStrikeCanvas) return null;
  const ctx = virusStrikeCanvas.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);

  if (
    virusStrikeCanvas.width !== nextWidth ||
    virusStrikeCanvas.height !== nextHeight
  ) {
    virusStrikeCanvas.width = nextWidth;
    virusStrikeCanvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
};

const resizeVirusBorderLightningCanvas = () => {
  if (!virusBorderLightningCanvas) return null;
  const ctx = virusBorderLightningCanvas.getContext("2d");
  if (!ctx) return null;
  const field = virusBorderLightningCanvas.parentElement;
  const rect = field
    ? field.getBoundingClientRect()
    : virusBorderLightningCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);

  if (
    virusBorderLightningCanvas.width !== nextWidth ||
    virusBorderLightningCanvas.height !== nextHeight
  ) {
    virusBorderLightningCanvas.width = nextWidth;
    virusBorderLightningCanvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
};

const clearVirusBorderLightningCanvas = () => {
  const setup = resizeVirusBorderLightningCanvas();
  if (!setup) return;
  setup.ctx.clearRect(0, 0, setup.width, setup.height);
};

const getVirusStrikeOrigin = (targetRect) => {
  if (isVirusWindowVisible(virusRescueWindow)) {
    const rescueRect = virusRescueWindow.getBoundingClientRect();
    if (rescueRect.width > 0 && rescueRect.height > 0) {
      return {
        x: rescueRect.left + rescueRect.width / 2,
        y: rescueRect.top + rescueRect.height / 2,
      };
    }
  }
  const anchor = virusRescueAnchor || {
    left: targetRect.left,
    top: targetRect.top,
  };
  return {
    x: anchor.left + (anchor.width || targetRect.width) / 2,
    y: anchor.top + (anchor.height || targetRect.height) / 2,
  };
};

const virusStrikeTargetPoint = (rect, origin) => {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const deltaX = centerX - origin.x;
  const deltaY = centerY - origin.y;
  const halfWidth = Math.max(1, rect.width / 2);
  const halfHeight = Math.max(1, rect.height / 2);
  const scale = 1 / Math.max(
    Math.abs(deltaX) / halfWidth,
    Math.abs(deltaY) / halfHeight,
    0.001
  );
  const borderX = centerX - deltaX * scale;
  const borderY = centerY - deltaY * scale;
  const hitsVerticalEdge =
    Math.abs(borderX - rect.left) < 1 || Math.abs(borderX - rect.right) < 1;

  return {
    x: hitsVerticalEdge
      ? borderX
      : borderX + (Math.random() - 0.5) * rect.width * 0.16,
    y: hitsVerticalEdge
      ? borderY + (Math.random() - 0.5) * rect.height * 0.16
      : borderY,
  };
};

const drawVirusBolt = (ctx, path, startX, startY, level, alpha) => {
  const opacity = alpha * Math.max(0.28, 1 - level * 0.24);
  const glowWidth = level === 0 ? 7 : 3.5;
  const coreWidth = level === 0 ? 1.35 : 0.7;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(32, 156, 255, ${opacity})`;
  ctx.lineWidth = glowWidth;
  ctx.shadowBlur = level === 0 ? 18 : 9;
  ctx.shadowColor = "rgba(65, 180, 255, 0.95)";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(126, 219, 255, ${opacity})`;
  ctx.lineWidth = Math.max(1.5, glowWidth * 0.38);
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(245, 252, 255, ${Math.min(1, opacity + 0.22)})`;
  ctx.lineWidth = coreWidth;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();
  ctx.restore();
};

const drawVirusWindowLightningBorderFrame = (alpha) => {
  const setup = resizeVirusBorderLightningCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  const inset = 18;
  const left = inset;
  const top = inset;
  const right = Math.max(left + 1, width - inset);
  const bottom = Math.max(top + 1, height - inset);
  const displacement = clampNumber(Math.min(width, height) / 14, 6, 13);
  const edges = [
    [left, top, right, top],
    [right, top, right, bottom],
    [right, bottom, left, bottom],
    [left, bottom, left, top],
  ];
  const bolts = [];

  ctx.clearRect(0, 0, width, height);
  edges.forEach(([x1, y1, x2, y2]) => {
    const startX = x1 + (Math.random() - 0.5) * 4;
    const startY = y1 + (Math.random() - 0.5) * 4;
    const endX = x2 + (Math.random() - 0.5) * 4;
    const endY = y2 + (Math.random() - 0.5) * 4;
    const path = generateFateBoltPath(
      startX,
      startY,
      endX,
      endY,
      displacement,
      0,
      bolts
    );

    bolts.push({ path, start: [startX, startY], level: 0 });
  });

  bolts.forEach((bolt) => {
    drawVirusBolt(ctx, bolt.path, bolt.start[0], bolt.start[1], bolt.level, alpha);
  });
};

const drawVirusStrikeFrame = (origin, rect, alpha) => {
  const setup = resizeVirusStrikeCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  const sourceRadius = 5 + Math.random() * 5;

  ctx.clearRect(0, 0, width, height);
  drawVirusWindowLightningBorderFrame(alpha * 0.95);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(225, 248, 255, 0.95)";
  ctx.shadowBlur = 22;
  ctx.shadowColor = "rgba(49, 169, 255, 1)";
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, sourceRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const target = virusStrikeTargetPoint(rect, origin);
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  const displacement = clampNumber(distance / 5.5, 9, 22);
  const bolts = [];
  const path = generateFateBoltPath(
    origin.x,
    origin.y,
    target.x,
    target.y,
    displacement,
    0,
    bolts
  );
  bolts.push({ path, start: [origin.x, origin.y], level: 0 });
  bolts.forEach((bolt) => {
    drawVirusBolt(ctx, bolt.path, bolt.start[0], bolt.start[1], bolt.level, alpha);
  });
};

const startVirusStrikeEffect = (onComplete) => {
  if (!virusWindow) {
    if (onComplete) onComplete();
    return;
  }

  clearVirusStrikeEffect();
  createVirusStrikeCanvas();
  setVirusInstallButtonsDisabled(true);
  virusWindow.classList.add("is-virus-struck");

  const startedAt = performance.now();

  const render = (now) => {
    if (!virusWindow || virusWindow.classList.contains("is-hidden")) {
      clearVirusStrikeEffect();
      return;
    }

    const progress = Math.min(1, (now - startedAt) / VIRUS_STRIKE_DURATION_MS);
    const rect = virusWindow.getBoundingClientRect();
    const origin = getVirusStrikeOrigin(rect);
    const flicker = Math.random() > 0.18 ? 1 : 0.32;
    const alpha = Math.max(0, flicker * (1 - progress * 0.12));
    drawVirusStrikeFrame(origin, rect, alpha);

    if (progress < 1) {
      virusStrikeFrame = requestAnimationFrame(render);
      return;
    }

    virusStrikeFrame = null;
  };

  virusStrikeFrame = requestAnimationFrame(render);
  virusStrikeTimer = setTimeout(() => {
    clearVirusStrikeEffect();
    if (onComplete) onComplete();
  }, VIRUS_STRIKE_DURATION_MS);
};

const triggerVirusFlashbang = () => {
  const flash = document.createElement("div");
  flash.className = "virus-flashbang";
  document.body.appendChild(flash);
  const animation = flash.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { opacity: 1, offset: 0.28 },
      { opacity: 0 },
    ],
    {
      duration: 900,
      easing: "ease-out",
      fill: "forwards",
    }
  );
  animation.addEventListener("finish", () => flash.remove(), { once: true });
};

const showVirusEventWindow = (win, anchor = null, { animate = true } = {}) => {
  showManagedRandomEventWindow(win, {
    isVisible: () => isVirusWindowVisible(win),
    onFront: () => clampRandomEventWindowToViewport(win),
    clearClasses: ["is-opening", "is-exploding", "is-virus-struck"],
    position: (target) => {
      if (anchor) setVirusEventWindowPosition(target, anchor.left, anchor.top);
      else positionRandomEventWindowInViewport(target);
      clampRandomEventWindowToViewport(target);
    },
    clampAfterMediaLoad: true,
    animate,
  });
};

const closeVirusEventWindow = (win) => {
  closeManagedRandomEventWindow(win, {
    beforeClose: () => {
      if (win === virusWindow) clearVirusStrikeEffect();
    },
  });
};

const showVirusWindow = () => {
  clearVirusStrikeEffect();
  virusExploding = false;
  virusRescueAnchor = null;
  showVirusEventWindow(virusWindow);
};

const showVirusRescueWindow = (state = "ready") => {
  const isAttack = state === "attack";
  setVirusRescueMessage(isAttack ? VIRUS_RESCUE_ATTACK_TEXT : VIRUS_RESCUE_READY_TEXT);
  setVirusRescueButtonDisabled(isAttack);
  showVirusEventWindow(virusRescueWindow, virusRescueAnchor, {
    animate: !isAttack,
  });
};

const acceptVirusInstall = () => {
  if (!virusWindow || virusExploding || virusWindow.classList.contains("is-hidden")) return;
  virusExploding = true;
  virusRescueAnchor = chooseVirusRescueAnchor();
  showVirusRescueWindow("attack");
  startVirusStrikeEffect(() => {
    virusWindow.setAttribute("aria-hidden", "true");
    triggerVirusFlashbang();
    animateWindowExplode(virusWindow, () => {
      virusExploding = false;
      virusWindow.classList.add("is-hidden");
      virusWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
      showVirusRescueWindow("ready");
    });
  });
};

registerRandomEvent({
  id: "virus",
  preloadTargets: () => [virusWindow, virusRescueWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isVirusVisible,
  canTrigger: () => !isVirusVisible(),
  run: () => {
    showVirusWindow();
  },
  bind: () => {
    if (virusYes) {
      virusYes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        acceptVirusInstall();
      });
    }

    if (virusNo) {
      virusNo.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeVirusEventWindow(virusWindow);
      });
    }

    if (virusRescueThanks) {
      virusRescueThanks.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeVirusEventWindow(virusRescueWindow);
      });
    }

    [virusWindow, virusRescueWindow].forEach((win) => {
      bindManagedRandomEventWindowAnimation(win, {
        afterOpen: () => clampRandomEventWindowToViewport(win),
      });
    });
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  virusWindow,
  virusRescueWindow,
]);

window.homeEventVirus = Object.freeze({
  virusRescueWindow,
  virusWindow,
});
})();
