(() => {
  const HOME_RESOURCE_URLS = Object.freeze({
    randomEventStyles:
      "styles/home/random-events.css?v=vanishing-popup-layout-20261009",
    adminStyles:
      "styles/home/admin-controls.css?v=on-demand-home-loading-20261007",
    adminOrchestrator:
      "scripts/home/admin/orchestrator.js?v=on-demand-home-loading-20261007",
    adminControls:
      "scripts/home/admin-controls.js?v=home-loading-ghost-repair-20261007",
  });

  const resourceStates = new Map();

  const resourceState = (key) => resourceStates.get(key)?.status || "idle";

  const startResourceLoad = (key, createElement, validate = () => true) => {
    const current = resourceStates.get(key);
    if (current?.status === "loaded" || current?.status === "loading") {
      return current.promise;
    }

    const element = createElement();
    const promise = new Promise((resolve, reject) => {
      const finish = () => {
        if (!validate()) {
          fail();
          return;
        }
        resourceStates.set(key, {
          element,
          promise: Promise.resolve(element),
          status: "loaded",
        });
        resolve(element);
      };
      const fail = () => {
        element.remove();
        resourceStates.delete(key);
        reject(new Error(`Failed to load Home resource: ${key}`));
      };
      element.addEventListener("load", finish, { once: true });
      element.addEventListener("error", fail, { once: true });
    });

    resourceStates.set(key, { element, promise, status: "loading" });
    document.head.append(element);
    return promise;
  };

  const loadStylesheet = (key, href) =>
    startResourceLoad(key, () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.homeResource = key;
      return link;
    });

  const loadClassicScript = (key, src, validate) =>
    startResourceLoad(key, () => {
      const script = document.createElement("script");
      script.async = false;
      script.src = src;
      script.dataset.homeResource = key;
      return script;
    }, validate);

  const adminOrchestratorReady = () =>
    ["listEvents", "resetScene", "runEvent"].every(
      (name) => typeof window.rohinAdminOrchestrator?.[name] === "function"
    );

  const adminControllerReady = () =>
    Boolean(
      window.rohinAdminControls &&
      typeof window.rohinAdminControlsController?.getState === "function"
    );

  const loadRandomEventStyles = () =>
    loadStylesheet("random-event-styles", HOME_RESOURCE_URLS.randomEventStyles);

  let adminResourcesPromise = null;

  let adminResourceGeneration = 0;

  const assertAdminResourceRequestActive = (generation) => {
    if (generation === adminResourceGeneration) return;
    const error = new Error("Admin resource loading was cancelled.");
    error.code = "home-resource-load-cancelled";
    throw error;
  };

  const loadAdminResources = () => {
    if (adminResourcesPromise) return adminResourcesPromise;
    const generation = adminResourceGeneration;
    const request = Promise.all([
      loadRandomEventStyles(),
      loadStylesheet("admin-styles", HOME_RESOURCE_URLS.adminStyles),
    ])
      .then(() => {
        assertAdminResourceRequestActive(generation);
        return loadClassicScript(
          "admin-orchestrator",
          HOME_RESOURCE_URLS.adminOrchestrator,
          adminOrchestratorReady
        );
      })
      .then(() => {
        assertAdminResourceRequestActive(generation);
        return loadClassicScript(
          "admin-controls",
          HOME_RESOURCE_URLS.adminControls,
          adminControllerReady
        );
      })
      .catch((error) => {
        if (adminResourcesPromise === request) adminResourcesPromise = null;
        throw error;
      });
    adminResourcesPromise = request;
    return request;
  };

  const cancelAdminResourceLoad = () => {
    adminResourceGeneration += 1;
    adminResourcesPromise = null;
  };

window.homeResources = Object.freeze({
    HOME_RESOURCE_URLS,
    cancelAdminResourceLoad,
    loadAdminResources,
    loadRandomEventStyles,
    resourceState,
});
})();
