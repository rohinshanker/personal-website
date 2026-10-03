(() => {

const POINTER_HELD_ITEM_CURSOR_CLASS = "is-holding-pointer-item";

const pointerHeldItemCursorSources = new Set();

const setPointerHeldItemCursor = (source, isHeld) => {
  if (!source) return;
  if (isHeld) {
    pointerHeldItemCursorSources.add(source);
  } else {
    pointerHeldItemCursorSources.delete(source);
  }
  document.body?.classList.toggle(
    POINTER_HELD_ITEM_CURSOR_CLASS,
    pointerHeldItemCursorSources.size > 0
  );
};

window.homePointerCursor = Object.freeze({
  setPointerHeldItemCursor,
});
})();
