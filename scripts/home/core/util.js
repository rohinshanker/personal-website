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

const resolveStorage = (storage) =>
  typeof storage === "function" ? storage() : storage;

/** Reads JSON without letting blocked storage access or malformed data escape. */
const readJsonStorage = (storage, key, fallbackValue = null) => {
  try {
    const serialized = resolveStorage(storage).getItem(key);
    return serialized === null ? fallbackValue : JSON.parse(serialized);
  } catch {
    return fallbackValue;
  }
};

/** Writes JSON when storage and serialization are available. */
const writeJsonStorage = (storage, key, value) => {
  try {
    resolveStorage(storage).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/** Removes a storage entry, reporting whether the operation was available. */
const removeStorage = (storage, key) => {
  try {
    resolveStorage(storage).removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const bannerAnimationCleanups = new WeakMap();

/** Restarts a banner animation and leaves no stale animationend listener. */
const flashBanner = (element, className = "is-showing") => {
  if (!element) return false;
  const previousCleanup = bannerAnimationCleanups.get(element);
  if (previousCleanup) element.removeEventListener("animationend", previousCleanup);
  element.classList.remove(className);
  void element.offsetWidth;
  const cleanup = (event) => {
    if (event.target !== element) return;
    element.classList.remove(className);
    element.removeEventListener("animationend", cleanup);
    if (bannerAnimationCleanups.get(element) === cleanup) {
      bannerAnimationCleanups.delete(element);
    }
  };
  bannerAnimationCleanups.set(element, cleanup);
  element.addEventListener("animationend", cleanup);
  element.classList.add(className);
  return true;
};

/** Whether a document is visible and, when supported, owns page focus. */
const isPageActive = (pageDocument = document) =>
  Boolean(
    pageDocument &&
      !pageDocument.hidden &&
      (typeof pageDocument.hasFocus !== "function" || pageDocument.hasFocus())
  );

/**
 * A cancellable progress scheduler. Games supply their own progress curve,
 * readiness rule, duration, and UI callbacks; the helper only owns timing.
 */
const createProgressLoader = ({
  progressCap,
  isReady = () => true,
  shouldContinue = () => true,
  nextProgress,
  nextDelay,
  onProgress,
  onReady,
  onTimerChange = () => {},
  now = () => performance.now(),
  setTimer = (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimer = (timerId) => window.clearTimeout(timerId),
}) => {
  let timerId = null;
  let startedAt = 0;
  let durationMs = 0;
  let progress = 0;
  let running = false;
  let generation = 0;

  const setLoaderTimer = (callback, delayMs) => {
    timerId = setTimer(callback, Math.max(0, delayMs));
    onTimerChange(timerId);
  };

  const clearLoaderTimer = () => {
    if (timerId !== null) clearTimer(timerId);
    timerId = null;
    onTimerChange(null);
  };

  const cancel = () => {
    generation += 1;
    running = false;
    clearLoaderTimer();
  };

  const updateProgress = (value) => {
    progress = clampNumber(value, 0, progressCap);
    onProgress(progress);
  };

  const tick = (ownedGeneration) => {
    if (!running || ownedGeneration !== generation) return;
    timerId = null;
    onTimerChange(null);
    if (!running || ownedGeneration !== generation) return;
    const continues = shouldContinue();
    if (!running || ownedGeneration !== generation) return;
    if (!continues) {
      cancel();
      return;
    }

    const elapsedMs = Math.max(0, now() - startedAt);
    const ready = elapsedMs >= durationMs && isReady();
    if (!running || ownedGeneration !== generation) return;
    if (ready) {
      running = false;
      progress = 100;
      onProgress(progress);
      if (ownedGeneration !== generation) return;
      onReady();
      return;
    }

    const proposedProgress = nextProgress({
      elapsedMs,
      durationMs,
      progress,
      progressCap,
    });
    if (!running || ownedGeneration !== generation) return;
    updateProgress(Math.max(progress, proposedProgress));
    if (!running || ownedGeneration !== generation) return;
    const delayMs = nextDelay({
      elapsedMs,
      durationMs,
      progress,
      progressCap,
      waitingForReady: elapsedMs >= durationMs,
    });
    if (!running || ownedGeneration !== generation) return;
    setLoaderTimer(() => tick(ownedGeneration), delayMs);
  };

  const start = ({ duration, initialDelay = 0, initialProgress = 0 } = {}) => {
    cancel();
    generation += 1;
    const ownedGeneration = generation;
    durationMs = Math.max(0, Number(duration) || 0);
    startedAt = now();
    running = true;
    updateProgress(initialProgress);
    if (!running || ownedGeneration !== generation) {
      return { durationMs, startedAt };
    }
    setLoaderTimer(() => tick(ownedGeneration), initialDelay);
    return { durationMs, startedAt };
  };

  const snapshot = () => ({ durationMs, progress, running, startedAt, timerId });

  return Object.freeze({ cancel, snapshot, start });
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
  createProgressLoader,
  debounceTimer,
  flashBanner,
  formatElapsedTime,
  getLocalDateKey,
  isPageActive,
  padTwoDigits,
  prefersReducedMotion,
  readJsonStorage,
  reducedMotionQuery,
  removeStorage,
  shuffle,
  writeJsonStorage,
});
})();
