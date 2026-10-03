(() => {
const doc = document;

// Shared lookup helpers. Feature scripts own their own elements and read them
// through these, so no eager table has to know about every feature.
const byId = (id) => doc.getElementById(id);
const one = (selector) => doc.querySelector(selector);
const all = (selector) => doc.querySelectorAll(selector);

// The desktop shell itself: the chrome every feature sits inside. Anything
// belonging to one feature is looked up in that feature's script instead.
window.homeDom = Object.freeze({
  byId,
  one,
  all,
  clock: byId("taskbar-clock"),
  startButton: one(".start-button"),
  appButtons: all("[data-app]"),
  taskbar: one(".taskbar"),
  appWindows: all("[data-app-window]"),
  closeButtons: all("[data-close]"),
  draggableWindows: all(".window"),
});
})();
