(() => {
// Desktop activity that something else may want to react to. A feature
// announces what the visitor did and does not care who is listening, so the
// random-event runtime can observe every feature while still loading after
// all of them. Without this channel each feature would have to read the
// runtime's contract, which no ordered script list can satisfy.
const observers = [];

/** Returns true when an observer acted on the activity. */
const notifyActivity = (triggerName, detail = {}) =>
  observers.reduce(
    (handled, observe) => Boolean(observe(triggerName, detail)) || handled,
    false
  );

const observeActivity = (observe) => {
  observers.push(observe);
};

window.homeActivity = Object.freeze({
  notifyActivity,
  observeActivity,
});
})();
