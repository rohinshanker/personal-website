(() => {
const {
  byId,
} = window.homeDom;
const {
  isVideoSource,
  preloadMediaSourcesAfter,
  preloadMediaSourcesInOrder,
  setLoading,
} = window.homeMedia;
const {
  isVisibleMediaElement,
  isWindowVisible,
  playActiveAutoplayVideos,
  playMediaElement,
  registerContentActivator,
  setWindowOpen,
} = window.homeWindows;
const {
  loadDeferredMedia,
  preloadDeferredMediaInOrder,
} = window.homeActivation;
const {
  notifyActivity,
} = window.homeActivity;

const openFrontiersPdf = byId("open-frontiers-pdf");
const openPulsePresentation = byId("open-pulse-presentation");
const openDronePresentation = byId("open-drone-presentation");
const openTcpPaper = byId("open-tcp-paper");
const openTcpPresentation = byId("open-tcp-presentation");
const openWritingTcpPaper = byId("open-writing-tcp-paper");
const openBioe190Presentation = byId("open-bioe190-presentation");
const openBioe190Proposal = byId("open-bioe190-proposal");
const pulsePresentationIframe = byId("pulse-presentation-iframe");
const dronePresentationIframe = byId("drone-presentation-iframe");
const pulseProjectImage = byId("pulse-project-image");
const pulseProjectCaption = byId("pulse-project-caption");
const pulseProjectDescription = byId("pulse-project-description");
const pulseProjectPrev = byId("pulse-project-prev");
const pulseProjectCounter = byId("pulse-project-counter");
const pulseProjectNext = byId("pulse-project-next");
const tcpResultsImage = byId("tcp-results-image");
const tcpResultsCaption = byId("tcp-results-caption");
const tcpResultsDescription = byId("tcp-results-description");
const tcpResultsPrev = byId("tcp-results-prev");
const tcpResultsCounter = byId("tcp-results-counter");
const tcpResultsNext = byId("tcp-results-next");
const ekgProjectImage = byId("ekg-project-image");
const ekgProjectVideo = byId("ekg-project-video");
const ekgProjectCaption = byId("ekg-project-caption");
const ekgProjectDescription = byId("ekg-project-description");
const ekgProjectPrev = byId("ekg-project-prev");
const ekgProjectCounter = byId("ekg-project-counter");
const ekgProjectNext = byId("ekg-project-next");
const droneProjectVideo = byId("drone-project-video");
const droneVideoCaption = byId("drone-video-caption");
const droneVideoPrev = byId("drone-video-prev");
const droneVideoCounter = byId("drone-video-counter");
const droneVideoNext = byId("drone-video-next");

/**
 * @typedef {Object} VideoGalleryItem
 * @property {string} src
 * @property {string} title
 */
const PULSE_PROJECT_BASE_URL = "https://rohinshanker.github.io/pulse-oximeter";

const PULSE_PRESENTATION_PDF_URL =
  `${PULSE_PROJECT_BASE_URL}/course%20resources/pulse%20ox%20slides.pdf#page=1&zoom=100&toolbar=0&navpanes=0`;

/**
 * @typedef {Object} ImageGalleryItem
 * @property {string} src
 * @property {string} alt
 * @property {string} [title]
 * @property {string} [description]
 */

/**
 * @typedef {Object} ProjectMediaItem
 * @property {"image" | "video"} type
 * @property {string} src
 * @property {string} title
 * @property {string} description
 * @property {string} [alt]
 */

/** @type {ReadonlyArray<ImageGalleryItem>} */
const pulseProjectFigures = Object.freeze([
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/demo-photo.jpg`,
    alt: "Working pulse oximeter demo with the yellow finger sleeve, OLED readout, laptop waveform, and commercial reference oximeter.",
    title: "Demo and validation",
    description:
      "Final bench demo with finger sleeve, live serial waveform, OLED readout, and commercial reference oximeter.",
  },
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/breadboard-1.jpg`,
    alt: "Early breadboard pulse oximeter circuit with Arduino and jumper wires.",
    title: "Prototype iteration 1",
    description:
      "Early analog chain and LED-control testing on a compact breadboard.",
  },
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/breadboard-2.jpg`,
    alt: "Expanded pulse oximeter prototype with multiple breadboards, OLED displays, and a yellow finger sleeve.",
    title: "Prototype iteration 2",
    description:
      "Expanded bench setup with display modules, separated wiring, and the printed finger sleeve.",
  },
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/breadboard-3.jpg`,
    alt: "Final breadboard prototype with Arduino MKR Zero, filtering circuit, and OLED display.",
    title: "Final circuit",
    description:
      "Cleaner final circuit with MKR Zero, analog filtering, OLED readout, and the optical finger interface.",
  },
]);

const TCP_PROJECT_BASE_URL = "https://rohinshanker.github.io/EE-122-simulation";

const GITHUB_REPOSITORY_URL =
  "https://github.com/rohinshanker/personal-website";

const tcpResultFigures = Object.freeze([
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/common_links/throughput_by_category_algorithm.png`,
    alt: "Throughput by algorithm across terrestrial, LEO, GEO 500 ms, and GEO 1000 ms profiles.",
    title: "Common links: throughput by category",
    description:
      "Compares receiver-side throughput across representative terrestrial, LEO, GEO 500 ms, and GEO 1000 ms profiles.",
  },
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/delay/throughput_vs_delay_ms.png`,
    alt: "Throughput versus configured delay for CUBIC, Reno, BBRv3, and Vegas.",
    title: "Delay suite: throughput versus delay",
    description:
      "Shows how throughput changes as configured delay increases; CUBIC and Reno stay steadier while BBRv3 tapers and Vegas drops at GEO-scale delay.",
  },
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/loss/retransmits_per_second_vs_loss_pct.png`,
    alt: "Retransmits per second versus configured packet loss for CUBIC, Reno, BBRv3, and Vegas.",
    title: "Loss suite: retransmits versus loss",
    description:
      "Shows BBRv3's aggressive probing tradeoff: higher throughput and utilization are paired with elevated retransmission rates as loss increases.",
  },
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/summary/utilization_by_condition_heatmap.png`,
    alt: "Heatmap showing utilization by condition and algorithm.",
    title: "Utilization by condition and algorithm",
    description:
      "Summarizes utilization across conditions; BBRv3 is largely yellow and green, indicating higher utilization across many tested profiles.",
  },
]);

const DRONE_PRESENTATION_PDF_URL =
  "https://rohinshanker.github.io/drone-navigation-project/assets/docs/EECS%20C106A%20Final%20Project%20-%20Group%2044%20-%20Google%20Slides.pdf#page=1&zoom=100&toolbar=0&navpanes=0";

/** @type {ReadonlyArray<ProjectMediaItem>} */
const ekgProjectMedia = Object.freeze([
  {
    type: "image",
    src: "assets/projects/ekg-project/final-breadboard.webp",
    alt: "Final EKG breadboard.",
    title: "Final breadboard",
    description: "Final breadboard.",
  },
  {
    type: "video",
    src: "assets/projects/ekg-project/signal-closeup.mp4",
    title: "Signal closeup",
    description: "Signal closeup.",
  },
  {
    type: "video",
    src: "assets/projects/ekg-project/video-demo.mp4",
    title: "Video demo",
    description: "Video demo.",
  },
]);

/** @type {ReadonlyArray<VideoGalleryItem>} */
const droneProjectVideos = Object.freeze([
  {
    src: "https://rohinshanker.github.io/drone-navigation-project/assets/videos/mujocosimulator.mp4",
    title: "MuJoCo simulation demo",
  },
  {
    src: "https://rohinshanker.github.io/drone-navigation-project/assets/videos/livedemo.mp4",
    title: "Live drone demo",
  },
]);

let pulseProjectIndex = 0;

let tcpResultsIndex = 0;

let ekgProjectIndex = 0;

let droneVideoIndex = 0;

const aboutCarouselImage = byId("about-carousel-image");
const aboutCarouselPrev = byId("about-carousel-prev");
const aboutCarouselCounter = byId("about-carousel-counter");
const aboutCarouselNext = byId("about-carousel-next");

const ABOUT_CAROUSEL_ITEMS = Object.freeze([
  Object.freeze({
    src: "assets/optimized/bio-pic-720.jpg",
    alt: "Portrait of Rohin Shanker in front of red rock formations",
  }),
  Object.freeze({
    src: "assets/about-carousel/2.jpg",
    alt: "Rohin Shanker seated for the Fast Sonder Lookbook Shoot 2",
  }),
  Object.freeze({
    src: "assets/about-carousel/3.jpg",
    alt: "Rohin Shanker making a pie with a friend",
  }),
  Object.freeze({
    src: "assets/about-carousel/4.jpg",
    alt: "Rohin Shanker walking in the Club Rambutan runway show",
  }),
  Object.freeze({
    src: "assets/about-carousel/5.jpg",
    alt: "Rohin Shanker celebrating graduation with friends at UC Berkeley",
  }),
  Object.freeze({
    src: "assets/about-carousel/6.jpg",
    alt: "Rohin Shanker backstage at the Garb Sub-urban runway show",
  }),
  Object.freeze({
    src: "assets/about-carousel/7.jpg",
    alt: "Rohin Shanker with a friend at a music festival",
  }),
  Object.freeze({
    src: "assets/about-carousel/8.jpg",
    alt: "Rohin Shanker resting beside climbing pads",
  }),
  Object.freeze({
    src: "assets/about-carousel/9.jpg",
    alt: "Rohin Shanker modeling in the Garb Means Business shoot",
  }),
]);

let aboutCarouselIndex = 0;

const updateAboutCarousel = () => {
  const activeImage = ABOUT_CAROUSEL_ITEMS[aboutCarouselIndex];
  setGalleryImageSource(aboutCarouselImage, activeImage);
  setGalleryCounterText(
    aboutCarouselCounter,
    aboutCarouselIndex,
    ABOUT_CAROUSEL_ITEMS.length
  );
  const navigationDisabled = ABOUT_CAROUSEL_ITEMS.length < 2;
  if (aboutCarouselPrev) aboutCarouselPrev.disabled = navigationDisabled;
  if (aboutCarouselNext) aboutCarouselNext.disabled = navigationDisabled;
  return queueGallerySuccessors(
    aboutCarouselImage,
    ABOUT_CAROUSEL_ITEMS,
    aboutCarouselIndex
  );
};


const pathfinderImages = [
  "assets/creative-work/pathfinder-logo.png",
  "assets/creative-work/pathfinder-cad.webp",
  "assets/creative-work/pathfinder-new-trash.webp",
  "assets/creative-work/pathfinder-person.webp",
];

const pathfinderImage = document.getElementById("pathfinder-image");

const pathfinderPrev = document.getElementById("pathfinder-prev");

const pathfinderCounter = document.getElementById("pathfinder-counter");

const pathfinderNext = document.getElementById("pathfinder-next");

let pathfinderIndex = 0;

const berserkPosterImages = [
  "assets/creative-work/berserk-poster-redesign/magazine-cover.webp",
  "assets/creative-work/berserk-poster-redesign/watercolor-poster.webp",
  "assets/creative-work/berserk-poster-redesign/bw.webp",
  "assets/creative-work/berserk-poster-redesign/bw-paintbrush.webp",
  "assets/creative-work/berserk-poster-redesign/black-cyberpunk.webp",
  "assets/creative-work/berserk-poster-redesign/yellow-cyberpunk-griffith.webp",
];

const berserkPosterImage = document.getElementById("berserk-poster-image");

const berserkPosterPrev = document.getElementById("berserk-poster-prev");

const berserkPosterCounter = document.getElementById("berserk-poster-counter");

const berserkPosterNext = document.getElementById("berserk-poster-next");

let berserkPosterIndex = 0;

const myBrothersGhostImages = [
  {
    src: "assets/creative-work/my-brothers-ghost-01.jpg",
    caption: "In production 2026",
    alt: "My Brother's Ghost in production 2026 poster",
  },
  {
    src: "assets/creative-work/my-brothers-ghost-02.jpg",
    caption: "Two brothers reconnect in a haunted apartment",
    alt: "My Brother's Ghost haunted apartment poster",
  },
  {
    src: "assets/creative-work/my-brothers-ghost-03.jpg",
    caption: "Rohin Shanker is Ghost",
    alt: "Rohin Shanker is Ghost poster",
  },
];

const myBrothersGhostImage = document.getElementById("my-brothers-ghost-image");

const myBrothersGhostPrev = document.getElementById("my-brothers-ghost-prev");

const myBrothersGhostCounter = document.getElementById("my-brothers-ghost-counter");

const myBrothersGhostNext = document.getElementById("my-brothers-ghost-next");

let myBrothersGhostIndex = 0;

const frontiersPdfSlides = [
  {
    page: 4,
    src: "assets/writing/mec-slides/mec-page-4.webp",
    alt: "Microbial Edge Computing slide 4",
  },
  {
    page: 5,
    src: "assets/writing/mec-slides/mec-page-5.png",
    alt: "Microbial Edge Computing slide 5",
  },
];

const frontiersSlideImage = document.getElementById("frontiers-slide-image");

const frontiersSlidePrev = document.getElementById("frontiers-slide-prev");

const frontiersSlideCounter = document.getElementById("frontiers-slide-counter");

const frontiersSlideNext = document.getElementById("frontiers-slide-next");

let frontiersSlideIndex = 0;

const galleryCounterText = (index, total) => `${index + 1} of ${total}`;

const galleryItemSource = (item) =>
  typeof item === "string" ? item : item?.src || "";

const galleryPreloadTokens = new WeakMap();

const modelingGalleryPreloadRefreshers = new WeakMap();

const appMediaPrewarmTokens = new WeakMap();

const orderedGallerySuccessorSources = (items, currentIndex) => {
  if (!Array.isArray(items) || items.length < 2) return [];
  return Array.from({ length: items.length - 1 }, (_, offset) => {
    const index = (currentIndex + offset + 1) % items.length;
    return galleryItemSource(items[index]);
  }).filter(Boolean);
};

const queueGallerySuccessors = (element, items, currentIndex) => {
  if (!element || !preloadMediaSourcesAfter) return Promise.resolve();
  const successors = orderedGallerySuccessorSources(items, currentIndex);
  if (!successors.length) return Promise.resolve();

  const token = Symbol("gallery-preload");
  galleryPreloadTokens.set(element, token);
  return preloadMediaSourcesAfter(element, successors, {
    shouldContinue: () =>
      galleryPreloadTokens.get(element) === token && isVisibleMediaElement(element),
  });
};

const setGalleryCounterText = (counter, index, itemCount) => {
  if (counter) counter.textContent = galleryCounterText(index, itemCount);
};

const setGalleryText = (element, text) => {
  if (element && typeof text === "string") element.textContent = text;
};

const galleryImageLoadTokens = new WeakMap();

const galleryImageLoadCleanups = new WeakMap();

const setGalleryImageLoading = (image, isLoading) => {
  setLoading(image?.closest(".gallery-scroll"), isLoading, {
    className: "gallery-loading-indicator",
    loadingClass: "is-image-loading",
  });
};

const loadGalleryImage = (image, src) => {
  if (!image || !src) return image;
  const scroll = image.closest(".gallery-scroll");
  if (!scroll) {
    image.setAttribute("src", src);
    return image;
  }

  galleryImageLoadCleanups.get(image)?.();
  const token = Symbol("gallery-image-load");
  galleryImageLoadTokens.set(image, token);
  setGalleryImageLoading(image, true);

  const finish = () => {
    if (galleryImageLoadTokens.get(image) !== token) return;
    image.removeEventListener("load", finish);
    image.removeEventListener("error", finish);
    galleryImageLoadCleanups.delete(image);
    setGalleryImageLoading(image, false);
  };
  const cleanup = () => {
    image.removeEventListener("load", finish);
    image.removeEventListener("error", finish);
  };

  galleryImageLoadCleanups.set(image, cleanup);
  image.addEventListener("load", finish, { once: true });
  image.addEventListener("error", finish, { once: true });
  image.setAttribute("src", src);
  if (image.complete) queueMicrotask(finish);
  return image;
};

const setGalleryImageSource = (image, item, { trackDeferredSource = false } = {}) => {
  if (!image || !item) return;
  const src = galleryItemSource(item);
  if (!src) return;
  if (trackDeferredSource) image.dataset.src = src;
  loadGalleryImage(image, src);
  if (typeof item !== "string" && item.alt) image.setAttribute("alt", item.alt);
};

const setProjectFigureContent = ({ image, caption, description, counter }, item, index, itemCount) => {
  if (!item) return;
  setGalleryImageSource(image, item, { trackDeferredSource: true });
  setGalleryText(caption, item.title);
  setGalleryText(description, item.description);
  setGalleryCounterText(counter, index, itemCount);
};

const clearProjectVideo = (video) => {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  delete video.dataset.src;
  video.load();
};

const setProjectVideoSource = (video, item) => {
  if (!video || !item?.src) return;
  video.dataset.src = item.src;
  if (video.getAttribute("src") !== item.src) {
    video.pause();
    video.setAttribute("src", item.src);
    video.load();
  }
  if (item.title) video.setAttribute("aria-label", item.title);
};

const recordCarouselNavigationRandomEvent = (event, direction, index, itemCount) => {
  if (!event?.isTrusted) return false;
  return notifyActivity("carouselNavigation", {
    direction,
    index,
    itemCount,
    source: "gallery-controls",
  });
};

const bindGalleryNavigation = (previous, next, itemCount, getIndex, setIndex, update) => {
  if (!previous || !next || !itemCount) return;

  const move = (event, offset) => {
    const nextIndex = (getIndex() + offset + itemCount) % itemCount;
    setIndex(nextIndex);
    update();
    recordCarouselNavigationRandomEvent(
      event,
      offset < 0 ? "previous" : "next",
      nextIndex,
      itemCount
    );
  };

  previous.addEventListener("click", (event) => move(event, -1));
  next.addEventListener("click", (event) => move(event, 1));
};

const setupGalleryControlLabels = (root = document) => {
  root.querySelectorAll(".gallery-controls button").forEach((button) => {
    const label = button.textContent.trim();
    const isPrevious = /^prev/i.test(label);
    button.dataset.fullLabel = label;
    button.dataset.shortLabel = isPrevious ? "Prev" : "Next";
    button.dataset.iconLabel = isPrevious ? "‹" : "›";
    if (!button.hasAttribute("aria-label")) {
      button.setAttribute("aria-label", isPrevious ? "Previous item" : "Next item");
    }
  });
};

// Shoot data lives in scripts/home/modeling-portfolio.js, shared with the /modeling/ route.
const modelingPortfolio = window.rohinModelingPortfolio || { linkIcons: {}, shoots: [] };

const modelingLinkIconPaths = modelingPortfolio.linkIcons;

const modelingLinkData = Object.fromEntries(
  modelingPortfolio.shoots.map((shoot) => [shoot.id, shoot.links])
);

const modelingGalleryData = Object.fromEntries(
  modelingPortfolio.shoots.map((shoot) => [
    shoot.id,
    {
      folder: shoot.folder,
      media: shoot.files.map((filename) => `${shoot.folder}/${filename}`),
      autoplay: Boolean(shoot.autoplay),
    },
  ])
);

const renderModelingLinks = (container) => {
  if (container.dataset.rendered === "true") return;
  const linkId = container.getAttribute("data-modeling-links");
  const links = modelingLinkData[linkId] || [];

  if (!links.length) {
    container.replaceChildren();
    container.dataset.rendered = "true";
    return;
  }

  const row = document.createElement("div");
  row.className = "lp-link-row";
  row.setAttribute("aria-label", "Modeling project links");

  links.forEach(({ type, label, href, title }) => {
    const anchor = document.createElement("a");
    anchor.className = "lp-link";
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.setAttribute("aria-label", label);
    anchor.title =
      title || (type === "instagram" ? "Instagram" : "Website");

    const icon = document.createElement("img");
    icon.src = modelingLinkIconPaths[type] || modelingLinkIconPaths.website;
    icon.alt = "";

    anchor.appendChild(icon);
    row.appendChild(anchor);
  });

  container.replaceChildren(row);
  container.dataset.rendered = "true";
};

const renderModelingGallery = (container) => {
  if (container.dataset.rendered === "true") return;
  const galleryId = container.getAttribute("data-modeling-gallery");
  const gallery = modelingGalleryData[galleryId];
  if (!gallery) return;
  const media = gallery.media;

  const frame = document.createElement("div");
  frame.className = "gallery-frame";

  if (!media.length) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.textContent = `No images found in ${gallery.folder} yet.`;
    frame.appendChild(empty);
    container.replaceChildren(frame);
    container.dataset.rendered = "true";
    return;
  }

  let currentIndex = 0;
  const scroll = document.createElement("div");
  scroll.className = "gallery-scroll gallery-scroll--modeling";

  const controls = document.createElement("div");
  controls.className = "gallery-controls";

  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "Previous";
  previous.dataset.adminTarget = `modeling:${galleryId}:previous`;

  const counter = document.createElement("span");
  counter.className = "gallery-counter";
  counter.setAttribute("aria-live", "polite");

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  next.dataset.adminTarget = `modeling:${galleryId}:next`;

  controls.appendChild(previous);
  controls.appendChild(counter);
  controls.appendChild(next);
  frame.appendChild(scroll);
  frame.appendChild(controls);
  container.replaceChildren(frame);

  const update = () => {
    const previousVideo = scroll.querySelector("video");
    if (previousVideo) {
      previousVideo.pause();
      previousVideo.removeAttribute("src");
      previousVideo.load();
    }

    const source = media[currentIndex];
    const isVideo = isVideoSource(source);
    const currentMedia = document.createElement(isVideo ? "video" : "img");

    if (isVideo) {
      currentMedia.controls = true;
      currentMedia.playsInline = true;
      currentMedia.preload = "metadata";
      currentMedia.dataset.unloadOnHide = "";
      if (gallery.autoplay) {
        currentMedia.autoplay = true;
        currentMedia.dataset.autoplayOnActive = "";
      }
      currentMedia.setAttribute(
        "aria-label",
        `Modeling video ${galleryCounterText(currentIndex, media.length)}`
      );
    } else {
      currentMedia.loading = "lazy";
      currentMedia.decoding = "async";
      currentMedia.alt = `Modeling photo ${galleryCounterText(currentIndex, media.length)}`;
    }

    scroll.replaceChildren(currentMedia);
    if (isVideo) {
      currentMedia.src = source;
    } else {
      loadGalleryImage(currentMedia, source);
    }
    counter.textContent = galleryCounterText(currentIndex, media.length);
    if (gallery.autoplay && isVideo) playMediaElement(currentMedia);
    return queueGallerySuccessors(currentMedia, media, currentIndex);
  };

  bindGalleryNavigation(
    previous,
    next,
    media.length,
    () => currentIndex,
    (index) => {
      currentIndex = index;
    },
    update
  );

  const initialPreloadTask = update();
  modelingGalleryPreloadRefreshers.set(container, () => {
    const currentMedia = scroll.querySelector("img, video");
    return queueGallerySuccessors(currentMedia, media, currentIndex);
  });
  container.dataset.rendered = "true";
  setupGalleryControlLabels(container);
  return initialPreloadTask;
};

setupGalleryControlLabels();

const updatePathfinderImage = () => {
  setGalleryImageSource(pathfinderImage, pathfinderImages[pathfinderIndex]);
  setGalleryCounterText(pathfinderCounter, pathfinderIndex, pathfinderImages.length);
  return queueGallerySuccessors(pathfinderImage, pathfinderImages, pathfinderIndex);
};

const updateBerserkPosterImage = () => {
  if (berserkPosterImage) {
    setGalleryImageSource(berserkPosterImage, {
      src: berserkPosterImages[berserkPosterIndex],
      alt: `Berserk poster redesign ${berserkPosterIndex + 1}`,
    });
  }
  setGalleryCounterText(berserkPosterCounter, berserkPosterIndex, berserkPosterImages.length);
  return queueGallerySuccessors(
    berserkPosterImage,
    berserkPosterImages,
    berserkPosterIndex
  );
};

const updateMyBrothersGhostImage = () => {
  const activeImage = myBrothersGhostImages[myBrothersGhostIndex];
  setGalleryImageSource(myBrothersGhostImage, activeImage);
  setGalleryCounterText(
    myBrothersGhostCounter,
    myBrothersGhostIndex,
    myBrothersGhostImages.length
  );
  return queueGallerySuccessors(
    myBrothersGhostImage,
    myBrothersGhostImages,
    myBrothersGhostIndex
  );
};

const updateFrontiersSlide = () => {
  const activeSlide = frontiersPdfSlides[frontiersSlideIndex];
  setGalleryImageSource(frontiersSlideImage, activeSlide);
  setGalleryCounterText(frontiersSlideCounter, frontiersSlideIndex, frontiersPdfSlides.length);
  return queueGallerySuccessors(
    frontiersSlideImage,
    frontiersPdfSlides,
    frontiersSlideIndex
  );
};

const updatePulseProjectFigure = () => {
  const activeFigure = pulseProjectFigures[pulseProjectIndex];
  setProjectFigureContent(
    {
      image: pulseProjectImage,
      caption: pulseProjectCaption,
      description: pulseProjectDescription,
      counter: pulseProjectCounter,
    },
    activeFigure,
    pulseProjectIndex,
    pulseProjectFigures.length
  );
  return queueGallerySuccessors(
    pulseProjectImage,
    pulseProjectFigures,
    pulseProjectIndex
  );
};

const updateTcpResultFigure = () => {
  const activeFigure = tcpResultFigures[tcpResultsIndex];
  setProjectFigureContent(
    {
      image: tcpResultsImage,
      caption: tcpResultsCaption,
      description: tcpResultsDescription,
      counter: tcpResultsCounter,
    },
    activeFigure,
    tcpResultsIndex,
    tcpResultFigures.length
  );
  return queueGallerySuccessors(tcpResultsImage, tcpResultFigures, tcpResultsIndex);
};

const updateEkgProjectMedia = () => {
  if (!ekgProjectMedia.length) return;
  const activeMedia = ekgProjectMedia[ekgProjectIndex];
  if (!activeMedia) return;

  const isVideo = activeMedia.type === "video";

  if (ekgProjectImage) {
    ekgProjectImage.hidden = isVideo;
    if (isVideo) {
      ekgProjectImage.removeAttribute("src");
      delete ekgProjectImage.dataset.src;
    } else {
      setGalleryImageSource(ekgProjectImage, activeMedia, { trackDeferredSource: true });
    }
  }

  if (ekgProjectVideo) {
    ekgProjectVideo.hidden = !isVideo;
    if (isVideo) {
      setProjectVideoSource(ekgProjectVideo, activeMedia);
    } else {
      clearProjectVideo(ekgProjectVideo);
    }
  }

  setGalleryText(ekgProjectCaption, activeMedia.title);
  setGalleryText(ekgProjectDescription, activeMedia.description);
  setGalleryCounterText(ekgProjectCounter, ekgProjectIndex, ekgProjectMedia.length);
  return queueGallerySuccessors(
    isVideo ? ekgProjectVideo : ekgProjectImage,
    ekgProjectMedia,
    ekgProjectIndex
  );
};

const syncDroneProjectVideo = () => {
  if (!droneProjectVideo || !droneProjectVideos.length) return;
  const activeVideo = droneProjectVideos[droneVideoIndex];
  if (!activeVideo) return;

  setProjectVideoSource(droneProjectVideo, activeVideo);
  setGalleryText(droneVideoCaption, activeVideo.title);
  setGalleryCounterText(droneVideoCounter, droneVideoIndex, droneProjectVideos.length);
  return queueGallerySuccessors(droneProjectVideo, droneProjectVideos, droneVideoIndex);
};

const staticCarouselPreloadDefinitions = Object.freeze([
  {
    element: aboutCarouselImage,
    index: () => aboutCarouselIndex,
    items: ABOUT_CAROUSEL_ITEMS,
  },
  {
    element: pathfinderImage,
    index: () => pathfinderIndex,
    items: pathfinderImages,
  },
  {
    element: berserkPosterImage,
    index: () => berserkPosterIndex,
    items: berserkPosterImages,
  },
  {
    element: myBrothersGhostImage,
    index: () => myBrothersGhostIndex,
    items: myBrothersGhostImages,
  },
  {
    element: frontiersSlideImage,
    index: () => frontiersSlideIndex,
    items: frontiersPdfSlides,
  },
  {
    element: pulseProjectImage,
    index: () => pulseProjectIndex,
    items: pulseProjectFigures,
  },
  {
    element: tcpResultsImage,
    index: () => tcpResultsIndex,
    items: tcpResultFigures,
  },
]);

const isVisibleCarouselElement = (element) =>
  Boolean(element && !element.closest(".viewer-content.is-hidden") && isVisibleMediaElement(element));

const activeStaticCarouselPreloads = (root) =>
  staticCarouselPreloadDefinitions
    .filter(({ element }) => root.contains(element) && isVisibleCarouselElement(element))
    .map(({ element, index, items }) => queueGallerySuccessors(element, items, index()));

const orderedHiddenViewerPanels = (root) => {
  const selectorButtons = [...root.querySelectorAll(".selector-item[data-view]")];
  const activeIndex = selectorButtons.findIndex((button) => button.classList.contains("is-active"));
  if (activeIndex === -1) return [];

  return Array.from({ length: selectorButtons.length - 1 }, (_, offset) => {
    const button = selectorButtons[(activeIndex + offset + 1) % selectorButtons.length];
    const viewId = button.getAttribute("data-view");
    return [...root.querySelectorAll(".viewer-content")].find(
      (panel) => panel.getAttribute("data-view") === viewId
    );
  }).filter((panel) => panel?.classList.contains("is-hidden"));
};

const inactiveModelingGallerySources = (root) =>
  orderedHiddenViewerPanels(root)
    .map((panel) => panel.querySelector("[data-modeling-gallery]"))
    .filter(Boolean)
    .map((container) => modelingGalleryData[container.getAttribute("data-modeling-gallery")])
    .map((gallery) => gallery?.media || [])
    .map((media) => galleryItemSource(media[0]))
    .filter(Boolean);

const prewarmHiddenAppPanels = (root, shouldContinue) => {
  const panels = orderedHiddenViewerPanels(root);
  if (!panels.length) {
    return preloadDeferredMediaInOrder(root, { hiddenOnly: true, shouldContinue });
  }
  return panels.reduce(
    (queue, panel) =>
      queue.then(() =>
        preloadDeferredMediaInOrder(panel, { hiddenOnly: true, shouldContinue })
      ),
    Promise.resolve()
  );
};

const prewarmOpenedAppMedia = (root, carouselTasks) => {
  const win = root.matches(".window") ? root : root.closest(".window");
  const token = Symbol("app-media-prewarm");
  appMediaPrewarmTokens.set(root, token);
  const shouldContinue = () =>
    appMediaPrewarmTokens.get(root) === token && (!win || isWindowVisible(win));
  const activeMedia = preloadDeferredMediaInOrder(root, { activeOnly: true });

  activeMedia
    .then(() => Promise.all(carouselTasks))
    .then(() => {
      if (!shouldContinue()) return "skipped";
      return preloadMediaSourcesInOrder(inactiveModelingGallerySources(root), { shouldContinue });
    })
    .then(() => {
      if (!shouldContinue()) return "skipped";
      return prewarmHiddenAppPanels(root, shouldContinue);
    });
};


// Activating a newly visible window renders the carousels inside it and
// starts their media. The window manager owns the call; this owns the work.
registerContentActivator((root) => {
  const carouselTasks = [];

  root.querySelectorAll("[data-modeling-links]").forEach((container) => {
    if (!container.closest(".viewer-content.is-hidden")) {
      renderModelingLinks(container);
    }
  });

  root.querySelectorAll("[data-modeling-gallery]").forEach((container) => {
    if (!container.closest(".viewer-content.is-hidden")) {
      const preloadTask = renderModelingGallery(container);
      const refreshPreload = modelingGalleryPreloadRefreshers.get(container);
      if (preloadTask || refreshPreload) {
        carouselTasks.push(preloadTask || refreshPreload());
      }
    }
  });

  const dronePanel = root.querySelector(
    '[data-view="projects-drone-navigation"]:not(.is-hidden)'
  );
  if (dronePanel && droneProjectVideo && dronePanel.contains(droneProjectVideo)) {
    carouselTasks.push(syncDroneProjectVideo());
  }

  const ekgPanel = root.querySelector('[data-view="projects-ekg"]:not(.is-hidden)');
  if (ekgPanel) {
    carouselTasks.push(updateEkgProjectMedia());
  }

  loadDeferredMedia(root, true);
  carouselTasks.push(...activeStaticCarouselPreloads(root));
  prewarmOpenedAppMedia(root, carouselTasks.filter(Boolean));
  playActiveAutoplayVideos(root);
});

bindGalleryNavigation(
  aboutCarouselPrev,
  aboutCarouselNext,
  ABOUT_CAROUSEL_ITEMS.length,
  () => aboutCarouselIndex,
  (index) => {
    aboutCarouselIndex = index;
  },
  updateAboutCarousel
);

void updateAboutCarousel();

bindGalleryNavigation(
  pathfinderPrev,
  pathfinderNext,
  pathfinderImages.length,
  () => pathfinderIndex,
  (index) => {
    pathfinderIndex = index;
  },
  updatePathfinderImage
);

bindGalleryNavigation(
  berserkPosterPrev,
  berserkPosterNext,
  berserkPosterImages.length,
  () => berserkPosterIndex,
  (index) => {
    berserkPosterIndex = index;
  },
  updateBerserkPosterImage
);

bindGalleryNavigation(
  myBrothersGhostPrev,
  myBrothersGhostNext,
  myBrothersGhostImages.length,
  () => myBrothersGhostIndex,
  (index) => {
    myBrothersGhostIndex = index;
  },
  updateMyBrothersGhostImage
);

bindGalleryNavigation(
  frontiersSlidePrev,
  frontiersSlideNext,
  frontiersPdfSlides.length,
  () => frontiersSlideIndex,
  (index) => {
    frontiersSlideIndex = index;
  },
  updateFrontiersSlide
);

bindGalleryNavigation(
  pulseProjectPrev,
  pulseProjectNext,
  pulseProjectFigures.length,
  () => pulseProjectIndex,
  (index) => {
    pulseProjectIndex = index;
  },
  updatePulseProjectFigure
);

bindGalleryNavigation(
  tcpResultsPrev,
  tcpResultsNext,
  tcpResultFigures.length,
  () => tcpResultsIndex,
  (index) => {
    tcpResultsIndex = index;
  },
  updateTcpResultFigure
);

bindGalleryNavigation(
  ekgProjectPrev,
  ekgProjectNext,
  ekgProjectMedia.length,
  () => ekgProjectIndex,
  (index) => {
    ekgProjectIndex = index;
  },
  updateEkgProjectMedia
);

bindGalleryNavigation(
  droneVideoPrev,
  droneVideoNext,
  droneProjectVideos.length,
  () => droneVideoIndex,
  (index) => {
    droneVideoIndex = index;
  },
  syncDroneProjectVideo
);

if (openPulsePresentation) {
  openPulsePresentation.addEventListener("click", () => {
    if (
      pulsePresentationIframe &&
      pulsePresentationIframe.dataset.src !== PULSE_PRESENTATION_PDF_URL
    ) {
      pulsePresentationIframe.dataset.src = PULSE_PRESENTATION_PDF_URL;
      pulsePresentationIframe.removeAttribute("src");
    }
    setWindowOpen("pulse-presentation-pdf", true);
  });
}

if (openDronePresentation) {
  openDronePresentation.addEventListener("click", () => {
    if (
      dronePresentationIframe &&
      dronePresentationIframe.dataset.src !== DRONE_PRESENTATION_PDF_URL
    ) {
      dronePresentationIframe.dataset.src = DRONE_PRESENTATION_PDF_URL;
      dronePresentationIframe.removeAttribute("src");
    }
    setWindowOpen("drone-presentation-pdf", true);
  });
}

document.querySelectorAll("[data-github-shortcut]").forEach((button) => {
  button.addEventListener("click", () => {
    notifyActivity("newTabLink", {
      href: GITHUB_REPOSITORY_URL,
      source: "github-shortcut",
    });
    window.open(GITHUB_REPOSITORY_URL, "_blank", "noopener,noreferrer");
  });
});

if (openFrontiersPdf) {
  openFrontiersPdf.addEventListener("click", () => {
    setWindowOpen("mec-pdf", true);
  });
}

if (openBioe190Presentation) {
  openBioe190Presentation.addEventListener("click", () => {
    setWindowOpen("bioe190-presentation-pdf", true);
  });
}

if (openBioe190Proposal) {
  openBioe190Proposal.addEventListener("click", () => {
    setWindowOpen("bioe190-proposal-pdf", true);
  });
}

if (openTcpPaper) {
  openTcpPaper.addEventListener("click", () => {
    setWindowOpen("tcp-paper-pdf", true);
  });
}

if (openWritingTcpPaper) {
  openWritingTcpPaper.addEventListener("click", () => {
    setWindowOpen("tcp-paper-pdf", true);
  });
}

if (openTcpPresentation) {
  openTcpPresentation.addEventListener("click", () => {
    setWindowOpen("tcp-presentation-pdf", true);
  });
}

window.homeGallery = Object.freeze({
  loadImage: loadGalleryImage,
  bindGalleryNavigation,
  queueGallerySuccessors,
  setGalleryCounterText,
  setGalleryImageSource,
});
})();
