# O_google-search-console-refresh__20260827 — Open

Scope: Deploy the updated homepage search metadata and favicon assets, then guide a site owner through Google Search Console's live test, indexing request, and follow-up verification over a call.

Status: open

Opened: 2026-08-27

Updated: 2026-08-27

Current State: The repository changes are implemented and tested locally: both homepage documents use `My personal website. Best enjoyed on desktop…`, transient loader copy remains excluded with `data-nosnippet`, and square 96×96 and 180×180 icon assets are declared. The changes must be deployed before Search Console is asked to inspect or recrawl the homepage.

Verification: Complete the live-site checks, record the Search Console property and indexed Last crawl date, pass Test live URL, inspect the tested HTML/resources, submit one Request indexing action, and later confirm that Google's indexed Last crawl postdates the deployment. The exact result snippet and favicon are observations, not completion requirements, because Google does not guarantee either presentation.

Cleanup: After the post-deployment crawl is confirmed, resolve this ticket, retain only reusable updates in `docs/validation/search-preview-favicon.md`, remove this ticket from the live index, and delete the resolved ticket.

## Objective

Use a screen-shared call to show the site owner what changed, verify that Google can fetch the new homepage and favicon, request a new crawl once, and establish realistic follow-up expectations.

Search Console does not provide editable fields for a site's description or favicon. Those values come from the deployed HTML and image assets. Search Console is used here to inspect Google's current indexed copy, test the live deployment, and request recrawling.

## Information to record

- Call date:
- Facilitator:
- Search Console account owner:
- Deployment commit or release URL:
- Deployment completion time and timezone:
- Selected Search Console property:
- Indexed Last crawl before the request:
- Test live URL result:
- Request indexing confirmation:
- First follow-up date:
- Second follow-up date:
- Indexed Last crawl after deployment:
- Observed Google query and result:

## Before the call

1. Ensure the metadata and favicon changes have been merged or pushed to `main` and the GitHub Pages deployment workflow has completed successfully.
2. Open `https://rohin.shanker.me/` in a private browser window and confirm the homepage loads over HTTPS.
3. Open these assets directly and confirm both load:
   - `https://rohin.shanker.me/assets/favicon-96.png`
   - `https://rohin.shanker.me/assets/apple-touch-icon-180.png`
4. View the live homepage source and confirm it contains:
   - `<meta name="description" content="My personal website. Best enjoyed on desktop…">`
   - `href="/assets/favicon-96.png"`
   - `sizes="96x96"`
   - `data-nosnippet` on the entry loader.
5. Confirm the person joining the call has either Owner or Full user access to a Search Console property covering `rohin.shanker.me`. Request indexing is unavailable to Restricted users.
6. If no suitable property exists, have access to the DNS manager for `shanker.me` ready. A Domain property is preferred because it covers the root domain, all subdomains, and both protocols.
7. Have these references open in separate tabs:
   - [Add a Search Console property](https://support.google.com/webmasters/answer/34592)
   - [Use URL Inspection](https://support.google.com/webmasters/answer/12482179)
   - [Request a recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
   - [Google favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search)
   - [Google snippet behavior](https://developers.google.com/search/docs/appearance/snippet)

## Call walkthrough

### 1. Set expectations

Explain:

> We have already changed the website itself. Search Console does not let us type in a new description or upload a favicon. We are using it to verify that Google can see the deployed changes and to request a fresh crawl. Google can still choose a query-specific snippet, and favicon display is not guaranteed.

### 2. Select or add the correct property

1. Open [Google Search Console](https://search.google.com/search-console).
2. Open the property selector at the upper left.
3. If a Domain property named `shanker.me` already exists, select it. It covers `rohin.shanker.me`.
4. Otherwise select **+ Add property**.
5. Preferred path:
   - Choose **Domain**.
   - Enter `shanker.me` without `https://` and without a trailing slash.
   - Copy Google's TXT verification record into the DNS manager exactly as shown.
   - Wait for the DNS change to become visible, then select **Verify**.
6. Alternative path when DNS access is unavailable:
   - Choose **URL prefix**.
   - Enter exactly `https://rohin.shanker.me/`, including `https://` and the trailing slash.
   - Follow one of Google's offered verification methods.
7. Confirm the property appears in the selector and that the attendee is an Owner or Full user.

If Search Console says the inspected URL is outside the property, stop and switch to `shanker.me` or `https://rohin.shanker.me/`; do not inspect the parent homepage or `home.html` instead.

### 3. Inspect Google's current indexed copy

1. Paste exactly `https://rohin.shanker.me/` into the URL Inspection bar at the top.
2. Wait for the indexed report to load.
3. Expand **Page indexing** and record:
   - The overall URL verdict.
   - **Last crawl** date and time.
   - **Crawl allowed?**
   - **Page fetch** result.
   - **Indexing allowed?**
   - **User-declared canonical**.
   - **Google-selected canonical**.
4. Expected values are crawl allowed, successful page fetch, indexing allowed, and `https://rohin.shanker.me/` as the canonical URL.
5. Explain that the indexed report reflects Google's last completed crawl. If its Last crawl predates the deployment, seeing the old snippet is expected.

### 4. Test the live deployment

1. Select **Test live URL** in the indexed report.
2. Wait for the live test to finish; this can take a minute or two.
3. Confirm the live result says the URL is available to Google and shows no crawl or indexing block.
4. Select **View tested page**.
5. In the HTML view, search for:
   - `My personal website. Best enjoyed on desktop…`
   - `/assets/favicon-96.png`
   - `data-nosnippet`
6. Review the page resources or More information section and confirm the favicon resource was not blocked or failed. Search Console does not preview the final search-result favicon here; it only confirms that Google could fetch the page and its resources.
7. If the live HTML is still old, stop. Verify the deployment, caches, canonical URL, and live page source before requesting indexing.

### 5. Request indexing once

1. Return to the successful live-test result.
2. Select **Request indexing**.
3. Wait for the confirmation that the URL was added to the priority crawl queue.
4. Record the confirmation and call date in this ticket.
5. Do not submit repeated requests. Google states that repeated requests do not make recrawling faster and submission does not guarantee immediate inclusion.

### 6. Set follow-up expectations

Explain:

> The request is complete, but Google's systems update asynchronously. A recrawl can take a few days to a few weeks. The description can vary by search query, and Google may still decide not to display a favicon even when the page is eligible.

1. Schedule the first check approximately seven days after the request.
2. Schedule a second check approximately three weeks after the request if the indexed Last crawl has not advanced.
3. At each check, inspect `https://rohin.shanker.me/` again and compare **Last crawl** with the recorded deployment time.
4. Once Last crawl postdates the deployment, use **View crawled page** to confirm the indexed HTML contains the new description and favicon link.
5. Search Google for the exact URL and the original query that exposed the unwanted loader text. Record both observations because Google can generate different snippets for different queries.
6. Do not treat an unchanged result immediately after a new Last crawl as proof of a broken deployment. Allow additional processing time for snippets and favicons.

## Troubleshooting during the call

### The property is missing or the URL is outside the property

- Select the `shanker.me` Domain property, or add the exact URL-prefix property `https://rohin.shanker.me/`.
- A property for only `https://shanker.me/` does not cover the `rohin` subdomain.

### Test live URL cannot fetch the page

- Confirm the public homepage returns HTTP 200 without authentication.
- Confirm `robots.txt` allows crawling.
- Confirm the page has no `noindex` directive.
- Confirm the canonical URL is `https://rohin.shanker.me/`.
- Retry only after the underlying fetch problem is fixed.

### The live HTML is old

- Confirm the intended commit reached `main` and the Pages deployment succeeded.
- Hard-refresh the public page and inspect its source, not only the rendered DOM.
- Verify that the live description uses the single ellipsis character `…`, not the old cat-face suffix.

### Google still shows “Downloading latest update of Rohin OS”

- Compare the indexed Last crawl with the deployment time.
- Confirm the live loader still has `data-nosnippet` before requesting another investigation.
- If the Last crawl is new and the result remains unchanged, record the exact query and wait for snippet processing; snippets are query-specific and not manually editable.

### The favicon still does not appear

- Confirm `/assets/favicon-96.png` returns HTTP 200 with `Content-Type: image/png`.
- Confirm the declared image is square, 96×96, stable at the same URL, and crawlable by Googlebot-Image.
- Confirm the favicon link is on the hostname homepage, not only on `home.html`.
- Allow several days to several weeks after the homepage recrawl. Eligibility does not guarantee display.

## Completion checklist

- [ ] Metadata and favicon changes are live on `https://rohin.shanker.me/`.
- [ ] Both favicon URLs return HTTP 200 with PNG content.
- [ ] A verified Search Console property covers `rohin.shanker.me`.
- [ ] The attendee has Owner or Full user access.
- [ ] The indexed Last crawl before the request is recorded.
- [ ] Test live URL succeeds.
- [ ] View tested page shows the new description, favicon link, and snippet exclusion.
- [ ] Request indexing is submitted once and confirmed.
- [ ] Follow-up dates are scheduled.
- [ ] A later indexed Last crawl postdates the deployment.
- [ ] The later crawled HTML contains the new description and favicon link.
- [ ] The exact URL query and original discovery query are recorded after recrawling.
