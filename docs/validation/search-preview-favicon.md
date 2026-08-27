# Search Preview and Favicon

Purpose: Keep homepage search descriptions and favicon signals consistent, crawlable, and regression-tested.

Scope: `/`, `/home.html`, homepage social and `WebSite` metadata, loader snippet exclusions, and square favicon assets.

Last verified: 2026-08-27

## Contract

- `index.html` and `home.html` publish the same `meta[name="description"]`, Open Graph description, Twitter description, and JSON-LD `WebSite.description`.
- The JSON-LD `Person.description` remains a distinct biography and must not be replaced by the site description.
- The entry loader and alert text remain inside valid `data-nosnippet` containers so transient operating-system copy is not eligible for a Google result snippet.
- Both documents declare `/assets/favicon-96.png` as a 96×96 PNG favicon and `/assets/apple-touch-icon-180.png` as a 180×180 Apple touch icon.
- Both icons are square RGBA PNGs with transparent padding. Preserve the source logo's proportions; do not stretch it to fill the canvas.
- Favicon assets remain under `assets/`, which the Pages release workflow copies recursively. A root `favicon.ico` is not required.

## Verification

Run:

```sh
npm test
npx playwright test tests/ui/search-preview-favicon.spec.mjs
npm run game-stats:integrity:check
```

The source tests enforce exact metadata parity, canonical URLs, valid square PNG headers, and the loader snippet exclusion. The browser tests verify both entry routes, HTTP availability and PNG content types, natural image dimensions, and transparent corner padding.

For rendered inspection, serve the repository locally and inspect `/` and `/home.html` at 375×812, 768×1024, 1280×800, and 1440×900. Confirm no horizontal overflow and no metadata or favicon resource failures. The production Game Stats Worker may reject a localhost origin; that known CORS response is unrelated to search metadata.

## Google refresh runbook

1. Deploy the updated homepage and assets.
2. Confirm the live HTML contains the intended description and favicon links, and confirm both favicon URLs return `200` with `image/png`.
3. In Google Search Console, inspect `https://rohin.shanker.me/` in a property that covers the hostname.
4. Run **Test live URL**, then use **View tested page** to confirm Google fetched the updated HTML and resources.
5. Select **Request indexing** once. Repeated requests do not accelerate recrawling.
6. Monitor the indexed view's last crawl date. Snippets and favicons can take several days to several weeks to update, and Google does not guarantee an exact snippet or favicon display.
