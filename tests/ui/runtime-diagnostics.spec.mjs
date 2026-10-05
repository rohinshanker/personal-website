import { expect, test } from "./deterministic.mjs";
import {
  SKY_NAME_GENERATOR_DEFINITION,
  consumeDiagnostics,
  installSkyNameGenerator,
  installStubbedModelingMedia,
  openHomeDesktop,
} from "./helpers/rendered-site.mjs";

const DESKTOP = Object.freeze({ width: 1280, height: 800 });

/** How Chromium words a request the hermetic boundary refused. */
const SUBRESOURCE_BLOCKED = "net::ERR_BLOCKED_BY_CLIENT.Inspector";
const NAVIGATION_BLOCKED = "net::ERR_BLOCKED_BY_CLIENT";

const blocked = (url, errorText = SUBRESOURCE_BLOCKED) => `GET ${url} (${errorText})`;

/**
 * Waits until the record holds exactly `provoked` plus `echo`, what Chromium
 * itself reports beside it, then consumes the echo. Only the provoked
 * diagnostic is left, so the teardown failure a negative probe expects can come
 * from nothing else.
 *
 * @param {Record<string, string[]>} diagnostics the fixture's live record.
 * @param {Record<string, string[]>} provoked exact entries, by channel.
 * @param {Record<string, string[]>} [echo] a fragment of each echoed entry, by channel.
 */
const expectOnlyDiagnostics = async (diagnostics, provoked, echo = {}) => {
  const echoed = Object.fromEntries(
    Object.entries(echo).map(([channel, fragments]) => [
      channel,
      fragments.map((fragment) => expect.stringContaining(fragment)),
    ])
  );
  await expect
    .poll(() => diagnostics)
    .toEqual({
      consoleErrors: [],
      runtimeErrors: [],
      requestFailures: [],
      errorResponses: [],
      ...provoked,
      ...echoed,
    });
  consumeDiagnostics(diagnostics, echo);
};

/** Loads `url` the way an element of that kind would, and reports how it ended. */
const requestEmbed = (page, kind, url) =>
  page.evaluate(
    ([embedKind, src]) =>
      new Promise((resolve) => {
        const tag = { image: "img", media: "video", document: "iframe", script: "script" }[embedKind];
        const element = document.createElement(tag);
        ["load", "loadeddata", "error"].forEach((type) =>
          element.addEventListener(type, () => resolve(type), { once: true })
        );
        element.src = src;
        document.body.append(element);
      }),
    [kind, url]
  );

/** Has the page open `path` in a new window, as a link or `window.open` would. */
const openPopup = async (page, path) => {
  const opened = page.waitForEvent("popup");
  await page.evaluate((url) => {
    window.open(url);
  }, path);
  await opened;
};

// Each negative probe must fail in automatic fixture teardown. If enforcement
// is removed, Playwright reports an unexpected pass and fails the suite.
test("automatic diagnostics reject an uncaught page exception", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  const reported = page.waitForEvent("pageerror", { timeout: 5_000 });
  await page.evaluate(() => {
    queueMicrotask(() => { throw new Error("injected runtime failure"); });
  });
  await reported;
  await expectOnlyDiagnostics(diagnostics, { runtimeErrors: ["injected runtime failure"] });
  test.fail(true, "The fixture must reject the observed page exception.");
});

test("automatic diagnostics reject console errors", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await page.evaluate(() => console.error("injected console failure"));
  await expectOnlyDiagnostics(diagnostics, { consoleErrors: ["injected console failure"] });
  test.fail(true, "The fixture must reject the observed console error.");
});

test("automatic diagnostics reject failed resource delivery", async ({
  baseURL,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  await page.route("**/unreachable-asset.png", (route) => route.abort("connectionrefused"));
  await page.evaluate(() => fetch("/unreachable-asset.png").catch(() => undefined));
  await expectOnlyDiagnostics(
    diagnostics,
    { requestFailures: [`GET ${baseURL}/unreachable-asset.png (net::ERR_CONNECTION_REFUSED)`] },
    { consoleErrors: ["net::ERR_CONNECTION_REFUSED"] }
  );
  test.fail(true, "The fixture must reject the failed resource delivery.");
});

test("automatic diagnostics reject HTTP error responses", async ({
  baseURL,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  await page.route("**/missing-fixture.png", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.evaluate(() => fetch("/missing-fixture.png"));
  await expectOnlyDiagnostics(
    diagnostics,
    { errorResponses: [`404 ${baseURL}/missing-fixture.png`] },
    { consoleErrors: ["status of 404"] }
  );
  test.fail(true, "The fixture must reject the HTTP error response independently of console output.");
});

test("intentional request cancellation does not fail a healthy render", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  const cancelled = page.waitForEvent("requestfailed", (request) =>
    request.url().endsWith("/assets/mountain-and-sky.png")
  );
  await page.evaluate(async () => {
    const controller = new AbortController();
    const pending = fetch("/assets/mountain-and-sky.png", { signal: controller.signal }).catch(() => undefined);
    controller.abort();
    await pending;
  });
  // The cancellation really happened; it is the one failure text left out.
  expect((await cancelled).failure().errorText).toBe("net::ERR_ABORTED");
  await expectOnlyDiagnostics(diagnostics, {});
});

/**
 * What Chromium reports beside each blocked embed. A blocked subresource is
 * echoed to the console. A blocked frame is silent, but shows an error document
 * in which the deterministic init script is denied storage.
 */
const SUBRESOURCE_ECHO = Object.freeze({ consoleErrors: [SUBRESOURCE_BLOCKED, SUBRESOURCE_BLOCKED] });
const ERROR_DOCUMENT_ECHO = Object.freeze({
  runtimeErrors: ["Failed to read the 'localStorage' property", "Failed to read the 'localStorage' property"],
});

// The unknown origin proves nothing is stubbed by resource type; the unlisted
// path on an origin Home does embed proves nothing is stubbed by origin or prefix.
for (const { kind, errorText, echo, unknownOrigin, unlistedPath } of [
  {
    kind: "image",
    errorText: SUBRESOURCE_BLOCKED,
    echo: SUBRESOURCE_ECHO,
    unknownOrigin: "https://images.example.invalid/unlisted.png",
    unlistedPath: "https://rohinshanker.github.io/pulse-oximeter/site-assets/unlisted.jpg",
  },
  {
    kind: "media",
    errorText: SUBRESOURCE_BLOCKED,
    echo: SUBRESOURCE_ECHO,
    unknownOrigin: "https://media.example.invalid/unlisted.mp4",
    unlistedPath: "https://rohinshanker.github.io/pulse-oximeter/site-assets/unlisted.mp4",
  },
  {
    kind: "document",
    errorText: NAVIGATION_BLOCKED,
    echo: ERROR_DOCUMENT_ECHO,
    unknownOrigin: "https://embeds.example.invalid/player",
    unlistedPath: "https://rohinshanker.github.io/pulse-oximeter/unlisted.pdf",
  },
]) {
  test(`an unknown remote ${kind} is blocked rather than quietly stubbed`, async ({
    page,
    diagnostics,
  }) => {
    await openHomeDesktop(page, DESKTOP);
    await requestEmbed(page, kind, unknownOrigin);
    await requestEmbed(page, kind, unlistedPath);
    await expectOnlyDiagnostics(
      diagnostics,
      { requestFailures: [blocked(unknownOrigin, errorText), blocked(unlistedPath, errorText)] },
      echo
    );
    test.fail(true, `The fixture must reject an unlisted remote ${kind}.`);
  });
}

test("a known remote embed is answered by its local stub", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  expect(
    await requestEmbed(
      page,
      "image",
      "https://rohinshanker.github.io/pulse-oximeter/site-assets/demo-photo.jpg"
    )
  ).toBe("load");
  expect(
    await requestEmbed(
      page,
      "media",
      "https://imgix.bustle.com/inverse/8d/d9/86/e4/92b5/4dec/b80e/3402288d9a18/giphy-9gif.gif?w=825&h=464&fit=max&fm=mp4"
    )
  ).toBe("loadeddata");
  expect(
    await requestEmbed(page, "document", "https://www.youtube.com/embed/rduOw_oshqM?si=JKRMSKOS6UJrs9jK")
  ).toBe("load");
});

test("a known remote embed requested as another kind is blocked", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  const listedImage = "https://rohinshanker.github.io/pulse-oximeter/site-assets/demo-photo.jpg";
  await page.evaluate((url) => fetch(url).catch(() => undefined), listedImage);
  await expectOnlyDiagnostics(
    diagnostics,
    { requestFailures: [blocked(listedImage)] },
    { consoleErrors: [SUBRESOURCE_BLOCKED] }
  );
  test.fail(true, "A script must not be able to read an address approved only as an embed.");
});

const fetchText = (page, url) =>
  page.evaluate((address) => fetch(address).then((response) => response.text()), url);

test("a route a spec registers answers ahead of the hermetic block", async ({ page }) => {
  const mockedApi = "https://api.example.invalid/stats";
  const overriddenEmbed = "https://rohinshanker.github.io/pulse-oximeter/site-assets/demo-photo.jpg";
  await openHomeDesktop(page, DESKTOP);
  await page.route(mockedApi, (route) => route.fulfill({ contentType: "application/json", body: "{}" }));
  await page.route(overriddenEmbed, (route) =>
    route.fulfill({ contentType: "text/plain", body: "spec override" })
  );
  expect(await fetchText(page, mockedApi)).toBe("{}");
  expect(await fetchText(page, overriddenEmbed)).toBe("spec override");
});

const SKY_DOWNLOAD = "https://perchance.org/api/downloadGenerator";
const SKY_QUERY = "generatorName=sky-cotl-namegen&listsOnly=true";

test("the Sky generator stand-in answers its exact download and yields to a spec", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  expect(await fetchText(page, `${SKY_DOWNLOAD}?${SKY_QUERY}`)).toBe(SKY_NAME_GENERATOR_DEFINITION);
  await installSkyNameGenerator(page, "names\n  spec");
  expect(await fetchText(page, `${SKY_DOWNLOAD}?${SKY_QUERY}`)).toBe("names\n  spec");
});

test("a mistyped or different generator download is blocked", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  const mistypedPath = `${SKY_DOWNLOAD}-typo?${SKY_QUERY}`;
  const otherGenerator = `${SKY_DOWNLOAD}?generatorName=another-generator&listsOnly=true`;
  for (const url of [mistypedPath, otherGenerator]) {
    await page.evaluate((address) => fetch(address).catch(() => undefined), url);
  }
  await expectOnlyDiagnostics(
    diagnostics,
    { requestFailures: [blocked(mistypedPath), blocked(otherGenerator)] },
    { consoleErrors: [SUBRESOURCE_BLOCKED, SUBRESOURCE_BLOCKED] }
  );
  test.fail(true, "Only the exact Sky generator download has a stand-in.");
});

test("a local mock does not answer for its path on another host", async ({ page, diagnostics }) => {
  await installStubbedModelingMedia(page);
  await openHomeDesktop(page, DESKTOP);
  // The files the fixture mocks by default, and one a spec opts into.
  const foreign = [
    ["script", "https://assets.example.invalid/scripts/home/game-stats-backend.js"],
    ["script", "https://assets.example.invalid/scripts/home/sudoku-generator.worker.js"],
    ["script", "https://assets.example.invalid/scripts/home/events/prompts.js"],
    ["image", "https://assets.example.invalid/assets/modeling/unlisted.jpg"],
  ];
  for (const [kind, url] of foreign) {
    expect(await requestEmbed(page, kind, url)).toBe("error");
  }
  await expectOnlyDiagnostics(
    diagnostics,
    { requestFailures: foreign.map(([, url]) => blocked(url)) },
    { consoleErrors: foreign.map(() => SUBRESOURCE_BLOCKED) }
  );
  test.fail(true, "A mocked local file on a foreign host is an outbound request.");
});

test("only the configured test server origin is local", async ({ baseURL, page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  const server = new URL(baseURL);
  const otherPort = `http://${server.hostname}:${Number(server.port) + 1}/home.html`;
  const otherHost = `http://localhost:${server.port}/home.html`;
  for (const url of [otherPort, otherHost]) {
    await page.evaluate((address) => fetch(address).catch(() => undefined), url);
  }
  await expectOnlyDiagnostics(
    diagnostics,
    { requestFailures: [blocked(otherPort), blocked(otherHost)] },
    { consoleErrors: [SUBRESOURCE_BLOCKED, SUBRESOURCE_BLOCKED] }
  );
  test.fail(true, "Another loopback port or host name is not the test server.");
});

test("a popup and its opener each report once into the same record", async ({
  context,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  const popup = await context.newPage();
  await popup.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => console.error("injected opener failure"));
  await expectOnlyDiagnostics(diagnostics, { consoleErrors: ["injected opener failure"] });
  await popup.evaluate(() => console.error("injected popup failure"));
  await expectOnlyDiagnostics(diagnostics, {
    consoleErrors: ["injected opener failure", "injected popup failure"],
  });
  test.fail(true, "The fixture must reject a console error raised in any page.");
});

test("a popup page is held to the same hermetic boundary", async ({
  context,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  const popup = await context.newPage();
  await popup.goto("/home.html", { waitUntil: "domcontentloaded" });
  await popup.evaluate(() => fetch("https://api.example.invalid/stats").catch(() => undefined));
  await expectOnlyDiagnostics(
    diagnostics,
    { requestFailures: [blocked("https://api.example.invalid/stats")] },
    { consoleErrors: [SUBRESOURCE_BLOCKED] }
  );
  test.fail(true, "A popup must not be able to reach the network either.");
});

// A popup's first navigation is answered before Playwright announces the page,
// so only a listener that predates the popup can see how it went.
test("an HTTP error on a popup's first navigation is reported", async ({
  baseURL,
  context,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  await context.route("**/popup-unavailable.html", (route) =>
    route.fulfill({ status: 503, contentType: "text/html", body: "<!doctype html><title>down</title>" })
  );
  await openPopup(page, "/popup-unavailable.html");
  await expectOnlyDiagnostics(
    diagnostics,
    { errorResponses: [`503 ${baseURL}/popup-unavailable.html`] },
    { consoleErrors: ["status of 503"] }
  );
  test.fail(true, "The fixture must reject an HTTP error on a popup's first navigation.");
});

test("a delivery failure on a popup's first navigation is reported", async ({
  baseURL,
  context,
  page,
  diagnostics,
}) => {
  await openHomeDesktop(page, DESKTOP);
  await context.route("**/popup-refused.html", (route) => route.abort("connectionrefused"));
  await openPopup(page, "/popup-refused.html");
  await expectOnlyDiagnostics(diagnostics, {
    requestFailures: [`GET ${baseURL}/popup-refused.html (net::ERR_CONNECTION_REFUSED)`],
  });
  test.fail(true, "The fixture must reject a delivery failure on a popup's first navigation.");
});

test("repeated navigation records each diagnostic only once", async ({ page, diagnostics }) => {
  await openHomeDesktop(page, DESKTOP);
  await openHomeDesktop(page, DESKTOP);
  await page.evaluate(() => console.error("counted once"));
  await expectOnlyDiagnostics(diagnostics, {}, { consoleErrors: ["counted once"] });
});
