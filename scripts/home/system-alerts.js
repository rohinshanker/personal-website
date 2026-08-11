(() => {
  const DEFAULT_TITLE = "System Alert";
  const DEFAULT_BUTTON_ALIGNMENT = "right";
  const DEFAULT_BUTTONS = Object.freeze([
    Object.freeze({ label: "OK", action: "dismiss" }),
  ]);
  const SUPPORTED_BUTTON_ALIGNMENTS = new Set(["left", "center", "right"]);
  const SUPPORTED_BUTTON_ACTIONS = new Set(["dismiss"]);
  const SYSTEM_ALERT_ID_PATTERN = /^(?=.{1,96}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const SYSTEM_ALERT_BUTTON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const SYSTEM_ALERT_ICON_PATTERN =
    /^assets\/app-icons\/ico\/([A-Za-z0-9_.-]+\.ico)$/;

  const readRequiredText = (value, label) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(`${label} must be a non-empty string`);
    }
    return value.trim();
  };

  const createButtonId = (label) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const normalizeButton = (button, alertId, index, usedButtonIds) => {
    if (!button || typeof button !== "object" || Array.isArray(button)) {
      throw new TypeError(
        `System alert ${alertId} button ${index + 1} must be an object`
      );
    }
    const label = readRequiredText(
      button.label,
      `System alert ${alertId} button ${index + 1} label`
    );
    const id = button.id === undefined
      ? createButtonId(label)
      : readRequiredText(
          button.id,
          `System alert ${alertId} button ${index + 1} id`
        );
    if (!SYSTEM_ALERT_BUTTON_ID_PATTERN.test(id)) {
      throw new Error(
        `System alert ${alertId} button ${index + 1} id must be lowercase kebab-case`
      );
    }
    if (usedButtonIds.has(id)) {
      throw new Error(`System alert ${alertId} has duplicate button id ${id}`);
    }
    usedButtonIds.add(id);

    const action = readRequiredText(
      button.action,
      `System alert ${alertId} button ${index + 1} action`
    );
    if (!SUPPORTED_BUTTON_ACTIONS.has(action)) {
      throw new Error(`System alert ${alertId} has unsupported button action ${action}`);
    }
    return Object.freeze({ id, label, action });
  };

  const normalizeDefinition = (definition, index, usedAlertIds, iconFileNames) => {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new TypeError(`System alert ${index + 1} must be an object`);
    }
    const id = readRequiredText(definition.id, `System alert ${index + 1} id`);
    if (!SYSTEM_ALERT_ID_PATTERN.test(id)) {
      throw new Error(
        `System alert ${id} id must be lowercase kebab-case with at most 96 characters`
      );
    }
    if (usedAlertIds.has(id)) {
      throw new Error(`Duplicate system alert id ${id}`);
    }
    usedAlertIds.add(id);

    const icon = readRequiredText(definition.icon, `System alert ${id} icon`);
    const iconMatch = SYSTEM_ALERT_ICON_PATTERN.exec(icon);
    if (!iconMatch || !iconFileNames.has(iconMatch[1])) {
      throw new Error(`System alert ${id} icon must reference an existing local ICO asset`);
    }

    const title = definition.title === undefined
      ? DEFAULT_TITLE
      : readRequiredText(definition.title, `System alert ${id} title`);
    const label = definition.label === undefined
      ? `System Alert — ${id
        .split("-")
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(" ")}`
      : readRequiredText(definition.label, `System alert ${id} label`);
    const body = readRequiredText(definition.body, `System alert ${id} body`);
    const buttonAlignment = definition.buttonAlignment === undefined
      ? DEFAULT_BUTTON_ALIGNMENT
      : readRequiredText(
          definition.buttonAlignment,
          `System alert ${id} buttonAlignment`
        );
    if (!SUPPORTED_BUTTON_ALIGNMENTS.has(buttonAlignment)) {
      throw new Error(
        `System alert ${id} has unsupported button alignment ${buttonAlignment}`
      );
    }

    const buttonInputs = definition.buttons === undefined
      ? DEFAULT_BUTTONS
      : definition.buttons;
    if (!Array.isArray(buttonInputs) || buttonInputs.length === 0) {
      throw new TypeError(`System alert ${id} buttons must be a non-empty array`);
    }
    const usedButtonIds = new Set();
    const buttons = Object.freeze(
      buttonInputs.map((button, buttonIndex) =>
        normalizeButton(button, id, buttonIndex, usedButtonIds)
      )
    );

    return Object.freeze({
      id,
      label,
      title,
      icon,
      body,
      buttons,
      buttonAlignment,
    });
  };

  const normalizeDefinitions = (
    definitions,
    { iconFileNames = window.rohinAppIconManifest } = {}
  ) => {
    if (!Array.isArray(definitions)) {
      throw new TypeError("System alert definitions must be an array");
    }
    if (!Array.isArray(iconFileNames)) {
      throw new TypeError("System alert icon manifest must be an array");
    }
    const usedAlertIds = new Set();
    const knownIconFileNames = new Set(iconFileNames);
    return Object.freeze(
      definitions.map((definition, index) =>
        normalizeDefinition(definition, index, usedAlertIds, knownIconFileNames)
      )
    );
  };

  /*
   * Copy/paste this object into SYSTEM_ALERT_INPUTS to add a basic alert.
   * `buttons` and `buttonAlignment` may be omitted to get one right-aligned OK
   * button that dismisses the alert.
   *
   * Object.freeze({
   *   id: "replace-with-unique-kebab-case-id",
   *   label: "System Alert — Replace With Administrator Label",
   *   icon: "assets/app-icons/ico/msg_information.ico",
   *   body: "Replace with the system-alert body text.",
   *   buttons: Object.freeze([
   *     Object.freeze({ label: "OK", action: "dismiss" }),
   *   ]),
   *   buttonAlignment: "right",
   * }),
   */
  const SYSTEM_ALERT_INPUTS = Object.freeze([
    Object.freeze({
      id: "ram-prices",
      icon: "assets/app-icons/ico/processor.ico",
      body: "RAM prices went up again.",
    }),
    Object.freeze({
      id: "computer-nevermind",
      icon: "assets/app-icons/ico/msg_error.ico",
      body: "Error: your computer is umm.. uh. actually never mind",
    }),
    Object.freeze({
      id: "received-fax",
      icon: "assets/app-icons/ico/fax_machine_exclam.ico",
      body: "You received a fax.",
    }),
    Object.freeze({
      id: "make-art",
      icon: "assets/app-icons/ico/paint_old.ico",
      body: "Go make some art today!",
    }),
    Object.freeze({
      id: "required-file",
      title: "Error Starting Program",
      icon: "assets/app-icons/ico/msg_warning.ico",
      body: "A required file È9å|ļ1(VÿB.LL was not found.",
    }),
    Object.freeze({
      id: "unexpected-error",
      title: "Microsoft Data Link",
      icon: "assets/app-icons/ico/msg_warning.ico",
      body: "An unexpected error. Please investigate.",
    }),
    Object.freeze({
      id: "three-wise-monkeys",
      icon: "assets/app-icons/ico/msagent_file.ico",
      body: "See no evil, hear no evil, speak no evil.",
    }),
    Object.freeze({
      id: "ask-for-help",
      icon: "assets/app-icons/ico/help_question_mark.ico",
      body: "It is okay to ask for help when you need it.",
    }),
    Object.freeze({
      id: "leave-the-house",
      icon: "assets/app-icons/ico/address_book_home.ico",
      body: "Don't forget to leave your house sometimes!",
    }),
    Object.freeze({
      id: "always-watching",
      icon: "assets/app-icons/ico/file_eye.ico",
      body: "They are always watching.",
    }),
    Object.freeze({
      id: "seneca-announcement",
      title: "System Announcement",
      icon: "assets/app-icons/ico/certificate_no.ico",
      body:
        "“Let it offend you that someone else could be handed your days and turn them into something greater.”\n" +
        "—Lucius Annaeus Seneca",
    }),
    Object.freeze({
      id: "deodorant-reminder",
      icon: "assets/app-icons/ico/user_computer_pair.ico",
      body:
        "Be sure to shower and wear deodorant! Or don't. I'm just a website, who am I to tell you?",
    }),
    Object.freeze({
      id: "power-cycle-reminder",
      icon: "assets/app-icons/ico/shell_window1.ico",
      body:
        "It is important to turn off your computer periodically. Leaving it on for long amounts of time will make it stressed out and sad!",
    }),
    Object.freeze({
      id: "substack-reminder",
      label: "System Alert – Substack Reminder",
      icon: "assets/app-icons/ico/help_book_computer.ico",
      body: "Don't forget to check out my substack!",
    }),
    Object.freeze({
      id: "goldfish",
      label: "System Alert – Goldfish",
      icon: "assets/app-icons/ico/msg_information.ico",
      body: "Don't overfeed your goldfish!",
    }),
    Object.freeze({
      id: "browser-infected",
      label: "System Alert — Browser Infected",
      icon: "assets/app-icons/ico/msie1.ico",
      body:
        "Attention!!! Multiple viruses have been detected on your computer. I think.",
    }),
    Object.freeze({
      id: "operation-unsupported",
      label: "System Alert – Operation Unsupported",
      icon: "assets/app-icons/ico/msg_error.ico",
      body: "Error: Operation is not supported.",
    }),
    Object.freeze({
      id: "time-warning",
      label: "System Alert — Time Warning",
      icon: "assets/app-icons/ico/clock.ico",
      body: "Your time is limited. Make the most of it!",
    }),
    Object.freeze({
      id: "question-everything",
      label: "System Alert — Question Everything",
      icon: "assets/app-icons/ico/circle_question.ico",
      body: "Question everything.",
    }),
    Object.freeze({
      id: "degrees",
      label: "System Alert — Degrees",
      icon: "assets/app-icons/ico/certificate_seal.ico",
      body: "C's get degrees.",
    }),
    Object.freeze({
      id: "comdex",
      label: "System Alert — Comdex",
      icon: "assets/app-icons/ico/rj_jack.ico",
      body: "Don't plug in a USB scanner during the COMDEX 1998 Spring Keynote...",
    }),
    Object.freeze({
      id: "battery",
      label: "System Alert — battery",
      icon: "assets/app-icons/ico/battery.ico",
      body: "Warning: Your device has low battery. I believe.",
    }),
    Object.freeze({
      id: "tabs",
      label: "System Alert — tabs",
      icon: "assets/app-icons/ico/accessibility_two_windows.ico",
      body: "Don't forget to close your unused tabs!",
    }),
    Object.freeze({
      id: "eye-strain",
      label: "System Alert — eye strain",
      icon: "assets/app-icons/ico/color_profile_gray.ico",
      body: "Spending too much time on screens will strain your eyes.",
    }),
    Object.freeze({
      id: "social-media",
      label: "System Alert — social media",
      icon: "assets/app-icons/ico/installer_generic_old.ico",
      body:
        "Social media promotes inflammatory content to maintian your attention and make the most ad revenue off of you.",
    }),
    Object.freeze({
      id: "language",
      label: "System Alert — Language",
      icon: "assets/app-icons/ico/charmap.ico",
      body:
        "Learn another language! There are few better things you can spend your time doing.",
    }),
    Object.freeze({
      id: "radio-waves",
      label: "System Alert — radio waves",
      icon: "assets/app-icons/ico/infrared.ico",
      body: "Continuous exposure to Wi-Fi and radio waves isn't the best for your body.",
    }),
    Object.freeze({
      id: "cereal",
      label: "System Alert — Cereal",
      icon: "assets/app-icons/ico/search_computer.ico",
      body: "I love cereal.",
    }),
    Object.freeze({
      id: "keys",
      label: "System Alert — Keys",
      icon: "assets/app-icons/ico/keys.ico",
      body: "Don't forget your keys, phone, and wallet!",
    }),
    Object.freeze({
      id: "photos",
      label: "System Alert - Photos",
      icon: "assets/app-icons/ico/pictures.ico",
      body: "Don't forget to backup your photos. Memories are irreplaceable.",
    }),
  ]);

  const definitions = normalizeDefinitions(SYSTEM_ALERT_INPUTS);
  window.rohinSystemAlerts = Object.freeze({
    definitions,
    normalizeDefinitions,
  });
})();
