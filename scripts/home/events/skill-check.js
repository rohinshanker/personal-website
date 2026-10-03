(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
} = window.homeUtil;
const {
  nextWindowZIndex,
} = window.homeWindows;

const skillCheckWindow = byId("skill-check-window");
const skillCheckResultWindow = byId("skill-check-result-window");
const skillCheckRoll = byId("skill-check-roll");
const skillCheckIgnore = byId("skill-check-ignore");
const skillCheckDieTens = byId("skill-check-die-tens");
const skillCheckDieOnes = byId("skill-check-die-ones");
const skillCheckResultIcon = byId("skill-check-result-icon");
const skillCheckResultText = byId("skill-check-result-text");
const skillCheckResultOk = byId("skill-check-result-ok");

let skillCheckRollTimer = null;

let skillCheckRollTimeout = null;

let skillCheckRolling = false;

const SKILL_CHECK_ROLL_DURATION_MS = 1100;

const SKILL_CHECK_ROLL_INTERVAL_MS = 55;

const SKILL_CHECK_FAILURE_ICON = "assets/app-icons/ico/search_file_2.ico";

const SKILL_CHECK_SUCCESS_ICON = "assets/app-icons/ico/game_solitaire.ico";

const SKILL_CHECK_FAILURE_TEXT = "Check failed. You found nothing.";

const SKILL_CHECK_SUCCESS_TEXT =
  "Success. You notice a bag of gold behind the Solitaire app. +15 gold coins.";

const SKILL_CHECK_DIGIT_SOURCES = Object.freeze({
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
  " ": "assets/minesweeper_assets/digital_digits/digital_blank.png",
});

const isSkillCheckWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isSkillCheckVisible = () =>
  isSkillCheckWindowVisible(skillCheckWindow) ||
  isSkillCheckWindowVisible(skillCheckResultWindow);

const setSkillCheckDigit = (image, char) => {
  if (!image) return;
  const src = SKILL_CHECK_DIGIT_SOURCES[char] || SKILL_CHECK_DIGIT_SOURCES[" "];
  image.src = src;
};

const setSkillCheckRollDisplay = (value = null) => {
  const text =
    typeof value === "number" ? String(clampNumber(value, 1, 20)).padStart(2, " ") : "  ";
  setSkillCheckDigit(skillCheckDieTens, text[0]);
  setSkillCheckDigit(skillCheckDieOnes, text[1]);
};

const clearSkillCheckRollTimers = () => {
  if (skillCheckRollTimer) {
    clearInterval(skillCheckRollTimer);
    skillCheckRollTimer = null;
  }
  if (skillCheckRollTimeout) {
    clearTimeout(skillCheckRollTimeout);
    skillCheckRollTimeout = null;
  }
  skillCheckRolling = false;
};

const resetSkillCheckWindow = () => {
  clearSkillCheckRollTimers();
  if (skillCheckWindow) skillCheckWindow.classList.remove("is-locked");
  if (skillCheckRoll) skillCheckRoll.disabled = false;
  if (skillCheckIgnore) skillCheckIgnore.disabled = false;
  setSkillCheckRollDisplay();
};

const lockSkillCheckWindow = () => {
  if (skillCheckWindow) skillCheckWindow.classList.add("is-locked");
  if (skillCheckRoll) skillCheckRoll.disabled = true;
  if (skillCheckIgnore) skillCheckIgnore.disabled = true;
};

const showSkillCheckResultWindow = (roll) => {
  if (!skillCheckResultWindow) return;
  const success = roll >= 15;
  if (skillCheckResultIcon) {
    skillCheckResultIcon.src = success ? SKILL_CHECK_SUCCESS_ICON : SKILL_CHECK_FAILURE_ICON;
  }
  if (skillCheckResultText) {
    skillCheckResultText.textContent = success ? SKILL_CHECK_SUCCESS_TEXT : SKILL_CHECK_FAILURE_TEXT;
  }
  showManagedRandomEventWindow(skillCheckResultWindow, {
    isVisible: () => false,
    afterShow: () => {
      requestAnimationFrame(() => {
        if (skillCheckResultOk) skillCheckResultOk.focus();
      });
    },
  });
};

const beginSkillCheckRoll = () => {
  if (!skillCheckWindow || skillCheckRolling) return;
  skillCheckRolling = true;
  lockSkillCheckWindow();
  skillCheckRollTimer = setInterval(() => {
    setSkillCheckRollDisplay(Math.floor(Math.random() * 20) + 1);
  }, SKILL_CHECK_ROLL_INTERVAL_MS);
  skillCheckRollTimeout = setTimeout(() => {
    clearSkillCheckRollTimers();
    const roll = Math.floor(Math.random() * 20) + 1;
    setSkillCheckRollDisplay(roll);
    lockSkillCheckWindow();
    showSkillCheckResultWindow(roll);
  }, SKILL_CHECK_ROLL_DURATION_MS);
};

const showSkillCheckWindow = () => {
  if (!skillCheckWindow) return;
  if (isSkillCheckVisible()) {
    // The result window, when up, is the one the player should see on top.
    const front = isSkillCheckWindowVisible(skillCheckResultWindow)
      ? skillCheckResultWindow
      : skillCheckWindow;
    front.style.zIndex = String(nextWindowZIndex());
    return;
  }
  showManagedRandomEventWindow(skillCheckWindow, {
    beforeShow: resetSkillCheckWindow,
    afterShow: () => {
      requestAnimationFrame(() => {
        if (skillCheckRoll) skillCheckRoll.focus();
      });
    },
  });
};

const closeSkillCheckWindow = () => {
  clearSkillCheckRollTimers();
  closeManagedRandomEventWindow(skillCheckWindow);
  closeManagedRandomEventWindow(skillCheckResultWindow);
};

registerRandomEvent({
  id: "sudden-skill-check",
  preloadTargets: () => [skillCheckWindow, skillCheckResultWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSkillCheckVisible,
  canTrigger: () => !isSkillCheckVisible(),
  run: () => {
    showSkillCheckWindow();
  },
  bind: () => {
    if (skillCheckRoll) {
      skillCheckRoll.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        beginSkillCheckRoll();
      });
    }

    if (skillCheckIgnore) {
      skillCheckIgnore.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSkillCheckWindow();
      });
    }

    if (skillCheckResultOk) {
      skillCheckResultOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSkillCheckWindow();
      });
    }

    [skillCheckWindow, skillCheckResultWindow].forEach((win) => {
      bindManagedRandomEventWindowAnimation(win, {
        afterClose: () => {
          if (win === skillCheckWindow) resetSkillCheckWindow();
        },
        unloadImages: false,
      });
    });
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  skillCheckWindow,
  skillCheckResultWindow,
]);

window.homeEventSkillCheck = Object.freeze({
  SKILL_CHECK_DIGIT_SOURCES,
  skillCheckResultWindow,
  skillCheckWindow,
});
})();
