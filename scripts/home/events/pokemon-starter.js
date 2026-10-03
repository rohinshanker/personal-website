(() => {
const {
  all,
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
  clearPokemonStyleDialogueTyping,
  setPokemonStyleDialogueText,
  setPokemonStyleSegmentedDialogue,
} = window.homeEventDialogue;
const {
  clampNumber,
} = window.homeUtil;

const pokemonStarterWindow = byId("pokemon-starter-window");
const pokemonStarterClose = byId("pokemon-starter-close");
const pokemonStarterScene = byId("pokemon-starter-scene");
const pokemonStarterChoices = all("[data-pokemon-starter]");
const pokemonStarterInfoCard = byId("pokemon-starter-info-card");
const pokemonStarterInfoName = byId("pokemon-starter-info-name");
const pokemonStarterInfoTypes = byId("pokemon-starter-info-types");
const pokemonStarterInfoHp = byId("pokemon-starter-info-hp");
const pokemonStarterInfoHpValue = byId("pokemon-starter-info-hp-value");
const pokemonStarterInfoMeta = byId("pokemon-starter-info-meta");
const pokemonStarterConfirm = byId("pokemon-starter-confirm");
const pokemonStarterConfirmName = byId("pokemon-starter-confirm-name");
const pokemonStarterConfirmYes = byId("pokemon-starter-confirm-yes");
const pokemonStarterConfirmNo = byId("pokemon-starter-confirm-no");
const pokemonStarterPokeballStage = byId("pokemon-starter-pokeball-stage");
const pokemonStarterDialogue = byId("pokemon-starter-dialogue");
const pokemonStarterDialogueText = byId("pokemon-starter-dialogue-text");

const POKEMON_STARTERS = Object.freeze({
  bulbasaur: {
    name: "Bulbasaur",
    primaryType: "grass",
    types: ["Grass", "Poison"],
    hp: 45,
    pokedex: "#0001",
    height: "2'04\"",
    weight: "15.2 lbs",
  },
  charmander: {
    name: "Charmander",
    primaryType: "fire",
    types: ["Fire"],
    hp: 39,
    pokedex: "#0004",
    height: "2'00\"",
    weight: "18.7 lbs",
  },
  squirtle: {
    name: "Squirtle",
    primaryType: "water",
    types: ["Water"],
    hp: 44,
    pokedex: "#0007",
    height: "1'08\"",
    weight: "19.8 lbs",
  },
});


let pokemonStarterSelected = "";

let pokemonStarterStage = "select";

const isPokemonStarterVisible = () =>
  isManagedRandomEventWindowVisible(pokemonStarterWindow);

const setPokemonStarterElementHidden = (element, hidden) => {
  if (!element) return;
  element.classList.toggle("is-hidden", hidden);
  element.setAttribute("aria-hidden", String(hidden));
};

const clearPokemonStarterTyping = () => {
  clearPokemonStyleDialogueTyping(pokemonStarterDialogueText);
};

const setPokemonStarterDialogue = (text, { instant = false } = {}) => {
  setPokemonStyleDialogueText(pokemonStarterDialogueText, text, { instant });
};

const setPokemonStarterSegmentedDialogue = (segments, className = "") => {
  setPokemonStyleSegmentedDialogue(pokemonStarterDialogueText, segments, {
    className,
  });
};

const pokemonStarterNameSegment = (starter) => ({
  text: starter.name,
  className: `pokemon-dialogue-name pokemon-starter-type-color--${starter.primaryType}`,
});

const setPokemonStarterChosenDialogue = (starter) => {
  setPokemonStarterSegmentedDialogue(
    [
      { text: "You received " },
      pokemonStarterNameSegment(starter),
      { text: "! Take good care of " },
      pokemonStarterNameSegment(starter),
      { text: "." },
    ],
    "pokemon-starter-dialogue-final"
  );
};

const setPokemonStarterReadyDialogue = (starter) => {
  setPokemonStarterSegmentedDialogue([
    pokemonStarterNameSegment(starter),
    { text: " looks ready to go with you." },
  ]);
};

const setPokemonStarterStage = (stage) => {
  pokemonStarterStage = stage;
  if (!pokemonStarterWindow) return;
  pokemonStarterWindow.classList.toggle("is-confirming", stage === "confirm");
  pokemonStarterWindow.classList.toggle("is-chosen", stage === "chosen");
};

const positionPokemonStarterInfoCard = (choice) => {
  if (!pokemonStarterScene || !pokemonStarterInfoCard || !choice) return;
  const sceneRect = pokemonStarterScene.getBoundingClientRect();
  const choiceRect = choice.getBoundingClientRect();
  const cardWidth = pokemonStarterInfoCard.offsetWidth || 190;
  const minLeft = cardWidth / 2 + 12;
  const maxLeft = Math.max(minLeft, sceneRect.width - cardWidth / 2 - 12);
  const choiceCenter = choiceRect.left + choiceRect.width / 2 - sceneRect.left;
  const cardLeft = clampNumber(choiceCenter, minLeft, maxLeft);
  pokemonStarterInfoCard.style.left = `${Math.round(cardLeft)}px`;
};

const setPokemonStarterInfo = (starterKey, choice = null) => {
  const starter = POKEMON_STARTERS[starterKey];
  if (!starter || !pokemonStarterInfoCard) return;
  pokemonStarterInfoCard.dataset.pokemonType = starter.primaryType;
  if (pokemonStarterInfoName) pokemonStarterInfoName.textContent = starter.name;
  if (pokemonStarterInfoTypes) {
    pokemonStarterInfoTypes.replaceChildren(
      ...starter.types.map((type) => {
        const typeBadge = document.createElement("span");
        typeBadge.className = `pokemon-starter-type pokemon-starter-type--${type.toLowerCase()}`;
        typeBadge.textContent = type;
        return typeBadge;
      })
    );
  }
  if (pokemonStarterInfoHp) {
    pokemonStarterInfoHp.style.width = "100%";
  }
  if (pokemonStarterInfoHpValue) {
    pokemonStarterInfoHpValue.textContent = `${starter.hp}/${starter.hp}`;
  }
  if (pokemonStarterInfoMeta) {
    pokemonStarterInfoMeta.textContent = `${starter.pokedex} · HT ${starter.height} · WT ${starter.weight}`;
  }
  setPokemonStarterElementHidden(pokemonStarterInfoCard, false);
  positionPokemonStarterInfoCard(choice);
};

const clearPokemonStarterChoiceState = () => {
  pokemonStarterChoices.forEach((choice) => {
    choice.classList.remove("is-selected");
    choice.disabled = false;
    choice.removeAttribute("aria-disabled");
  });
};

const lockPokemonStarterChoiceState = (selectedChoice) => {
  pokemonStarterChoices.forEach((choice) => {
    const isSelected = choice === selectedChoice;
    choice.disabled = !isSelected;
    choice.setAttribute("aria-disabled", String(!isSelected));
  });
};

const resetPokemonStarterEvent = ({ typewrite = false } = {}) => {
  pokemonStarterSelected = "";
  setPokemonStarterStage("select");
  clearPokemonStarterChoiceState();
  if (pokemonStarterWindow) {
    pokemonStarterWindow.classList.remove("is-flashing");
  }
  setPokemonStarterElementHidden(pokemonStarterInfoCard, true);
  setPokemonStarterElementHidden(pokemonStarterConfirm, true);
  setPokemonStarterElementHidden(pokemonStarterPokeballStage, true);
  if (pokemonStarterConfirmName) {
    pokemonStarterConfirmName.className = "";
    pokemonStarterConfirmName.textContent = "Bulbasaur";
  }
  setPokemonStarterDialogue("Select a starter Pokémon!", { instant: !typewrite });
};

const showPokemonStarterWindow = () => {
  showManagedRandomEventWindow(pokemonStarterWindow, {
    beforeShow: resetPokemonStarterEvent,
    clampAfterMediaLoad: true,
    afterShow: () => setPokemonStarterDialogue("Select a starter Pokémon!"),
  });
};

const closePokemonStarterWindow = () => {
  closeManagedRandomEventWindow(pokemonStarterWindow, {
    beforeClose: clearPokemonStarterTyping,
  });
};

const choosePokemonStarter = (starterKey, choice) => {
  const starter = POKEMON_STARTERS[starterKey];
  if (!starter || pokemonStarterStage === "chosen") return;
  pokemonStarterSelected = starterKey;
  setPokemonStarterStage("confirm");
  clearPokemonStarterChoiceState();
  choice?.classList.add("is-selected");
  lockPokemonStarterChoiceState(choice);
  setPokemonStarterInfo(starterKey, choice);
  if (pokemonStarterConfirmName) {
    pokemonStarterConfirmName.className = `pokemon-starter-confirm-name pokemon-starter-type-color--${starter.primaryType}`;
    pokemonStarterConfirmName.textContent = starter.name;
  }
  setPokemonStarterElementHidden(pokemonStarterConfirm, false);
  setPokemonStarterReadyDialogue(starter);
};

const cancelPokemonStarterChoice = () => {
  pokemonStarterSelected = "";
  setPokemonStarterStage("select");
  clearPokemonStarterChoiceState();
  setPokemonStarterElementHidden(pokemonStarterConfirm, true);
  setPokemonStarterElementHidden(pokemonStarterInfoCard, true);
  setPokemonStarterDialogue("Select a starter Pokémon!");
};

const confirmPokemonStarterChoice = () => {
  const starter = POKEMON_STARTERS[pokemonStarterSelected];
  if (!starter || !pokemonStarterWindow) return;
  setPokemonStarterStage("chosen");
  pokemonStarterChoices.forEach((choice) => {
    choice.disabled = true;
    choice.classList.remove("is-selected");
  });
  setPokemonStarterElementHidden(pokemonStarterConfirm, true);
  setPokemonStarterElementHidden(pokemonStarterInfoCard, true);
  setPokemonStarterElementHidden(pokemonStarterPokeballStage, false);
  pokemonStarterWindow.classList.remove("is-flashing");
  void pokemonStarterWindow.offsetWidth;
  pokemonStarterWindow.classList.add("is-flashing");
  setPokemonStarterChosenDialogue(starter);
};

registerRandomEvent({
  id: "pokemon-starter-selection",
  preloadTargets: () => [pokemonStarterWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isPokemonStarterVisible,
  canTrigger: () => !isPokemonStarterVisible(),
  run: () => {
    showPokemonStarterWindow();
  },
  bind: () => {
    if (pokemonStarterClose) {
      pokemonStarterClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closePokemonStarterWindow();
      });
    }

    pokemonStarterChoices.forEach((choice) => {
      const starterKey = choice.dataset.pokemonStarter;
      choice.addEventListener("pointerenter", () => {
        if (pokemonStarterStage !== "select") return;
        setPokemonStarterInfo(starterKey, choice);
      });
      choice.addEventListener("focus", () => {
        if (pokemonStarterStage !== "select") return;
        setPokemonStarterInfo(starterKey, choice);
      });
      choice.addEventListener("pointerleave", () => {
        if (pokemonStarterSelected || pokemonStarterStage !== "select") return;
        setPokemonStarterElementHidden(pokemonStarterInfoCard, true);
      });
      choice.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pokemonStarterStage !== "select") return;
        choosePokemonStarter(starterKey, choice);
      });
    });

    if (pokemonStarterConfirmYes) {
      pokemonStarterConfirmYes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        confirmPokemonStarterChoice();
      });
    }

    if (pokemonStarterConfirmNo) {
      pokemonStarterConfirmNo.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelPokemonStarterChoice();
      });
    }

    if (pokemonStarterDialogue) {
      pokemonStarterDialogue.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pokemonStarterStage === "chosen") {
          closePokemonStarterWindow();
        }
      });
    }

    if (pokemonStarterPokeballStage) {
      pokemonStarterPokeballStage.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pokemonStarterStage === "chosen") {
          closePokemonStarterWindow();
        }
      });
    }

    bindManagedRandomEventWindowAnimation(pokemonStarterWindow, {
      afterClose: resetPokemonStarterEvent,
    });
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  pokemonStarterWindow,
]);

window.homeEventPokemonStarter = Object.freeze({
  pokemonStarterWindow,
});
})();
