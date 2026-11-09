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
  /** This device's registration with the Worker: `{ profileId, token, name, icon }`. */
  const SOCIAL_PROFILE_STORAGE_KEY = "personalSiteSocialProfileV1";
  /** Worker route for one post's reactions; `{postId}` is the event id. */
  const SOCIAL_POST_REACTIONS_PATH = "/social-posts/{postId}/reactions";
  /** Worker route that registers a profile and returns its token once. */
  const SOCIAL_PROFILES_PATH = "/social-profiles";
  const SOCIAL_POST_REQUEST_TIMEOUT_MS = 8000;
  const SOCIAL_POST_DEFAULT_ICON = "assets/app-icons/ico/user_card.ico";
  const SOCIAL_POST_SYSTEM_ICON = "assets/app-icons/ico/msg_information.ico";
  const SOCIAL_POST_NO_PROFILE_MESSAGE = "Create a profile in Game Progress to like this post.";
  const SOCIAL_POST_NO_PROFILE_DISLIKE_MESSAGE =
    "Create a profile in Game Progress to dislike this post.";
  const SOCIAL_POST_OFFLINE_MESSAGE =
    "Couldn't reach the server. Your reaction is saved on this device.";
  const SOCIAL_POST_PROFILE_REGISTERED_MESSAGE =
    "This profile is already registered from another device, so it can't react here.";
  const SOCIAL_POST_PROFILE_NAME_REJECTED_MESSAGE =
    "Your profile name isn't a generated name, so it can't be used on posts.";
  const SOCIAL_POST_PROFILE_BLOCKED_MESSAGE = "This profile can't react on posts.";
  const SOCIAL_POST_EMPTY_LIKERS_MESSAGE = "No one has liked this yet.";
  const REACTION_LIKE = "like";
  const REACTION_DISLIKE = "dislike";

  /** Why a press did not land on the Worker. Only `offline` keeps the press shown. */
  const FAILURE_OFFLINE = "offline";
  const FAILURE_PROFILE_REGISTERED = "profile-registered";
  const FAILURE_PROFILE_NAME_REJECTED = "profile-name-rejected";
  const FAILURE_PROFILE_BLOCKED = "profile-blocked";
  /** The stored token no longer works; the client registers once more. */
  const FAILURE_PROFILE_TOKEN = "profile-token";

  const SOCIAL_POST_FAILURE_MESSAGES = Object.freeze({
    [FAILURE_PROFILE_REGISTERED]: SOCIAL_POST_PROFILE_REGISTERED_MESSAGE,
    [FAILURE_PROFILE_NAME_REJECTED]: SOCIAL_POST_PROFILE_NAME_REJECTED_MESSAGE,
    [FAILURE_PROFILE_BLOCKED]: SOCIAL_POST_PROFILE_BLOCKED_MESSAGE,
  });

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

  const isSocialProfileRecord = (value) =>
    Boolean(value) &&
    typeof value.profileId === "string" &&
    typeof value.token === "string" &&
    value.token !== "";

  /** This device's registration record, or null when absent or unreadable. */
  const readSocialProfileRecord = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SOCIAL_PROFILE_STORAGE_KEY) || "null");
      return isSocialProfileRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeSocialProfileRecord = (record) => {
    try {
      localStorage.setItem(SOCIAL_PROFILE_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Storage may be full or blocked; the next press registers again.
    }
  };

  const clearSocialProfileRecord = () => {
    try {
      localStorage.removeItem(SOCIAL_PROFILE_STORAGE_KEY);
    } catch {
      // Nothing to clear when storage is blocked.
    }
  };

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

  /** One Worker route's URL, or "" when no backend is configured. */
  const backendUrl = (path) => {
    const baseUrl = normalizeBackendBaseUrl(window.rohinGameStatsBackend);
    return baseUrl ? `${baseUrl}${path}` : "";
  };

  const socialPostReactionsUrl = (postId) =>
    backendUrl(SOCIAL_POST_REACTIONS_PATH.replace("{postId}", encodeURIComponent(postId)));

  const socialProfilesUrl = () => backendUrl(SOCIAL_PROFILES_PATH);

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
   * One JSON request to the Worker. Resolves to `{ status, payload }`: the
   * status is 0 for a network error or timeout, the payload null when the
   * body is not JSON.
   */
  const requestWorkerJson = async (url, { method = "GET", body, headers } = {}) => {
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
      return { status: response.status, payload: await readResponseJson(response) };
    } catch {
      return { status: 0, payload: null };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const isOkAnswer = ({ status, payload }) => status >= 200 && status < 300 && payload?.ok === true;

  /** The Worker's state for one post, or null for any failure. */
  const fetchSocialPostReactions = async (postId) => {
    const url = socialPostReactionsUrl(postId);
    if (!url) return null;
    const answer = await requestWorkerJson(url);
    return isOkAnswer(answer) ? normalizeServerReactions(answer.payload) : null;
  };

  /** Why a registration answer is not a success, from the Worker's status and error code. */
  const registrationFailure = ({ status, payload }) => {
    if (status === 409) return FAILURE_PROFILE_REGISTERED;
    if (status === 400) return FAILURE_PROFILE_NAME_REJECTED;
    if (status === 403 && payload?.code === FAILURE_PROFILE_BLOCKED) return FAILURE_PROFILE_BLOCKED;
    return FAILURE_OFFLINE;
  };

  const isRegistrationAnswer = (answer) =>
    isOkAnswer(answer) && typeof answer.payload.token === "string" && answer.payload.token !== "";

  /**
   * Registers `profile` for this device and stores the token the Worker
   * returns exactly once. Resolves to `{ record }` or `{ failure }`.
   */
  const registerSocialProfile = async (profile) => {
    const url = socialProfilesUrl();
    if (!url) return { failure: FAILURE_OFFLINE };
    const body = { id: profile.id, name: profile.name, icon: profile.icon };
    const answer = await requestWorkerJson(url, { method: "POST", body });
    if (!isRegistrationAnswer(answer)) return { failure: registrationFailure(answer) };
    const registered = isLiker(answer.payload.profile)
      ? toReactor(answer.payload.profile)
      : profile;
    const record = {
      profileId: profile.id,
      token: answer.payload.token,
      name: registered.name,
      icon: registered.icon,
    };
    writeSocialProfileRecord(record);
    return { record };
  };

  /** The registration in flight, so two quick presses share one request. */
  let pendingRegistration = null;

  const registerSocialProfileOnce = (profile) => {
    if (pendingRegistration?.profileId !== profile.id) {
      const promise = registerSocialProfile(profile).finally(() => {
        if (pendingRegistration?.promise === promise) pendingRegistration = null;
      });
      pendingRegistration = { profileId: profile.id, promise };
    }
    return pendingRegistration.promise;
  };

  /** This device's record for `profile`, registering when there is none for it. */
  const ensureSocialProfileRecord = (profile) => {
    const record = readSocialProfileRecord();
    if (record?.profileId === profile.id) return Promise.resolve({ record });
    return registerSocialProfileOnce(profile);
  };

  /** Why a reaction answer is not a success, from the Worker's status and error code. */
  const reactionFailure = ({ status, payload }) => {
    const code = payload?.code;
    if (status === 404 && code === "profile-unknown") return FAILURE_PROFILE_TOKEN;
    if (status === 403 && code === "profile-token-invalid") return FAILURE_PROFILE_TOKEN;
    if (status === 403 && code === FAILURE_PROFILE_BLOCKED) return FAILURE_PROFILE_BLOCKED;
    return FAILURE_OFFLINE;
  };

  /** Sends one reaction body; resolves to `{ state }` or `{ failure }`. */
  const postSocialPostReaction = async (postId, body, headers) => {
    const url = socialPostReactionsUrl(postId);
    if (!url) return { failure: FAILURE_OFFLINE };
    const answer = await requestWorkerJson(url, { method: "POST", body, headers });
    if (isOkAnswer(answer)) return { state: normalizeServerReactions(answer.payload) };
    return { failure: reactionFailure(answer) };
  };

  /** The Administrator reacts under the stored proof and never registers. */
  const publishAdministratorReaction = (postId, profile, reaction) =>
    postSocialPostReaction(
      postId,
      { administrator: true, reaction },
      administratorAuthorizationHeaders(profile),
    );

  /**
   * A visitor reacts under this device's registration. A token the Worker no
   * longer knows is dropped and registration tried once more before giving up.
   */
  const publishVisitorReaction = async (postId, profile, reaction, { retry = true } = {}) => {
    const registration = await ensureSocialProfileRecord(profile);
    if (registration.failure) return registration;
    const { profileId, token } = registration.record;
    const outcome = await postSocialPostReaction(postId, { profileId, token, reaction });
    if (outcome.failure !== FAILURE_PROFILE_TOKEN) return outcome;
    clearSocialProfileRecord();
    if (!retry) return { failure: FAILURE_OFFLINE };
    return publishVisitorReaction(postId, profile, reaction, { retry: false });
  };

  const publishSocialPostReaction = (postId, profile, reaction) =>
    window.homeAdministratorSession.isAdministratorProfile(profile)
      ? publishAdministratorReaction(postId, profile, reaction)
      : publishVisitorReaction(postId, profile, reaction);

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

    /** The visitor as the Worker lists them when it does, else the local profile. */
    const serverReactorOf = (profile) =>
      [...serverState.likes, ...serverState.dislikes].find(
        (reactor) => reactor.id === profile.id,
      ) || profile;

    /** Server lists with the visitor's unconfirmed reaction applied exactly once. */
    const mergeOptimistic = ({ profile, reaction }) => {
      const reactor = serverReactorOf(profile);
      const likes = withoutProfile(serverState.likes, profile);
      const dislikes = withoutProfile(serverState.dislikes, profile);
      const removed = serverReactionOf(profile) ? 1 : 0;
      return {
        likes: reaction === REACTION_LIKE ? [...likes, reactor] : likes,
        dislikes: reaction === REACTION_DISLIKE ? [...dislikes, reactor] : dislikes,
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

    /** Takes back a press the Worker refused for good, in the view and in this device's cache. */
    const revertReaction = (profile, previousReaction) => {
      optimistic = null;
      writeLocalReaction(profile, serverState ? serverReactionOf(profile) : previousReaction);
      render();
    };

    const refreshFromServer = async () => {
      const request = ++latestRequest;
      const state = await fetchSocialPostReactions(eventId);
      if (request !== latestRequest || !state) return;
      adoptServerState(state);
    };

    const publishReaction = async (profile, reaction, previousReaction) => {
      const request = ++latestRequest;
      const outcome = await publishSocialPostReaction(eventId, profile, reaction);
      if (request !== latestRequest) return;
      if (outcome.state) {
        adoptServerState(outcome.state);
      } else if (outcome.failure === FAILURE_OFFLINE) {
        appendOfflineRow();
      } else {
        revertReaction(profile, previousReaction);
        appendSystemRow(SOCIAL_POST_FAILURE_MESSAGES[outcome.failure]);
      }
    };

    /** Toggles one reaction for the visitor: shown at once, then sent to the Worker. */
    const toggleReaction = (reaction, noProfileMessage) => {
      const profile = currentSocialPostProfile();
      if (!profile) {
        appendSystemRow(noProfileMessage);
        return;
      }
      const previous = currentView(profile).reaction;
      const next = previous === reaction ? null : reaction;
      writeLocalReaction(profile, next);
      optimistic = { profile, reaction: next };
      render();
      void publishReaction(profile, next, previous);
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
    SOCIAL_PROFILE_STORAGE_KEY,
    SOCIAL_POST_REACTIONS_PATH,
    SOCIAL_PROFILES_PATH,
  });
})();
