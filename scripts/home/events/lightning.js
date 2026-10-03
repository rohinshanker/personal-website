(() => {
// How often a bolt forks a second time.
const FATE_LIGHTNING_BRANCH_CHANCE = 0.22;

const {
  clampNumber,
} = window.homeUtil;

const RED_LIGHTNING_PALETTE = Object.freeze({
  glow: "255, 0, 0",
  mid: "255, 60, 60",
  core: "255, 235, 235",
  shadow: "rgba(255, 0, 0, 0.95)",
});

const GREEN_LIGHTNING_PALETTE = Object.freeze({
  glow: "0, 190, 70",
  mid: "68, 255, 130",
  core: "232, 255, 238",
  shadow: "rgba(0, 255, 120, 0.95)",
});

const YELLOW_LIGHTNING_PALETTE = Object.freeze({
  glow: "255, 209, 0",
  mid: "255, 238, 86",
  core: "255, 255, 232",
  shadow: "rgba(255, 214, 0, 0.95)",
});

const resizeLightningCanvas = (canvas) => {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const field = canvas.parentElement;
  const rect = field ? field.getBoundingClientRect() : canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
};

const clearLightningCanvas = (canvas) => {
  const setup = resizeLightningCanvas(canvas);
  if (!setup) return;
  setup.ctx.clearRect(0, 0, setup.width, setup.height);
};

const generateFateBoltPath = (
  x1,
  y1,
  x2,
  y2,
  displacement,
  branchLevel,
  bolts
) => {
  const midpointX = (x1 + x2) / 2;
  const midpointY = (y1 + y2) / 2;

  if (displacement < 0.5) {
    return [[x2, y2]];
  }

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const offset = (Math.random() - 0.5) * displacement * 3 * (1 - branchLevel * 0.14);
  const newMidX = midpointX + Math.cos(angle + Math.PI / 2) * offset;
  const newMidY = midpointY + Math.sin(angle + Math.PI / 2) * offset;
  const newDisplacement = displacement * 0.42;

  if (branchLevel < 2 && Math.random() < FATE_LIGHTNING_BRANCH_CHANCE) {
    const branchAngle = angle + (Math.random() - 0.5) * Math.PI * 0.95;
    const branchLength = displacement * (Math.random() * 2.6 + 1.6);
    const branchX2 = newMidX + Math.cos(branchAngle) * branchLength;
    const branchY2 = newMidY + Math.sin(branchAngle) * branchLength;
    const branchPath = generateFateBoltPath(
      newMidX,
      newMidY,
      branchX2,
      branchY2,
      newDisplacement,
      branchLevel + 1,
      bolts
    );

    bolts.push({
      path: branchPath,
      start: [newMidX, newMidY],
      level: branchLevel + 1,
    });
  }

  const path1 = generateFateBoltPath(
    x1,
    y1,
    newMidX,
    newMidY,
    newDisplacement,
    branchLevel,
    bolts
  );
  const path2 = generateFateBoltPath(
    newMidX,
    newMidY,
    x2,
    y2,
    newDisplacement,
    branchLevel,
    bolts
  );

  return path1.concat([[newMidX, newMidY]], path2);
};

const drawFateBolt = (
  ctx,
  path,
  startX,
  startY,
  level,
  alpha,
  palette = RED_LIGHTNING_PALETTE
) => {
  const opacity = alpha * Math.max(0.3, 1 - level * 0.24);
  const glowWidth = level === 0 ? 6 : 3;
  const coreWidth = level === 0 ? 1.4 : 0.65;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(${palette.glow}, ${opacity})`;
  ctx.lineWidth = glowWidth;
  ctx.shadowBlur = level === 0 ? 16 : 9;
  ctx.shadowColor = palette.shadow;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(${palette.mid}, ${opacity})`;
  ctx.lineWidth = Math.max(1.4, glowWidth * 0.42);
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(${palette.core}, ${Math.min(1, opacity + 0.18)})`;
  ctx.lineWidth = coreWidth;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();
  ctx.restore();
};

const drawLightningBorderFrame = (canvas, alpha, palette = RED_LIGHTNING_PALETTE) => {
  const setup = resizeLightningCanvas(canvas);
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
    drawFateBolt(ctx, bolt.path, bolt.start[0], bolt.start[1], bolt.level, alpha, palette);
  });
};

window.homeEventLightning = Object.freeze({
  GREEN_LIGHTNING_PALETTE,
  RED_LIGHTNING_PALETTE,
  YELLOW_LIGHTNING_PALETTE,
  clearLightningCanvas,
  drawLightningBorderFrame,
  generateFateBoltPath,
});
})();
