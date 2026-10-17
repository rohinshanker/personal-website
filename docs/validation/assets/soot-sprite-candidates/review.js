/* Review page logic: stills, size samples, and dressing the real swarm with a candidate look. */
(() => {
const { VARIANTS, VARIANT_DETAILS, applySootSpriteTimeline, createSeededRandom, renderSootSprite } =
  window.sootSpriteCandidates;
const registration = window.sootSpriteReviewRuntime.getRegistration("soot-sprites");
const status = document.getElementById("status");
const reducedMotionToggle = document.getElementById("reduced-motion");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const STILL_SIZE = 256;
const SAMPLE_SIZES = [24, 40];
const SAMPLES_PER_SIZE = 3;

let lastTimings = null;

const selectedVariant = () => document.querySelector('input[name="swarm-variant"]:checked').value;

const reducedMotion = () => reducedMotionToggle.checked;

const setStatus = (text) => {
  status.textContent = text;
};

/* Candidate table and cards. */

const buildTable = () => {
  const tbody = document.getElementById("candidate-table");
  VARIANTS.forEach((variant) => {
    const details = VARIANT_DETAILS[variant];
    const row = document.createElement("tr");
    [variant.toUpperCase(), details.film, details.technique, details.behaviour].forEach((text) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    });
    tbody.append(row);
  });
};

const createStill = (variant, size, seed) => {
  const still = renderSootSprite(variant, size, { random: createSeededRandom(seed) });
  still.classList.add("soot-candidate--still");
  return still;
};

const buildCards = () => {
  const grid = document.getElementById("contact-sheet");
  VARIANTS.forEach((variant, index) => {
    const details = VARIANT_DETAILS[variant];
    const card = document.createElement("section");
    card.className = "window";
    card.setAttribute("aria-labelledby", `candidate-${variant}-title`);
    card.innerHTML = `
      <div class="title-bar"><div class="title-bar-text">Candidate ${variant.toUpperCase()}</div></div>
      <div class="window-body">
        <h2 id="candidate-${variant}-title">${variant.toUpperCase()} · ${details.film}</h2>
        <dl>
          <dt>Technique</dt><dd>${details.technique}</dd>
          <dt>Behaviour</dt><dd>${details.behaviour}</dd>
        </dl>
        <div class="candidate-still" data-still></div>
        <div class="candidate-sizes" data-sizes></div>
      </div>`;
    grid.append(card);
    const sizes = card.querySelector("[data-sizes]");
    SAMPLE_SIZES.forEach((size) => {
      const figure = document.createElement("figure");
      const row = document.createElement("div");
      row.className = "row";
      for (let sample = 0; sample < SAMPLES_PER_SIZE; sample += 1) {
        row.append(createStill(variant, size, 2000 + index * 10 + size + sample));
      }
      const caption = document.createElement("figcaption");
      caption.textContent = `${size} px`;
      figure.append(row, caption);
      sizes.append(figure);
    });
  });
  // Limbs and hairs overflow the body by about 0.6 D, so stills are sized once every card is
  // in the grid and shrink on narrow panels.
  VARIANTS.forEach((variant, index) => {
    const panel = grid.querySelector(`[aria-labelledby="candidate-${variant}-title"] [data-still]`);
    panel.append(createStill(variant, Math.min(STILL_SIZE, Math.floor(panel.clientWidth / 1.7)), 1000 + index));
  });
};

/* Dressing the real swarm. */

const parseTranslate = (transform) => {
  const match = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(transform || "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
};

/** Reads the fall/run timeline back out of the production sprite's keyframes. */
const readTimeline = (sprite) => {
  const motion = sprite.getAnimations()[0];
  const timing = motion.effect.getTiming();
  const groundY = Number.parseFloat(sprite.style.getPropertyValue("--soot-y-land"));
  const points = motion.effect
    .getKeyframes()
    .map((frame) => ({ offset: frame.computedOffset, ...parseTranslate(frame.transform) }));
  const landingIndex = points.findIndex((point, index) => index > 0 && Math.abs(point.y - groundY) < 0.75);
  const landing = points[landingIndex];
  const fallDirection = Math.sign(landing.x - points[0].x) || 1;
  const runs = [];
  for (let index = landingIndex + 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    runs.push({
      startOffset: previous.offset,
      endOffset: points[index].offset,
      direction: Math.sign(points[index].x - previous.x) || fallDirection,
    });
  }
  return { duration: timing.duration, delay: timing.delay, landingOffset: landing.offset, fallDirection, runs };
};

const dressSwarm = (overlay) => {
  const variant = selectedVariant();
  if (variant === "current") {
    setStatus(`Current sprite swarm: ${overlay.querySelectorAll(".soot-sprite").length} sprites.`);
    return;
  }
  const animations = [];
  const sprites = [...overlay.querySelectorAll(".soot-sprite")];
  const started = performance.now();
  // Read every timeline before touching the DOM so the animation reads force one style pass.
  const timelines = sprites.map(readTimeline);
  const readMs = performance.now() - started;
  const bodies = sprites.map((sprite) =>
    renderSootSprite(variant, Number.parseFloat(sprite.style.getPropertyValue("--soot-size")))
  );
  const renderMs = performance.now() - started - readMs;
  sprites.forEach((sprite, index) => {
    sprite.querySelector(".soot-sprite-body")?.replaceWith(bodies[index]);
  });
  const replaceMs = performance.now() - started - readMs - renderMs;
  bodies.forEach((body, index) => {
    animations.push(...applySootSpriteTimeline(body, timelines[index], { reducedMotion: reducedMotion() }));
  });
  lastTimings = { readMs, renderMs, replaceMs, animateMs: performance.now() - started - readMs - renderMs - replaceMs };
  const release = new MutationObserver(() => {
    if (overlay.classList.contains("is-staged")) return;
    animations.forEach((animation) => animation.play());
    release.disconnect();
    setStatus(`Candidate ${variant.toUpperCase()} swarm released: ${sprites.length} sprites${reducedMotion() ? ", reduced motion" : ""}.`);
  });
  release.observe(overlay, { attributes: true, attributeFilter: ["class"] });
  const dressMs = Math.round(performance.now() - started);
  performance.mark("soot-candidate-dressed");
  setStatus(`Candidate ${variant.toUpperCase()} swarm staged behind the alert (${sprites.length} bodies dressed in ${dressMs} ms).`);
};

const watchForSwarms = () => {
  new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("soot-sprites-swarm")) dressSwarm(node);
      });
    });
  }).observe(document.body, { childList: true });
};

/* Controls. */

const syncReducedMotion = () => {
  document.documentElement.dataset.reducedMotion = reducedMotion() ? "true" : "false";
};

buildTable();
buildCards();
watchForSwarms();
registration.bind();
reducedMotionToggle.checked = motionQuery.matches;
syncReducedMotion();
reducedMotionToggle.addEventListener("change", syncReducedMotion);
document.getElementById("trigger-alert").addEventListener("click", () => {
  registration.run();
  setStatus(`Alert open for candidate ${selectedVariant().toUpperCase()}. Press Yes to release the swarm.`);
});

window.sootSpriteReview = Object.freeze({ readTimeline, selectedVariant, getLastTimings: () => lastTimings });
})();
