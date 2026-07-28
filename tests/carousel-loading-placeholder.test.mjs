import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const readGifDimensions = (gif) => ({
  width: gif.readUInt16LE(6),
  height: gif.readUInt16LE(8),
});

const skipGifSubBlocks = (gif, offset) => {
  let nextOffset = offset;
  while (nextOffset < gif.length) {
    const size = gif[nextOffset];
    nextOffset += 1;
    if (size === 0) return nextOffset;
    nextOffset += size;
  }
  throw new Error("Unterminated GIF data block");
};

const readGifDurationCentiseconds = (gif) => {
  assert.equal(gif.subarray(0, 6).toString("ascii"), "GIF89a");
  const hasGlobalColorTable = (gif[10] & 0x80) !== 0;
  const globalColorTableSize = hasGlobalColorTable ? 3 * 2 ** ((gif[10] & 0x07) + 1) : 0;
  let offset = 13 + globalColorTableSize;
  let pendingDelay = 0;
  let totalDelay = 0;

  while (offset < gif.length) {
    const marker = gif[offset];
    offset += 1;
    if (marker === 0x3b) return totalDelay;
    if (marker === 0x21) {
      const label = gif[offset];
      offset += 1;
      if (label === 0xf9) {
        assert.equal(gif[offset], 4);
        pendingDelay = gif.readUInt16LE(offset + 2);
        offset += 6;
      } else {
        const blockSize = gif[offset];
        offset += 1 + blockSize;
        offset = skipGifSubBlocks(gif, offset);
      }
      continue;
    }
    if (marker !== 0x2c) throw new Error(`Unexpected GIF block: ${marker}`);

    const imagePackedFields = gif[offset + 8];
    offset += 9;
    if ((imagePackedFields & 0x80) !== 0) {
      offset += 3 * 2 ** ((imagePackedFields & 0x07) + 1);
    }
    offset += 1;
    offset = skipGifSubBlocks(gif, offset);
    totalDelay += pendingDelay;
    pendingDelay = 0;
  }

  throw new Error("GIF trailer was not found");
};

test("gallery image loads use a local hourglass overlay instead of stale or empty media", async () => {
  const [main, media, styles, home, index, rawGif, paddedGif] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("scripts/home/core/media.js", root), "utf8"),
    readFile(new URL("styles/home/portfolio.css", root), "utf8"),
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("assets/loading/windows98-hourglass-2x.gif", root)),
    readFile(new URL("assets/loading/windows98-hourglass-padded-2x.gif", root)),
  ]);

  assert.match(main, /GALLERY_LOADING_RAW_ASSET = "assets\/loading\/windows98-hourglass-2x\.gif"/);
  assert.match(
    main,
    /GALLERY_LOADING_PADDED_ASSET =\s+"assets\/loading\/windows98-hourglass-padded-2x\.gif"/
  );
  assert.match(main, /const setGalleryImageLoading = \(image, isLoading\) =>/);
  assert.match(main, /image\.addEventListener\("load", finish, \{ once: true \}\)/);
  assert.match(main, /image\.addEventListener\("error", finish, \{ once: true \}\)/);
  assert.match(main, /if \(image\.complete\) queueMicrotask\(finish\)/);
  assert.match(main, /window\.homeGallery = \{[\s\S]*?loadImage: loadGalleryImage/);
  assert.match(main, /const setGalleryImageSource[\s\S]*?loadGalleryImage\(image, src\)/);
  assert.match(
    main,
    /const updateBerserkPosterImage[\s\S]*?setGalleryImageSource\(berserkPosterImage/
  );
  assert.match(
    main,
    /scroll\.replaceChildren\(currentMedia\);[\s\S]{0,180}loadGalleryImage\(currentMedia, source\)/
  );
  assert.match(
    media,
    /galleryScroll && window\.homeGallery\?\.loadImage[\s\S]{0,120}window\.homeGallery\.loadImage\(element, element\.dataset\.src\)/
  );

  assert.match(
    styles,
    /\.gallery-scroll \{[\s\S]*?--gallery-content-inset: 2px;[\s\S]*?padding: var\(--gallery-content-inset\);[\s\S]*?position: relative;/
  );
  assert.match(
    styles,
    /\.gallery-loading-indicator \{[\s\S]*?background: #fff;[\s\S]*?inset: var\(--gallery-content-inset\);[\s\S]*?position: absolute;/
  );
  assert.match(styles, /\.gallery-loading-indicator__image \{[\s\S]*?object-fit: cover !important;/);
  assert.match(
    styles,
    /\.gallery-loading-indicator--compact \.gallery-loading-indicator__image \{[\s\S]*?object-fit: contain !important;/
  );

  for (const source of [home, index]) {
    assert.match(source, /media-priority-loader-20260723/);
  }

  assert.deepEqual(readGifDimensions(rawGif), { width: 258, height: 272 });
  assert.deepEqual(readGifDimensions(paddedGif), { width: 1024, height: 1024 });
  assert.equal(readGifDurationCentiseconds(rawGif), 232);
  assert.equal(readGifDurationCentiseconds(paddedGif), 232);
});
