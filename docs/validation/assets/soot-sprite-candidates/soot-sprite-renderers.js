/*
 * Stage 1 soot-sprite candidates for docs/notes/tickets/A_soot-sprite-redesign__20260929.md.
 *
 * Nothing here ships. The review page swaps each production sprite's body for one of these
 * candidates; Stage 2 moves the chosen renderer into scripts/home/events/soot-sprites.js.
 *
 * Structure: one inline SVG draws the static coat (fur or fringe plus the body disc) in a
 * 100-unit viewBox whose disc fills the production `--soot-size` box, so hairs and limbs
 * overflow it the way the current fuzz does. Eyes, pupils, limbs and the held candy are
 * HTML spans sized from `--soot-candidate-size`, so every behaviour animation is a composited
 * `transform` or `opacity` on an HTML element and never touches SVG geometry per frame.
 */
(() => {
const VARIANTS = Object.freeze(["a", "b", "c", "d"]);

const VARIANT_DETAILS = Object.freeze({
  a: Object.freeze({
    film: "My Neighbor Totoro",
    technique: "Vector SVG silhouette with a bristle fringe",
    behaviour: "Limbless; pupils follow the direction of travel.",
  }),
  b: Object.freeze({
    film: "My Neighbor Totoro",
    technique: "Procedural fur: strands generated per sprite so no two match",
    behaviour: "Limbless; occasional blink; fringe shivers while falling.",
  }),
  c: Object.freeze({
    film: "Spirited Away",
    technique: "Vector SVG with arms and legs",
    behaviour: "Legs scurry on the ground run; arms tuck in while falling.",
  }),
  d: Object.freeze({
    film: "Spirited Away",
    technique: "Procedural fur with limbs",
    behaviour: "After landing, some sprites lift a star candy overhead.",
  }),
});

/* Look spec in body diameters; see the ticket's "Look spec" heading. */
const BODY_RADIUS = 50;
const CANDY_LIFT_CHANCE = 0.4;
const CANDY_COLORS = Object.freeze(["#c9f7c2", "#ffc6dc", "#fff2a6", "#fffaf0", "#bde7ff"]);
const PUPIL_TRAVEL_PERCENT = 20;
const ARM_REST_MIN_DEG = 12;
const ARM_REST_MAX_DEG = 30;
const ARM_TUCKED_DEG = 62;
const ARM_LIFTED_DEG = -135;
const ARM_SWING_DEG = Object.freeze([-16, 8]);
const LEG_SCURRY_DEG = Object.freeze([-26, 24]);
const SCURRY_STEP_MS = 110;
const SHIVER_STEP_MS = 140;
const CANDY_LIFT_MS = 300;
const SVG_NS = "http://www.w3.org/2000/svg";
const SYMBOL_IDS = Object.freeze({ fringeA: "soot-candidate-fringe-a", fringeC: "soot-candidate-fringe-c" });

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

const round = (value) => Number(value.toFixed(2));

const polar = (radius, angle) => [
  round(BODY_RADIUS + radius * Math.cos(angle)),
  round(BODY_RADIUS + radius * Math.sin(angle)),
];

/**
 * Builds one path covering a whole ring of hairs. Each hair is a thin tapered quad bent by a
 * quadratic control point, so the ring reads as soft fur rather than spikes. Two layers are
 * drawn: a dense short coat plus sparser, longer stray hairs.
 */
const createBristlePath = (random, { coat, stray }) => {
  const parts = [];
  const drawLayer = ({ count, minLength, maxLength, baseWidth, spread, curl }) => {
    for (let index = 0; index < count; index += 1) {
      const angle = ((Math.PI * 2) / count) * index + between(random, -spread, spread);
      const length = between(random, minLength, maxLength);
      const bend = between(random, -curl, curl);
      const halfBase = baseWidth / 2 / BODY_RADIUS;
      const base = BODY_RADIUS - 3;
      const [tipX, tipY] = polar(base + length, angle + bend);
      const [leftX, leftY] = polar(base, angle - halfBase);
      const [rightX, rightY] = polar(base, angle + halfBase);
      const [controlX, controlY] = polar(base + length * 0.55, angle - bend * 0.6);
      parts.push(`M${leftX} ${leftY}Q${controlX} ${controlY} ${tipX} ${tipY}Q${controlX} ${controlY} ${rightX} ${rightY}Z`);
    }
  };
  drawLayer(coat);
  drawLayer(stray);
  return parts.join("");
};

const FRINGE_A = Object.freeze({
  coat: { count: 96, minLength: 6, maxLength: 13, baseWidth: 2.6, spread: 0.03, curl: 0.16 },
  stray: { count: 30, minLength: 12, maxLength: 20, baseWidth: 2.2, spread: 0.1, curl: 0.22 },
});

const FRINGE_C = Object.freeze({
  coat: { count: 110, minLength: 5, maxLength: 11, baseWidth: 2.4, spread: 0.03, curl: 0.14 },
  stray: { count: 22, minLength: 10, maxLength: 16, baseWidth: 2, spread: 0.1, curl: 0.2 },
});

const randomFur = (random) => ({
  coat: {
    count: Math.round(between(random, 84, 120)),
    minLength: between(random, 5, 7),
    maxLength: between(random, 11, 15),
    baseWidth: between(random, 2.2, 3),
    spread: 0.05,
    curl: between(random, 0.1, 0.22),
  },
  stray: {
    count: Math.round(between(random, 18, 34)),
    minLength: between(random, 10, 13),
    maxLength: between(random, 16, 23),
    baseWidth: between(random, 1.8, 2.4),
    spread: 0.12,
    curl: between(random, 0.14, 0.3),
  },
});

const createSvgElement = (name, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
};

/** The two fixed fringes are defined once per document and referenced with <use>. */
const ensureSharedSymbols = () => {
  if (document.getElementById(SYMBOL_IDS.fringeA)) return;
  const random = createSeededRandom(20260929);
  const defs = createSvgElement("svg", { "aria-hidden": "true", class: "soot-candidate-defs", width: 0, height: 0 });
  defs.style.position = "absolute";
  [
    [SYMBOL_IDS.fringeA, FRINGE_A],
    [SYMBOL_IDS.fringeC, FRINGE_C],
  ].forEach(([id, spec]) => {
    const symbol = createSvgElement("symbol", { id, viewBox: "0 0 100 100", overflow: "visible" });
    symbol.append(createSvgElement("path", { d: createBristlePath(random, spec), fill: "#060606" }));
    defs.append(symbol);
  });
  document.body.prepend(defs);
};

const createSpan = (className, style = "") => {
  const span = document.createElement("span");
  span.className = className;
  if (style) span.style.cssText = style;
  return span;
};

const armTransform = (side, angle) => `${side === "left" ? "scaleX(-1) " : ""}rotate(${angle}deg)`;

const legTransform = (side, angle) => `${side === "left" ? "scaleX(-1) " : ""}rotate(${angle}deg)`;

const pupilShift = (direction, descending) =>
  `translate(${round(direction * PUPIL_TRAVEL_PERCENT * 0.8)}%, ${descending ? PUPIL_TRAVEL_PERCENT * 0.6 : 0}%)`;

const createLimbs = (random) => {
  const limbs = {
    leftArm: createSpan("soot-candidate__limb soot-candidate__arm soot-candidate__arm--left"),
    rightArm: createSpan("soot-candidate__limb soot-candidate__arm soot-candidate__arm--right"),
    leftLeg: createSpan("soot-candidate__limb soot-candidate__leg soot-candidate__leg--left"),
    rightLeg: createSpan("soot-candidate__limb soot-candidate__leg soot-candidate__leg--right"),
  };
  limbs.leftArm.style.transform = armTransform("left", round(between(random, ARM_REST_MIN_DEG, ARM_REST_MAX_DEG)));
  limbs.rightArm.style.transform = armTransform("right", round(between(random, ARM_REST_MIN_DEG, ARM_REST_MAX_DEG)));
  limbs.leftLeg.style.transform = legTransform("left", 0);
  limbs.rightLeg.style.transform = legTransform("right", 0);
  return limbs;
};

/**
 * Renders one candidate body at `size` pixels. The returned element replaces
 * `.soot-sprite-body` inside a production `.soot-sprite`, or stands alone for stills.
 */
const renderSootSprite = (variant, size, { random = Math.random } = {}) => {
  if (!VARIANTS.includes(variant)) throw new Error(`Unknown soot sprite variant: ${variant}`);
  ensureSharedSymbols();
  const body = createSpan(`soot-candidate soot-candidate--${variant}`);
  body.style.setProperty("--soot-candidate-size", `${size}px`);
  const coat = createSvgElement("svg", {
    class: "soot-candidate__coat",
    viewBox: "0 0 100 100",
    overflow: "visible",
    "aria-hidden": "true",
    focusable: "false",
  });
  const parts = { body, coat, variant };

  if (variant === "a" || variant === "c") {
    // A random turn and an optional mirror about x = 50 give the shared fringe per-sprite variety.
    const mirror = random() < 0.5 ? " matrix(-1 0 0 1 100 0)" : "";
    coat.append(
      createSvgElement("use", {
        href: `#${variant === "a" ? SYMBOL_IDS.fringeA : SYMBOL_IDS.fringeC}`,
        transform: `rotate(${round(between(random, 0, 360))} 50 50)${mirror}`,
      })
    );
  } else {
    coat.append(createSvgElement("path", { d: createBristlePath(random, randomFur(random)), fill: "#060606" }));
  }
  coat.append(createSvgElement("circle", { cx: 50, cy: 50, r: BODY_RADIUS, fill: "#060606" }));

  const eyes = createSpan("soot-candidate__eyes");
  const pupils = createSpan("soot-candidate__pupils");
  pupils.append(
    createSpan("soot-candidate__pupil soot-candidate__pupil--left"),
    createSpan("soot-candidate__pupil soot-candidate__pupil--right")
  );
  eyes.append(
    createSpan("soot-candidate__eye soot-candidate__eye--left"),
    createSpan("soot-candidate__eye soot-candidate__eye--right"),
    pupils
  );
  Object.assign(parts, { eyes, pupils });

  body.append(coat);
  if (variant === "c" || variant === "d") {
    const limbs = createLimbs(random);
    body.append(limbs.leftLeg, limbs.rightLeg, limbs.leftArm, limbs.rightArm);
    Object.assign(parts, limbs);
  }
  body.append(eyes);

  if (variant === "d" && random() < CANDY_LIFT_CHANCE) {
    const candy = createSpan("soot-candidate__candy");
    candy.style.setProperty("--soot-candidate-candy", CANDY_COLORS[Math.floor(random() * CANDY_COLORS.length)]);
    body.append(candy);
    parts.candy = candy;
  }

  body.sootCandidate = parts;
  return body;
};

/** Keyframes alternating between poses every `stepMs` across [start, end] of the timeline. */
const alternatingKeyframes = ({ duration, start, end, stepMs, transforms, rest }) => {
  const frames = [];
  if (start > 0) frames.push({ offset: 0, transform: rest }, { offset: start, transform: rest });
  const steps = Math.max(1, Math.floor(((end - start) * duration) / stepMs));
  for (let index = 0; index <= steps; index += 1) {
    const offset = start + ((end - start) * index) / steps;
    frames.push({ offset: Math.min(offset, end), transform: transforms[index % transforms.length] });
  }
  if (end < 1) frames.push({ offset: Math.min(1, end + 0.0005), transform: rest }, { offset: 1, transform: rest });
  return frames;
};

/**
 * Attaches the behaviour animations for one body to a trajectory timeline:
 * `{ duration, delay, landingOffset, fallDirection, runs: [{ startOffset, endOffset, direction }] }`
 * with offsets as fractions of `duration`. Returns the paused Animation objects so the caller
 * can play them in step with the sprite's motion. Reduced motion attaches no animation and
 * leaves every candidate in its resting pose.
 */
const applySootSpriteTimeline = (body, timeline, { reducedMotion = false, random = Math.random } = {}) => {
  const parts = body.sootCandidate;
  if (!parts || reducedMotion) return [];
  const { duration, delay = 0, landingOffset, fallDirection, runs } = timeline;
  const timing = { delay, duration, easing: "linear", fill: "both" };
  const animations = [];
  const run = (element, keyframes, overrides = {}) => {
    const animation = element.animate(keyframes, { ...timing, ...overrides });
    animation.pause();
    animations.push(animation);
  };
  const pupilFrames = (fallShift) => {
    const frames = [
      { offset: 0, transform: fallShift },
      { offset: landingOffset, transform: fallShift },
    ];
    runs.forEach((segment) => {
      frames.push(
        { offset: Math.min(1, segment.startOffset + 0.02), transform: pupilShift(segment.direction, false) },
        { offset: segment.endOffset, transform: pupilShift(segment.direction, false) }
      );
    });
    return frames;
  };

  if (parts.variant === "a") run(parts.pupils, pupilFrames(pupilShift(fallDirection, true)));

  if (parts.variant === "b") {
    run(
      parts.coat,
      alternatingKeyframes({
        duration,
        start: 0,
        end: landingOffset,
        stepMs: SHIVER_STEP_MS,
        transforms: ["rotate(-3deg) scale(1.03)", "rotate(3deg) scale(0.98)"],
        rest: "rotate(0deg) scale(1)",
      })
    );
    const blinkPeriod = between(random, 2600, 4600);
    run(
      parts.eyes,
      [
        { offset: 0, transform: "scaleY(1)" },
        { offset: 0.9, transform: "scaleY(1)" },
        { offset: 0.94, transform: "scaleY(0.08)" },
        { offset: 0.98, transform: "scaleY(1)" },
        { offset: 1, transform: "scaleY(1)" },
      ],
      { duration: blinkPeriod, delay: delay + between(random, 0, blinkPeriod), iterations: Infinity, fill: "none" }
    );
  }

  if (parts.variant === "c" || parts.variant === "d") {
    const liftsCandy = Boolean(parts.candy);
    const liftOffset = Math.min(1, landingOffset + CANDY_LIFT_MS / duration);
    ["left", "right"].forEach((side, index) => {
      const leg = parts[`${side}Leg`];
      const poses = index === 0 ? LEG_SCURRY_DEG : [...LEG_SCURRY_DEG].reverse();
      run(
        leg,
        alternatingKeyframes({
          duration,
          start: landingOffset,
          end: 1,
          stepMs: SCURRY_STEP_MS,
          transforms: poses.map((angle) => legTransform(side, angle)),
          rest: leg.style.transform,
        })
      );
      const arm = parts[`${side}Arm`];
      const tucked = armTransform(side, ARM_TUCKED_DEG);
      const frames = [
        { offset: 0, transform: tucked },
        { offset: landingOffset, transform: tucked },
      ];
      if (liftsCandy) {
        frames.push(
          { offset: liftOffset, transform: armTransform(side, ARM_LIFTED_DEG) },
          { offset: 1, transform: armTransform(side, ARM_LIFTED_DEG) }
        );
      } else {
        const swingStart = Math.min(1, landingOffset + 0.03);
        frames.push(
          ...alternatingKeyframes({
            duration,
            start: swingStart,
            end: 1,
            stepMs: SCURRY_STEP_MS * 2,
            transforms: ARM_SWING_DEG.map((angle) => armTransform(side, angle)),
            rest: arm.style.transform,
          }).filter((frame) => frame.offset >= swingStart)
        );
      }
      run(arm, frames);
    });

    if (liftsCandy) {
      run(parts.candy, [
        { offset: 0, opacity: 0, transform: "translateY(120%) scale(0.4)" },
        { offset: landingOffset, opacity: 0, transform: "translateY(120%) scale(0.4)" },
        { offset: liftOffset, opacity: 1, transform: "translateY(0) scale(1)" },
        { offset: 1, opacity: 1, transform: "translateY(0) scale(1)" },
      ]);
    }

    // Pupils in C and D face the run direction too: a cheap read of where a sprite is going.
    run(parts.pupils, pupilFrames(pupilShift(0, true)));
  }

  return animations;
};

window.sootSpriteCandidates = Object.freeze({
  VARIANTS,
  VARIANT_DETAILS,
  applySootSpriteTimeline,
  createSeededRandom,
  renderSootSprite,
});
})();
