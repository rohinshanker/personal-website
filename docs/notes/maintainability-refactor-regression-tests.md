# Maintainability Refactor Regression Tests

Date: 2026-07-06

Scope: visual and functional checks for the sections touched by the
maintainability refactor: static page loading, DOM registry lookups, project
gallery helpers, media gallery helpers, and managed random-event windows.

## Test Environment

- Local server: `python3 -m http.server 8765 --bind 127.0.0.1`
- Browser: headless Google Chrome with a temporary profile and Chrome DevTools
  Protocol automation.
- Main test artifacts:
  - JSON report: `/tmp/personal-website-visual-tests/report.json`
  - Landing-page JSON report: `/tmp/personal-website-visual-tests/index-report.json`
  - Screenshots: `/tmp/personal-website-visual-tests/*.png`
- Result: 72 main-page assertions passed, 0 failed. Additional landing-page
  loader/cache-key checks passed.

## Method Notes

- The main page was loaded from `http://127.0.0.1:8765/home.html`.
- For random-event windows, the test load injected temporary private test hooks
  into the served `main.js` response so the actual in-file `show*` and `close*`
  functions could be called directly. The source logic under test was otherwise
  the current working-tree `scripts/home/main.js`.
- There is no pre-refactor screenshot baseline in the repo, so these tests check
  functional behavior, DOM/computed visual state, dimensions, visibility, media
  source changes, accessibility state, and provide screenshots for manual visual
  inspection.

## Page Boot And Cache Keys

- Verified `home.html` loads without runtime exceptions.
- Verified `home.html` emits no `console.error` calls during load.
- Verified loaded `dom.js` URL includes
  `?v=maintainability-refactor-20260706`.
- Verified loaded `main.js` URL includes
  `?v=maintainability-refactor-20260706`.
- Verified `index.html` loader page still renders.
- Verified `index.html` loader and alert overlay retain `data-nosnippet`.
- Verified `index.html` source includes the updated `dom.js` and `main.js`
  cache keys.
- Screenshot for inspection: `/tmp/personal-website-visual-tests/index-loader.png`

## DOM Registry

- Verified all touched `window.homeDom.dom` entries resolve to real elements:
  - Gradescope curve: window, prompt, yes/no buttons, graph, path, adjustment
    controls, slider, set row, set button.
  - EKG project gallery: image, video, caption, description, previous button,
    counter, next button.
  - Existing gallery/media entries used by the refactor: pulse image, TCP image,
    drone video.

## Project Galleries

- Projects app opened successfully via the desktop icon.
- Pulse Oximeter:
  - Initial counter is `1 of 4`.
  - Next button advances to `2 of 4`.
  - Image source changes to `breadboard-1.jpg`.
  - Caption changes to `Prototype iteration 1`.
  - Previous button returns to `1 of 4`.
  - Screenshots:
    - `/tmp/personal-website-visual-tests/projects-pulse-initial.png`
    - `/tmp/personal-website-visual-tests/projects-pulse-next.png`
- TCP Congestion Control:
  - Initial counter is `1 of 4`.
  - Next button advances to `2 of 4`.
  - Image source changes to `throughput_vs_delay_ms.png`.
  - Screenshot: `/tmp/personal-website-visual-tests/projects-tcp-next.png`
- EKG mixed media carousel:
  - Initial counter is `1 of 3`.
  - Initial media shows the image and hides the video.
  - Initial image source is `final-breadboard.jpeg`.
  - Next button advances to `2 of 3`.
  - Image becomes hidden and video becomes visible.
  - Video source changes to `signal-closeup.MOV`.
  - Video `aria-label` changes to `Signal closeup`.
  - Next button advances to `3 of 3`.
  - Video source changes to `video-demo.mov`.
  - Previous button returns to `2 of 3`.
  - Screenshots:
    - `/tmp/personal-website-visual-tests/projects-ekg-image.png`
    - `/tmp/personal-website-visual-tests/projects-ekg-video-1.png`
- Drone Navigation:
  - Initial counter is `1 of 2`.
  - Initial video source is `mujocosimulator.mp4`.
  - Next button advances to `2 of 2`.
  - Video source changes to `livedemo.mp4`.
  - Screenshot: `/tmp/personal-website-visual-tests/projects-drone-initial.png`

## Creative Galleries

- Creative Work app opened successfully via the desktop icon.
- Pathfinder:
  - Initial counter is `1 of 4`.
  - Next button advances to `2 of 4`.
  - Image source changes to `pathfinder-cad.png`.
  - Screenshot: `/tmp/personal-website-visual-tests/creative-pathfinder-next.png`
- Berserk poster redesign:
  - Next button advances to `2 of 6`.
  - Image alt text remains descriptive: `Berserk poster redesign 2`.
  - Screenshot: `/tmp/personal-website-visual-tests/creative-berserk-poster-next.png`
- My Brother's Ghost:
  - Next button advances to `2 of 3`.
  - Image source changes to `my-brothers-ghost-02.jpg`.
  - Screenshot: `/tmp/personal-website-visual-tests/creative-my-brothers-ghost-next.png`

## Writing Galleries

- Writing app opened successfully via the desktop icon.
- Frontiers slide gallery:
  - Initial counter is `1 of 2`.
  - Next button advances to `2 of 2`.
  - Image source changes to `mec-page-5.png`.
  - Screenshot: `/tmp/personal-website-visual-tests/writing-frontiers-slide-next.png`

## Random Events

- Lain system alert:
  - `showLainAlert` opens a visible window with nonzero dimensions.
  - Calling show again while visible raises z-index.
  - OK button closes the window.
  - Closed state restores `aria-hidden="true"` and `is-hidden`.
  - Screenshot: `/tmp/personal-website-visual-tests/random-lain-visible.png`
- Lelouch system alert:
  - `showLelouchAlert` opens a visible window with nonzero dimensions.
  - OK button closes the window.
  - Closed state restores `aria-hidden="true"` and `is-hidden`.
  - Screenshot: `/tmp/personal-website-visual-tests/random-lelouch-visible.png`
- Berserk sunrise:
  - `showBerserkSunrise` opens a visible window with nonzero dimensions.
  - OK button closes the window.
  - Closed state restores `aria-hidden="true"` and `is-hidden`.
  - Screenshot: `/tmp/personal-website-visual-tests/random-berserk-sunrise-visible.png`
- Calendar reminder:
  - `showCalendarReminder` opens a visible window with nonzero dimensions.
  - Show button opens the calendar popout.
  - Reminder window closes after Show.
  - Screenshots:
    - `/tmp/personal-website-visual-tests/random-calendar-reminder-visible.png`
    - `/tmp/personal-website-visual-tests/random-calendar-popout-opened.png`
- Gradescope curve:
  - `showGradescopeCurve` opens a visible window with nonzero dimensions.
  - Opens in prompt mode with default slider value `72`.
  - Prompt is visible; adjustment and set controls are hidden.
  - Yes button switches to adjusting mode.
  - Prompt hides; adjustment and set controls show.
  - SVG curve path is populated.
  - Slider `input` updates the SVG path.
  - Set Curve closes the window and restores hidden state.
  - Close reset restores prompt mode and slider value `72`.
  - Reopen works after reset.
  - No button closes the window and restores hidden state.
  - Screenshots:
    - `/tmp/personal-website-visual-tests/random-gradescope-prompt.png`
    - `/tmp/personal-website-visual-tests/random-gradescope-adjusting.png`
    - `/tmp/personal-website-visual-tests/random-gradescope-prompt-second-open.png`

## Runtime After Interaction

- Verified no runtime exceptions after all gallery and random-event interactions.
- Verified no `console.error` calls after all gallery and random-event
  interactions.

## Syntax And Static Validation

- `git diff --check`
- `node --check scripts/build-study-resources-manifest.mjs`
- `node --check scripts/home/core/dom.js`
- `node --check scripts/home/core/media.js`
- `node --check scripts/home/main.js`
- `node scripts/build-study-resources-manifest.mjs`

## Manual Inspection Checklist

- Open each screenshot under `/tmp/personal-website-visual-tests/`.
- Compare the random-event windows against expected Windows-style spacing,
  title bars, button placement, and prompt/control visibility.
- Check the EKG screenshots specifically for image/video switching and stable
  gallery frame layout.
- Check the project/creative/writing screenshots for stable counter placement
  and unchanged gallery sizing.
