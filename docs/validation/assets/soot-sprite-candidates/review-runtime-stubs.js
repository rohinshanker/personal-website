/*
 * Minimal stand-ins for the Home globals that scripts/home/events/soot-sprites.js destructures
 * at load, so the review page can run the real trajectory code outside Home.
 */
(() => {
  const registrations = [];
  const windowAnimations = new Map();

  window.homeDom = Object.freeze({
    byId: (id) => document.getElementById(id),
    taskbar: document.querySelector(".taskbar"),
  });

  window.homeUtil = Object.freeze({
    clampNumber: (value, min, max) => Math.max(min, Math.min(value, max)),
  });

  window.homeEventRuntime = Object.freeze({
    RANDOM_EVENT_KIND_INTERACTIVE: "interactive",
    registerRandomEvent: (event) => {
      registrations.push(event);
    },
    registerRandomEventWindows: () => {},
    bindRandomEventButton: (button, handler) => {
      button?.addEventListener("click", handler);
    },
    bindManagedRandomEventWindowAnimation: (windowElement, options = {}) => {
      windowAnimations.set(windowElement, options);
    },
    isManagedRandomEventWindowVisible: (windowElement) =>
      Boolean(windowElement) && !windowElement.classList.contains("is-hidden"),
    setRandomEventWindowPosition: (windowElement, left, top) => {
      windowElement.style.transform = "none";
      windowElement.style.left = `${Math.round(left)}px`;
      windowElement.style.top = `${Math.round(top)}px`;
    },
    showManagedRandomEventWindow: (windowElement, { afterShow } = {}) => {
      windowElement.classList.remove("is-hidden");
      windowElement.setAttribute("aria-hidden", "false");
      windowElement.style.transform = "none";
      windowElement.style.left = `${Math.max(12, Math.round((window.innerWidth - windowElement.offsetWidth) / 2))}px`;
      windowElement.style.top = `${Math.max(16, Math.round((window.innerHeight - windowElement.offsetHeight) / 2) - 60)}px`;
      afterShow?.();
      windowElement.querySelector("button")?.focus();
    },
    closeManagedRandomEventWindow: (windowElement) => {
      windowElement.classList.add("is-hidden");
      windowElement.setAttribute("aria-hidden", "true");
      windowAnimations.get(windowElement)?.afterClose?.();
    },
  });

  window.sootSpriteReviewRuntime = Object.freeze({
    getRegistration: (id) => registrations.find((event) => event.id === id),
  });
})();
