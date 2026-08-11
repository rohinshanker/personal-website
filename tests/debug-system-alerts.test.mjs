import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const defaultButton = Object.freeze({
  id: "ok",
  label: "OK",
  action: "dismiss",
});

const expectedAlert = ({
  id,
  label = `System Alert — ${id
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")}`,
  icon,
  body,
  title = "System Alert",
  buttons = [defaultButton],
  buttonAlignment = "right",
}) => ({
  id,
  label,
  title,
  icon,
  body,
  buttons,
  buttonAlignment,
});

const expectedAlerts = [
  expectedAlert({
    id: "ram-prices",
    icon: "assets/app-icons/ico/processor.ico",
    body: "RAM prices went up again.",
  }),
  expectedAlert({
    id: "computer-nevermind",
    icon: "assets/app-icons/ico/msg_error.ico",
    body: "Error: your computer is umm.. uh. actually never mind",
  }),
  expectedAlert({
    id: "received-fax",
    icon: "assets/app-icons/ico/fax_machine_exclam.ico",
    body: "You received a fax.",
  }),
  expectedAlert({
    id: "make-art",
    icon: "assets/app-icons/ico/paint_old.ico",
    body: "Go make some art today!",
  }),
  expectedAlert({
    id: "required-file",
    title: "Error Starting Program",
    icon: "assets/app-icons/ico/msg_warning.ico",
    body: "A required file È9å|ļ1(VÿB.LL was not found.",
  }),
  expectedAlert({
    id: "unexpected-error",
    title: "Microsoft Data Link",
    icon: "assets/app-icons/ico/msg_warning.ico",
    body: "An unexpected error. Please investigate.",
  }),
  expectedAlert({
    id: "three-wise-monkeys",
    icon: "assets/app-icons/ico/msagent_file.ico",
    body: "See no evil, hear no evil, speak no evil.",
  }),
  expectedAlert({
    id: "ask-for-help",
    icon: "assets/app-icons/ico/help_question_mark.ico",
    body: "It is okay to ask for help when you need it.",
  }),
  expectedAlert({
    id: "leave-the-house",
    icon: "assets/app-icons/ico/address_book_home.ico",
    body: "Don't forget to leave your house sometimes!",
  }),
  expectedAlert({
    id: "always-watching",
    icon: "assets/app-icons/ico/file_eye.ico",
    body: "They are always watching.",
  }),
  expectedAlert({
    id: "seneca-announcement",
    title: "System Announcement",
    icon: "assets/app-icons/ico/certificate_no.ico",
    body:
      "“Let it offend you that someone else could be handed your days and turn them into something greater.”\n" +
      "—Lucius Annaeus Seneca",
  }),
  expectedAlert({
    id: "deodorant-reminder",
    icon: "assets/app-icons/ico/user_computer_pair.ico",
    body:
      "Be sure to shower and wear deodorant! Or don't. I'm just a website, who am I to tell you?",
  }),
  expectedAlert({
    id: "power-cycle-reminder",
    icon: "assets/app-icons/ico/shell_window1.ico",
    body:
      "It is important to turn off your computer periodically. Leaving it on for long amounts of time will make it stressed out and sad!",
  }),
  expectedAlert({
    id: "substack-reminder",
    label: "System Alert – Substack Reminder",
    icon: "assets/app-icons/ico/help_book_computer.ico",
    body: "Don't forget to check out my substack!",
  }),
  expectedAlert({
    id: "goldfish",
    label: "System Alert – Goldfish",
    icon: "assets/app-icons/ico/msg_information.ico",
    body: "Don't overfeed your goldfish!",
  }),
  expectedAlert({
    id: "browser-infected",
    label: "System Alert — Browser Infected",
    icon: "assets/app-icons/ico/msie1.ico",
    body:
      "Attention!!! Multiple viruses have been detected on your computer. I think.",
  }),
  expectedAlert({
    id: "operation-unsupported",
    label: "System Alert – Operation Unsupported",
    icon: "assets/app-icons/ico/msg_error.ico",
    body: "Error: Operation is not supported.",
  }),
  expectedAlert({
    id: "time-warning",
    label: "System Alert — Time Warning",
    icon: "assets/app-icons/ico/clock.ico",
    body: "Your time is limited. Make the most of it!",
  }),
  expectedAlert({
    id: "question-everything",
    label: "System Alert — Question Everything",
    icon: "assets/app-icons/ico/circle_question.ico",
    body: "Question everything.",
  }),
  expectedAlert({
    id: "degrees",
    label: "System Alert — Degrees",
    icon: "assets/app-icons/ico/certificate_seal.ico",
    body: "C's get degrees.",
  }),
  expectedAlert({
    id: "comdex",
    label: "System Alert — Comdex",
    icon: "assets/app-icons/ico/rj_jack.ico",
    body: "Don't plug in a USB scanner during the COMDEX 1998 Spring Keynote...",
  }),
  expectedAlert({
    id: "battery",
    label: "System Alert — battery",
    icon: "assets/app-icons/ico/battery.ico",
    body: "Warning: Your device has low battery. I believe.",
  }),
  expectedAlert({
    id: "tabs",
    label: "System Alert — tabs",
    icon: "assets/app-icons/ico/accessibility_two_windows.ico",
    body: "Don't forget to close your unused tabs!",
  }),
  expectedAlert({
    id: "eye-strain",
    label: "System Alert — eye strain",
    icon: "assets/app-icons/ico/color_profile_gray.ico",
    body: "Spending too much time on screens will strain your eyes.",
  }),
  expectedAlert({
    id: "social-media",
    label: "System Alert — social media",
    icon: "assets/app-icons/ico/installer_generic_old.ico",
    body:
      "Social media promotes inflammatory content to maintian your attention and make the most ad revenue off of you.",
  }),
  expectedAlert({
    id: "language",
    label: "System Alert — Language",
    icon: "assets/app-icons/ico/charmap.ico",
    body:
      "Learn another language! There are few better things you can spend your time doing.",
  }),
  expectedAlert({
    id: "radio-waves",
    label: "System Alert — radio waves",
    icon: "assets/app-icons/ico/infrared.ico",
    body: "Continuous exposure to Wi-Fi and radio waves isn't the best for your body.",
  }),
  expectedAlert({
    id: "cereal",
    label: "System Alert — Cereal",
    icon: "assets/app-icons/ico/search_computer.ico",
    body: "I love cereal.",
  }),
  expectedAlert({
    id: "keys",
    label: "System Alert — Keys",
    icon: "assets/app-icons/ico/keys.ico",
    body: "Don't forget your keys, phone, and wallet!",
  }),
  expectedAlert({
    id: "photos",
    label: "System Alert - Photos",
    icon: "assets/app-icons/ico/pictures.ico",
    body: "Don't forget to backup your photos. Memories are irreplaceable.",
  }),
];

const legacyAlertIds = Object.freeze(
  expectedAlerts.slice(0, 13).map(({ id }) => id)
);
const addedAlertIds = Object.freeze(
  expectedAlerts.slice(13).map(({ id }) => id)
);

const readSystemAlertRuntime = async () => {
  const [manifestSource, systemAlertSource] = await Promise.all([
    readFile(new URL("scripts/home/app-icon-manifest.js", root), "utf8"),
    readFile(new URL("scripts/home/system-alerts.js", root), "utf8"),
  ]);
  const context = vm.createContext({ window: {} });
  vm.runInContext(`${manifestSource}\n${systemAlertSource}`, context);
  return {
    definitions: context.window.rohinSystemAlerts.definitions,
    iconFileNames: context.window.rohinAppIconManifest,
    normalizeDefinitions: context.window.rohinSystemAlerts.normalizeDefinitions,
    source: systemAlertSource,
  };
};

const assertDeepFrozen = (value, label = "value") => {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  Object.entries(value).forEach(([key, child]) => {
    assertDeepFrozen(child, `${label}.${key}`);
  });
};

test("system alerts preserve all 30 exact definitions and their local icons", async () => {
  const { definitions, iconFileNames, source } = await readSystemAlertRuntime();
  const alerts = structuredClone(definitions);

  assert.equal(alerts.length, 30);
  assert.deepEqual(alerts, expectedAlerts);
  assert.deepEqual(alerts.slice(0, 13).map(({ id }) => id), legacyAlertIds);
  assert.deepEqual(alerts.slice(13).map(({ id }) => id), addedAlertIds);
  assert.equal(addedAlertIds.length, 17);
  assert.equal(new Set(alerts.map(({ id }) => id)).size, alerts.length);
  assert.match(source, /Copy\/paste this object into SYSTEM_ALERT_INPUTS/);

  await Promise.all(
    alerts.map(async ({ icon }) => {
      const iconFileName = icon.split("/").at(-1);
      assert.ok(iconFileNames.includes(iconFileName), `${icon} must be in the manifest`);
      await access(new URL(icon, root));
    })
  );
});

test("system alert normalization supplies defaults and deeply freezes output", async () => {
  const { normalizeDefinitions } = await readSystemAlertRuntime();
  const definitions = normalizeDefinitions(
    [
      {
        id: "defaults",
        icon: "assets/app-icons/ico/msg_information.ico",
        body: "Use every default.",
      },
      {
        id: "explicit-buttons",
        title: "Explicit title",
        icon: "assets/app-icons/ico/msg_error.ico",
        body: "Keep the declared button order.",
        buttons: [
          { label: "Try Again", action: "dismiss" },
          { id: "cancel", label: "Cancel", action: "dismiss" },
        ],
        buttonAlignment: "left",
      },
    ],
    { iconFileNames: ["msg_information.ico", "msg_error.ico"] }
  );

  assert.deepEqual(structuredClone(definitions), [
    expectedAlert({
      id: "defaults",
      icon: "assets/app-icons/ico/msg_information.ico",
      body: "Use every default.",
    }),
    expectedAlert({
      id: "explicit-buttons",
      title: "Explicit title",
      icon: "assets/app-icons/ico/msg_error.ico",
      body: "Keep the declared button order.",
      buttons: [
        { id: "try-again", label: "Try Again", action: "dismiss" },
        { id: "cancel", label: "Cancel", action: "dismiss" },
      ],
      buttonAlignment: "left",
    }),
  ]);
  assertDeepFrozen(definitions, "definitions");

  for (const buttonAlignment of ["left", "center", "right"]) {
    const [definition] = normalizeDefinitions(
      [
        {
          id: `${buttonAlignment}-buttons`,
          icon: "assets/app-icons/ico/msg_information.ico",
          body: `${buttonAlignment} aligned buttons`,
          buttonAlignment,
        },
      ],
      { iconFileNames: ["msg_information.ico"] }
    );
    assert.equal(definition.buttonAlignment, buttonAlignment);
  }
});

test("system alert normalization rejects every malformed authoring case", async () => {
  const { normalizeDefinitions } = await readSystemAlertRuntime();
  const iconFileNames = ["msg_information.ico", "msg_error.ico"];
  const validDefinition = () => ({
    id: "valid-alert",
    icon: "assets/app-icons/ico/msg_information.ico",
    body: "Valid body",
  });
  const normalize = (definitions) =>
    normalizeDefinitions(definitions, { iconFileNames });

  const invalidCases = [
    ["non-array definitions", () => normalize({}), /definitions must be an array/],
    [
      "non-array icon manifest",
      () => normalizeDefinitions([], { iconFileNames: new Set(iconFileNames) }),
      /icon manifest must be an array/,
    ],
    ["null definition", () => normalize([null]), /alert 1 must be an object/],
    ["array definition", () => normalize([[]]), /alert 1 must be an object/],
    [
      "missing id",
      () => normalize([{ ...validDefinition(), id: undefined }]),
      /alert 1 id must be a non-empty string/,
    ],
    [
      "invalid id",
      () => normalize([{ ...validDefinition(), id: "Not Kebab" }]),
      /id must be lowercase kebab-case/,
    ],
    [
      "Administrator-incompatible long id",
      () => normalize([{ ...validDefinition(), id: "a".repeat(97) }]),
      /id must be lowercase kebab-case with at most 96 characters/,
    ],
    [
      "duplicate id",
      () => normalize([validDefinition(), validDefinition()]),
      /Duplicate system alert id valid-alert/,
    ],
    [
      "missing icon",
      () => normalize([{ ...validDefinition(), icon: "" }]),
      /icon must be a non-empty string/,
    ],
    [
      "external icon",
      () => normalize([{ ...validDefinition(), icon: "https:\/\/example.com\/icon.ico" }]),
      /icon must reference an existing local ICO asset/,
    ],
    [
      "traversing icon path",
      () =>
        normalize([
          {
            ...validDefinition(),
            icon: "assets/app-icons/ico/../msg_information.ico",
          },
        ]),
      /icon must reference an existing local ICO asset/,
    ],
    [
      "missing local icon",
      () =>
        normalize([
          {
            ...validDefinition(),
            icon: "assets/app-icons/ico/not-in-manifest.ico",
          },
        ]),
      /icon must reference an existing local ICO asset/,
    ],
    [
      "blank title",
      () => normalize([{ ...validDefinition(), title: "   " }]),
      /title must be a non-empty string/,
    ],
    [
      "blank Administrator label",
      () => normalize([{ ...validDefinition(), label: "   " }]),
      /label must be a non-empty string/,
    ],
    [
      "missing body",
      () => normalize([{ ...validDefinition(), body: undefined }]),
      /body must be a non-empty string/,
    ],
    [
      "blank body",
      () => normalize([{ ...validDefinition(), body: "\n\t" }]),
      /body must be a non-empty string/,
    ],
    [
      "unsupported alignment",
      () => normalize([{ ...validDefinition(), buttonAlignment: "spread" }]),
      /unsupported button alignment spread/,
    ],
    [
      "non-array buttons",
      () => normalize([{ ...validDefinition(), buttons: {} }]),
      /buttons must be a non-empty array/,
    ],
    [
      "empty buttons",
      () => normalize([{ ...validDefinition(), buttons: [] }]),
      /buttons must be a non-empty array/,
    ],
    [
      "null button",
      () => normalize([{ ...validDefinition(), buttons: [null] }]),
      /button 1 must be an object/,
    ],
    [
      "array button",
      () => normalize([{ ...validDefinition(), buttons: [[]] }]),
      /button 1 must be an object/,
    ],
    [
      "blank button label",
      () =>
        normalize([
          {
            ...validDefinition(),
            buttons: [{ label: " ", action: "dismiss" }],
          },
        ]),
      /button 1 label must be a non-empty string/,
    ],
    [
      "invalid generated button id",
      () =>
        normalize([
          {
            ...validDefinition(),
            buttons: [{ label: "?!", action: "dismiss" }],
          },
        ]),
      /button 1 id must be lowercase kebab-case/,
    ],
    [
      "invalid explicit button id",
      () =>
        normalize([
          {
            ...validDefinition(),
            buttons: [{ id: "Not Kebab", label: "OK", action: "dismiss" }],
          },
        ]),
      /button 1 id must be lowercase kebab-case/,
    ],
    [
      "duplicate button id",
      () =>
        normalize([
          {
            ...validDefinition(),
            buttons: [
              { id: "same", label: "First", action: "dismiss" },
              { id: "same", label: "Second", action: "dismiss" },
            ],
          },
        ]),
      /duplicate button id same/,
    ],
    [
      "missing button action",
      () =>
        normalize([
          {
            ...validDefinition(),
            buttons: [{ label: "OK" }],
          },
        ]),
      /button 1 action must be a non-empty string/,
    ],
    [
      "unknown button action",
      () =>
        normalize([
          {
            ...validDefinition(),
            buttons: [{ label: "Run", action: "execute-code" }],
          },
        ]),
      /unsupported button action execute-code/,
    ],
  ];

  for (const [name, operation, expectedError] of invalidCases) {
    assert.throws(operation, expectedError, name);
  }
});

test("system alerts use one accessible shell and one dynamic renderer", async () => {
  const [html, css, dom, source] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("styles/home/random-events.css", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
  ]);

  assert.equal(html.match(/id="debug-system-alert-window"/g)?.length, 1);
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /aria-labelledby="debug-system-alert-title"/);
  assert.match(html, /aria-describedby="debug-system-alert-message"/);
  assert.match(html, /data-system-alert-button-id="ok"/);
  assert.match(html, /data-system-alert-action="dismiss"/);
  assert.match(
    html,
    /app-icon-manifest\.js[\s\S]*system-alerts\.js[\s\S]*main\.js/
  );

  assert.match(
    css,
    /\.random-alert-actions\[data-button-alignment="left"\] \{\n  justify-content: flex-start;/
  );
  assert.match(
    css,
    /\.random-alert-actions\[data-button-alignment="center"\] \{\n  justify-content: center;/
  );
  assert.match(
    css,
    /\.random-alert-actions\[data-button-alignment="right"\] \{\n  justify-content: flex-end;/
  );
  assert.match(css, /\.random-alert-actions \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(css, /\.debug-system-alert-message p \{\n  overflow-wrap: anywhere;/);
  assert.match(css, /\.debug-system-alert-message p \{[\s\S]*?white-space: pre-line;/);

  assert.match(dom, /debugSystemAlertWindow:/);
  assert.match(source, /\bdebugSystemAlertWindow\b/);
  for (const elementId of [
    "debug-system-alert-title",
    "debug-system-alert-icon",
    "debug-system-alert-message",
    "debug-system-alert-actions",
  ]) {
    assert.match(source, new RegExp(`querySelector\\("#${elementId}"\\)`));
  }
  assert.doesNotMatch(dom, /debugSystemAlertOk/);
  assert.doesNotMatch(source, /debugSystemAlertOk/);

  assert.match(source, /const SYSTEM_ALERTS = window\.rohinSystemAlerts\.definitions;/);
  assert.match(source, /const renderDebugSystemAlert = \(/);
  assert.match(source, /title\.textContent = alert\.title/);
  assert.match(source, /message\.textContent = alert\.body/);
  assert.match(source, /actions\.dataset\.buttonAlignment = alert\.buttonAlignment/);
  assert.match(source, /const buttons = alert\.buttons\.map\(\(buttonDefinition\) => \{/);
  assert.match(source, /button\.dataset\.systemAlertButtonId = buttonDefinition\.id/);
  assert.match(source, /button\.dataset\.systemAlertAction = buttonDefinition\.action/);
  assert.match(source, /button\.textContent = buttonDefinition\.label/);
  assert.match(source, /buttonDefinition\.action === "dismiss"/);
  assert.match(source, /actions\.replaceChildren\(\.\.\.buttons\)/);
  assert.match(source, /actionButtons\[0\]\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    source,
    /const configureDebugSystemAlertPreview = \(preview, alert\) => \{\n  renderDebugSystemAlert\(alert, \{ root: preview, interactive: false \}\);\n\};/
  );
  assert.match(source, /showManagedRandomEventWindow\(debugSystemAlertWindow/);
  assert.match(source, /closeManagedRandomEventWindow\(debugSystemAlertWindow\)/);
  assert.match(source, /bindManagedRandomEventWindowAnimation\(debugSystemAlertWindow/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.doesNotMatch(source, /DEBUG_SYSTEM_ALERT_BROWSER_TRIGGER_ENABLED/);
});
