import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isolateAllProductionDebug,
  PRODUCTION_PER_EVENT_DEBUG_IDS,
} from "./ui/helpers/random-event-debug.mjs";

const root = new URL("../", import.meta.url);

test("the browser fixture isolates every production debug event unless explicitly retained", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const enabledIds = [
    ...source.matchAll(/id: "([^"]+)",\n  debug: true,/g),
  ].map((match) => match[1]);

  assert.deepEqual(enabledIds, [...PRODUCTION_PER_EVENT_DEBUG_IDS]);
  const isolated = isolateAllProductionDebug(source);
  assert.doesNotMatch(isolated, /id: "[^"]+",\n  debug: true,/);
  assert.doesNotMatch(isolated, /debug: alert\.debug === true,/);

  const retained = isolateAllProductionDebug(source, {
    except: ["neko-stream-system-alert"],
  });
  assert.match(
    retained,
    /id: "neko-stream-system-alert",\n  debug: true,/
  );
  assert.match(retained, /id: "lain-system-alert",\n  debug: false,/);
  assert.match(retained, /id: "red-tool",\n  debug: false,/);
  assert.throws(
    () =>
      isolateAllProductionDebug(source, {
        except: ["red-tool"],
      }),
    /Unknown production debug event exception: red-tool/
  );
  assert.throws(
    () =>
      isolateAllProductionDebug(source, {
        except: ["lain-system-alert"],
      }),
    /Unknown production debug event exception: lain-system-alert/
  );
});
