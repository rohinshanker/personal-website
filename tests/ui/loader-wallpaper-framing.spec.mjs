import { expect, test } from "./deterministic.mjs";

// The loader wallpaper is wide enough that `cover` fits common screens by height, so the rays
// at the top and the mountains at the bottom both stay in frame. Anchoring it left keeps the
// rays above the dialog; anchoring it to the bottom keeps the mountains on wider screens.
const viewports = [
  { width: 375, height: 812, fullHeight: true },
  { width: 1280, height: 800, fullHeight: true },
  { width: 1920, height: 1080, fullHeight: true },
  { width: 2560, height: 1080, fullHeight: false },
];

for (const viewport of viewports) {
  test(`loader wallpaper keeps rays and mountains in frame at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const layers = await page.evaluate(() =>
      [document.body, document.querySelector(".loader")].map((element) => {
        const style = getComputedStyle(element);
        return {
          image: style.backgroundImage,
          position: style.backgroundPosition,
          size: style.backgroundSize,
        };
      }),
    );
    for (const layer of layers) {
      expect(layer.image).toContain("assets/mountain-and-sky.png");
      expect(layer.position).toBe("0% 100%");
      expect(layer.size).toBe("cover");
    }

    const natural = await page.evaluate(async () => {
      const image = new Image();
      image.src = "assets/mountain-and-sky.png";
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
    const fitsByHeight = viewport.width / viewport.height <= natural.width / natural.height;
    expect(fitsByHeight).toBe(viewport.fullHeight);

    const dialog = await page.locator(".loader-window").boundingBox();
    expect(dialog).not.toBeNull();
    expect(Math.abs(dialog.x + dialog.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(dialog.y + dialog.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  });
}
