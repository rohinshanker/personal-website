# Gears Random Event Inspection Checklist

Date: 2026-07-06

## Static Validation

- `node --check scripts/home/core/dom.js`
- `node --check scripts/home/core/media.js`
- `node --check scripts/home/main.js`
- `git diff --check`
- `node scripts/build-study-resources-manifest.mjs`

## Lancer Battle: Random Event Gating and Ready Prompt

- `lancer-battle` is registered with `debug: false`.
- Ready prompt is visible before the event starts.
- Ready prompt includes the local pasted image:
  `assets/random events/lancer-battle-ready.png`.
- Ready image renders inside the same `.lancer-battle-media-frame` dimensions
  used by the clash and result stages.
- Ready window body uses the standard Windows surface background with black
  text.
- Ready prompt text is centered.
- Starting the duel removes the ready color state so the clash/result styling
  remains dark.
- Clash, result, and final stages are hidden at ready state.
- Prompt copy says exactly `Delta Squad, an enemy approaches. Hold the line!`.
- `Start` action is present.
- Window renders as a larger event window and keeps a stable size through the
  ready, clash, and result states.
- Window fits inside a 1280x820 viewport.
- Concurrent debug popup from the nest event can be dismissed independently.

## Lancer Battle: Intro Media and Clash Phase

- `Start` switches from ready prompt to clash video stage.
- Supplied Imgix media is assigned to the video element:
  `https://imgix.bustle.com/inverse/8d/d9/86/e4/92b5/4dec/b80e/3402288d9a18/giphy-9gif.gif?w=825&h=464&fit=max&fm=mp4`
- `Fight Back` is visible but disabled before the clash phase.
- During the final clash phase, the window has the `is-clashing` class.
- Red lightning field becomes visible during the clash.
- `Fight Back` is visible, enabled, and labeled exactly `Fight Back`.
- Progress starts, increases per click, drains per tick, and ticks at the same
  rate as the Berserk `Resist Causality` random event.
- The clash video is manually paused and boomeranged across the final 0.5s
  segment at 60% of the previous manual step speed.
- Each `Fight Back` click has a 40% chance to count toward the general
  random-event click counter instead of every click being counted.

## Lancer Battle: Win Path

- Rapid `Fight Back` clicks fill the meter to 100.
- Win result stage appears with `is-win`.
- Win video iframe source is assigned and cache-busted for replay.
- Win video iframe source uses the requested `Bic2bBf0LsY` video with
  a valid integer-start embed URL, then sends a YouTube iframe API `seekTo`
  command for 29.5 seconds so playback does not fall back to the video start.
- Win video iframe is visible while the loss GIF image is hidden.
- Win result text appears: `Marcus wins the blade lock.`
- After the timed clip stage, final prompt appears.
- Win video iframe `src` is removed before the final prompt.
- Final prompt says `Good job, Gear.`
- Final prompt uses a Windows settings gear icon and compact alert-sized width.
- Final prompt button is labeled `OK`.
- `OK` hides the event window.

## Lancer Battle: Loss Path

- Not fighting back drains the meter to 0.
- Loss result stage appears with `is-loss`.
- Loss video iframe source is assigned and cache-busted for replay.
- Loss video iframe source uses the requested 0:21.5-0:25 clip parameters:
  `start=21.5` and `end=25`.
- Loss video iframe is visible while the result image is hidden.
- Loss window title appears as `You get Overwhelmed`.
- No loss result body text appears.
- After the 3.45-second timed clip stage, the event window closes directly with
  no final prompt.

## Lancer Battle: Responsive Visuals

- Mobile ready prompt fits a 390x740 viewport.
- No horizontal overflow was detected on the mobile ready prompt.
- Desktop screenshots were captured for ready, intro, clash, win result, win
  final, loss result, and loss final states.
- Mobile screenshot was captured for the ready state.
- Follow-up screenshots were captured for the pasted ready image, the win clip
  result stage, the loss clip result stage, and the centered final prompts.
- Latest ready-state screenshot confirms the standard Windows surface treatment
  and centered initial prompt text.
- Latest focused final pass confirms the ready copy, no extra bottom gap,
  disabled-to-enabled `Fight Back` transition, final 0.5s boomerang segment,
  and Berserk `Resist Causality` progress timing/click/drain aliases.

## Runtime Health

- No `Runtime.exceptionThrown` browser events were observed during the focused
  Lancer battle test run.

## Screenshot Artifacts

- `/tmp/personal-website-lancer-tests/desktop-ready.png`
- `/tmp/personal-website-lancer-tests/desktop-intro-video.png`
- `/tmp/personal-website-lancer-tests/desktop-clash-boomerang.png`
- `/tmp/personal-website-lancer-tests/focused-ready.png`
- `/tmp/personal-website-lancer-tests/focused-clash.png`
- `/tmp/personal-website-lancer-tests/focused-win-gif.png`
- `/tmp/personal-website-lancer-tests/focused-win-final.png`
- `/tmp/personal-website-lancer-tests/focused-loss-gif.png`
- `/tmp/personal-website-lancer-tests/focused-loss-final.png`
- `/tmp/personal-website-lancer-tests/focused-mobile-ready.png`
- `/tmp/personal-website-lancer-tests/latest-ready-image.png`
- `/tmp/personal-website-lancer-tests/latest-win-video-result.png`
- `/tmp/personal-website-lancer-tests/latest-loss-video-result.png`
- `/tmp/personal-website-lancer-tests/latest-win-final-good-job.png`
- `/tmp/personal-website-lancer-tests/latest-ready-window-surface.png`
- `/tmp/personal-website-lancer-tests/latest-lancer-final-ready.png`
- `/tmp/personal-website-lancer-tests/latest-lancer-final-active.png`

## Reports

- Follow-up ready-image JSON report:
  `/tmp/personal-website-lancer-tests/latest-ready-image-report.json`
- Follow-up loss-video JSON report:
  `/tmp/personal-website-lancer-tests/latest-loss-video-report.json`
- Follow-up ready-surface JSON report:
  `/tmp/personal-website-lancer-tests/latest-ready-surface-report.json`
- Final focused Lancer JSON report:
  `/tmp/personal-website-lancer-tests/latest-lancer-final-report.json`
