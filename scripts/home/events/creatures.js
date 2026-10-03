(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  positionRandomEventWindowInViewport,
  registerRandomEvent,
  registerRandomEventWindows,
  setRandomEventWindowPosition,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;

const stalkerWindow = byId("stalker-window");
const stalkerYes = byId("stalker-yes");
const stalkerNo = byId("stalker-no");
const stalkerResultWindow = byId("stalker-result-window");
const stalkerResultOk = byId("stalker-result-ok");
const nanaEncounterWindow = byId("nana-encounter-window");
const nanaEncounterYes = byId("nana-encounter-yes");
const nanaEncounterNo = byId("nana-encounter-no");
const nanaAcceptWindow = byId("nana-accept-window");
const nanaAcceptOk = byId("nana-accept-ok");
const servalEncounterWindow = byId("serval-encounter-window");
const servalEncounterIgnore = byId("serval-encounter-ignore");
const servalEncounterOfferPizza = byId("serval-encounter-offer-pizza");
const servalPizzaWindow = byId("serval-pizza-window");
const servalPizzaCool = byId("serval-pizza-cool");
const caracalEncounterWindow = byId("caracal-encounter-window");
const caracalEncounterPet = byId("caracal-encounter-pet");
const caracalEncounterIgnore = byId("caracal-encounter-ignore");
const caracalResultWindow = byId("caracal-result-window");
const caracalResultImage = byId("caracal-result-image");
const caracalResultMessage = byId("caracal-result-message");
const caracalResultOk = byId("caracal-result-ok");
const shoebillEncounterWindow = byId("shoebill-encounter-window");
const shoebillEncounterBow = byId("shoebill-encounter-bow");
const shoebillEncounterRunAway = byId("shoebill-encounter-run-away");
const shoebillBowWindow = byId("shoebill-bow-window");
const shoebillBowOk = byId("shoebill-bow-ok");

const CARACAL_RESULT_CONTENT = {
  pet: {
    image: "assets/random%20events/caracalpet.gif",
    message: "You pet the caracal. It is very fluffy!",
  },
  ignore: {
    image: "assets/random%20events/caracalbite.gif",
    message: "In a fit of rage, the caracal bites you. How horrible!",
  },
};

const isStalkerWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isStalkerVisible = () =>
  isStalkerWindowVisible(stalkerWindow) || isStalkerWindowVisible(stalkerResultWindow);

const copyStalkerWindowPosition = (source, target) => {
  if (!source || !target) return false;
  target.style.translate = source.style.translate || "0 0";
  target.style.left = source.style.left;
  target.style.top = source.style.top;
  return Boolean(source.style.left && source.style.top);
};

const showStalkerWindow = (win = stalkerWindow, anchorWindow = null) => {
  showManagedRandomEventWindow(win, {
    position: (target) => {
      if (copyStalkerWindowPosition(anchorWindow, target)) return;
      positionRandomEventWindowInViewport(target);
    },
  });
};

const closeStalkerWindow = (win = stalkerWindow) => {
  closeManagedRandomEventWindow(win);
};

const showStalkerResultWindow = (anchorWindow = null) => {
  showStalkerWindow(stalkerResultWindow, anchorWindow);
};

const isNanaEncounterWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isNanaEncounterVisible = () =>
  isNanaEncounterWindowVisible(nanaEncounterWindow) ||
  isNanaEncounterWindowVisible(nanaAcceptWindow);

const setNanaEncounterWindowPosition = (win, left, top) => {
  if (!win) return false;
  setRandomEventWindowPosition(win, left, top);
  return true;
};

const copyNanaEncounterPosition = (source, target) => {
  if (!source || !target) return false;
  const sourceLeft = Number.parseFloat(source.style.left);
  const sourceTop = Number.parseFloat(source.style.top);
  if (!Number.isFinite(sourceLeft) || !Number.isFinite(sourceTop)) return false;
  return setNanaEncounterWindowPosition(target, sourceLeft, sourceTop);
};

const showNanaEncounterWindow = () => {
  showManagedRandomEventWindow(nanaEncounterWindow);
};

const showNanaAcceptWindow = (anchorWindow = null) => {
  showManagedRandomEventWindow(nanaAcceptWindow, {
    position: (target) => {
      if (copyNanaEncounterPosition(anchorWindow, target)) return;
      positionRandomEventWindowInViewport(target);
    },
  });
};

const closeNanaEncounterWindow = (win) => {
  closeManagedRandomEventWindow(win);
};

const acceptNanaEncounter = () => {
  const anchor = nanaEncounterWindow;
  closeNanaEncounterWindow(nanaEncounterWindow);
  setTimeout(() => {
    showNanaAcceptWindow(anchor);
  }, 180);
};

const isServalEncounterWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isServalEncounterVisible = () =>
  isServalEncounterWindowVisible(servalEncounterWindow) ||
  isServalEncounterWindowVisible(servalPizzaWindow);

const copyServalEncounterPosition = (source, target) => {
  if (!source || !target) return false;
  const sourceLeft = Number.parseFloat(source.style.left);
  const sourceTop = Number.parseFloat(source.style.top);
  if (!Number.isFinite(sourceLeft) || !Number.isFinite(sourceTop)) return false;
  setRandomEventWindowPosition(target, sourceLeft, sourceTop);
  return true;
};

const showServalEncounterWindow = () => {
  showManagedRandomEventWindow(servalEncounterWindow, {
    clampAfterMediaLoad: true,
  });
};

const showServalPizzaWindow = (anchorWindow = null) => {
  showManagedRandomEventWindow(servalPizzaWindow, {
    position: (target) => {
      if (copyServalEncounterPosition(anchorWindow, target)) return;
      positionRandomEventWindowInViewport(target);
    },
    clampAfterMediaLoad: true,
  });
};

const closeServalEncounterWindow = (win) => {
  closeManagedRandomEventWindow(win);
};

const offerServalPizza = () => {
  const anchor = servalEncounterWindow;
  closeServalEncounterWindow(servalEncounterWindow);
  setTimeout(() => {
    showServalPizzaWindow(anchor);
  }, 180);
};

const isCaracalEncounterWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isCaracalEncounterVisible = () =>
  isCaracalEncounterWindowVisible(caracalEncounterWindow) ||
  isCaracalEncounterWindowVisible(caracalResultWindow);

const copyCaracalEncounterPosition = (source, target) => {
  if (!source || !target) return false;
  const sourceLeft = Number.parseFloat(source.style.left);
  const sourceTop = Number.parseFloat(source.style.top);
  if (!Number.isFinite(sourceLeft) || !Number.isFinite(sourceTop)) return false;
  setRandomEventWindowPosition(target, sourceLeft, sourceTop);
  return true;
};

const showCaracalEncounterWindow = () => {
  showManagedRandomEventWindow(caracalEncounterWindow, {
    clampAfterMediaLoad: true,
  });
};

const showCaracalResultWindow = (resultKey, anchorWindow = null) => {
  if (!caracalResultWindow) return;
  const result = CARACAL_RESULT_CONTENT[resultKey] || CARACAL_RESULT_CONTENT.pet;
  if (caracalResultMessage) caracalResultMessage.textContent = result.message;
  if (caracalResultImage) {
    caracalResultImage.removeAttribute("src");
    caracalResultImage.dataset.src = result.image;
  }
  showManagedRandomEventWindow(caracalResultWindow, {
    position: (target) => {
      if (copyCaracalEncounterPosition(anchorWindow, target)) return;
      positionRandomEventWindowInViewport(target);
    },
    clampAfterMediaLoad: true,
  });
};

const closeCaracalEncounterWindow = (win) => {
  closeManagedRandomEventWindow(win);
};

const chooseCaracalEncounterResult = (resultKey) => {
  const anchor = caracalEncounterWindow;
  closeCaracalEncounterWindow(caracalEncounterWindow);
  setTimeout(() => {
    showCaracalResultWindow(resultKey, anchor);
  }, 180);
};

const isShoebillEncounterWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isShoebillEncounterVisible = () =>
  isShoebillEncounterWindowVisible(shoebillEncounterWindow) ||
  isShoebillEncounterWindowVisible(shoebillBowWindow);

const copyShoebillEncounterPosition = (source, target) => {
  if (!source || !target) return false;
  const sourceLeft = Number.parseFloat(source.style.left);
  const sourceTop = Number.parseFloat(source.style.top);
  if (!Number.isFinite(sourceLeft) || !Number.isFinite(sourceTop)) return false;
  setRandomEventWindowPosition(target, sourceLeft, sourceTop);
  return true;
};

const showShoebillEncounterWindow = () => {
  showManagedRandomEventWindow(shoebillEncounterWindow, {
    clampAfterMediaLoad: true,
  });
};

const showShoebillBowWindow = (anchorWindow = null) => {
  showManagedRandomEventWindow(shoebillBowWindow, {
    position: (target) => {
      if (copyShoebillEncounterPosition(anchorWindow, target)) return;
      positionRandomEventWindowInViewport(target);
    },
    clampAfterMediaLoad: true,
  });
};

const closeShoebillEncounterWindow = (win) => {
  closeManagedRandomEventWindow(win);
};

const bowToShoebill = () => {
  const anchor = shoebillEncounterWindow;
  closeShoebillEncounterWindow(shoebillEncounterWindow);
  setTimeout(() => {
    showShoebillBowWindow(anchor);
  }, 180);
};

registerRandomEvent({
  id: "stalker-zone",
  preloadTargets: () => [stalkerWindow, stalkerResultWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isStalkerVisible,
  canTrigger: () => !isStalkerVisible(),
  run: () => {
    showStalkerWindow();
  },
  bind: () => {
    if (stalkerYes) {
      stalkerYes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeStalkerWindow(stalkerWindow);
        showStalkerResultWindow(stalkerWindow);
      });
    }

    if (stalkerNo) {
      stalkerNo.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeStalkerWindow(stalkerWindow);
      });
    }

    if (stalkerResultOk) {
      stalkerResultOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeStalkerWindow(stalkerResultWindow);
      });
    }

    [stalkerWindow, stalkerResultWindow].forEach((win) => bindManagedRandomEventWindowAnimation(win));
  },
});

registerRandomEvent({
  id: "nana-random-encounter",
  preloadTargets: () => [nanaEncounterWindow, nanaAcceptWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isNanaEncounterVisible,
  canTrigger: () => !isNanaEncounterVisible(),
  run: () => {
    showNanaEncounterWindow();
  },
  bind: () => {
    if (nanaEncounterYes) {
      nanaEncounterYes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        acceptNanaEncounter();
      });
    }

    if (nanaEncounterNo) {
      nanaEncounterNo.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeNanaEncounterWindow(nanaEncounterWindow);
      });
    }

    if (nanaAcceptOk) {
      nanaAcceptOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeNanaEncounterWindow(nanaAcceptWindow);
      });
    }

    [nanaEncounterWindow, nanaAcceptWindow].forEach((win) => bindManagedRandomEventWindowAnimation(win));
  },
});

registerRandomEvent({
  id: "serval-pizza-encounter",
  preloadTargets: () => [servalEncounterWindow, servalPizzaWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isServalEncounterVisible,
  canTrigger: () => !isServalEncounterVisible(),
  run: () => {
    showServalEncounterWindow();
  },
  bind: () => {
    if (servalEncounterIgnore) {
      servalEncounterIgnore.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeServalEncounterWindow(servalEncounterWindow);
      });
    }

    if (servalEncounterOfferPizza) {
      servalEncounterOfferPizza.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        offerServalPizza();
      });
    }

    if (servalPizzaCool) {
      servalPizzaCool.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeServalEncounterWindow(servalPizzaWindow);
      });
    }

    [servalEncounterWindow, servalPizzaWindow].forEach((win) => bindManagedRandomEventWindowAnimation(win));
  },
});

registerRandomEvent({
  id: "caracal-encounter",
  preloadTargets: () => [
    caracalEncounterWindow,
    caracalResultWindow,
    Object.values(CARACAL_RESULT_CONTENT).map((result) => result.image),
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isCaracalEncounterVisible,
  canTrigger: () => !isCaracalEncounterVisible(),
  run: () => {
    showCaracalEncounterWindow();
  },
  bind: () => {
    if (caracalEncounterPet) {
      caracalEncounterPet.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseCaracalEncounterResult("pet");
      });
    }

    if (caracalEncounterIgnore) {
      caracalEncounterIgnore.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseCaracalEncounterResult("ignore");
      });
    }

    if (caracalResultOk) {
      caracalResultOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeCaracalEncounterWindow(caracalResultWindow);
      });
    }

    [caracalEncounterWindow, caracalResultWindow].forEach((win) => bindManagedRandomEventWindowAnimation(win));
  },
});

registerRandomEvent({
  id: "shoebill",
  preloadTargets: () => [shoebillEncounterWindow, shoebillBowWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isShoebillEncounterVisible,
  canTrigger: () => !isShoebillEncounterVisible(),
  run: () => {
    showShoebillEncounterWindow();
  },
  bind: () => {
    if (shoebillEncounterBow) {
      shoebillEncounterBow.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        bowToShoebill();
      });
    }

    if (shoebillEncounterRunAway) {
      shoebillEncounterRunAway.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeShoebillEncounterWindow(shoebillEncounterWindow);
      });
    }

    if (shoebillBowOk) {
      shoebillBowOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeShoebillEncounterWindow(shoebillBowWindow);
      });
    }

    [shoebillEncounterWindow, shoebillBowWindow].forEach((win) => bindManagedRandomEventWindowAnimation(win));
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  stalkerWindow,
  stalkerResultWindow,
  nanaEncounterWindow,
  nanaAcceptWindow,
  servalEncounterWindow,
  servalPizzaWindow,
  caracalEncounterWindow,
  caracalResultWindow,
  shoebillEncounterWindow,
  shoebillBowWindow,
]);

window.homeEventCreatures = Object.freeze({
  CARACAL_RESULT_CONTENT,
  caracalEncounterWindow,
  caracalResultWindow,
  nanaAcceptWindow,
  nanaEncounterWindow,
  servalEncounterWindow,
  servalPizzaWindow,
  shoebillBowWindow,
  shoebillEncounterWindow,
  stalkerResultWindow,
  stalkerWindow,
});
})();