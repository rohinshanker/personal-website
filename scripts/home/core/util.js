(() => {

const clampNumber = (value, min, max) => Math.max(min, Math.min(value, max));

const DIGITAL_DIGIT_SOURCES = {
  "0": "assets/minesweeper_assets/digital_digits/digital_0.png",
  "1": "assets/minesweeper_assets/digital_digits/digital_1.png",
  "2": "assets/minesweeper_assets/digital_digits/digital_2.png",
  "3": "assets/minesweeper_assets/digital_digits/digital_3.png",
  "4": "assets/minesweeper_assets/digital_digits/digital_4.png",
  "5": "assets/minesweeper_assets/digital_digits/digital_5.png",
  "6": "assets/minesweeper_assets/digital_digits/digital_6.png",
  "7": "assets/minesweeper_assets/digital_digits/digital_7.png",
  "8": "assets/minesweeper_assets/digital_digits/digital_8.png",
  "9": "assets/minesweeper_assets/digital_digits/digital_9.png",
  "-": "assets/minesweeper_assets/digital_digits/digital_minus.png",
  " ": "assets/minesweeper_assets/digital_digits/digital_unlit.png",
};

const padTwoDigits = (value) => String(value).padStart(2, "0");

const debounceTimer = (timerId, callback, delayMs) => {
  if (timerId) window.clearTimeout(timerId);
  return window.setTimeout(callback, delayMs);
};

const afterFrames = (frameCount, callback) => {
  if (frameCount <= 0) {
    callback();
    return null;
  }
  return window.requestAnimationFrame(() => afterFrames(frameCount - 1, callback));
};

const reducedMotionQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

const prefersReducedMotion = () => Boolean(reducedMotionQuery?.matches);

/** Seconds as `mm:ss`, or the placeholder when there is no time yet. */
const formatElapsedTime = (seconds, placeholder = "—") => {
  if (!Number.isFinite(seconds)) return placeholder;
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = padTwoDigits(Math.floor(safeSeconds / 60));
  const remainingSeconds = padTwoDigits(safeSeconds % 60);
  return `${minutes}:${remainingSeconds}`;
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());
  return `${year}-${month}-${day}`;
};

const chooseWeightedRandomEvent = (eligibleEvents) => {
  const totalWeight = eligibleEvents.reduce(
    (total, event) => total + (event.selectionWeight ?? event.triggerProbability),
    0
  );
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (const event of eligibleEvents) {
    roll -= event.selectionWeight ?? event.triggerProbability;
    if (roll <= 0) return event;
  }

  return eligibleEvents[eligibleEvents.length - 1] || null;
};

const shuffle = (items) => {
  const shuffled = Array.from(items);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};


window.homeUtil = Object.freeze({
  DIGITAL_DIGIT_SOURCES,
  afterFrames,
  chooseWeightedRandomEvent,
  clampNumber,
  debounceTimer,
  formatElapsedTime,
  getLocalDateKey,
  padTwoDigits,
  prefersReducedMotion,
  reducedMotionQuery,
  shuffle,
});
})();