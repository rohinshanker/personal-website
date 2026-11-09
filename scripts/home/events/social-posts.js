(() => {
  const { byId } = window.homeDom;
  const {
    RANDOM_EVENT_KIND_INTERACTIVE,
    STANDARD_RANDOM_EVENT_PROBABILITIES,
    STANDARD_RANDOM_EVENT_PROBABILITY,
    bindManagedRandomEventWindowAnimation,
    bindRandomEventButton,
    closeManagedRandomEventWindow,
    isManagedRandomEventWindowVisible,
    registerRandomEvent,
    registerRandomEventWindows,
    showManagedRandomEventWindow,
  } = window.homeEventRuntime;

  const SOCIAL_POST_LIKES_STORAGE_KEY = "personalSiteSocialPostLikesV1";
  const SOCIAL_POST_DISLIKES_STORAGE_KEY = "personalSiteSocialPostDislikesV1";
  const SOCIAL_POST_DEFAULT_ICON = "assets/app-icons/ico/user_card.ico";
  const SOCIAL_POST_SYSTEM_ICON = "assets/app-icons/ico/msg_information.ico";
  const SOCIAL_POST_NO_PROFILE_MESSAGE = "Create a profile in Game Progress to like this post.";
  const SOCIAL_POST_NO_PROFILE_DISLIKE_MESSAGE =
    "Create a profile in Game Progress to dislike this post.";
  const SOCIAL_POST_EMPTY_LIKERS_MESSAGE = "No one has liked this yet.";

  const isLiker = (value) => Boolean(value) && typeof value.id === "string";

  /** Reactions by event id: `{ [eventId]: [{ id, name, icon }] }`, empty when unreadable. */
  const readSocialPostReactions = (storageKey) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).map(([eventId, likers]) => [
          eventId,
          Array.isArray(likers) ? likers.filter(isLiker) : [],
        ]),
      );
    } catch {
      return {};
    }
  };

  const writeSocialPostReactions = (storageKey, reactions) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(reactions));
    } catch {
      // Storage may be full or blocked; the rendered state still reflects this toggle.
    }
  };

  const readSocialPostLikes = () => readSocialPostReactions(SOCIAL_POST_LIKES_STORAGE_KEY);
  const readSocialPostDislikes = () => readSocialPostReactions(SOCIAL_POST_DISLIKES_STORAGE_KEY);

  const withoutProfile = (reactors, profile) =>
    reactors.filter((reactor) => reactor.id !== profile.id);

  const currentSocialPostProfile = () => {
    const profile = window.homeGameStats.getGameStatsProfile();
    if (!isLiker(profile)) return null;
    return {
      id: profile.id,
      name: String(profile.name || "N/A"),
      icon: profile.icon || SOCIAL_POST_DEFAULT_ICON,
    };
  };

  const formatSocialPostLikeCount = (count) => `${count} ${count === 1 ? "like" : "likes"}`;
  const formatSocialPostDislikeCount = (count) =>
    `${count} ${count === 1 ? "dislike" : "dislikes"}`;

  const createSocialPostProfileIcon = (profile) => {
    const icon = document.createElement("img");
    icon.src = profile.icon;
    icon.alt = "";
    icon.width = 18;
    icon.height = 18;
    if (window.homeAdministratorSession.isAdministratorProfile(profile)) {
      icon.dataset.rohinNekoAvatar = "true";
    }
    icon.addEventListener(
      "error",
      () => {
        icon.src = SOCIAL_POST_DEFAULT_ICON;
      },
      { once: true },
    );
    return icon;
  };

  const createSocialPostSystemIcon = () => {
    const icon = document.createElement("img");
    icon.src = SOCIAL_POST_SYSTEM_ICON;
    icon.alt = "";
    icon.width = 18;
    icon.height = 18;
    return icon;
  };

  const createSocialPost = ({ eventId, windowId, closeId }) => {
    const win = byId(windowId);
    const close = byId(closeId);
    const likeButton = win?.querySelector("[data-social-post-like]");
    const dislikeButton = win?.querySelector("[data-social-post-dislike]");
    const likeCount = win?.querySelector("[data-social-post-like-count]");
    const dislikeCount = win?.querySelector("[data-social-post-dislike-count]");
    const likersList = win?.querySelector("[data-social-post-likers]");
    const log = win?.querySelector("[data-social-post-log]");

    let focusReturn = null;

    const isVisible = () => isManagedRandomEventWindowVisible(win);

    const readLikers = () => readSocialPostLikes()[eventId] || [];
    const readDislikers = () => readSocialPostDislikes()[eventId] || [];

    const createLogRow = (icon, text, { system = false } = {}) => {
      const row = document.createElement("div");
      row.className = `social-post-log-row${system ? " is-system" : ""}`;
      row.append(icon, text);
      return row;
    };

    const appendLogRow = (icon, text, options) => {
      if (!log) return;
      log.appendChild(createLogRow(icon, text, options));
      log.scrollTop = log.scrollHeight;
    };

    const createActivityRow = (profile, action) => {
      const text = document.createElement("p");
      const name = document.createElement("strong");
      name.textContent = profile.name;
      text.append(name, ` ${action}`);
      return createLogRow(createSocialPostProfileIcon(profile), text);
    };

    /** The log lists current reactions only; a removed reaction removes its row. */
    const renderLog = (likers, dislikers) => {
      if (!log) return;
      log.replaceChildren(
        ...likers.map((liker) => createActivityRow(liker, "liked this.")),
        ...dislikers.map((reactor) => createActivityRow(reactor, "disliked this.")),
      );
      log.scrollTop = log.scrollHeight;
    };

    const appendSystemRow = (message) => {
      const text = document.createElement("p");
      text.textContent = message;
      appendLogRow(createSocialPostSystemIcon(), text, { system: true });
    };

    const renderLikers = (likers) => {
      if (!likersList) return;
      likersList.replaceChildren();
      if (likers.length === 0) {
        const empty = document.createElement("li");
        empty.className = "social-post-likers-empty";
        empty.textContent = SOCIAL_POST_EMPTY_LIKERS_MESSAGE;
        likersList.appendChild(empty);
        return;
      }
      likers.forEach((liker) => {
        const row = document.createElement("li");
        row.className = "social-post-liker";
        const name = document.createElement("span");
        name.textContent = liker.name;
        row.append(createSocialPostProfileIcon(liker), name);
        likersList.appendChild(row);
      });
    };

    const render = () => {
      const likers = readLikers();
      const dislikers = readDislikers();
      const profile = currentSocialPostProfile();
      const liked = Boolean(profile) && likers.some((liker) => liker.id === profile.id);
      const disliked = Boolean(profile) && dislikers.some((reactor) => reactor.id === profile.id);
      if (likeCount) likeCount.textContent = formatSocialPostLikeCount(likers.length);
      if (dislikeCount) dislikeCount.textContent = formatSocialPostDislikeCount(dislikers.length);
      if (likeButton) likeButton.setAttribute("aria-pressed", String(liked));
      if (dislikeButton) dislikeButton.setAttribute("aria-pressed", String(disliked));
      renderLikers(likers);
      renderLog(likers, dislikers);
    };

    /** A profile holds at most one reaction per post: the other one is cleared. */
    const clearOtherReaction = (storageKey, profile) => {
      const reactions = readSocialPostReactions(storageKey);
      const reactors = reactions[eventId] || [];
      if (!reactors.some((reactor) => reactor.id === profile.id)) return;
      reactions[eventId] = withoutProfile(reactors, profile);
      writeSocialPostReactions(storageKey, reactions);
    };

    const toggleLike = () => {
      const profile = currentSocialPostProfile();
      if (!profile) {
        appendSystemRow(SOCIAL_POST_NO_PROFILE_MESSAGE);
        return;
      }
      const likes = readSocialPostLikes();
      const likers = likes[eventId] || [];
      const liked = likers.some((liker) => liker.id === profile.id);
      likes[eventId] = liked ? withoutProfile(likers, profile) : [...likers, profile];
      writeSocialPostReactions(SOCIAL_POST_LIKES_STORAGE_KEY, likes);
      if (!liked) clearOtherReaction(SOCIAL_POST_DISLIKES_STORAGE_KEY, profile);
      render();
    };

    const toggleDislike = () => {
      const profile = currentSocialPostProfile();
      if (!profile) {
        appendSystemRow(SOCIAL_POST_NO_PROFILE_DISLIKE_MESSAGE);
        return;
      }
      const dislikes = readSocialPostDislikes();
      const dislikers = dislikes[eventId] || [];
      const disliked = dislikers.some((reactor) => reactor.id === profile.id);
      dislikes[eventId] = disliked ? withoutProfile(dislikers, profile) : [...dislikers, profile];
      writeSocialPostReactions(SOCIAL_POST_DISLIKES_STORAGE_KEY, dislikes);
      if (!disliked) clearOtherReaction(SOCIAL_POST_LIKES_STORAGE_KEY, profile);
      render();
    };

    const focusLikeButton = () => likeButton?.focus({ preventScroll: true });

    const show = () => {
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      showManagedRandomEventWindow(win, {
        onFront: focusLikeButton,
        beforeShow: () => {
          focusReturn = activeElement;
          render();
        },
        afterShow: () => {
          requestAnimationFrame(focusLikeButton);
        },
      });
    };

    const hide = () => {
      closeManagedRandomEventWindow(win);
    };

    const restoreFocus = () => {
      const target = focusReturn;
      focusReturn = null;
      if (target?.isConnected && !win?.contains(target)) target.focus({ preventScroll: true });
    };

    const bind = () => {
      bindRandomEventButton(close, hide);
      bindRandomEventButton(likeButton, toggleLike);
      bindRandomEventButton(dislikeButton, toggleDislike);
      win?.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        hide();
      });
      bindManagedRandomEventWindowAnimation(win, { afterClose: restoreFocus });
    };

    return { window: win, isVisible, show, bind };
  };

  const loisPostHappened = createSocialPost({
    eventId: "lois-post-happened",
    windowId: "lois-post-happened-window",
    closeId: "lois-post-happened-close",
  });

  const loisPostFiveOclock = createSocialPost({
    eventId: "lois-post-five-oclock",
    windowId: "lois-post-five-oclock-window",
    closeId: "lois-post-five-oclock-close",
  });

  registerRandomEvent({
    id: "lois-post-happened",
    debug: false,
    preloadTargets: () => [loisPostHappened.window],
    probability: STANDARD_RANDOM_EVENT_PROBABILITY,
    probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
    kind: RANDOM_EVENT_KIND_INTERACTIVE,
    isVisible: loisPostHappened.isVisible,
    canTrigger: () => !loisPostHappened.isVisible(),
    run: () => {
      loisPostHappened.show();
    },
    bind: () => {
      loisPostHappened.bind();
    },
  });

  registerRandomEvent({
    id: "lois-post-five-oclock",
    debug: false,
    preloadTargets: () => [loisPostFiveOclock.window],
    probability: STANDARD_RANDOM_EVENT_PROBABILITY,
    probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
    kind: RANDOM_EVENT_KIND_INTERACTIVE,
    isVisible: loisPostFiveOclock.isVisible,
    canTrigger: () => !loisPostFiveOclock.isVisible(),
    run: () => {
      loisPostFiveOclock.show();
    },
    bind: () => {
      loisPostFiveOclock.bind();
    },
  });

  const socialPostWindows = Object.freeze([loisPostHappened.window, loisPostFiveOclock.window]);

  // The runtime keeps these inside the viewport as the window resizes.
  registerRandomEventWindows(() => [loisPostHappened.window, loisPostFiveOclock.window]);

  window.homeEventSocialPosts = Object.freeze({
    socialPostWindows,
    readSocialPostLikes,
    readSocialPostDislikes,
    SOCIAL_POST_LIKES_STORAGE_KEY,
    SOCIAL_POST_DISLIKES_STORAGE_KEY,
  });
})();
