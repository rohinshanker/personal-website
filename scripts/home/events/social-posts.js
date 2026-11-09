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
  /** Worker route for one post's reactions; `{postId}` is the event id. */
  const SOCIAL_POST_REACTIONS_PATH = "/social-posts/{postId}/reactions";
  const SOCIAL_POST_REQUEST_TIMEOUT_MS = 8000;
  const SOCIAL_POST_DEFAULT_ICON = "assets/app-icons/ico/user_card.ico";
  const SOCIAL_POST_SYSTEM_ICON = "assets/app-icons/ico/msg_information.ico";
  const SOCIAL_POST_NO_PROFILE_MESSAGE = "Create a profile in Game Progress to like this post.";
  const SOCIAL_POST_NO_PROFILE_DISLIKE_MESSAGE =
    "Create a profile in Game Progress to dislike this post.";
  const SOCIAL_POST_OFFLINE_MESSAGE =
    "Couldn't reach the server. Your reaction is saved on this device.";
  const SOCIAL_POST_EMPTY_LIKERS_MESSAGE = "No one has liked this yet.";
  const REACTION_LIKE = "like";
  const REACTION_DISLIKE = "dislike";

  const isLiker = (value) => Boolean(value) && typeof value.id === "string";

  const toReactor = (value) => ({
    id: value.id,
    name: String(value.name || "N/A"),
    icon: value.icon || SOCIAL_POST_DEFAULT_ICON,
  });

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

  const hasProfile = (reactors, profile) => reactors.some((reactor) => reactor.id === profile.id);

  const currentSocialPostProfile = () => {
    const profile = window.homeGameStats.getGameStatsProfile();
    return isLiker(profile) ? toReactor(profile) : null;
  };

  /** Mirrors `normalizeBackendBaseUrl` in clash-royale.js: an http(s) origin plus path, no trailing slash. */
  const normalizeBackendBaseUrl = (rawConfig) => {
    const rawUrl = String(rawConfig?.apiBaseUrl ?? "").trim();
    if (!rawUrl) return "";
    try {
      const url = new URL(rawUrl);
      if (
        !/^https?:$/.test(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        return "";
      }
      url.pathname = url.pathname.replace(/\/+$/, "");
      return url.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  };

  /** The reactions URL for one post, or "" when no backend is configured. */
  const socialPostReactionsUrl = (postId) => {
    const baseUrl = normalizeBackendBaseUrl(window.rohinGameStatsBackend);
    if (!baseUrl) return "";
    return `${baseUrl}${SOCIAL_POST_REACTIONS_PATH.replace("{postId}", encodeURIComponent(postId))}`;
  };

  /** The Administrator's stored proof as a Bearer header; empty for everyone else. */
  const administratorAuthorizationHeaders = (profile) => {
    const session = window.homeAdministratorSession;
    if (!session.isAdministratorProfile(profile)) return {};
    try {
      const stored = sessionStorage.getItem(session.ADMINISTRATOR_PROOF_STORAGE_KEY);
      const proof = stored ? session.normalizeAdministratorProof(JSON.parse(stored)) : null;
      return proof ? { Authorization: `Bearer ${proof.proof}` } : {};
    } catch {
      return {};
    }
  };

  const readResponseJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const toReactorList = (value) =>
    Array.isArray(value) ? value.filter(isLiker).map(toReactor) : [];

  const toCount = (value, fallback) => (Number.isInteger(value) && value >= 0 ? value : fallback);

  /** The Worker's reaction state in the shape the view consumes. */
  const normalizeServerReactions = (payload) => {
    const likes = toReactorList(payload.likes);
    const dislikes = toReactorList(payload.dislikes);
    return {
      likes,
      dislikes,
      likeCount: toCount(payload.likeCount, likes.length),
      dislikeCount: toCount(payload.dislikeCount, dislikes.length),
    };
  };

  /**
   * One request to the reactions route. Resolves to the normalized server
   * state, or null for any failure: no backend, network error, timeout, a
   * non-2xx status, or a body that is not an `ok` reaction state.
   */
  const requestSocialPostReactions = async (postId, { method = "GET", body, headers } = {}) => {
    const url = socialPostReactionsUrl(postId);
    if (!url) return null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SOCIAL_POST_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        signal: controller.signal,
      });
      const payload = await readResponseJson(response);
      if (!response.ok || payload?.ok !== true) return null;
      return normalizeServerReactions(payload);
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
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
    /** The last reaction state the Worker reported, or null before it answers. */
    let serverState = null;
    /** The visitor's reaction the Worker has not confirmed yet: `{ profile, reaction }`. */
    let optimistic = null;
    /** Only the newest request may change state; older answers are dropped. */
    let latestRequest = 0;
    let offlineRowShown = false;

    const isVisible = () => isManagedRandomEventWindowVisible(win);

    const readLikers = () => readSocialPostLikes()[eventId] || [];
    const readDislikers = () => readSocialPostDislikes()[eventId] || [];

    /** The visitor's cached reaction on this device: "like", "dislike" or null. */
    const readLocalReaction = (profile) => {
      if (hasProfile(readLikers(), profile)) return REACTION_LIKE;
      if (hasProfile(readDislikers(), profile)) return REACTION_DISLIKE;
      return null;
    };

    const writeReactorList = (storageKey, profile, present) => {
      const reactions = readSocialPostReactions(storageKey);
      const others = withoutProfile(reactions[eventId] || [], profile);
      reactions[eventId] = present ? [...others, profile] : others;
      writeSocialPostReactions(storageKey, reactions);
    };

    /** A profile holds at most one reaction per post; the other one is cleared. */
    const writeLocalReaction = (profile, reaction) => {
      writeReactorList(SOCIAL_POST_LIKES_STORAGE_KEY, profile, reaction === REACTION_LIKE);
      writeReactorList(SOCIAL_POST_DISLIKES_STORAGE_KEY, profile, reaction === REACTION_DISLIKE);
    };

    const serverReactionOf = (profile) => {
      if (hasProfile(serverState.likes, profile)) return REACTION_LIKE;
      if (hasProfile(serverState.dislikes, profile)) return REACTION_DISLIKE;
      return null;
    };

    /** Server lists with the visitor's unconfirmed reaction applied exactly once. */
    const mergeOptimistic = ({ profile, reaction }) => {
      const likes = withoutProfile(serverState.likes, profile);
      const dislikes = withoutProfile(serverState.dislikes, profile);
      const removed = serverReactionOf(profile) ? 1 : 0;
      return {
        likes: reaction === REACTION_LIKE ? [...likes, profile] : likes,
        dislikes: reaction === REACTION_DISLIKE ? [...dislikes, profile] : dislikes,
        likeCount: serverState.likeCount - removed + (reaction === REACTION_LIKE ? 1 : 0),
        dislikeCount: serverState.dislikeCount - removed + (reaction === REACTION_DISLIKE ? 1 : 0),
        reaction,
      };
    };

    /** What the window shows: the server state when known, else this device's cache. */
    const currentView = (profile) => {
      if (!serverState) {
        const likes = readLikers();
        const dislikes = readDislikers();
        return {
          likes,
          dislikes,
          likeCount: likes.length,
          dislikeCount: dislikes.length,
          reaction: profile ? readLocalReaction(profile) : null,
        };
      }
      if (optimistic) return mergeOptimistic(optimistic);
      return { ...serverState, reaction: profile ? serverReactionOf(profile) : null };
    };

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
      offlineRowShown = false;
    };

    const appendSystemRow = (message) => {
      const text = document.createElement("p");
      text.textContent = message;
      appendLogRow(createSocialPostSystemIcon(), text, { system: true });
    };

    const appendOfflineRow = () => {
      if (offlineRowShown) return;
      appendSystemRow(SOCIAL_POST_OFFLINE_MESSAGE);
      offlineRowShown = true;
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
      const view = currentView(currentSocialPostProfile());
      if (likeCount) likeCount.textContent = formatSocialPostLikeCount(view.likeCount);
      if (dislikeCount) dislikeCount.textContent = formatSocialPostDislikeCount(view.dislikeCount);
      if (likeButton)
        likeButton.setAttribute("aria-pressed", String(view.reaction === REACTION_LIKE));
      if (dislikeButton) {
        dislikeButton.setAttribute("aria-pressed", String(view.reaction === REACTION_DISLIKE));
      }
      renderLikers(view.likes);
      renderLog(view.likes, view.dislikes);
    };

    /** Adopts a confirmed server state and brings this device's cache in line with it. */
    const adoptServerState = (state) => {
      serverState = state;
      optimistic = null;
      const profile = currentSocialPostProfile();
      if (profile) writeLocalReaction(profile, serverReactionOf(profile));
      render();
    };

    const refreshFromServer = async () => {
      const request = ++latestRequest;
      const state = await requestSocialPostReactions(eventId);
      if (request !== latestRequest || !state) return;
      adoptServerState(state);
    };

    const publishReaction = async (profile, reaction) => {
      const request = ++latestRequest;
      const state = await requestSocialPostReactions(eventId, {
        method: "POST",
        body: { profile, reaction },
        headers: administratorAuthorizationHeaders(profile),
      });
      if (request !== latestRequest) return;
      if (state) adoptServerState(state);
      else appendOfflineRow();
    };

    /** Toggles one reaction for the visitor: shown at once, then sent to the Worker. */
    const toggleReaction = (reaction, noProfileMessage) => {
      const profile = currentSocialPostProfile();
      if (!profile) {
        appendSystemRow(noProfileMessage);
        return;
      }
      const next = currentView(profile).reaction === reaction ? null : reaction;
      writeLocalReaction(profile, next);
      optimistic = { profile, reaction: next };
      render();
      void publishReaction(profile, next);
    };

    const toggleLike = () => toggleReaction(REACTION_LIKE, SOCIAL_POST_NO_PROFILE_MESSAGE);
    const toggleDislike = () =>
      toggleReaction(REACTION_DISLIKE, SOCIAL_POST_NO_PROFILE_DISLIKE_MESSAGE);

    const focusLikeButton = () => likeButton?.focus({ preventScroll: true });

    const show = () => {
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      showManagedRandomEventWindow(win, {
        onFront: focusLikeButton,
        beforeShow: () => {
          focusReturn = activeElement;
          render();
          void refreshFromServer();
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
    SOCIAL_POST_REACTIONS_PATH,
  });
})();
