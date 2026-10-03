(() => {
const {
  isGameStatsManualRefreshInProgress,
  isGameStatsSyncBusy,
} = window.homeGameStats;
const {
  isSnakeWindowVisible,
  snakeState,
} = window.homeSnake;
const {
  isSudokuWindowVisible,
  sudokuApp,
} = window.homeSudoku;
const {
  isSootSpritesVisible,
  sootSpritesWindow,
} = window.homeEventSootSprites;
const {
  isMcAfeeWindowVisible,
  mcAfeeDownloadWindow,
  isMcAfeeDownloadInProgress,
} = window.homeEventPrompts;
const {
  runAfterHomeActivation,
} = window.homeActivation;

const initCursorSettingsApp = () => {
  const cursorRuntime = window.RohinCursorRuntime;
  if (!cursorRuntime) throw new Error("The shared cursor runtime did not load.");
  const cursorModeButtons = document.querySelectorAll("[data-cursor-mode]");
  const syncCursorModeButtons = (mode = cursorRuntime.getMode()) => {
    cursorModeButtons.forEach((button) => {
      const isActive = button.getAttribute("data-cursor-mode") === mode;
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  cursorRuntime.subscribe(syncCursorModeButtons);
  cursorRuntime.start();

  document.querySelectorAll('[data-app="cursor"]').forEach((button) => {
    button.addEventListener("click", () => {
      window.setTimeout(syncCursorModeButtons, 0);
    });
  });

  cursorModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      cursorRuntime.setMode(button.getAttribute("data-cursor-mode"), {
        persist: true,
      });
    });
  });
};

initCursorSettingsApp();

const hasCustomCursorLoadingIndicator = () =>
  Boolean(
    (isGameStatsManualRefreshInProgress() && isGameStatsSyncBusy()) ||
      (snakeState.loading && isSnakeWindowVisible()) ||
      (sudokuApp?.classList.contains("is-sudoku-loading") && isSudokuWindowVisible()) ||
      (sootSpritesWindow?.classList.contains("is-loading-sprites") &&
        isSootSpritesVisible()) ||
      (isMcAfeeDownloadInProgress() && isMcAfeeWindowVisible(mcAfeeDownloadWindow))
  );

const initCustomCursorLoadingWatcher = () => {
  if (!document.body) return;
  window.RohinCursorRuntime.observeLoading({
    isLoading: hasCustomCursorLoadingIndicator,
    observeBody: true,
  });
};

runAfterHomeActivation(initCustomCursorLoadingWatcher);
})();
