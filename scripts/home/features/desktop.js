(() => {
const {
  all,
  clock,
} = window.homeDom;
const {
  updateAboutCurrentDate,
} = window.homeAbout;

const creditsIcons = all("[data-credits-icon]");

const updateClock = () => {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  updateAboutCurrentDate(now);
};

const creditsFrames = [
  "assets/app-icons/ico/search_laptop_1.ico",
  "assets/app-icons/ico/search_laptop_2.ico",
  "assets/app-icons/ico/search_laptop_3.ico",
  "assets/app-icons/ico/search_laptop_4.ico",
];

creditsIcons.forEach((icon) => {
  let frameIndex = 0;
  let intervalId = null;
  const startAnimation = () => {
    if (intervalId) return;
    intervalId = setInterval(() => {
      frameIndex = (frameIndex + 1) % creditsFrames.length;
      icon.setAttribute("src", creditsFrames[frameIndex]);
    }, 140);
  };
  const stopAnimation = () => {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    frameIndex = 0;
    icon.setAttribute("src", creditsFrames[0]);
  };

  icon.addEventListener("mouseenter", startAnimation);
  icon.addEventListener("mouseleave", stopAnimation);
  icon.addEventListener("focus", startAnimation);
  icon.addEventListener("blur", stopAnimation);
});

window.homeDesktop = Object.freeze({
  updateClock,
});
})();