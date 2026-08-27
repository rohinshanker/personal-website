(() => {
  "use strict";

  const TEXT_HOVER_CURSOR_CLASS = "is-custom-cursor-text-hover";
  const TEXT_SELECTING_CURSOR_CLASS = "is-custom-cursor-text-selecting";

  const EDITABLE_TARGET_SELECTOR = [
    "input",
    "textarea",
    "select",
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    ".study-file-name",
    ".red-tool-input",
  ].join(",");

  // These surfaces already have a more specific cursor meaning in cursors.css.
  const GUARDED_CURSOR_TARGET_SELECTOR = [
    "a[href]",
    "button",
    "summary",
    "label",
    '[role="button"]',
    ".desktop-icon",
    ".taskbar-icon",
    ".calendar-day[data-calendar-day]",
    '.calendar-day[data-calendar-weekday="thursday"]',
    ".selector-item",
    ".study-tree-row",
    ".study-file-item",
    ".ms-cell:not(.is-revealed)",
    ".sol-card",
    ".sol-stock",
    ".sol-waste",
    ".sol-foundation",
    ".sol-tableau",
    ".snake-direction-button",
    ".sudoku-cell",
    ".infinity-armory-gem",
    ".infinity-armory-slot",
    ".infinity-armory-map-slot",
    ".infinity-armory-map",
    ".john-pork-call-button",
    ".pokemon-starter-choice",
    ".pokemon-starter-pokeball-stage",
    ".pokemon-starter-dialogue",
    ".dst-resource-token",
    ".dst-craft-slot",
    '[aria-label*="Help" i]',
    '[aria-label*="Info" i]',
    '[aria-label*="Question" i]',
    '[title*="help" i]',
    '[title*="info" i]',
    '[title*="question" i]',
    ".snake-help-button",
    ".sol-help",
    ".calendar-day.is-event-day",
    ".window:not([data-no-drag]) > .title-bar",
    ".calendar-popout > .title-bar",
    ".panel-divider",
    ".portfolio-window.is-resize-hover",
    ".portfolio-window.is-manual-resizing",
    '[draggable="true"]',
    '[role="separator"]',
    "[data-custom-cursor-guard]",
  ].join(",");

  const UNAVAILABLE_TARGET_SELECTOR = [
    "[disabled]",
    '[aria-disabled="true"]',
    ".is-disabled",
    ".is-unavailable",
  ].join(",");

  const HIDDEN_TARGET_SELECTOR = '[hidden], [aria-hidden="true"], [inert]';

  const initCustomCursorTextSelection = () => {
    if (!document.body) return;

    let hoveredTextHost = null;
    let hitTestFrameId = null;
    let primaryMousePointerId = null;
    let primaryMouseTextHost = null;
    let isPrimaryMouseDown = false;
    let hasPointerPosition = false;
    let pointerClientX = 0;
    let pointerClientY = 0;

    const setHoveredTextHost = (nextHost) => {
      if (hoveredTextHost === nextHost) return;
      hoveredTextHost?.classList.remove(TEXT_HOVER_CURSOR_CLASS);
      hoveredTextHost = nextHost;
      hoveredTextHost?.classList.add(TEXT_HOVER_CURSOR_CLASS);
    };

    const setTextSelectionGestureActive = (isActive) => {
      document.documentElement.classList.toggle(TEXT_SELECTING_CURSOR_CLASS, isActive);
      document.body.classList.toggle(TEXT_SELECTING_CURSOR_CLASS, isActive);
    };

    const isGloballyGuardedCursorState = () =>
      document.body.classList.contains("is-custom-cursor-loading") ||
      document.body.classList.contains("is-holding-pointer-item") ||
      document.body.classList.contains("is-resizing-window");

    const isGuardedCursorTarget = (element) =>
      isGloballyGuardedCursorState() ||
      element.closest(EDITABLE_TARGET_SELECTOR) !== null ||
      element.closest(GUARDED_CURSOR_TARGET_SELECTOR) !== null ||
      element.closest(UNAVAILABLE_TARGET_SELECTOR) !== null;

    const isVisibleSelectableTextHost = (host) => {
      if (!host.isConnected || isGuardedCursorTarget(host)) return false;
      if (host.closest(HIDDEN_TARGET_SELECTOR)) return false;
      if (host.isContentEditable) return false;

      for (let element = host; element; element = element.parentElement) {
        const style = window.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse" ||
          style.contentVisibility === "hidden" ||
          style.opacity === "0" ||
          style.userSelect === "none" ||
          style.webkitUserSelect === "none"
        ) {
          return false;
        }
      }

      return true;
    };

    const getCaretTextPosition = (clientX, clientY) => {
      if (typeof document.caretPositionFromPoint === "function") {
        try {
          const caretPosition = document.caretPositionFromPoint(clientX, clientY);
          if (caretPosition?.offsetNode?.nodeType === Node.TEXT_NODE) {
            return {
              textNode: caretPosition.offsetNode,
              offset: caretPosition.offset,
            };
          }
        } catch {
          // Fall through to the WebKit caret-range API.
        }
      }

      if (typeof document.caretRangeFromPoint === "function") {
        try {
          const caretRange = document.caretRangeFromPoint(clientX, clientY);
          if (caretRange?.startContainer?.nodeType === Node.TEXT_NODE) {
            return {
              textNode: caretRange.startContainer,
              offset: caretRange.startOffset,
            };
          }
        } catch {
          // An unsupported point simply has no selectable text target.
        }
      }

      return null;
    };

    const isPointInsideNonWhitespaceGlyph = (textNode, offset, clientX, clientY) => {
      const text = textNode.data;
      const candidateStarts = [];
      if (offset < text.length) candidateStarts.push(offset);
      if (offset > 0) candidateStarts.push(offset - 1);

      return candidateStarts.some((start) => {
        if (!/\S/u.test(text.slice(start, start + 1))) return false;

        const glyphRange = document.createRange();
        glyphRange.setStart(textNode, start);
        glyphRange.setEnd(textNode, start + 1);
        return Array.from(glyphRange.getClientRects()).some(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        );
      });
    };

    const findSelectableTextHostAtPoint = (clientX, clientY) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      if (clientX < 0 || clientY < 0 || clientX > innerWidth || clientY > innerHeight) {
        return null;
      }

      const hitElement = document.elementFromPoint(clientX, clientY);
      if (!hitElement || isGuardedCursorTarget(hitElement)) return null;

      const caret = getCaretTextPosition(clientX, clientY);
      if (!caret || !hitElement.contains(caret.textNode)) return null;

      const host = caret.textNode.parentElement;
      if (!host || !isVisibleSelectableTextHost(host)) return null;
      if (
        !isPointInsideNonWhitespaceGlyph(
          caret.textNode,
          caret.offset,
          clientX,
          clientY
        )
      ) {
        return null;
      }

      return host;
    };

    const runPointerHitTest = () => {
      hitTestFrameId = null;
      setHoveredTextHost(
        hasPointerPosition
          ? findSelectableTextHostAtPoint(pointerClientX, pointerClientY)
          : null
      );
    };

    const schedulePointerHitTest = () => {
      if (hitTestFrameId !== null) return;
      hitTestFrameId = window.requestAnimationFrame(runPointerHitTest);
    };

    const rememberMousePointer = (event) => {
      pointerClientX = event.clientX;
      pointerClientY = event.clientY;
      hasPointerPosition = true;
    };

    const finishPrimaryMouseGesture = () => {
      primaryMousePointerId = null;
      primaryMouseTextHost = null;
      isPrimaryMouseDown = false;
      setTextSelectionGestureActive(false);
    };

    const clearPointerCursorState = () => {
      if (hitTestFrameId !== null) {
        window.cancelAnimationFrame(hitTestFrameId);
        hitTestFrameId = null;
      }
      hasPointerPosition = false;
      finishPrimaryMouseGesture();
      setHoveredTextHost(null);
    };

    const handlePointerMove = (event) => {
      if (event.pointerType !== "mouse") return;
      rememberMousePointer(event);
      schedulePointerHitTest();
    };

    const handlePointerDown = (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary) return;
      finishPrimaryMouseGesture();
      primaryMousePointerId = event.pointerId;
      isPrimaryMouseDown = true;
      rememberMousePointer(event);
      primaryMouseTextHost = findSelectableTextHostAtPoint(
        pointerClientX,
        pointerClientY
      );
      setHoveredTextHost(primaryMouseTextHost);
    };

    const handleSelectStart = () => {
      if (!isPrimaryMouseDown || !primaryMouseTextHost) return;
      setHoveredTextHost(primaryMouseTextHost);
      setTextSelectionGestureActive(true);
    };

    const handlePointerEnd = (event) => {
      if (event.pointerType !== "mouse" || event.pointerId !== primaryMousePointerId) return;
      rememberMousePointer(event);
      finishPrimaryMouseGesture();
      schedulePointerHitTest();
    };

    const handlePointerLeave = (event) => {
      if (event.pointerType !== "mouse" || event.relatedTarget !== null) return;
      hasPointerPosition = false;
      setHoveredTextHost(null);
    };

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("pointerup", handlePointerEnd, { passive: true });
    document.addEventListener("pointercancel", handlePointerEnd, { passive: true });
    document.addEventListener("lostpointercapture", handlePointerEnd, { passive: true });
    document.addEventListener("pointerout", handlePointerLeave, { passive: true });
    window.addEventListener("scroll", schedulePointerHitTest, { passive: true });
    window.addEventListener("resize", schedulePointerHitTest, { passive: true });
    window.addEventListener("blur", clearPointerCursorState);
    window.addEventListener("pageshow", clearPointerCursorState);

    clearPointerCursorState();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCustomCursorTextSelection, {
      once: true,
    });
  } else {
    initCustomCursorTextSelection();
  }
})();
