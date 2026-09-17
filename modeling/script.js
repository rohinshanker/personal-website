(() => {
  "use strict";

  const portfolio = window.rohinModelingPortfolio;
  if (!portfolio || !Array.isArray(portfolio.shoots)) return;

  /** Shared data paths are repository-root relative; this route lives one level down. */
  const ASSET_ROOT = "../";
  const LOADING_ASSET = `${ASSET_ROOT}assets/loading/windows98-hourglass-2x.gif`;
  const LOADING_PADDED_ASSET = `${ASSET_ROOT}assets/loading/windows98-hourglass-padded-2x.gif`;
  const DOWNLOAD_ICON = `${ASSET_ROOT}assets/app-icons/ico/download.ico`;
  /** Below this box the padded hourglass no longer fits, so the raw frame is shown instead. */
  const LOADING_RAW_WIDTH = 258;
  const LOADING_RAW_HEIGHT = 272;
  const VIDEO_PATTERN = /\.(mp4|webm|ogg)(?:[?#]|$)/i;
  const SWIPE_MIN_DISTANCE = 40;
  const TOP_LINK_SCROLL_THRESHOLD = 480;
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollBehavior = () => (reducedMotion.matches ? "auto" : "smooth");
  const assetUrl = (path) => `${ASSET_ROOT}${path}`;
  const isVideoSource = (source) => VIDEO_PATTERN.test(source);
  const counterText = (index, total) => `${index + 1} of ${total}`;
  const anchorId = (shootId) => shootId.replace(/^modeling-/, "");
  const wrapIndex = (index, total) => ((index % total) + total) % total;

  const element = (tag, className, attributes = {}) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attributes).forEach(([name, value]) => {
      if (value === undefined || value === null || value === false) return;
      node.setAttribute(name, value === true ? "" : String(value));
    });
    return node;
  };

  const downloadName = (shoot, item, index, total) => {
    const extension = (item.source.match(/\.[a-z0-9]+$/i)?.[0] || "").toLowerCase();
    return `${anchorId(shoot.id)}-${index + 1}-of-${total}${extension}`;
  };

  /**
   * The "n of N" readout is also the download control: the whole raised button
   * saves whichever photo or clip is current.
   */
  const createDownloadControl = (block, counterAttributes) => {
    const link = element("a", `${block}__download`, { href: "#", download: "" });
    const counter = element("span", `${block}__counter`, counterAttributes);
    const icon = element("img", `${block}__download-icon`, { src: DOWNLOAD_ICON, alt: "" });
    link.append(counter, icon);
    return {
      link,
      update(shoot, media, index) {
        const item = media[index];
        link.href = item.source;
        link.setAttribute("download", downloadName(shoot, item, index, media.length));
        link.setAttribute(
          "aria-label",
          `Download ${item.video ? "clip" : "photo"} ${counterText(index, media.length)}`
        );
        counter.textContent = counterText(index, media.length);
      },
    };
  };

  const shootMedia = (shoot) =>
    shoot.files.map((filename, index) => {
      const source = assetUrl(`${shoot.folder}/${filename}`);
      const video = isVideoSource(filename);
      return {
        alt: `${shoot.title}, ${video ? "video" : "photo"} ${counterText(index, shoot.files.length)}`,
        source,
        video,
      };
    });

  /* ------------------------------------------------------------------ */
  /* Loading indicator: the Home hourglass, covering the slot while it loads. */

  const loadingIndicator = () => {
    const indicator = element("div", "media-loading", { "aria-hidden": "true", hidden: true });
    indicator.appendChild(element("img", "media-loading__image", { alt: "" }));
    return indicator;
  };

  const setLoading = (slot, isLoading) => {
    const indicator = slot.querySelector(":scope > .media-loading");
    if (!indicator) return;
    if (isLoading) {
      const compact =
        slot.clientWidth < LOADING_RAW_WIDTH || slot.clientHeight < LOADING_RAW_HEIGHT;
      indicator.classList.toggle("media-loading--compact", compact);
      indicator.querySelector("img").src = compact ? LOADING_ASSET : LOADING_PADDED_ASSET;
      slot.setAttribute("aria-busy", "true");
    } else {
      slot.removeAttribute("aria-busy");
    }
    indicator.hidden = !isLoading;
  };

  /**
   * Assigns the real source to a deferred image or video and keeps the
   * hourglass visible until the browser has the first frame.
   */
  const loadMedia = (slot, media, { onError } = {}) => {
    if (media.dataset.loaded === "true") return;
    media.dataset.loaded = "true";
    setLoading(slot, true);
    const finish = () => setLoading(slot, false);
    const fail = () => {
      finish();
      if (onError) onError();
    };
    if (media.matches("video")) {
      media.addEventListener("loadeddata", finish, { once: true });
      media.addEventListener("error", fail, { once: true });
      media.src = media.dataset.src;
      media.load();
      return;
    }
    media.addEventListener("load", finish, { once: true });
    media.addEventListener("error", fail, { once: true });
    media.src = media.dataset.src;
    if (media.complete && media.naturalWidth) finish();
  };

  /* ------------------------------------------------------------------ */
  /* Header */

  const hydrateHeader = () => {
    const { instagram, dropbox = {}, shoots } = portfolio;
    const instagramLink = document.querySelector("[data-portfolio-instagram]");
    if (instagramLink && instagram?.href) {
      instagramLink.href = instagram.href;
      const handle = instagramLink.querySelector("[data-portfolio-instagram-handle]");
      if (handle && instagram.handle) handle.textContent = instagram.handle;
    }

    document.querySelectorAll("[data-portfolio-dropbox]").forEach((slot) => {
      const href = String(dropbox[slot.dataset.portfolioDropbox] || "").trim();
      const pending = slot.querySelector("button");
      if (!href || !pending) return;
      const link = element("a", "portfolio-link", {
        href,
        target: "_blank",
        rel: "noreferrer",
      });
      link.append(...pending.childNodes);
      pending.replaceWith(link);
      slot.querySelector(".portfolio-link__note")?.remove();
    });

    const navSummary = document.querySelector("[data-portfolio-nav-summary]");
    if (navSummary) navSummary.textContent = `Jump to a shoot (${shoots.length})`;
    const navList = document.querySelector("[data-portfolio-nav-list]");
    if (navList) {
      navList.replaceChildren(
        ...shoots.map((shoot) => {
          const item = element("li");
          const link = element("a", "portfolio-nav__link", { href: `#${anchorId(shoot.id)}` });
          link.append(
            element("span", "portfolio-nav__title"),
            element("span", "portfolio-nav__date")
          );
          link.firstChild.textContent = shoot.title;
          link.lastChild.textContent = shoot.date;
          item.appendChild(link);
          return item;
        })
      );
    }
  };

  /* ------------------------------------------------------------------ */
  /* Carousel */

  const controllers = new Map();

  const nearViewport = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const controller = controllers.get(entry.target);
        if (!controller) return;
        if (entry.isIntersecting) controller.activate();
        else controller.deactivate();
      });
    },
    { rootMargin: "50% 0px 50% 0px" }
  );

  const createCarousel = (shoot, media, { onOpen }) => {
    const root = element("div", "carousel", { "data-carousel": shoot.id });
    const strip = element("div", "carousel__strip", {
      role: "group",
      "aria-roledescription": "carousel",
      "aria-label": `${shoot.title} photos`,
    });
    const slides = media.map((item, index) => {
      const slide = element("div", "carousel__slide", {
        role: "group",
        "aria-roledescription": "slide",
        "aria-label": counterText(index, media.length),
        "data-carousel-slide": index,
      });
      if (item.video) {
        const video = element("video", "carousel__video", {
          controls: true,
          playsinline: true,
          preload: "none",
          "aria-label": item.alt,
          "data-src": item.source,
        });
        slide.appendChild(video);
      } else {
        const button = element("button", "carousel__photo", {
          type: "button",
          "aria-label": `View ${item.alt.replace(`${shoot.title}, `, "")} fullscreen`,
          "data-carousel-open": index,
        });
        button.appendChild(
          element("img", "carousel__image", {
            alt: item.alt,
            "data-src": item.source,
            decoding: "async",
            draggable: "false",
          })
        );
        slide.appendChild(button);
      }
      slide.appendChild(loadingIndicator());
      return slide;
    });
    strip.append(...slides);

    const controls = element("div", "carousel__controls");
    const previous = element("button", "carousel__control", {
      type: "button",
      "aria-label": "Previous photo",
    });
    previous.textContent = "Previous";
    const download = createDownloadControl("carousel", { "aria-live": "polite" });
    download.update(shoot, media, 0);
    const next = element("button", "carousel__control", { type: "button", "aria-label": "Next photo" });
    next.textContent = "Next";
    controls.append(previous, download.link, next);
    root.append(strip, controls);

    let index = 0;
    let active = false;
    let loader = null;
    let scrollFrame = 0;
    /** Slide a programmatic scroll is still travelling to, so passing positions do not reset the index. */
    let pendingTarget = null;
    let pendingTimer = 0;

    const loadSlide = (slide) => {
      const item = slide.querySelector("[data-src]");
      if (!item) return;
      loadMedia(slide, item, {
        onError: () => {
          slide.classList.add("is-unavailable");
          const notice = element("p", "carousel__unavailable");
          notice.textContent = `This ${item.matches("video") ? "clip" : "photo"} could not be loaded.`;
          slide.appendChild(notice);
        },
      });
    };

    const loadAround = (center) => {
      [center - 1, center, center + 1]
        .filter((candidate) => candidate >= 0 && candidate < slides.length)
        .forEach((candidate) => loadSlide(slides[candidate]));
    };

    const syncVideos = () => {
      slides.forEach((slide, slideIndex) => {
        const video = slide.querySelector("video");
        if (!video) return;
        const current = active && slideIndex === index;
        if (!current) {
          if (!video.paused) video.pause();
          return;
        }
        if (!shoot.autoplay) return;
        video.muted = true;
        video.loop = true;
        loadSlide(slide);
        const playback = video.play();
        if (playback && typeof playback.catch === "function") playback.catch(() => {});
      });
    };

    const setIndex = (nextIndex) => {
      const bounded = Math.max(0, Math.min(slides.length - 1, nextIndex));
      if (bounded === index) return;
      index = bounded;
      download.update(shoot, media, index);
      if (active) loadAround(index);
      syncVideos();
    };

    const settlePending = () => {
      pendingTarget = null;
      window.clearTimeout(pendingTimer);
      pendingTimer = 0;
    };

    const goTo = (target, behavior = scrollBehavior()) => {
      const wrapped = wrapIndex(target, slides.length);
      setIndex(wrapped);
      pendingTarget = wrapped;
      window.clearTimeout(pendingTimer);
      pendingTimer = window.setTimeout(settlePending, 700);
      strip.scrollTo({ left: wrapped * strip.clientWidth, behavior });
    };

    const focusSlide = (slideIndex) => {
      slides[slideIndex]?.querySelector("button, video")?.focus({ preventScroll: true });
    };

    strip.addEventListener(
      "scroll",
      () => {
        if (scrollFrame) return;
        scrollFrame = window.requestAnimationFrame(() => {
          scrollFrame = 0;
          if (!strip.clientWidth) return;
          const position = strip.scrollLeft / strip.clientWidth;
          if (pendingTarget !== null) {
            if (Math.abs(position - pendingTarget) < 0.02) settlePending();
            return;
          }
          setIndex(Math.round(position));
        });
      },
      { passive: true }
    );
    ["pointerdown", "wheel"].forEach((eventName) => {
      strip.addEventListener(eventName, settlePending, { passive: true });
    });

    previous.addEventListener("click", () => goTo(index - 1));
    next.addEventListener("click", () => goTo(index + 1));
    root.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.target.closest("video")) return;
      event.preventDefault();
      goTo(index + (event.key === "ArrowLeft" ? -1 : 1));
      if (event.target.closest(".carousel__strip")) focusSlide(index);
    });
    strip.addEventListener("click", (event) => {
      const button = event.target.closest("[data-carousel-open]");
      if (!button) return;
      onOpen(Number(button.dataset.carouselOpen), button);
    });

    const controller = {
      element: root,
      activate() {
        if (active) return;
        active = true;
        if (!loader) {
          // Half a slide of margin on either side of the strip catches exactly
          // the neighbouring slides, so a swipe never lands on an empty slot.
          loader = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) loadSlide(entry.target);
              });
            },
            { root: strip, rootMargin: "0px 50% 0px 50%", threshold: 0 }
          );
          slides.forEach((slide) => loader.observe(slide));
        }
        loadAround(index);
        syncVideos();
      },
      deactivate() {
        if (!active) return;
        active = false;
        syncVideos();
      },
      currentIndex: () => index,
      goTo,
      realign() {
        if (strip.clientWidth) strip.scrollTo({ left: index * strip.clientWidth, behavior: "auto" });
      },
    };
    controllers.set(root, controller);
    nearViewport.observe(root);
    return controller;
  };

  /* ------------------------------------------------------------------ */
  /* Fullscreen viewer */

  const createLightbox = () => {
    const root = element("div", "lightbox", {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "lightbox-title",
      hidden: true,
      "data-lightbox": true,
    });
    const backdrop = element("div", "lightbox__backdrop", { "data-lightbox-close": true });
    const windowElement = element("div", "window lightbox__window");
    const titleBar = element("div", "title-bar");
    const title = element("div", "title-bar-text lightbox__title", { id: "lightbox-title" });
    const titleControls = element("div", "title-bar-controls");
    const close = element("button", "close lightbox__close", {
      type: "button",
      "aria-label": "Close fullscreen view",
      "data-lightbox-close": true,
    });
    titleControls.appendChild(close);
    titleBar.append(title, titleControls);

    const body = element("div", "window-body lightbox__body");
    const stage = element("div", "lightbox__stage", { "data-lightbox-stage": true });
    const mediaSlot = element("div", "lightbox__media", { "data-lightbox-media": true });
    stage.append(mediaSlot, loadingIndicator());
    const footer = element("div", "lightbox__footer");
    const previous = element("button", "lightbox__control", {
      type: "button",
      "aria-label": "Previous photo",
      "data-lightbox-previous": true,
    });
    previous.textContent = "Previous";
    const download = createDownloadControl("lightbox", {
      "aria-live": "polite",
      "data-lightbox-counter": true,
    });
    const next = element("button", "lightbox__control", {
      type: "button",
      "aria-label": "Next photo",
      "data-lightbox-next": true,
    });
    next.textContent = "Next";
    footer.append(previous, download.link, next);
    body.append(stage, footer);
    windowElement.append(titleBar, body);
    root.append(backdrop, windowElement);
    document.body.appendChild(root);

    let state = null;
    let lockedScrollY = 0;
    let swipeStart = null;

    const preload = (item) => {
      if (!item || item.video) return;
      const image = new Image();
      image.src = item.source;
    };

    const render = () => {
      const { shoot, media, index } = state;
      const item = media[index];
      const previousVideo = mediaSlot.querySelector("video");
      if (previousVideo) previousVideo.pause();
      title.textContent = shoot.title;
      download.update(shoot, media, index);
      let node;
      if (item.video) {
        node = element("video", "lightbox__video", {
          controls: true,
          playsinline: true,
          preload: "metadata",
          "aria-label": item.alt,
          "data-src": item.source,
        });
      } else {
        node = element("img", "lightbox__image", {
          alt: item.alt,
          decoding: "async",
          draggable: "false",
          "data-src": item.source,
        });
      }
      mediaSlot.replaceChildren(node);
      loadMedia(stage, node);
      preload(media[wrapIndex(index + 1, media.length)]);
      preload(media[wrapIndex(index - 1, media.length)]);
    };

    const navigate = (offset) => {
      if (!state) return;
      state.index = wrapIndex(state.index + offset, state.media.length);
      state.carousel.goTo(state.index, "auto");
      render();
    };

    const setPageInert = (inert) => {
      Array.from(document.body.children).forEach((child) => {
        if (child === root) return;
        if (inert) child.setAttribute("inert", "");
        else child.removeAttribute("inert");
      });
    };

    const lockScroll = () => {
      lockedScrollY = window.scrollY;
      document.body.style.top = `-${lockedScrollY}px`;
      document.documentElement.classList.add("is-lightbox-open");
    };

    const unlockScroll = () => {
      document.documentElement.classList.remove("is-lightbox-open");
      document.body.style.top = "";
      window.scrollTo(0, lockedScrollY);
    };

    const open = ({ shoot, media, carousel, index, opener }) => {
      state = { shoot, media, carousel, index, opener };
      lockScroll();
      setPageInert(true);
      root.hidden = false;
      render();
      close.focus({ preventScroll: true });
    };

    const dismiss = () => {
      if (!state) return;
      const { opener } = state;
      const video = mediaSlot.querySelector("video");
      if (video) video.pause();
      mediaSlot.replaceChildren();
      setLoading(stage, false);
      root.hidden = true;
      setPageInert(false);
      unlockScroll();
      state = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };

    const trapFocus = (event) => {
      const focusable = Array.from(windowElement.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (candidate) => candidate.offsetParent !== null || candidate === close
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!windowElement.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-lightbox-close]")) dismiss();
    });
    previous.addEventListener("click", () => navigate(-1));
    next.addEventListener("click", () => navigate(1));
    document.addEventListener("keydown", (event) => {
      if (!state) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (event.target.closest("video")) return;
        event.preventDefault();
        navigate(event.key === "ArrowLeft" ? -1 : 1);
      } else if (event.key === "Tab") {
        trapFocus(event);
      }
    });
    stage.addEventListener("pointerdown", (event) => {
      if (event.target.closest("video")) return;
      swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    stage.addEventListener("pointerup", (event) => {
      if (!swipeStart || swipeStart.id !== event.pointerId) return;
      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY)) return;
      navigate(deltaX < 0 ? 1 : -1);
    });
    stage.addEventListener("pointercancel", () => {
      swipeStart = null;
    });

    return { open, dismiss, isOpen: () => Boolean(state) };
  };

  /* ------------------------------------------------------------------ */
  /* Shoot sections */

  const renderShoot = (shoot, lightbox) => {
    const id = anchorId(shoot.id);
    const media = shootMedia(shoot);
    const section = element("section", "window shoot", {
      id,
      "aria-labelledby": `${id}-title`,
      "data-shoot": shoot.id,
    });

    const titleBar = element("div", "title-bar");
    const heading = element("h2", "title-bar-text shoot__title", { id: `${id}-title` });
    heading.appendChild(element("img", "title-bar-icon", { src: assetUrl(shoot.icon), alt: "" }));
    heading.appendChild(document.createTextNode(shoot.title));
    const controls = element("div", "title-bar-controls");
    const fullscreen = element("button", "shoot__expand", {
      type: "button",
      "aria-label": `Expand ${shoot.title} fullscreen`,
      "data-shoot-fullscreen": true,
    });
    fullscreen.textContent = "Expand";
    controls.appendChild(fullscreen);
    titleBar.append(heading, controls);

    const body = element("div", "window-body shoot__body");
    const date = element("p", "shoot__date");
    date.textContent = shoot.date;

    const carousel = createCarousel(shoot, media, {
      onOpen: (index, opener) => lightbox.open({ shoot, media, carousel, index, opener }),
    });
    fullscreen.addEventListener("click", () =>
      lightbox.open({ shoot, media, carousel, index: carousel.currentIndex(), opener: fullscreen })
    );

    const links = element("div", "shoot__links", {
      role: "group",
      "aria-label": `${shoot.title} links`,
    });
    (shoot.links || []).forEach((link) => {
      const anchor = element("a", "shoot__link", {
        href: link.href,
        target: "_blank",
        rel: "noreferrer",
        title: link.title || null,
      });
      const icon = portfolio.linkIcons?.[link.type] || portfolio.linkIcons?.website;
      if (icon) anchor.appendChild(element("img", "shoot__link-icon", { src: assetUrl(icon), alt: "" }));
      const label = element("span");
      label.textContent = link.label;
      anchor.appendChild(label);
      links.appendChild(anchor);
    });

    body.append(date, carousel.element);
    if (links.childElementCount) body.appendChild(links);
    if (shoot.credits?.length) {
      const credits = element("details", "shoot__credits");
      const summary = element("summary", "shoot__credits-summary");
      summary.textContent = "Credits";
      const list = element("ul", "shoot__credits-list");
      shoot.credits.forEach((line) => {
        const item = element("li");
        item.textContent = line;
        list.appendChild(item);
      });
      credits.append(summary, list);
      body.appendChild(credits);
    }
    section.append(titleBar, body);
    return section;
  };

  /* ------------------------------------------------------------------ */
  /* Page */

  const bindTopLink = () => {
    const link = document.querySelector("[data-portfolio-top]");
    if (!link) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      link.hidden = window.scrollY < TOP_LINK_SCROLL_THRESHOLD;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!frame) frame = window.requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  };

  const bindResize = () => {
    let frame = 0;
    window.addEventListener("resize", () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        controllers.forEach((controller) => controller.realign());
      });
    });
  };

  const revealHashTarget = () => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash));
    if (target) target.scrollIntoView({ block: "start" });
  };

  hydrateHeader();
  const lightbox = createLightbox();
  const container = document.querySelector("[data-portfolio-shoots]");
  if (container) {
    container.append(...portfolio.shoots.map((shoot) => renderShoot(shoot, lightbox)));
  }
  bindTopLink();
  bindResize();
  revealHashTarget();
})();
