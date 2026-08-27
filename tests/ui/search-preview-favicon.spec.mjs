import { expect, test } from "@playwright/test";

const description = "My personal website. Best enjoyed on desktop…";

for (const route of ["/", "/home.html"]) {
  test(`${route} publishes its search preview and favicon metadata`, async ({ page }) => {
    await page.goto(route);

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      description
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      description
    );
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      description
    );
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
      "href",
      "/assets/favicon-96.png"
    );
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("sizes", "96x96");
  });
}

test("favicon assets load as square images with transparent padding", async ({
  page,
  request,
}) => {
  await page.goto("/");

  for (const path of [
    "/assets/favicon-96.png",
    "/assets/apple-touch-icon-180.png",
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }

  const assets = await page.evaluate(async () => {
    const inspectImage = async (path) => {
      const image = new Image();
      image.src = path;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);

      return {
        alphaAtTopLeft: context.getImageData(0, 0, 1, 1).data[3],
        height: image.naturalHeight,
        path,
        width: image.naturalWidth,
      };
    };

    return Promise.all([
      inspectImage("/assets/favicon-96.png"),
      inspectImage("/assets/apple-touch-icon-180.png"),
    ]);
  });

  expect(assets).toEqual([
    {
      alphaAtTopLeft: 0,
      height: 96,
      path: "/assets/favicon-96.png",
      width: 96,
    },
    {
      alphaAtTopLeft: 0,
      height: 180,
      path: "/assets/apple-touch-icon-180.png",
      width: 180,
    },
  ]);
});
