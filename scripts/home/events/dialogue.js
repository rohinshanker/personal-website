(() => {
const pokemonStyleDialogueTimers = new WeakMap();


const POKEMON_DIALOGUE_TYPEWRITER_MS = 24;

const setPokemonStyleDialogueTextClass = (
  textElement,
  { className = "", arrow = false, complete = false } = {}
) => {
  if (!textElement) return;
  textElement.className = [
    "pokemon-dialogue-text",
    className,
    arrow ? "has-pokemon-dialogue-arrow" : "",
    complete ? "is-typewriter-complete" : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const clearPokemonStyleDialogueTyping = (textElement) => {
  if (!textElement) return;
  const timerId = pokemonStyleDialogueTimers.get(textElement);
  if (!timerId) return;
  clearInterval(timerId);
  pokemonStyleDialogueTimers.delete(textElement);
};

const setPokemonStyleDialogueText = (
  textElement,
  text,
  { instant = false, className = "", arrow = false } = {}
) => {
  if (!textElement) return;
  clearPokemonStyleDialogueTyping(textElement);
  setPokemonStyleDialogueTextClass(textElement, {
    className,
    arrow,
    complete: instant,
  });
  if (instant) {
    textElement.textContent = text;
    return;
  }
  textElement.textContent = "";
  let index = 0;
  const timerId = window.setInterval(() => {
    index += 1;
    textElement.textContent = text.slice(0, index);
    if (index >= text.length) {
      textElement.classList.add("is-typewriter-complete");
      clearPokemonStyleDialogueTyping(textElement);
    }
  }, POKEMON_DIALOGUE_TYPEWRITER_MS);
  pokemonStyleDialogueTimers.set(textElement, timerId);
};

const setPokemonStyleSegmentedDialogue = (
  textElement,
  segments,
  { className = "", arrow = false } = {}
) => {
  if (!textElement) return;
  clearPokemonStyleDialogueTyping(textElement);
  setPokemonStyleDialogueTextClass(textElement, { className, arrow });
  textElement.textContent = "";
  let segmentIndex = 0;
  let charIndex = 0;
  let activeNode = null;
  const appendNextSegment = () => {
    const segment = segments[segmentIndex];
    activeNode = segment.className ? document.createElement("span") : document.createTextNode("");
    if (segment.className) activeNode.className = segment.className;
    textElement.appendChild(activeNode);
  };
  appendNextSegment();
  const timerId = window.setInterval(() => {
    const segment = segments[segmentIndex];
    if (!segment) {
      clearPokemonStyleDialogueTyping(textElement);
      return;
    }
    charIndex += 1;
    activeNode.textContent = segment.text.slice(0, charIndex);
    if (charIndex < segment.text.length) return;
    segmentIndex += 1;
    charIndex = 0;
    if (segmentIndex >= segments.length) {
      textElement.classList.add("is-typewriter-complete");
      clearPokemonStyleDialogueTyping(textElement);
      return;
    }
    appendNextSegment();
  }, POKEMON_DIALOGUE_TYPEWRITER_MS);
  pokemonStyleDialogueTimers.set(textElement, timerId);
};

window.homeEventDialogue = Object.freeze({
  clearPokemonStyleDialogueTyping,
  setPokemonStyleDialogueText,
  setPokemonStyleSegmentedDialogue,
});
})();