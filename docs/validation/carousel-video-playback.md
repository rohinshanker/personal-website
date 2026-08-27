# Carousel Video Playback

Purpose: Keep carousel video and audio paused whenever its slide, portfolio tab, or owning window is not visible.

Scope: Modeling, EKG, Drone, and future carousel media using `.gallery-scroll` and deferred `data-src` loading.

Last verified: 2026-08-27

## Playback contract

- Changing a carousel slide pauses and unloads the outgoing video before replacing or hiding it.
- Changing a portfolio selector tab or closing its window pauses every contained video and audio element. Media marked `data-unload-on-hide` also moves its `src` back to `data-src`.
- Deferred preloading must suspend hidden carousel media before either restoring or accepting an existing source. Hidden means the media element has `hidden`, its `.viewer-content` is hidden, or its app window is hidden.
- Hidden preload removes native autoplay by setting `autoplay` to false. Intentional autoplay uses `data-autoplay-on-active` and the visibility-gated playback helper, so Stand Still resumes only when its video slide and tab are visible.
- Manual videos such as Fast Reverie, EKG, and Drone remain paused when their slide or tab is revisited.

When `scripts/home/core/media.js` changes, update its cache key in both `index.html` and `home.html`.

## Verification

Run:

```bash
node --test tests/media-priority.test.mjs tests/carousel-loading-placeholder.test.mjs
npx playwright test tests/ui/carousel-video-playback.spec.mjs tests/ui/media-loading-priority.spec.mjs tests/ui/shared-carousel-spacing.spec.mjs
```

The playback suite serves each MP4 and MOV request from a small valid local H.264 fixture. It covers Stand Still's visible-only autoplay and the manual Fast Reverie, EKG, and Drone videos across slide changes, tab changes, hidden prewarming, return visits, and window closure. Every hidden state also asserts that no carousel video or audio element is playing.

For rendered validation, inspect `/home.html` at 375×812, 768×1024, 1280×800, and 1440×900. Start Stand Still, select a different Modeling project, wait for its hidden source to be restored, and confirm `paused` stays true and `currentTime` stays fixed. Return to Stand Still and confirm its intentional autoplay resumes; move to the second slide and confirm the video element is removed.
