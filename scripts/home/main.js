(() => {
const {
  homePerfLog,
  homePerfNow,
  runAfterHomeActivation,
} = window.homeActivation;
const {
  updateClock,
} = window.homeDesktop;
const {
  updateCalendarClock,
} = window.homeCalendar;
const {
  RANDOM_EVENT_RELOAD_KEY,
  bindRegisteredRandomEvents,
  clampVisibleRandomEventWindows,
  scheduleRandomEventIdleTrigger,
} = window.homeEventRuntime;
const {
  flushSudokuSave,
} = window.homeSudoku;
const {
  saveSnakeHighScores,
  saveSnakeSettings,
} = window.homeSnake;
const {
  fitImagesIntoFrames,
} = window.homeMedia;
const {
  pauseActiveWindowMedia,
  registerViewportObserver,
  restoreSuspendedActiveWindow,
} = window.homeWindows;

runAfterHomeActivation(() => {
  requestAnimationFrame(() => {
    if (window.rohinHomePerf.firstDesktopPaintAt !== null) return;
    window.rohinHomePerf.firstDesktopPaintAt = homePerfNow();
    homePerfLog("first desktop paint", window.rohinHomePerf);
  });
});

runAfterHomeActivation(() => {
  updateClock();
  setInterval(updateClock, 1000 * 30);
  updateCalendarClock();
  setInterval(updateCalendarClock, 500);
  scheduleRandomEventIdleTrigger();
});

const handleHomeBeforeUnload = () => {
  flushSudokuSave();
  saveSnakeHighScores();
  saveSnakeSettings();
  try {
    sessionStorage.setItem(RANDOM_EVENT_RELOAD_KEY, "true");
  } catch (error) {
    // Session storage can be disabled in some browsing modes.
  }
};

runAfterHomeActivation(() => {
  window.addEventListener("beforeunload", handleHomeBeforeUnload);
});

// Every feature has registered its own resize response by now, so putting
// stray event windows back inside the viewport runs last.
registerViewportObserver({
  onFrame: () => clampVisibleRandomEventWindows(),
});

bindRegisteredRandomEvents();

fitImagesIntoFrames(document);

const defaultDocumentTitle = document.title || "Rohin OS";

const awayDocumentTitle = "come back :(";

document.addEventListener("visibilitychange", () => {
  document.title = document.hidden ? awayDocumentTitle : defaultDocumentTitle;
  if (document.hidden) {
    pauseActiveWindowMedia();
  } else {
    restoreSuspendedActiveWindow();
  }
});
})();
