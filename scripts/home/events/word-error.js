(() => {
const {
  clampNumber,
  shuffle,
} = window.homeUtil;
const {
  RANDOM_EVENT_KIND_NON_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  registerRandomEvent,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  nextWindowZIndex,
} = window.homeWindows;

let wordErrorWindows = [];

let wordErrorOpenTimers = [];

let wordErrorCloseTimers = [];

let wordErrorStackClosing = false;

const clearWordErrorTimers = () => {
  wordErrorOpenTimers.forEach((timer) => clearTimeout(timer));
  wordErrorCloseTimers.forEach((timer) => clearTimeout(timer));
  wordErrorOpenTimers = [];
  wordErrorCloseTimers = [];
};

const isWordErrorStackVisible = () => wordErrorWindows.length > 0;

const wordErrorStackLayout = () => {
  const count = 10;
  const padding = 12;
  const taskbarClearance = 64;
  const windowWidth = clampNumber(window.innerWidth - padding * 2, 260, 360);
  const windowHeight = 136;
  const availableWidth = Math.max(0, window.innerWidth - padding * 2 - windowWidth);
  const availableHeight = Math.max(
    0,
    window.innerHeight - taskbarClearance - padding - windowHeight
  );
  const maxStep = Math.min(
    28,
    availableWidth / (count - 1),
    availableHeight / (count - 1)
  );
  const step = maxStep >= 8 ? maxStep : Math.max(0, maxStep);
  const totalOffset = step * (count - 1);
  const startLeft = Math.round(padding + Math.max(0, (availableWidth - totalOffset) / 2));
  const startTop = Math.round(padding + Math.max(0, (availableHeight - totalOffset) / 2));

  return {
    count,
    step,
    startLeft,
    startTop,
    windowWidth,
  };
};

const removeWordErrorWindow = (win) => {
  if (!win) return;
  win.remove();
  wordErrorWindows = wordErrorWindows.filter((item) => item !== win);
  if (!wordErrorWindows.length) {
    wordErrorStackClosing = false;
    clearWordErrorTimers();
  }
};

const closeWordErrorWindow = (win) => {
  if (win?.classList.contains("is-closing")) return;
  closeManagedRandomEventWindow(win, { force: true });
};

const closeWordErrorStack = (selectedWindow) => {
  if (wordErrorStackClosing) return;
  wordErrorStackClosing = true;
  wordErrorOpenTimers.forEach((timer) => clearTimeout(timer));
  wordErrorOpenTimers = [];

  const visibleWindows = wordErrorWindows.filter(
    (win) => !win.classList.contains("is-hidden")
  );
  const hiddenWindows = wordErrorWindows.filter((win) =>
    win.classList.contains("is-hidden")
  );

  hiddenWindows.forEach(removeWordErrorWindow);

  const selectedIsVisible =
    selectedWindow && visibleWindows.includes(selectedWindow);
  if (selectedIsVisible) {
    closeWordErrorWindow(selectedWindow);
  }

  const remainingWindows = shuffle(
    visibleWindows.filter((win) => win !== selectedWindow)
  );

  remainingWindows.forEach((win, index) => {
    const timer = setTimeout(() => closeWordErrorWindow(win), (index + 1) * 100);
    wordErrorCloseTimers.push(timer);
  });

  if (!selectedIsVisible && !remainingWindows.length) {
    wordErrorStackClosing = false;
  }
};

const createWordErrorWindow = (index, layout) => {
  const win = document.createElement("div");
  win.className = "window random-event-window word-error-stack-window is-hidden";
  win.setAttribute("aria-hidden", "true");
  win.style.left = `${Math.round(layout.startLeft + index * layout.step)}px`;
  win.style.top = `${Math.round(layout.startTop + index * layout.step)}px`;
  win.style.width = `${layout.windowWidth}px`;

  const titleBar = document.createElement("div");
  titleBar.className = "title-bar";

  const title = document.createElement("div");
  title.className = "title-bar-text";
  title.textContent = "Microsoft Word";

  const controls = document.createElement("div");
  controls.className = "title-bar-controls";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");

  controls.appendChild(closeButton);
  titleBar.appendChild(title);
  titleBar.appendChild(controls);

  const body = document.createElement("div");
  body.className = "window-body";

  const message = document.createElement("div");
  message.className = "word-error-message";

  const icon = document.createElement("img");
  icon.src = "assets/app-icons/ico/application_hourglass_small.ico";
  icon.alt = "";

  const text = document.createElement("p");
  text.textContent =
    "Fatal Error: Your license could not be confirmed, please sign back into Microsft Office.";

  const actions = document.createElement("div");
  actions.className = "word-error-actions";

  const noThanks = document.createElement("button");
  noThanks.type = "button";
  noThanks.textContent = "No, thanks.";

  const thinkAboutIt = document.createElement("button");
  thinkAboutIt.type = "button";
  thinkAboutIt.textContent = "I'll think about it.";

  [closeButton, noThanks, thinkAboutIt].forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeWordErrorStack(win);
    });
  });

  bindManagedRandomEventWindowAnimation(win, {
    afterOpen: () => clampRandomEventWindowToViewport(win),
    onClose: () => removeWordErrorWindow(win),
  });

  message.appendChild(icon);
  message.appendChild(text);
  actions.appendChild(noThanks);
  actions.appendChild(thinkAboutIt);
  body.appendChild(message);
  body.appendChild(actions);
  win.appendChild(titleBar);
  win.appendChild(body);

  return win;
};

const showWordErrorStack = () => {
  if (isWordErrorStackVisible()) {
    wordErrorWindows.forEach((win) => {
      if (!win.classList.contains("is-hidden")) win.style.zIndex = String(nextWindowZIndex());
    });
    return;
  }

  clearWordErrorTimers();
  wordErrorStackClosing = false;
  const layout = wordErrorStackLayout();
  wordErrorWindows = Array.from({ length: layout.count }, (_, index) =>
    createWordErrorWindow(index, layout)
  );

  wordErrorWindows.forEach((win) => document.body.appendChild(win));
  wordErrorWindows.forEach((win, index) => {
    const timer = setTimeout(() => {
      if (wordErrorStackClosing || !wordErrorWindows.includes(win)) return;
      showManagedRandomEventWindow(win, {
        isVisible: () => false,
        // The stack cascades its own windows; viewport centring would undo it.
        position: () => {},
      });
    }, index * 100);
    wordErrorOpenTimers.push(timer);
  });
};

registerRandomEvent({
  id: "microsoft-word-license-stack",
  preloadTargets: () => [wordErrorWindows],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isWordErrorStackVisible,
  canTrigger: () => !isWordErrorStackVisible(),
  run: () => {
    showWordErrorStack();
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  ...wordErrorWindows,
]);

window.homeEventWordError = Object.freeze({
  createWordErrorWindow,
  wordErrorStackLayout,
  wordErrorWindows,
});
})();
