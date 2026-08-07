(() => {
  "use strict";

  const TEXT_SELECTION_CURSOR_CLASS = "is-custom-cursor-text-selection";

  const hasHighlightedDocumentText = () => {
    const selection = window.getSelection();
    return Boolean(
      selection &&
        selection.rangeCount > 0 &&
        !selection.isCollapsed &&
        selection.toString().length > 0
    );
  };

  const initCustomCursorTextSelectionWatcher = () => {
    if (!document.body) return;

    let syncFrameId = null;
    const syncTextSelectionCursor = () => {
      syncFrameId = null;
      const hasHighlightedText = hasHighlightedDocumentText();
      document.documentElement.classList.toggle(TEXT_SELECTION_CURSOR_CLASS, hasHighlightedText);
      document.body.classList.toggle(TEXT_SELECTION_CURSOR_CLASS, hasHighlightedText);
    };
    const scheduleTextSelectionCursorSync = () => {
      if (syncFrameId !== null) return;
      syncFrameId = window.requestAnimationFrame(syncTextSelectionCursor);
    };

    document.addEventListener("selectionchange", scheduleTextSelectionCursorSync);
    document.addEventListener("selectstart", scheduleTextSelectionCursorSync);
    document.addEventListener("pointerup", scheduleTextSelectionCursorSync);
    document.addEventListener("pointercancel", scheduleTextSelectionCursorSync);
    window.addEventListener("pageshow", scheduleTextSelectionCursorSync);
    syncTextSelectionCursor();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCustomCursorTextSelectionWatcher, {
      once: true,
    });
  } else {
    initCustomCursorTextSelectionWatcher();
  }
})();
