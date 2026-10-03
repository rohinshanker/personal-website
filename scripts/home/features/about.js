(() => {
const {
  byId,
} = window.homeDom;
const {
  padTwoDigits,
  reducedMotionQuery,
} = window.homeUtil;
const {
  registerViewportObserver,
} = window.homeWindows;

const aboutCurrentDate = byId("about-current-date");

const aboutDateOrdinalSuffix = (day) => {
  const lastTwoDigits = day % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
};

const aboutDateLabel = (date) => {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  return `${weekday} the ${day}${aboutDateOrdinalSuffix(day)}, ${month} ${date.getFullYear()}`;
};

const aboutDateValue = (date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => (index ? padTwoDigits(part) : String(part)))
    .join("-");

const updateAboutCurrentDate = (now = new Date()) => {
  if (!aboutCurrentDate) return;
  aboutCurrentDate.dateTime = aboutDateValue(now);
  aboutCurrentDate.textContent = aboutDateLabel(now);
};

const ABOUT_DEGREE_DWELL_MS = 1000;

const ABOUT_DEGREE_SCROLL_SPEED_PX_PER_SECOND = 30;

const ABOUT_DEGREE_MIN_TRAVEL_MS = 1200;

const aboutDegreeAnimations = new WeakMap();

const aboutDegreeTypes = [...document.querySelectorAll(".about-degree-type")];

const aboutDegreeFields = [...document.querySelectorAll("[data-about-degree-field]")];

const aboutDegreeReducedMotion = reducedMotionQuery;

let aboutDegreeRefreshFrame = 0;

const cancelAboutDegreeAnimation = (field) => {
  const animation = aboutDegreeAnimations.get(field);
  if (!animation) return;
  animation.cancel();
  aboutDegreeAnimations.delete(field);
};

const updateAboutDegreeTypeLabel = (type) => {
  const fullLabel = type.dataset.fullLabel || type.textContent;
  const shortLabel = type.dataset.shortLabel || fullLabel;
  type.textContent = fullLabel;
  if (type.clientWidth > 1 && type.scrollWidth > type.clientWidth + 1) {
    type.textContent = shortLabel;
  }
};

const updateAboutDegreeField = (field) => {
  const track = field.querySelector(".about-degree-field-track");
  cancelAboutDegreeAnimation(field);
  field.classList.remove("is-overflowing");
  field.tabIndex = -1;
  field.scrollLeft = 0;
  if (!track || field.clientWidth <= 1) return;

  const distance = Math.ceil(track.scrollWidth - field.clientWidth);
  if (distance <= 1) return;

  field.classList.add("is-overflowing");
  field.tabIndex = 0;
  if (
    aboutDegreeReducedMotion.matches ||
    document.activeElement === field ||
    typeof track.animate !== "function"
  ) {
    return;
  }

  const travelMs = Math.max(
    ABOUT_DEGREE_MIN_TRAVEL_MS,
    (distance / ABOUT_DEGREE_SCROLL_SPEED_PX_PER_SECOND) * 1000
  );
  const duration = 2 * (ABOUT_DEGREE_DWELL_MS + travelMs);
  const animation = track.animate(
    [
      { transform: "translateX(0px)", offset: 0 },
      {
        transform: "translateX(0px)",
        offset: ABOUT_DEGREE_DWELL_MS / duration,
      },
      {
        transform: `translateX(-${distance}px)`,
        offset: (ABOUT_DEGREE_DWELL_MS + travelMs) / duration,
      },
      {
        transform: `translateX(-${distance}px)`,
        offset: (2 * ABOUT_DEGREE_DWELL_MS + travelMs) / duration,
      },
      { transform: "translateX(0px)", offset: 1 },
    ],
    { duration, easing: "linear", iterations: Infinity }
  );
  aboutDegreeAnimations.set(field, animation);
};

const refreshAboutDegrees = () => {
  aboutDegreeRefreshFrame = 0;
  aboutDegreeTypes.forEach(updateAboutDegreeTypeLabel);
  aboutDegreeFields.forEach(updateAboutDegreeField);
};

const queueAboutDegreeRefresh = () => {
  if (aboutDegreeRefreshFrame) cancelAnimationFrame(aboutDegreeRefreshFrame);
  aboutDegreeRefreshFrame = requestAnimationFrame(refreshAboutDegrees);
};

aboutDegreeFields.forEach((field) => {
  field.addEventListener("focus", () => updateAboutDegreeField(field));
  field.addEventListener("blur", queueAboutDegreeRefresh);
  field.addEventListener("mouseenter", () => aboutDegreeAnimations.get(field)?.pause());
  field.addEventListener("mouseleave", () => aboutDegreeAnimations.get(field)?.play());
});

const aboutDegreeUsesResizeObserver = typeof ResizeObserver === "function";

if (aboutDegreeUsesResizeObserver) {
  const aboutDegreeResizeObserver = new ResizeObserver(queueAboutDegreeRefresh);
  [...aboutDegreeTypes, ...aboutDegreeFields].forEach((element) => {
    aboutDegreeResizeObserver.observe(element);
  });
}

aboutDegreeReducedMotion.addEventListener("change", queueAboutDegreeRefresh);

document.fonts?.ready.then(queueAboutDegreeRefresh);

queueAboutDegreeRefresh();


// The degree lists re-measure on resize where ResizeObserver is unavailable.
registerViewportObserver({
  onFrame: () => {
    if (!aboutDegreeUsesResizeObserver) queueAboutDegreeRefresh();
  },
});

window.homeAbout = Object.freeze({
  aboutDegreeUsesResizeObserver,
  queueAboutDegreeRefresh,
  updateAboutCurrentDate,
});
})();
