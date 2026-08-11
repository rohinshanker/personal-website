import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const expectedAlerts = [
  {
    id: "ram-prices",
    title: "System Alert",
    icon: "assets/app-icons/ico/processor.ico",
    message: "RAM prices went up again.",
    alignment: "right",
  },
  {
    id: "computer-nevermind",
    title: "System Alert",
    icon: "assets/app-icons/ico/msg_error.ico",
    message: "Error: your computer is umm.. uh. actually never mind",
    alignment: "right",
  },
  {
    id: "received-fax",
    title: "System Alert",
    icon: "assets/app-icons/ico/fax_machine_exclam.ico",
    message: "You received a fax.",
    alignment: "right",
  },
  {
    id: "make-art",
    title: "System Alert",
    icon: "assets/app-icons/ico/paint_old.ico",
    message: "Go make some art today!",
    alignment: "right",
  },
  {
    id: "required-file",
    title: "Error Starting Program",
    icon: "assets/app-icons/ico/msg_warning.ico",
    message: "A required file È9å|ļ1(VÿB.LL was not found.",
    alignment: "right",
  },
  {
    id: "unexpected-error",
    title: "Microsoft Data Link",
    icon: "assets/app-icons/ico/msg_warning.ico",
    message: "An unexpected error. Please investigate.",
    alignment: "right",
  },
  {
    id: "three-wise-monkeys",
    title: "System Alert",
    icon: "assets/app-icons/ico/msagent_file.ico",
    message: "See no evil, hear no evil, speak no evil.",
    alignment: "right",
  },
  {
    id: "ask-for-help",
    title: "System Alert",
    icon: "assets/app-icons/ico/help_question_mark.ico",
    message: "It is okay to ask for help when you need it.",
    alignment: "right",
  },
  {
    id: "leave-the-house",
    title: "System Alert",
    icon: "assets/app-icons/ico/address_book_home.ico",
    message: "Don't forget to leave your house sometimes!",
    alignment: "right",
  },
  {
    id: "always-watching",
    title: "System Alert",
    icon: "assets/app-icons/ico/file_eye.ico",
    message: "They are always watching.",
    alignment: "right",
  },
  {
    id: "seneca-announcement",
    debug: false,
    title: "System Announcement",
    icon: "assets/app-icons/ico/certificate_no.ico",
    message:
      "“Let it offend you that someone else could be handed your days and turn them into something greater.”\n" +
      "—Lucius Annaeus Seneca",
    alignment: "right",
  },
  {
    id: "deodorant-reminder",
    debug: false,
    title: "System Alert",
    icon: "assets/app-icons/ico/user_computer_pair.ico",
    message:
      "Be sure to shower and wear deodorant! Or don't. I'm just a website, who am I to tell you?",
    alignment: "right",
  },
  {
    id: "power-cycle-reminder",
    debug: false,
    title: "System Alert",
    icon: "assets/app-icons/ico/shell_window1.ico",
    message:
      "It is important to turn off your computer periodically. Leaving it on for long amounts of time will make it stressed out and sad!",
    alignment: "right",
  },
];
const formerlyCenteredAlertIds = [
  "required-file",
  "unexpected-error",
  "three-wise-monkeys",
  "ask-for-help",
  "leave-the-house",
  "always-watching",
  "power-cycle-reminder",
];

const readAlertConfiguration = (source) => {
  const start = source.indexOf("const DEBUG_SYSTEM_ALERTS =");
  const end = source.indexOf("\nconst RANDOM_EVENT_RELOAD_KEY", start);
  assert.notEqual(start, -1, "The debug alert configuration must exist");
  assert.notEqual(end, -1, "The debug alert configuration must be bounded");
  const context = vm.createContext({ Object });
  vm.runInContext(
    `${source.slice(start, end)}\nglobalThis.alerts = DEBUG_SYSTEM_ALERTS;`,
    context
  );
  return structuredClone(context.alerts);
};

test("system alert events preserve the requested content and local assets", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const alerts = readAlertConfiguration(source);

  assert.deepEqual(alerts, expectedAlerts);
  assert.equal(new Set(alerts.map(({ id }) => id)).size, expectedAlerts.length);
  assert.deepEqual(
    alerts.filter(({ debug }) => debug).map(({ id }) => id),
    []
  );
  assert.deepEqual(
    alerts
      .filter(({ id }) => formerlyCenteredAlertIds.includes(id))
      .map(({ id, alignment }) => ({ id, alignment })),
    formerlyCenteredAlertIds.map((id) => ({ id, alignment: "right" }))
  );
  await Promise.all(alerts.map(({ icon }) => access(new URL(icon, root))));
});

test("system alert events use one accessible managed shell with exact alignment", async () => {
  const [html, css, dom, source] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("styles/home/random-events.css", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
  ]);

  assert.match(html, /id="debug-system-alert-window"/);
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /aria-labelledby="debug-system-alert-title"/);
  assert.match(html, /aria-describedby="debug-system-alert-message"/);
  assert.match(html, /<button type="button" id="debug-system-alert-ok">OK<\/button>/);
  assert.match(css, /\.random-alert-actions\.is-centered \{\n  justify-content: center;/);
  assert.match(css, /\.debug-system-alert-message p \{\n  overflow-wrap: anywhere;/);
  assert.match(css, /\.debug-system-alert-message p \{[\s\S]*?white-space: pre-line;/);
  for (const binding of [
    "debugSystemAlertWindow",
    "debugSystemAlertTitle",
    "debugSystemAlertIcon",
    "debugSystemAlertMessage",
    "debugSystemAlertActions",
    "debugSystemAlertOk",
  ]) {
    assert.match(dom, new RegExp(`${binding}:`));
    assert.match(source, new RegExp(`\\b${binding}\\b`));
  }

  assert.match(source, /DEBUG_SYSTEM_ALERTS\.forEach\(\(alert\) => \{/);
  assert.match(source, /id: `debug-system-alert-\$\{alert\.id\}`/);
  assert.match(source, /debug: alert\.debug === true/);
  assert.doesNotMatch(source, /DEBUG_SYSTEM_ALERT_BROWSER_TRIGGER_ENABLED/);
  assert.match(
    source,
    /canTrigger: \(\) => !isDebugSystemAlertVisible\(\),/
  );
  assert.doesNotMatch(source, /debugSystemAlertNextIndex/);
  assert.match(source, /showManagedRandomEventWindow\(debugSystemAlertWindow/);
  assert.match(source, /closeManagedRandomEventWindow\(debugSystemAlertWindow\)/);
  assert.match(source, /bindManagedRandomEventWindowAnimation\(debugSystemAlertWindow/);
  assert.match(source, /debugSystemAlertOk\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(
    source,
    /"debug-system-alert-seneca-announcement": "System Announcement — Seneca"/
  );
  assert.match(
    source,
    /"debug-system-alert-deodorant-reminder": "System Alert — Hygiene Reminder"/
  );
  assert.match(
    source,
    /"debug-system-alert-power-cycle-reminder": "System Alert — Power-Cycle Reminder"/
  );
});
