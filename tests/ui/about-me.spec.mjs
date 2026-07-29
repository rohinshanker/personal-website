import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

const viewports = [
  { width: 375, height: 812, name: "mobile" },
  { width: 375, height: 500, name: "short-mobile" },
  { width: 744, height: 900, name: "at-stack-breakpoint" },
  { width: 745, height: 900, name: "above-stack-breakpoint" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 720, name: "actual-desktop" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1440, height: 900, name: "wide" },
];

const expectedLinks = [
  [
    "LinkedIn",
    "@rohin-shanker",
    "https://www.linkedin.com/in/rohin-shanker/",
    "users_green.ico",
  ],
  ["Instagram", "@rrohinss", "https://www.instagram.com/rohin.personal", "camera.ico"],
  ["Substack", "@rohins", "https://substack.com/@rohins", "newspaper.ico"],
  [
    "Spotify",
    "@rohin",
    "https://open.spotify.com/user/rohindaman?si=ee2c1491d5eb48fe",
    "keyboard_musical_midi.ico",
  ],
  ["GitHub", "@rohinshanker", "https://github.com/rohinshanker", "gears.ico"],
];

const expectedCarouselImages = [
  {
    src: "assets/about-carousel/1.jpg",
    alt: "Portrait of Rohin Shanker in front of red rock formations",
  },
  {
    src: "assets/about-carousel/2.jpg",
    alt: "Rohin Shanker seated for the Fast Sonder Lookbook Shoot 2",
  },
  {
    src: "assets/about-carousel/3.jpg",
    alt: "Rohin Shanker making a pie with a friend",
  },
  {
    src: "assets/about-carousel/4.jpg",
    alt: "Rohin Shanker walking in the Club Rambutan runway show",
  },
  {
    src: "assets/about-carousel/5.jpg",
    alt: "Rohin Shanker celebrating graduation with friends at UC Berkeley",
  },
  {
    src: "assets/about-carousel/6.jpg",
    alt: "Rohin Shanker backstage at the Garb Sub-urban runway show",
  },
  {
    src: "assets/about-carousel/7.jpg",
    alt: "Rohin Shanker with a friend at a music festival",
  },
  {
    src: "assets/about-carousel/8.jpg",
    alt: "Rohin Shanker resting beside climbing pads",
  },
  {
    src: "assets/about-carousel/9.jpg",
    alt: "Rohin Shanker modeling in the Garb Means Business shoot",
  },
];

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const prepareAboutPage = async (page, { reducedMotion = "reduce" } = {}) => {
  await page.emulateMedia({ reducedMotion });
  await page.clock.setFixedTime(new Date("2026-07-27T12:00:00Z"));
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    localStorage.clear();
  });
  await disableRemoteGameStats(page);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
};

const aboutMetrics = (page) =>
  page.evaluate(() => {
    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        height: bounds.height,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      };
    };
    const body = document.querySelector("#about-window .about-body");
    const bodyBounds = body.getBoundingClientRect();
    const bodyStyle = getComputedStyle(body);
    const contentBounds = document
      .querySelector(".about-page-header")
      .getBoundingClientRect();
    const degrees = document.querySelector(".about-degrees-list");
    const degreeCards = [...document.querySelectorAll(".about-degree-card")];
    const degreeIcons = [...document.querySelectorAll(".about-degree-card img")];
    const degreeCopies = [...document.querySelectorAll(".about-degree-copy")];
    const degreeTypes = [...document.querySelectorAll(".about-degree-type")];
    const degreeFields = [...document.querySelectorAll(".about-degree-field")];
    const image = document.querySelector("#about-carousel-image");
    const socialLinks = [...document.querySelectorAll(".about-social-link")];
    const linkRects = socialLinks.map((link) => link.getBoundingClientRect());
    const socialLinksContainer = document.querySelector(".about-social-links");
    const articleSection = document.querySelector(".about-article-section");
    const article = document.querySelector(".about-article-copy");
    const quote = document.querySelector(".about-article-quote");
    const quoteStyle = getComputedStyle(quote);
    const quoteTextRects = [];
    const quoteTextWalker = document.createTreeWalker(quote, NodeFilter.SHOW_TEXT);
    while (quoteTextWalker.nextNode()) {
      const textNode = quoteTextWalker.currentNode;
      if (!textNode.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      quoteTextRects.push(...range.getClientRects());
    }
    return {
      article: rect(".about-article-copy"),
      articleHorizontalOverflow: article.scrollWidth > article.clientWidth + 1,
      articleSection: rect(".about-article-section"),
      body: rect("#about-window .about-body"),
      bodyClientHeight: body.clientHeight,
      bodyOverflowY: getComputedStyle(body).overflowY,
      bodyScrollHeight: body.scrollHeight,
      carousel: rect(".about-carousel"),
      carouselMedia: rect(".about-carousel-media"),
      carouselMediaOverflow: getComputedStyle(
        document.querySelector(".about-carousel-media")
      ).overflow,
      carouselMediaPadding: Number.parseFloat(
        getComputedStyle(document.querySelector(".about-carousel-media")).padding
      ),
      carouselObjectFit: getComputedStyle(image).objectFit,
      degreeCardHeights: degreeCards.map((card) => card.getBoundingClientRect().height),
      degreeIconContained: degreeIcons.every((icon) => {
        const iconBounds = icon.getBoundingClientRect();
        const cardBounds = icon.closest(".about-degree-card").getBoundingClientRect();
        return (
          iconBounds.left >= cardBounds.left - 0.6 &&
          iconBounds.right <= cardBounds.right + 0.6 &&
          iconBounds.top >= cardBounds.top - 0.6 &&
          iconBounds.bottom <= cardBounds.bottom + 0.6
        );
      }),
      degreeIconSizes: degreeIcons.map((icon) => {
        const bounds = icon.getBoundingClientRect();
        return { height: bounds.height, width: bounds.width };
      }),
      degreeCardToIconInsets: degreeCards.map((card) => {
        const cardBounds = card.getBoundingClientRect();
        const iconBounds = card.querySelector("img").getBoundingClientRect();
        return iconBounds.left - cardBounds.left;
      }),
      degreeCardToIconVerticalInsets: degreeCards.map((card) => {
        const cardBounds = card.getBoundingClientRect();
        const iconBounds = card.querySelector("img").getBoundingClientRect();
        return {
          bottom: cardBounds.bottom - iconBounds.bottom,
          top: iconBounds.top - cardBounds.top,
        };
      }),
      degreeIconToCopyGaps: degreeCards.map((card) => {
        const icon = card.querySelector("img").getBoundingClientRect();
        const copy = card.querySelector(".about-degree-copy").getBoundingClientRect();
        return copy.left - icon.right;
      }),
      degreeHorizontalOverflow: degrees.scrollWidth > degrees.clientWidth,
      degreeCopyUsesRows: degreeCopies.every((copy) => {
        const type = copy.querySelector(".about-degree-type").getBoundingClientRect();
        const field = copy.querySelector(".about-degree-field").getBoundingClientRect();
        return type.bottom <= field.top + 0.6;
      }),
      degreeLineGaps: degreeCopies.map((copy) => {
        const type = copy.querySelector(".about-degree-type").getBoundingClientRect();
        const field = copy.querySelector(".about-degree-field").getBoundingClientRect();
        return field.top - type.bottom;
      }),
      degreeLineHeightRatios: degreeCopies.map((copy) => {
        const style = getComputedStyle(copy);
        return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
      }),
      degreeTextFitsVertically: degreeCopies.every((copy) =>
        [...copy.children].every(
          (line) => line.scrollHeight <= line.clientHeight + 1
        )
      ),
      degreeFieldContained: degreeFields.every((field) => {
        const fieldBounds = field.getBoundingClientRect();
        const cardBounds = field.closest(".about-degree-card").getBoundingClientRect();
        return (
          fieldBounds.left >= cardBounds.left - 0.6 &&
          fieldBounds.right <= cardBounds.right + 0.6
        );
      }),
      degreeFieldTracksFullyVisible: degreeFields.every((field) => {
        const fieldBounds = field.getBoundingClientRect();
        const trackBounds = field
          .querySelector(".about-degree-field-track")
          .getBoundingClientRect();
        return (
          trackBounds.left >= fieldBounds.left - 0.6 &&
          trackBounds.right <= fieldBounds.right + 0.6
        );
      }),
      degreeFieldFontWeights: degreeFields.map((field) =>
        Number.parseInt(getComputedStyle(field).fontWeight, 10)
      ),
      degreeFieldOverflowCount: degreeFields.filter(
        (field) => field.scrollWidth > field.clientWidth + 1
      ).length,
      degreeFieldOverflowContract: degreeFields.every(
        (field) =>
          field.classList.contains("is-overflowing") ===
          (field.scrollWidth > field.clientWidth + 1)
      ),
      degreeFieldsManageOverflow: degreeFields.every(
        (field) =>
          field.scrollWidth <= field.clientWidth + 1 ||
          getComputedStyle(field).overflowX === "auto"
      ),
      degreeFieldAnimationCount: degreeFields.reduce(
        (count, field) =>
          count + field.querySelector(".about-degree-field-track").getAnimations().length,
        0
      ),
      degreeTypeAnimationCount: degreeTypes.reduce(
        (count, type) => count + type.getAnimations().length,
        0
      ),
      degreeTypeFontWeights: degreeTypes.map((type) =>
        Number.parseInt(getComputedStyle(type).fontWeight, 10)
      ),
      degreeTypesFit: degreeTypes.every((type) => type.scrollWidth <= type.clientWidth + 1),
      degreeVerticalOverflow: degrees.scrollHeight > degrees.clientHeight,
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
      introColumns: getComputedStyle(
        document.querySelector(".about-intro-grid")
      ).gridTemplateColumns,
      image: rect("#about-carousel-image"),
      imageNaturalHeight: image.naturalHeight,
      imageNaturalWidth: image.naturalWidth,
      linkTopSpread:
        Math.max(...linkRects.map(({ top }) => top)) -
        Math.min(...linkRects.map(({ top }) => top)),
      overview: rect(".about-overview-panel"),
      quote: rect(".about-article-quote"),
      quoteBorderInlineStart: Number.parseFloat(quoteStyle.borderInlineStartWidth),
      quoteChildLefts: [...quote.children].map(
        (child) => child.getBoundingClientRect().left
      ),
      quoteHorizontalOverflow: quote.scrollWidth > quote.clientWidth + 1,
      quotePaddingInlineStart: Number.parseFloat(quoteStyle.paddingInlineStart),
      quoteTextLeft: Math.min(...quoteTextRects.map(({ left }) => left)),
      quoteTextRight: Math.max(...quoteTextRects.map(({ right }) => right)),
      socialContentUsesRows: socialLinks.every((link) => {
        const icon = link.querySelector(".socials-logo").getBoundingClientRect();
        const copy = link.querySelector(".about-social-copy").getBoundingClientRect();
        const name = link.querySelector(".socials-name").getBoundingClientRect();
        const username = link.querySelector(".socials-username").getBoundingClientRect();
        return icon.right <= copy.left + 0.6 && name.bottom <= username.top + 0.6;
      }),
      socialContentContained: socialLinks.every((link) => {
        const card = link.getBoundingClientRect();
        const icon = link.querySelector(".socials-logo").getBoundingClientRect();
        const copy = link.querySelector(".about-social-copy").getBoundingClientRect();
        return (
          icon.left >= card.left - 0.6 &&
          icon.right <= card.right + 0.6 &&
          icon.top >= card.top - 0.6 &&
          icon.bottom <= card.bottom + 0.6 &&
          copy.left >= card.left - 0.6 &&
          copy.right <= card.right + 0.6 &&
          copy.top >= card.top - 0.6 &&
          copy.bottom <= card.bottom + 0.6
        );
      }),
      socialCardHeightSpread:
        Math.max(...linkRects.map(({ height }) => height)) -
        Math.min(...linkRects.map(({ height }) => height)),
      socialHorizontalOverflow:
        socialLinksContainer.scrollWidth > socialLinksContainer.clientWidth,
      socialColumnCount: new Set(linkRects.map(({ left }) => Math.round(left))).size,
      socialRowCount: new Set(linkRects.map(({ top }) => Math.round(top))).size,
      taskbar: rect(".taskbar"),
      visibleLeftInset:
        Number.parseFloat(bodyStyle.marginLeft) +
        contentBounds.left -
        (bodyBounds.left + body.clientLeft),
      visibleRightInset:
        bodyBounds.left + body.clientLeft + body.clientWidth - contentBounds.right,
      window: rect("#about-window"),
    };
  });

test("About Me is complete, scrollable, and responsive", async ({ page }, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 800 });
  await prepareAboutPage(page);

  const aboutWindow = page.locator("#about-window");
  const aboutBody = aboutWindow.locator(".about-body");
  await expect(aboutWindow).toBeVisible();
  await expect(aboutWindow).toHaveRole("dialog");
  await expect(aboutWindow).toHaveAccessibleName("About Me");
  await expect(page.locator(".about-title")).toHaveText("Welcome to my Website!");
  await expect(page.locator("#about-current-date")).toHaveText(
    "Monday the 27th, July 2026"
  );
  await expect(page.locator("#about-current-date")).toHaveAttribute(
    "datetime",
    "2026-07-27"
  );
  const websiteDescription = await page.locator(".about-website-section p").evaluate(
    (paragraph) => ({
      breakCount: paragraph.querySelectorAll("br").length,
      text: paragraph.innerText,
    })
  );
  expect(websiteDescription).toEqual({
    breakCount: 1,
    text:
      "Welcome to my personal website! I wanted to make something unique & playful that would give me a reason to come back to often (and hopefully you too!) while also keeping record of a few things I’m proud of in one place. Enjoy your stay :)\n—Rohin",
  });

  const image = page.locator("#about-carousel-image");
  await expect(image).toHaveAttribute(
    "alt",
    "Portrait of Rohin Shanker in front of red rock formations"
  );
  await expect
    .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
    .toBe(true);
  await expect(page.locator(".about-carousel-media")).not.toHaveAttribute(
    "aria-busy",
    "true"
  );
  await expect(page.locator("#about-carousel-counter")).toHaveText("1 of 9");
  await expect(page.locator("#about-carousel-prev")).toBeEnabled();
  await expect(page.locator("#about-carousel-next")).toBeEnabled();

  const readCarouselGeometry = () =>
    page.evaluate(() => {
      const bounds = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return {
          bottom: box.bottom,
          height: box.height,
          left: box.left,
          right: box.right,
          top: box.top,
          width: box.width,
        };
      };
      const media = document.querySelector(".about-carousel-media");
      const carouselImage = document.querySelector("#about-carousel-image");
      return {
        carousel: bounds(".about-carousel"),
        image: bounds("#about-carousel-image"),
        media: bounds(".about-carousel-media"),
        mediaOverflow: getComputedStyle(media).overflow,
        mediaPadding: Number.parseFloat(getComputedStyle(media).padding),
        naturalHeight: carouselImage.naturalHeight,
        naturalWidth: carouselImage.naturalWidth,
        objectFit: getComputedStyle(carouselImage).objectFit,
      };
    });

  const baselineCarousel = await readCarouselGeometry();
  await page.locator(".about-carousel").screenshot({
    path: testInfo.outputPath("about-carousel-01.png"),
  });
  for (let index = 1; index < expectedCarouselImages.length; index += 1) {
    const item = expectedCarouselImages[index];
    await page.locator("#about-carousel-next").click();
    await expect(image).toHaveAttribute("src", item.src);
    await expect(image).toHaveAttribute("alt", item.alt);
    await expect
      .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
      .toBe(true);
    await expect(page.locator(".about-carousel-media")).not.toHaveAttribute(
      "aria-busy",
      "true"
    );
    await expect(page.locator(".about-carousel .gallery-loading-indicator")).toBeHidden();
    await expect(page.locator("#about-carousel-counter")).toHaveText(
      `${index + 1} of ${expectedCarouselImages.length}`
    );

    const geometry = await readCarouselGeometry();
    expect(geometry.carousel.width).toBeCloseTo(baselineCarousel.carousel.width, 1);
    expect(geometry.carousel.height).toBeCloseTo(baselineCarousel.carousel.height, 1);
    expect(geometry.media.width).toBeCloseTo(baselineCarousel.media.width, 1);
    expect(geometry.media.height).toBeCloseTo(baselineCarousel.media.height, 1);
    expect(geometry.image.left).toBeCloseTo(
      geometry.media.left + geometry.mediaPadding,
      1
    );
    expect(geometry.image.right).toBeCloseTo(
      geometry.media.right - geometry.mediaPadding,
      1
    );
    expect(geometry.image.top).toBeCloseTo(
      geometry.media.top + geometry.mediaPadding,
      1
    );
    expect(geometry.image.bottom).toBeCloseTo(
      geometry.media.bottom - geometry.mediaPadding,
      1
    );
    expect(geometry.mediaOverflow).toBe("hidden");
    expect(geometry.objectFit).toBe("contain");
    expect(geometry.naturalWidth).toBeGreaterThan(0);
    expect(geometry.naturalHeight).toBeGreaterThan(0);
    await page.locator(".about-carousel").screenshot({
      path: testInfo.outputPath(
        `about-carousel-${String(index + 1).padStart(2, "0")}.png`
      ),
    });
  }

  await page.locator("#about-carousel-next").click();
  await expect(image).toHaveAttribute("src", expectedCarouselImages[0].src);
  await expect(page.locator("#about-carousel-counter")).toHaveText("1 of 9");
  await page.locator("#about-carousel-prev").click();
  await expect(image).toHaveAttribute("src", expectedCarouselImages.at(-1).src);
  await expect(page.locator("#about-carousel-counter")).toHaveText("9 of 9");
  await page.locator("#about-carousel-next").click();
  await expect(image).toHaveAttribute("src", expectedCarouselImages[0].src);

  await expect(page.locator(".about-degree-card")).toHaveCount(4);
  await expect(page.locator("#about-institution-one")).toHaveText(
    "Yale University (2026-2027)"
  );
  await expect(page.locator("#about-institution-two")).toHaveText(
    "University of California, Berkeley (2022-2026)"
  );
  await expect(page.getByRole("region", { name: "Academic degrees" })).toBeVisible();
  await expect(page.locator(".about-degree-type")).toHaveText([
    "Master of Science",
    "Bachelor of Science",
    "Bachelor of Science",
    "Certificate",
  ]);
  expect(
    await page.locator(".about-degree-field").evaluateAll((fields) =>
      fields.every((field) => Boolean(field.getAttribute("title")))
    )
  ).toBe(true);
  await expect(page.locator(".about-degree-field-track")).toHaveText([
    "Biomedical Engineering",
    "Electrical Engineering & Computer Science (EECS)",
    "Bioengineering",
    "Entrepreneurship & Technology (SCET)",
  ]);
  const degreeIcons = page.locator(".about-degree-card img");
  await expect(degreeIcons).toHaveCount(4);
  for (const [index, source] of [
    "assets/app-icons/ico/certificate_gear.ico",
    "assets/app-icons/ico/certificate.ico",
    "assets/app-icons/ico/certificate.ico",
    "assets/app-icons/ico/certificate_seal.ico",
  ].entries()) {
    await expect(degreeIcons.nth(index)).toHaveAttribute("src", source);
    await expect(degreeIcons.nth(index)).toHaveAttribute("alt", "");
  }
  const longestDegree = page.locator(".about-degree-field").nth(1);
  await expect(longestDegree).toHaveAttribute("tabindex", "-1");
  await expect(longestDegree).toHaveCSS("overflow-x", "hidden");
  await expect
    .poll(() =>
      longestDegree.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    )
    .toBe(true);
  const degreeList = page.locator(".about-degrees-list");
  await degreeList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => degreeList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.locator(".about-intro-grid").screenshot({
    path: testInfo.outputPath("about-degree-icons-bottom.png"),
  });
  await degreeList.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page.locator("#about-article-date")).toHaveValue("30-07-2026");
  await expect(page.locator("#about-article-date option")).toHaveText("30/07/2026");
  await expect(page.locator("#about-article-copy > p")).toHaveCount(7);
  await expect(page.locator(".about-article-quote")).toHaveCount(1);
  await expect(page.locator(".about-article-quote strong")).toContainText(
    "When a tree is growing, it’s tender and pliant."
  );
  await expect(page.locator(".about-article-quote-source")).toHaveText("—Andrei Tarkovsky");
  const signature = page.locator(".about-signature");
  await expect(signature).toHaveAttribute("src", "assets/about-signature.png");
  await expect(signature).toHaveAttribute("alt", "Rohin S. Shanker handwritten signature");
  await expect
    .poll(() => signature.evaluate((element) => element.complete && element.naturalWidth === 1404))
    .toBe(true);
  const signatureAlpha = await signature.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(element, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const alphaAt = (x, y) => pixels[(y * canvas.width + x) * 4 + 3];
    let visiblePixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) visiblePixels += 1;
    }
    return {
      corners: [
        alphaAt(0, 0),
        alphaAt(canvas.width - 1, 0),
        alphaAt(0, canvas.height - 1),
        alphaAt(canvas.width - 1, canvas.height - 1),
      ],
      visiblePixels,
    };
  });
  expect(signatureAlpha.corners).toEqual([0, 0, 0, 0]);
  expect(signatureAlpha.visiblePixels).toBeGreaterThan(10_000);
  await expect(page.locator(".about-signoff")).toContainText("Yours Truly,");
  await expect(page.locator(".about-signoff")).toContainText("Rohin Shanker");

  const socialCards = page.locator(".about-social-link");
  await expect(socialCards).toHaveCount(6);
  const links = page.locator("a.about-social-link");
  await expect(links).toHaveCount(expectedLinks.length);
  for (const [index, [label, username, href, icon]] of expectedLinks.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveAccessibleName(`${label} ${username}`);
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link.locator(".socials-name")).toHaveText(label);
    await expect(link.locator(".socials-username")).toHaveText(username);
    await expect(link.locator(".socials-logo")).toHaveAttribute(
      "src",
      new RegExp(`${icon.replace(".", "\\.")}$`)
    );
  }

  const linkedIn = links.first();
  const restingBackground = await linkedIn.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );
  await linkedIn.hover();
  await expect
    .poll(() => linkedIn.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(restingBackground);
  await expect
    .poll(() => linkedIn.evaluate((element) => getComputedStyle(element).color))
    .toBe("rgb(255, 255, 255)");

  const socialsLauncher = page.locator(".about-social-launcher");
  const socialsWindow = page.locator("#socials-window");
  await expect(socialsLauncher).toHaveAccessibleName("Socials See All");
  await expect(socialsLauncher).toHaveAttribute("data-app", "socials");
  await expect(socialsLauncher).toHaveAttribute("aria-controls", "socials-window");
  await expect(socialsLauncher).toHaveAttribute("aria-haspopup", "dialog");
  await expect(socialsLauncher.locator(".socials-logo")).toHaveAttribute(
    "src",
    "assets/app-icons/ico/connected_world.ico"
  );
  await expect(socialsWindow).toBeHidden();

  await socialsLauncher.click();
  await expect(socialsWindow).toBeVisible();
  await expect(socialsWindow).not.toHaveClass(/is-opening/);
  await expect(socialsWindow).toHaveRole("dialog");
  await expect(socialsWindow).toHaveAccessibleName("Socials");
  await expect(socialsWindow).toContainText("Find me here:");
  await expect(socialsWindow.locator(".socials-list .socials-logo").first()).toHaveAttribute(
    "src",
    "assets/app-icons/ico/users_green.ico"
  );
  const settledSocialsBounds = await socialsWindow.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const taskbar = document.querySelector(".taskbar").getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      left: bounds.left,
      right: bounds.right,
      taskbarTop: taskbar.top,
      top: bounds.top,
    };
  });
  expect(settledSocialsBounds.left).toBeGreaterThanOrEqual(0);
  expect(settledSocialsBounds.right).toBeLessThanOrEqual(1280);
  expect(settledSocialsBounds.top).toBeGreaterThanOrEqual(0);
  expect(settledSocialsBounds.bottom).toBeLessThanOrEqual(
    settledSocialsBounds.taskbarTop
  );
  await page.screenshot({ path: testInfo.outputPath("about-socials-window-open.png") });
  await socialsWindow.getByRole("button", { name: "Close" }).click();
  await expect(socialsWindow).toBeHidden();

  for (const key of ["Enter", "Space"]) {
    await socialsLauncher.focus();
    await socialsLauncher.press(key);
    await expect(socialsWindow).toBeVisible();
    await socialsWindow.getByRole("button", { name: "Close" }).click();
    await expect(socialsWindow).toBeHidden();
  }

  await page.evaluate(() => {
    window.__aboutLinkClicks = [];
    document.querySelector(".about-social-links").addEventListener(
      "click",
      (event) => {
        const link = event.target.closest("a[href]");
        if (!link) return;
        event.preventDefault();
        window.__aboutLinkClicks.push(link.getAttribute("href"));
      },
      { capture: true }
    );
  });
  for (const link of await links.all()) await link.click();
  expect(await page.evaluate(() => window.__aboutLinkClicks)).toEqual(
    expectedLinks.map(([, , href]) => href)
  );
  await page.mouse.move(0, 0);
  await aboutBody.focus();

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await page.evaluate(() => document.activeElement?.blur());
      await aboutBody.evaluate((element) => {
        element.scrollTop = 0;
      });
      await expect
        .poll(() =>
          page.locator(".about-degree-field").evaluateAll((fields) =>
            fields.every(
              (field) =>
                field.classList.contains("is-overflowing") ===
                (field.scrollWidth > field.clientWidth + 1)
            )
          )
        )
        .toBe(true);
      await aboutBody.evaluate((element) => {
        element.scrollTop = 0;
      });

      const metrics = await aboutMetrics(page);
      expect(metrics.documentOverflow).toBe(false);
      expect(metrics.window.left).toBeGreaterThanOrEqual(11.5);
      expect(metrics.window.right).toBeLessThanOrEqual(viewport.width - 11.5);
      expect(metrics.window.width).toBeCloseTo(Math.min(viewport.width - 24, 720), 0);
      expect(metrics.window.top).toBeGreaterThanOrEqual(9.5);
      expect(metrics.window.bottom).toBeLessThanOrEqual(metrics.taskbar.top - 7.5);
      expect(metrics.bodyOverflowY).toBe("auto");
      expect(metrics.bodyClientHeight).toBeCloseTo(
        Math.min(viewport.height * 0.79, 750, viewport.height - 116),
        0
      );
      expect(metrics.bodyScrollHeight).toBeGreaterThan(metrics.bodyClientHeight);
      expect(metrics.articleHorizontalOverflow).toBe(false);
      expect(metrics.quoteHorizontalOverflow).toBe(false);
      const expectedArticleRatio = viewport.width <= 744 ? 1 : 0.75;
      expect(metrics.article.width / metrics.articleSection.width).toBeCloseTo(
        expectedArticleRatio,
        2
      );
      expect(metrics.article.left - metrics.articleSection.left).toBeCloseTo(
        metrics.articleSection.right - metrics.article.right,
        1
      );
      const quoteBorderEdge = metrics.quote.left + metrics.quoteBorderInlineStart;
      expect(metrics.quotePaddingInlineStart).toBeCloseTo(20, 1);
      expect(metrics.quoteTextLeft - quoteBorderEdge).toBeGreaterThanOrEqual(19.5);
      expect(metrics.quoteTextRight).toBeLessThanOrEqual(metrics.quote.right + 0.6);
      for (const childLeft of metrics.quoteChildLefts) {
        expect(childLeft - quoteBorderEdge).toBeGreaterThanOrEqual(19.5);
      }
      expect(metrics.degreeHorizontalOverflow).toBe(false);
      expect(metrics.degreeIconContained).toBe(true);
      expect(metrics.degreeIconSizes).toHaveLength(4);
      for (const icon of metrics.degreeIconSizes) {
        expect(icon.width).toBeCloseTo(32, 1);
        expect(icon.height).toBeCloseTo(32, 1);
      }
      for (const inset of metrics.degreeCardToIconInsets) {
        expect(inset).toBeCloseTo(6, 1);
      }
      for (const inset of metrics.degreeCardToIconVerticalInsets) {
        expect(inset.top).toBeCloseTo(8, 1);
        expect(inset.bottom).toBeCloseTo(8, 1);
      }
      for (const gap of metrics.degreeIconToCopyGaps) {
        expect(gap).toBeCloseTo(4, 1);
      }
      for (const cardHeight of metrics.degreeCardHeights) {
        expect(cardHeight).toBeCloseTo(48, 1);
      }
      expect(metrics.degreeCopyUsesRows).toBe(true);
      for (const gap of metrics.degreeLineGaps) {
        expect(gap).toBeCloseTo(0, 1);
      }
      for (const ratio of metrics.degreeLineHeightRatios) {
        expect(ratio).toBeCloseTo(1.2, 1);
      }
      expect(metrics.degreeTextFitsVertically).toBe(true);
      expect(metrics.degreeFieldContained).toBe(true);
      expect(metrics.degreeFieldTracksFullyVisible).toBe(true);
      expect(metrics.degreeFieldOverflowContract).toBe(true);
      expect(metrics.degreeFieldsManageOverflow).toBe(true);
      expect(metrics.degreeTypeAnimationCount).toBe(0);
      expect(metrics.degreeFieldAnimationCount).toBe(0);
      expect(metrics.degreeTypesFit).toBe(true);
      expect(metrics.degreeTypeFontWeights.every((weight) => weight >= 600)).toBe(true);
      expect(metrics.degreeFieldFontWeights.every((weight) => weight < 600)).toBe(true);
      expect(metrics.degreeFieldOverflowCount).toBe(0);
      expect(metrics.socialContentUsesRows).toBe(true);
      expect(metrics.socialContentContained).toBe(true);
      expect(metrics.socialCardHeightSpread).toBeLessThan(0.6);
      expect(metrics.socialHorizontalOverflow).toBe(false);
      expect(metrics.socialColumnCount).toBe(3);
      expect(metrics.socialRowCount).toBe(2);
      expect(metrics.visibleLeftInset).toBeCloseTo(10, 1);
      expect(metrics.visibleRightInset).toBeCloseTo(10, 1);
      expect(Math.abs(metrics.visibleLeftInset - metrics.visibleRightInset)).toBeLessThan(0.6);
      expect(metrics.carouselMediaOverflow).toBe("hidden");
      expect(metrics.carouselMediaPadding).toBeCloseTo(2, 1);
      expect(metrics.carouselObjectFit).toBe("contain");
      expect(metrics.image.left).toBeGreaterThanOrEqual(
        metrics.carouselMedia.left + metrics.carouselMediaPadding - 0.5
      );
      expect(metrics.image.right).toBeLessThanOrEqual(
        metrics.carouselMedia.right - metrics.carouselMediaPadding + 0.5
      );
      expect(metrics.image.top).toBeGreaterThanOrEqual(
        metrics.carouselMedia.top + metrics.carouselMediaPadding - 0.5
      );
      expect(metrics.image.bottom).toBeLessThanOrEqual(
        metrics.carouselMedia.bottom - metrics.carouselMediaPadding + 0.5
      );

      expect(metrics.linkTopSpread).toBeGreaterThan(1);

      if (viewport.width <= 744) {
        expect(metrics.introColumns.trim().split(/\s+/)).toHaveLength(1);
        expect(metrics.overview.top).toBeGreaterThanOrEqual(metrics.carousel.bottom + 11);
        expect(metrics.degreeVerticalOverflow).toBe(false);
      } else {
        expect(metrics.introColumns.trim().split(/\s+/)).toHaveLength(2);
        expect(metrics.overview.left).toBeGreaterThanOrEqual(metrics.carousel.right + 11);
        expect(Math.abs(metrics.overview.top - metrics.carousel.top)).toBeLessThan(1);
        expect(Math.abs(metrics.overview.bottom - metrics.carousel.bottom)).toBeLessThan(1);
        expect(metrics.carousel.width).toBeGreaterThan(298);
        expect(metrics.carousel.width).toBeLessThanOrEqual(350.5);
        expect(metrics.carousel.height).toBeGreaterThan(308);
        expect(metrics.carousel.height).toBeLessThan(370);
        expect(metrics.image.width).toBeGreaterThan(274);
        expect(metrics.image.width).toBeLessThan(340);
        expect(metrics.overview.width / metrics.carousel.width).toBeGreaterThan(0.97);
        expect(metrics.overview.width / metrics.carousel.width).toBeLessThan(1);
        expect(metrics.degreeVerticalOverflow).toBe(true);
      }

      await expect
        .poll(() => aboutBody.evaluate((element) => element.scrollTop))
        .toBeLessThanOrEqual(10);
      await expect(page.locator(".about-title")).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath(`about-me-${viewport.name}-top.png`),
      });
      await page.locator(".about-socials-section").screenshot({
        path: testInfo.outputPath(`about-social-grid-${viewport.name}.png`),
      });

      await aboutBody.focus();
      await aboutBody.press("End");
      await expect.poll(() => aboutBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.locator(".about-signoff")).toBeInViewport();

      await page.screenshot({
        path: testInfo.outputPath(`about-me-${viewport.name}.png`),
      });
      await page.evaluate(() => {
        document.activeElement?.blur();
        document.querySelector("#about-window .about-body").scrollTop = 0;
      });
    });
  }

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("About degree marquee moves only overflowing field lines with one-second endpoint dwells", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 800 });
  await prepareAboutPage(page, { reducedMotion: "no-preference" });

  const fields = page.locator(".about-degree-field");
  const tracks = page.locator(".about-degree-field-track");
  const eecsField = fields.nth(1);
  const eecsTrack = tracks.nth(1);
  const bioengineeringTrack = tracks.nth(2);

  await eecsField.evaluate((field) => {
    field.closest(".about-degree-copy").style.width = "180px";
  });

  await expect(eecsField).toHaveClass(/is-overflowing/);
  await expect.poll(() => eecsTrack.evaluate((track) => track.getAnimations().length)).toBe(1);
  await expect
    .poll(() => bioengineeringTrack.evaluate((track) => track.getAnimations().length))
    .toBe(0);
  expect(
    await page.locator(".about-degree-type").evaluateAll((types) =>
      types.every((type) => type.getAnimations().length === 0)
    )
  ).toBe(true);

  const overflowingFields = page.locator(".about-degree-field.is-overflowing");
  const overflowingFieldCount = await overflowingFields.count();
  expect(overflowingFieldCount).toBeGreaterThan(0);
  for (let index = 0; index < overflowingFieldCount; index += 1) {
    const field = overflowingFields.nth(index);
    const track = field.locator(".about-degree-field-track");
    await expect
      .poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState))
      .toBe("running");
    await field.hover();
    await expect
      .poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState))
      .toBe("paused");
    const pausedTime = await track.evaluate(
      (element) => Number(element.getAnimations()[0].currentTime)
    );
    await page.waitForTimeout(120);
    const stillPausedTime = await track.evaluate(
      (element) => Number(element.getAnimations()[0].currentTime)
    );
    expect(Math.abs(stillPausedTime - pausedTime)).toBeLessThan(8);
    await page.mouse.move(0, 0);
    await expect
      .poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState))
      .toBe("running");
    await expect
      .poll(
        () =>
          track.evaluate(
            (element, startTime) =>
              Number(element.getAnimations()[0]?.currentTime) > startTime + 16,
            pausedTime
          )
      )
      .toBe(true);
  }

  const timing = await eecsTrack.evaluate((track) => {
    const animation = track.getAnimations()[0];
    animation.pause();
    const effect = animation.effect;
    const duration = Number(effect.getTiming().duration);
    const keyframes = effect.getKeyframes();
    const translations = keyframes.map((keyframe) =>
      new DOMMatrixReadOnly(keyframe.transform).m41
    );
    const viewport = track.closest(".about-degree-field");
    animation.currentTime = duration * ((keyframes[2].offset + keyframes[3].offset) / 2);
    return {
      distance: Math.ceil(track.scrollWidth - viewport.clientWidth),
      duration,
      endDwell: duration * (keyframes[3].offset - keyframes[2].offset),
      forwardTravel: duration * (keyframes[2].offset - keyframes[1].offset),
      offsets: keyframes.map((keyframe) => keyframe.offset),
      returnTravel: duration * (keyframes[4].offset - keyframes[3].offset),
      startDwell: duration * (keyframes[1].offset - keyframes[0].offset),
      translations,
    };
  });

  expect(timing.offsets).toHaveLength(5);
  expect(timing.startDwell).toBeCloseTo(1000, 3);
  expect(timing.endDwell).toBeCloseTo(1000, 3);
  expect(timing.forwardTravel).toBeCloseTo(timing.returnTravel, 3);
  expect(timing.translations[0]).toBeCloseTo(0, 3);
  expect(timing.translations[1]).toBeCloseTo(0, 3);
  expect(timing.translations[2]).toBeCloseTo(-timing.distance, 3);
  expect(timing.translations[3]).toBeCloseTo(-timing.distance, 3);
  expect(timing.translations[4]).toBeCloseTo(0, 3);
  await page.locator(".about-degree-card").nth(1).screenshot({
    path: testInfo.outputPath("about-degree-marquee-end.png"),
  });

  await eecsField.focus();
  await expect.poll(() => eecsTrack.evaluate((track) => track.getAnimations().length)).toBe(0);
  for (let step = 0; step < 6; step += 1) await eecsField.press("ArrowRight");
  await expect.poll(() => eecsField.evaluate((field) => field.scrollLeft)).toBeGreaterThan(0);
  await page.evaluate(() => document.activeElement?.blur());
  await expect.poll(() => eecsTrack.evaluate((track) => track.getAnimations().length)).toBe(1);

  await eecsField.evaluate((field) => {
    field.closest(".about-degree-copy").style.width = "";
  });
  await expect(eecsField).not.toHaveClass(/is-overflowing/);
  await expect.poll(() => eecsTrack.evaluate((track) => track.getAnimations().length)).toBe(0);

  await page.locator(".about-degree-copy").evaluateAll((copies) => {
    copies.forEach((copy) => {
      copy.style.width = "36px";
    });
  });
  await expect(page.locator(".about-degree-type")).toHaveText([
    "M.S.",
    "B.S.",
    "B.S.",
    "Cert.",
  ]);
  expect(
    await page.locator(".about-degree-type").evaluateAll((types) =>
      types.every((type) => type.scrollWidth <= type.clientWidth + 1)
    )
  ).toBe(true);
  await page.locator(".about-degree-copy").evaluateAll((copies) => {
    copies.forEach((copy) => {
      copy.style.width = "";
    });
  });
  await expect(page.locator(".about-degree-type")).toHaveText([
    "Master of Science",
    "Bachelor of Science",
    "Bachelor of Science",
    "Certificate",
  ]);

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("About degree cards scroll without growing past the photo", async ({ page }) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 800 });
  await prepareAboutPage(page);

  const before = await aboutMetrics(page);
  await page.evaluate(() => {
    const list = document.querySelector(".about-institution ul");
    const template = list.querySelector(".about-degree-card");
    for (let index = 0; index < 12; index += 1) {
      const card = template.cloneNode(true);
      const field = card.querySelector(".about-degree-field");
      const track = card.querySelector(".about-degree-field-track");
      const label =
        `Long placeholder degree ${index + 1} with an additional concentration and certificate`;
      field.setAttribute("aria-label", label);
      field.setAttribute("title", label);
      track.textContent = label;
      list.appendChild(card);
    }
  });

  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

  const after = await aboutMetrics(page);
  expect(Math.abs(after.overview.height - before.overview.height)).toBeLessThan(1);
  expect(Math.abs(after.overview.bottom - after.carousel.bottom)).toBeLessThan(1);
  expect(after.degreeHorizontalOverflow).toBe(false);

  const degrees = page.locator(".about-degrees-list");
  const degreeScroll = await degrees.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(degreeScroll.scrollHeight).toBeGreaterThan(degreeScroll.clientHeight);
  await degrees.focus();
  await degrees.press("End");
  await expect.poll(() => degrees.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const horizontallyContained = await page.locator(".about-degree-card").evaluateAll((cards) => {
    const bounds = document.querySelector(".about-degrees-list").getBoundingClientRect();
    return cards.every((card) => {
      const rect = card.getBoundingClientRect();
      return rect.left >= bounds.left - 0.6 && rect.right <= bounds.right + 0.6;
    });
  });
  expect(horizontallyContained).toBe(true);
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
