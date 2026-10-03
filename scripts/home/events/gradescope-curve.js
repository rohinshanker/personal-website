(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
} = window.homeUtil;

const gradescopeCurveWindow = byId("gradescope-curve-window");
const gradescopeCurvePrompt = byId("gradescope-curve-prompt");
const gradescopeCurveYes = byId("gradescope-curve-yes");
const gradescopeCurveNo = byId("gradescope-curve-no");
const gradescopeCurvePath = byId("gradescope-curve-path");
const gradescopeCurveAdjust = byId("gradescope-curve-adjust");
const gradescopeCurveSlider = byId("gradescope-curve-slider");
const gradescopeCurveSetRow = byId("gradescope-curve-set-row");
const gradescopeCurveSet = byId("gradescope-curve-set");

const GRADESCOPE_CURVE_SLIDER_DEFAULT = 72;

const GRADESCOPE_CURVE_GRAPH_LEFT = 20;

const GRADESCOPE_CURVE_GRAPH_RIGHT = 260;

const GRADESCOPE_CURVE_GRAPH_BASE_Y = 132;

const GRADESCOPE_CURVE_GRAPH_AMPLITUDE = 84;

const GRADESCOPE_CURVE_GRAPH_SIGMA = 34;

const GRADESCOPE_CURVE_GRAPH_STEPS = 36;

const isGradescopeCurveVisible = () =>
  isManagedRandomEventWindowVisible(gradescopeCurveWindow);

const createGradescopeCurvePath = (rawValue, rawMin = 0, rawMax = 100) => {
  const min = Number(rawMin) || 0;
  const max = Number(rawMax) || 100;
  const value = Number.isFinite(rawValue) ? rawValue : GRADESCOPE_CURVE_SLIDER_DEFAULT;
  const ratio = clampNumber((value - min) / Math.max(1, max - min), 0, 1);
  const center =
    GRADESCOPE_CURVE_GRAPH_LEFT +
    ratio * (GRADESCOPE_CURVE_GRAPH_RIGHT - GRADESCOPE_CURVE_GRAPH_LEFT);
  const points = [];
  for (let index = 0; index <= GRADESCOPE_CURVE_GRAPH_STEPS; index += 1) {
    const x =
      GRADESCOPE_CURVE_GRAPH_LEFT +
      ((GRADESCOPE_CURVE_GRAPH_RIGHT - GRADESCOPE_CURVE_GRAPH_LEFT) * index) /
        GRADESCOPE_CURVE_GRAPH_STEPS;
    const offset = x - center;
    const y =
      GRADESCOPE_CURVE_GRAPH_BASE_Y -
      GRADESCOPE_CURVE_GRAPH_AMPLITUDE *
        Math.exp(-(offset * offset) / (2 * GRADESCOPE_CURVE_GRAPH_SIGMA ** 2));
    points.push(`${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return points.join(" ");
};

const updateGradescopeCurvePath = () => {
  if (!gradescopeCurvePath || !gradescopeCurveSlider) return;
  gradescopeCurvePath.setAttribute(
    "d",
    createGradescopeCurvePath(
      Number(gradescopeCurveSlider.value),
      gradescopeCurveSlider.min,
      gradescopeCurveSlider.max
    )
  );
};

const setGradescopeCurveMode = (mode) => {
  const adjusting = mode === "adjusting";
  gradescopeCurveWindow?.classList.toggle("is-adjusting", adjusting);
  gradescopeCurvePrompt?.classList.toggle("is-hidden", adjusting);
  gradescopeCurveAdjust?.classList.toggle("is-hidden", !adjusting);
  gradescopeCurveSetRow?.classList.toggle("is-hidden", !adjusting);
  if (adjusting) {
    updateGradescopeCurvePath();
    requestAnimationFrame(() => {
      gradescopeCurveSlider?.focus({ preventScroll: true });
    });
  }
};

const resetGradescopeCurve = () => {
  if (gradescopeCurveSlider) {
    gradescopeCurveSlider.value = String(GRADESCOPE_CURVE_SLIDER_DEFAULT);
  }
  updateGradescopeCurvePath();
  setGradescopeCurveMode("prompt");
};

const showGradescopeCurve = () => {
  showManagedRandomEventWindow(gradescopeCurveWindow, {
    beforeShow: resetGradescopeCurve,
    clampAfterMediaLoad: true,
  });
};

const closeGradescopeCurve = () => {
  closeManagedRandomEventWindow(gradescopeCurveWindow);
};

registerRandomEvent({
  id: "gradescope-curve",
  preloadTargets: () => [gradescopeCurveWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isGradescopeCurveVisible,
  canTrigger: () => !isGradescopeCurveVisible(),
  run: () => {
    showGradescopeCurve();
  },
  bind: () => {
    bindRandomEventButton(gradescopeCurveYes, () => {
      setGradescopeCurveMode("adjusting");
    });
    bindRandomEventButton(gradescopeCurveNo, closeGradescopeCurve);

    if (gradescopeCurveSlider) {
      gradescopeCurveSlider.addEventListener("input", () => {
        updateGradescopeCurvePath();
      });
    }

    bindRandomEventButton(gradescopeCurveSet, closeGradescopeCurve);
    bindManagedRandomEventWindowAnimation(gradescopeCurveWindow, {
      afterClose: resetGradescopeCurve,
      unloadImages: false,
    });
  },
});

const configureGradescopeCurvePreview = (preview) => {
  if (!preview) return;
  preview.classList.remove("is-adjusting");
  preview.querySelector("#gradescope-curve-prompt")?.classList.remove("is-hidden");
  preview.querySelector("#gradescope-curve-adjust")?.classList.add("is-hidden");
  preview.querySelector("#gradescope-curve-set-row")?.classList.add("is-hidden");
  const slider = preview.querySelector("#gradescope-curve-slider");
  if (slider) slider.value = String(GRADESCOPE_CURVE_SLIDER_DEFAULT);
  preview.querySelector("#gradescope-curve-path")?.setAttribute(
    "d",
    createGradescopeCurvePath(
      GRADESCOPE_CURVE_SLIDER_DEFAULT,
      slider?.min,
      slider?.max
    )
  );
};

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  gradescopeCurveWindow,
]);

window.homeEventGradescopeCurve = Object.freeze({
  configureGradescopeCurvePreview,
  gradescopeCurveWindow,
});
})();
