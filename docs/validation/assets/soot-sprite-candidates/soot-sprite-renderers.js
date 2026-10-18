/*
 * Second-round soot-sprite candidates for docs/notes/tickets/A_soot-sprite-redesign__20260929.md.
 *
 * Nothing here ships. The review page swaps each production sprite's body for one of these
 * candidates; Stage 2 moves the chosen renderer into scripts/home/events/soot-sprites.js.
 *
 * Every candidate is pixel art: a swarm's sprites are drawn cell by cell onto one shared
 * canvas sheet (black body disc, radial coat of single-cell hairs, white eyes with a baked
 * gaze), encoded once, and shown through `background-image` scaled up with
 * `image-rendering: pixelated`, so the sprite shares the site's pixel grid. The candidates
 * differ in cell size, coat length and density, eye size, and whether the coat "boils".
 * No limbs. One span per sprite, no SVG, no per-frame JavaScript.
 */
(() => {
const VARIANTS = Object.freeze(["e", "f", "g", "h", "i"]);

/*
 * unit: CSS pixels per cell at production size. fur: hair length range in body diameters,
 * density: hairs per cell of circumference, curl: maximum bend in radians.
 * eye: eye width in body diameters; eye centres sit `eyeGap` D apart and `eyeLift` D above centre.
 */
const VARIANT_DETAILS = Object.freeze({
  e: Object.freeze({
    name: "Chunky",
    unit: 3,
    fur: Object.freeze({ min: 0.08, max: 0.16, density: 1.2, curl: 0.12 }),
    eye: 0.36,
    eyeGap: 0.38,
    eyeLift: 0.05,
    technique: "3 px cells; short dense coat (0.08–0.16 D); eyes 0.36 D",
    behaviour: "Static coat. Each sprite's gaze is fixed in a random direction, as in the film still.",
  }),
  f: Object.freeze({
    name: "Reference",
    unit: 2,
    fur: Object.freeze({ min: 0.1, max: 0.22, density: 1.3, curl: 0.16 }),
    eye: 0.36,
    eyeGap: 0.38,
    eyeLift: 0.05,
    technique: "2 px cells; medium coat (0.10–0.22 D); eyes 0.36 D",
    behaviour: "Static coat with the reference's proportions and a fixed random gaze.",
  }),
  g: Object.freeze({
    name: "Urchin",
    unit: 1.5,
    fur: Object.freeze({ min: 0.14, max: 0.3, density: 0.9, curl: 0.3 }),
    eye: 0.36,
    eyeGap: 0.38,
    eyeLift: 0.05,
    technique: "1.5 px cells; long bent hairs (0.14–0.30 D), sparser; eyes 0.36 D",
    behaviour: "Static coat whose long hairs give the sea-urchin silhouette; fixed random gaze.",
  }),
  h: Object.freeze({
    name: "Boil",
    unit: 2,
    fur: Object.freeze({ min: 0.1, max: 0.22, density: 1.3, curl: 0.16 }),
    eye: 0.36,
    eyeGap: 0.38,
    eyeLift: 0.05,
    technique: "F's cells and coat drawn twice plus a blink frame",
    behaviour: "The coat flickers between two drawings every 160 ms while moving and the eyes blink every few seconds.",
  }),
  i: Object.freeze({
    name: "Mix",
    mix: Object.freeze(["f", "g", "h"]),
    technique: "Each sprite draws F's, G's or H's cells and coat at random (H's coat is F's)",
    behaviour: "Every sprite boils and blinks like H; pixel-art smoke and candy replace the blurred puffs and vector stars.",
  }),
});

/* Production candy colours (scripts/home/events/soot-sprites.js) in sheet order. */
const CANDY_COLORS = Object.freeze(["#c9f7c2", "#ffc6dc", "#fff2a6", "#fffaf0", "#bde7ff"]);
const CANDY_CELLS = 9;
const CANDY_SHAPES = Object.freeze([
  Object.freeze([
    "....X....",
    ".X..X..X.",
    "..XXXXX..",
    ".XXXXXXX.",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    ".X..X..X.",
    "....X....",
  ]),
  Object.freeze([
    "X...X...X",
    ".X.XXX.X.",
    "..XXXXX..",
    ".XXXXXXX.",
    "X.XXXXX.X",
    ".XXXXXXX.",
    "..XXXXX..",
    ".X.XXX.X.",
    "X...X...X",
  ]),
]);
const PUFF_CELLS = Object.freeze({ width: 96, height: 48 });
const PUFF_SHAPES = 6;

const NOMINAL_SIZE = 32;
const MIN_BODY_CELLS = 8;
const BOIL_STEP_MS = 160;
const BLINK_MIN_MS = 2400;
const BLINK_MAX_MS = 4800;
const INK = "#000";
const EYE_WHITE = "#fff";

/** Deterministic generator so stills and size samples are reproducible. */
const createSeededRandom = (seed) => {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const between = (random, min, max) => min + random() * (max - min);

/** Cell geometry for one sprite: body diameter in cells and the canvas size that fits the coat. */
const geometryFor = (details, nominalSize) => {
  const bodyCells = Math.max(MIN_BODY_CELLS, Math.round(nominalSize / details.unit));
  const furCells = Math.ceil(bodyCells * details.fur.max) + 1;
  const cells = bodyCells + furCells * 2;
  return { bodyCells, furCells, cells, centre: cells / 2 };
};

const fillCell = (context, x, y) => {
  context.fillRect(Math.floor(x), Math.floor(y), 1, 1);
};

/** Fills the cells whose centres fall inside the ellipse; `reach` below 1 trims the corner cells. */
const fillEllipse = (context, cx, cy, rx, ry, reach = 1) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= reach) fillCell(context, x, y);
    }
  }
};

/** Single-cell hairs rooted just inside the body edge, each with its own length and bend. */
const drawCoat = (context, geometry, fur, random) => {
  const { bodyCells, centre } = geometry;
  const radius = bodyCells / 2;
  const count = Math.round(Math.PI * bodyCells * fur.density);
  const step = (Math.PI * 2) / count;
  for (let index = 0; index < count; index += 1) {
    const angle = step * index + between(random, -step * 0.4, step * 0.4);
    const length = between(random, fur.min, fur.max) * bodyCells;
    const bend = between(random, -fur.curl, fur.curl);
    for (let distance = radius - 1; distance <= radius + length; distance += 0.5) {
      const along = Math.max(0, distance - radius) / Math.max(length, 0.5);
      const hairAngle = angle + bend * along;
      fillCell(context, centre + distance * Math.cos(hairAngle), centre + distance * Math.sin(hairAngle));
    }
  }
};

/**
 * Eyes with a baked gaze: white ovals with trimmed corners and a square pupil of whole cells
 * that stays at least one cell inside the white. `closed` draws one-cell slits for the blink frame.
 */
const drawEyes = (context, geometry, details, gaze, { closed = false } = {}) => {
  const { bodyCells, centre } = geometry;
  const rx = (details.eye * bodyCells) / 2;
  const ry = rx * 1.15;
  const eyeY = centre - details.eyeLift * bodyCells;
  const pupil = Math.max(1, Math.round(bodyCells * 0.07));
  const reachX = Math.max(0, Math.floor(rx - pupil / 2 - 1));
  const reachY = Math.max(0, Math.floor(ry - pupil / 2 - 1));
  [-1, 1].forEach((side) => {
    const eyeX = centre + (side * details.eyeGap * bodyCells) / 2;
    context.fillStyle = EYE_WHITE;
    if (closed) {
      for (let x = Math.floor(eyeX - rx * 0.8); x < Math.ceil(eyeX + rx * 0.8); x += 1) fillCell(context, x, eyeY);
      return;
    }
    fillEllipse(context, eyeX, eyeY, rx, ry, 0.85);
    context.fillStyle = INK;
    context.fillRect(
      Math.round(eyeX + gaze.x * reachX - pupil / 2),
      Math.round(eyeY + gaze.y * reachY - pupil / 2),
      pupil,
      pupil
    );
  });
};

/** Draws one sprite frame at `originX` on the shared sheet context. */
const drawFrame = (context, originX, geometry, details, random, gaze, { closed = false } = {}) => {
  context.save();
  context.translate(originX, 0);
  context.fillStyle = INK;
  drawCoat(context, geometry, details.fur, random);
  fillEllipse(context, geometry.centre, geometry.centre, geometry.bodyCells / 2, geometry.bodyCells / 2);
  drawEyes(context, geometry, details, gaze, { closed });
  context.restore();
};

/** A random direction scaled so pupils stay inside the whites; most sprites look mostly ahead. */
const randomGaze = (random) => {
  const angle = between(random, 0, Math.PI * 2);
  const reach = between(random, 0.2, 1);
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
};

const animatedCoat = (variant) => variant === "h" || variant === "i";

const frameCount = (variant) => (animatedCoat(variant) ? 3 : 1);

/** The look one sprite draws: the candidate itself, or a random member of a mixed candidate. */
const lookFor = (variant, random) => {
  const details = VARIANT_DETAILS[variant];
  if (!details.mix) return details;
  return VARIANT_DETAILS[details.mix[Math.floor(random() * details.mix.length)]];
};

/**
 * Renders a batch of candidate bodies that share one sprite sheet. `sprites` is a list of
 * `{ size, nominalSize }`; the pixel grid is derived from `nominalSize` (default `size`), so a
 * 256 px still drawn with `nominalSize: 32` shows the production cells magnified. Every frame of
 * every sprite is drawn side by side on one canvas with one 2D context, encoded once, and each
 * body shows its frames through `background-position` on a single span. The returned elements replace
 * `.soot-sprite-body` inside production `.soot-sprite`s, or stand alone for stills.
 */
const renderSootSprites = (variant, sprites, { random = Math.random } = {}) => {
  if (!VARIANTS.includes(variant)) throw new Error(`Unknown soot sprite variant: ${variant}`);
  const frames = frameCount(variant);
  const plans = sprites.map(({ size, nominalSize = size }) => {
    const details = lookFor(variant, random);
    return { size, details, geometry: geometryFor(details, nominalSize), gaze: randomGaze(random) };
  });
  const sheetWidth = plans.reduce((total, plan) => total + plan.geometry.cells * frames, 0);
  const sheetHeight = Math.max(...plans.map((plan) => plan.geometry.cells));
  const sheet = document.createElement("canvas");
  sheet.width = sheetWidth;
  sheet.height = sheetHeight;
  const context = sheet.getContext("2d");
  let originX = 0;
  const bodies = plans.map((plan) => {
    const { size, details, geometry, gaze } = plan;
    const cellPx = size / geometry.bodyCells;
    const body = document.createElement("span");
    body.className = `soot-candidate soot-candidate--${variant}`;
    body.style.setProperty("--soot-candidate-size", `${size}px`);
    body.style.setProperty("--soot-candidate-frame", `${geometry.cells * cellPx}px`);
    body.style.setProperty("--soot-candidate-inset", `${(size - geometry.cells * cellPx) / 2}px`);
    body.style.setProperty("--soot-candidate-sheet", `${sheetWidth * cellPx}px ${sheetHeight * cellPx}px`);
    const framePositions = [];
    for (let frame = 0; frame < frames; frame += 1) {
      drawFrame(context, originX, geometry, details, random, gaze, { closed: frame === 2 });
      framePositions.push(`${-originX * cellPx}px 0px`);
      originX += geometry.cells;
    }
    const layer = document.createElement("span");
    layer.className = "soot-candidate__frame";
    layer.style.backgroundPosition = framePositions[0];
    body.append(layer);
    body.sootCandidate = { body, variant, layer, framePositions, geometry };
    return body;
  });
  const image = `url("${sheet.toDataURL("image/png")}")`;
  bodies.forEach((body) => body.style.setProperty("--soot-candidate-image", image));
  return bodies;
};

/** Renders one candidate body; see `renderSootSprites`. */
const renderSootSprite = (variant, size, { random = Math.random, nominalSize = size } = {}) =>
  renderSootSprites(variant, [{ size, nominalSize }], { random })[0];

/**
 * Attaches the behaviour animations for one body to a trajectory timeline:
 * `{ duration, delay, landingOffset, fallDirection, runs }` with offsets as fractions of
 * `duration`. Only H and I animate: one stepped `background-position` animation alternates the two
 * coat frames while the sprite moves and shows the blink frame for one step every few seconds.
 * Returns the paused Animation objects so the caller can play them in step with the sprite's
 * motion. Reduced motion attaches no animation.
 */
const applySootSpriteTimeline = (body, timeline, { reducedMotion = false, random = Math.random } = {}) => {
  const parts = body.sootCandidate;
  if (!parts || reducedMotion || !animatedCoat(parts.variant)) return [];
  const { duration, delay = 0 } = timeline;
  const steps = Math.max(2, Math.floor(duration / BOIL_STEP_MS));
  const blinkEvery = Math.round(between(random, BLINK_MIN_MS, BLINK_MAX_MS) / BOIL_STEP_MS);
  const blinkPhase = Math.floor(between(random, 0, blinkEvery));
  const visibleFrame = (step) => ((step + blinkPhase) % blinkEvery === 0 ? 2 : step % 2);
  const keyframes = [];
  for (let step = 0; step <= steps; step += 1) {
    keyframes.push({
      offset: Math.min(1, step / steps),
      backgroundPosition: parts.framePositions[visibleFrame(step)],
      easing: "step-end",
    });
  }
  const animation = parts.layer.animate(keyframes, { delay, duration, fill: "both" });
  animation.pause();
  return [animation];
};

/** Darkens or lightens a hex colour by `amount` (−1…1). */
const shade = (hex, amount) => {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return `rgb(${channels
    .map((value) => Math.round(amount < 0 ? value * (1 + amount) : value + (255 - value) * amount))
    .join(", ")})`;
};

/**
 * Draws every candy colour in every shape on one 9-cell-high sheet: a filled star with a white
 * highlight cell and a darker lower-right edge. Returns the data URL and the slot index for a
 * production `--candy-color`.
 */
const renderCandySheet = () => {
  const sheet = document.createElement("canvas");
  sheet.width = CANDY_CELLS * CANDY_COLORS.length * CANDY_SHAPES.length;
  sheet.height = CANDY_CELLS;
  const context = sheet.getContext("2d");
  CANDY_SHAPES.forEach((shape, shapeIndex) => {
    CANDY_COLORS.forEach((color, colorIndex) => {
      const originX = (shapeIndex * CANDY_COLORS.length + colorIndex) * CANDY_CELLS;
      shape.forEach((row, y) => {
        [...row].forEach((cell, x) => {
          if (cell !== "X") return;
          const onEdge = y >= 5 && x >= 4 && (shape[y + 1]?.[x] !== "X" || shape[y]?.[x + 1] !== "X");
          context.fillStyle = onEdge ? shade(color, -0.28) : color;
          context.fillRect(originX + x, y, 1, 1);
        });
      });
      context.fillStyle = "#fff";
      context.fillRect(originX + 3, 3, 1, 1);
    });
  });
  return {
    image: `url("${sheet.toDataURL("image/png")}")`,
    slots: CANDY_COLORS.length * CANDY_SHAPES.length,
    slotFor: (color, shapeIndex) =>
      shapeIndex * CANDY_COLORS.length + Math.max(0, CANDY_COLORS.indexOf(String(color).trim().toLowerCase())),
  };
};

/**
 * Draws `PUFF_SHAPES` smoke blobs side by side, each a union of soft discs on a 96×48 cell grid
 * with three translucent shades of black and a dithered rim, so a scaled puff reads as pixel
 * smoke about as dark as the blurred production gradients.
 */
const renderPuffSheet = (random) => {
  const { width, height } = PUFF_CELLS;
  const sheet = document.createElement("canvas");
  sheet.width = width * PUFF_SHAPES;
  sheet.height = height;
  const context = sheet.getContext("2d");
  for (let shape = 0; shape < PUFF_SHAPES; shape += 1) {
    const discs = [];
    const discCount = Math.round(between(random, 6, 9));
    for (let index = 0; index < discCount; index += 1) {
      discs.push({
        x: between(random, width * 0.22, width * 0.78),
        y: between(random, height * 0.3, height * 0.7),
        r: between(random, height * 0.2, height * 0.34),
      });
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let nearest = Infinity;
        discs.forEach((disc) => {
          const distance = Math.hypot(x + 0.5 - disc.x, y + 0.5 - disc.y) / disc.r;
          if (distance < nearest) nearest = distance;
        });
        let alpha = 0;
        if (nearest < 0.7) alpha = 0.5;
        else if (nearest < 1) alpha = random() < 0.85 ? 0.32 : 0;
        else if (nearest < 1.18) alpha = random() < 0.4 ? 0.16 : 0;
        if (!alpha) continue;
        context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        context.fillRect(shape * width + x, y, 1, 1);
      }
    }
  }
  return { image: `url("${sheet.toDataURL("image/png")}")`, shapes: PUFF_SHAPES };
};

/** Builds both effect sheets once; the result feeds `dressSootEffects`. */
const renderSootEffectSheets = ({ random = Math.random } = {}) => ({
  candy: renderCandySheet(),
  puff: renderPuffSheet(random),
});

/**
 * Points every production candy and puff inside `overlay` at its pixel-art slot. The
 * `is-pixel-effects` class on the overlay switches the stylesheet from the vector star and the
 * blurred gradients to the sheets; the production fall, spin, drift and fade animations are
 * untouched because they only animate `transform` and `opacity`.
 */
const dressSootEffects = (overlay, sheets, { random = Math.random } = {}) => {
  overlay.classList.add("is-pixel-effects");
  overlay.style.setProperty("--soot-candy-sheet", sheets.candy.image);
  overlay.style.setProperty("--soot-candy-slots", String(sheets.candy.slots));
  overlay.style.setProperty("--soot-puff-sheet", sheets.puff.image);
  overlay.style.setProperty("--soot-puff-shapes", String(sheets.puff.shapes));
  overlay.querySelectorAll(".soot-star-candy").forEach((candy) => {
    const slot = sheets.candy.slotFor(
      candy.style.getPropertyValue("--candy-color"),
      Math.floor(random() * CANDY_SHAPES.length)
    );
    candy.style.setProperty("--soot-candy-slot", String(slot));
  });
  overlay.querySelectorAll(".soot-puff").forEach((puff) => {
    puff.style.setProperty("--soot-puff-shape", String(Math.floor(random() * sheets.puff.shapes)));
  });
};

window.sootSpriteCandidates = Object.freeze({
  NOMINAL_SIZE,
  VARIANTS,
  VARIANT_DETAILS,
  applySootSpriteTimeline,
  createSeededRandom,
  dressSootEffects,
  renderSootEffectSheets,
  renderSootSprite,
  renderSootSprites,
});
})();
