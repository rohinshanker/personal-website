import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const readAvatarSource = async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const start = source.indexOf("const ROHIN_NEKO_AVATAR_INITIAL_DELAY_MIN_MS");
  const end = source.indexOf("const NEKO_TASKBAR_WAKE_ICON", start);
  assert.ok(start >= 0 && end > start, "Rohin Neko avatar implementation must exist");
  return source.slice(start, end);
};

test("Rohin Neko profile avatars use the roaming Neko's sprite cadence and independent instances", async () => {
  const avatarSource = await readAvatarSource();

  assert.match(avatarSource, /INITIAL_DELAY_MIN_MS = 1000/);
  assert.match(avatarSource, /INITIAL_DELAY_MAX_MS = 3000/);
  assert.match(avatarSource, /ACTION_DELAY_MIN_MS = 4000/);
  assert.match(avatarSource, /ACTION_DELAY_MAX_MS = 8000/);
  assert.match(avatarSource, /SLEEP_CHANCE = 0\.3/);
  assert.match(avatarSource, /new Map\(\)/);
  assert.match(avatarSource, /new MutationObserver/);
  assert.match(avatarSource, /rohinNekoAvatarInstances\.get\(image\)/);
  assert.match(avatarSource, /rohinNekoAvatarInstances\.delete\(image\)/);
  assert.match(avatarSource, /image\.isConnected && !image\.closest\("\.is-hidden, \[hidden\]"\)/);

  assert.match(avatarSource, /frames: NEKO_SCRATCH_SELF_ACTION\.frames/);
  assert.match(avatarSource, /frames: NEKO_YAWN_ACTION\.frames/);
  assert.match(
    avatarSource,
    /NEKO_NAP_FRAME_SWITCH_FRAMES \* NEKO_FRAME_INTERVAL_MS/,
    "Sleeping profile icons must use the roaming Neko nap cadence."
  );
  assert.match(
    avatarSource,
    /ROHIN_NEKO_AVATAR_CLAW_DIRECTIONS = Object\.freeze\(\["left", "right"\]\)/,
    "Profile claws are intentionally limited to left and right."
  );
  assert.doesNotMatch(avatarSource, /ROHIN_NEKO_AVATAR_(?:FRAME_INTERVAL|ACTION_DURATION)_MS/);
});

