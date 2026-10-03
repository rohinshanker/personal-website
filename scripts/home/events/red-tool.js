(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  STANDARD_RANDOM_EVENT_PROBABILITIES,
  STANDARD_RANDOM_EVENT_PROBABILITY,
  bindManagedRandomEventWindowAnimation,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;

const redToolWindow = byId("red-tool-window");
const redToolClose = byId("red-tool-close");
const redToolChatLog = byId("red-tool-chat-log");
const redToolInput = byId("red-tool-input");
const redToolSend = byId("red-tool-send");

let redToolTypingStartTimer = null;

let redToolReplyTimer = null;

let redToolTypingTimer = null;

let redToolTypingFrame = 0;

let redToolTypingElement = null;

const isRedToolVisible = () => isManagedRandomEventWindowVisible(redToolWindow);

const scrollRedToolChatToBottom = () => {
  if (!redToolChatLog) return;
  redToolChatLog.scrollTop = redToolChatLog.scrollHeight;
};

const appendRedToolMessage = (speaker, message, { local = false } = {}) => {
  if (!redToolChatLog) return null;
  const row = document.createElement("div");
  row.className = `red-tool-message${local ? " is-local" : ""}`;

  const icon = document.createElement("img");
  icon.src = local
    ? "assets/app-icons/ico/address_book_user.ico"
    : "assets/random%20events/red-tool-icon.png";
  if (!local) icon.className = "red-tool-avatar";
  icon.alt = "";

  const text = document.createElement("p");
  const name = document.createElement("strong");
  name.textContent = `${speaker}:`;
  text.append(name, ` ${message}`);

  row.append(icon, text);
  redToolChatLog.appendChild(row);
  scrollRedToolChatToBottom();
  return row;
};

const resetRedToolTyping = () => {
  if (redToolTypingStartTimer) {
    clearTimeout(redToolTypingStartTimer);
    redToolTypingStartTimer = null;
  }
  if (redToolReplyTimer) {
    clearTimeout(redToolReplyTimer);
    redToolReplyTimer = null;
  }
  if (redToolTypingTimer) {
    clearInterval(redToolTypingTimer);
    redToolTypingTimer = null;
  }
  redToolTypingFrame = 0;
  if (redToolTypingElement) {
    redToolTypingElement.remove();
    redToolTypingElement = null;
  }
  if (redToolInput) {
    redToolInput.disabled = false;
    redToolInput.placeholder = "Type a message and press Enter";
  }
  if (redToolSend) {
    redToolSend.disabled = false;
  }
};

const sampleRedToolTypingStartDelay = () => 1000 + Math.random() * 1000;

const RED_TOOL_REPLY_BASE_DELAY_MS = 3000;

const sampleRedToolReplyDelay = () => {
  const lambda = 0.5;
  return (-Math.log(1 - Math.random()) / lambda) * 1000;
};

const showRedToolTyping = () => {
  if (!redToolChatLog) return;
  if (redToolTypingElement) redToolTypingElement.remove();
  const row = document.createElement("div");
  row.className = "red-tool-message red-tool-typing";

  const icon = document.createElement("img");
  icon.src = "assets/random%20events/red-tool-icon.png";
  icon.className = "red-tool-avatar";
  icon.alt = "";

  const text = document.createElement("p");
  text.textContent = "Red Tool is typing";

  row.append(icon, text);
  redToolChatLog.appendChild(row);
  redToolTypingElement = row;
  redToolTypingFrame = 0;
  if (redToolTypingTimer) clearInterval(redToolTypingTimer);
  redToolTypingTimer = setInterval(() => {
    redToolTypingFrame = (redToolTypingFrame + 1) % 4;
    text.textContent = `Red Tool is typing${".".repeat(redToolTypingFrame)}`;
  }, 360);
  scrollRedToolChatToBottom();
};

const sendRedToolMessage = () => {
  if (!redToolInput || redToolInput.disabled) return;
  const message = redToolInput.value.trim();
  if (!message) return;
  appendRedToolMessage("You", message, { local: true });
  redToolInput.value = "";
  redToolInput.disabled = true;
  redToolInput.placeholder = "Waiting for Red Tool...";
  if (redToolSend) redToolSend.disabled = true;
  redToolTypingStartTimer = setTimeout(() => {
    redToolTypingStartTimer = null;
    if (isRedToolVisible()) showRedToolTyping();
  }, sampleRedToolTypingStartDelay());
  redToolReplyTimer = setTimeout(() => {
    if (redToolTypingStartTimer) {
      clearTimeout(redToolTypingStartTimer);
      redToolTypingStartTimer = null;
    }
    if (redToolTypingTimer) {
      clearInterval(redToolTypingTimer);
      redToolTypingTimer = null;
    }
    if (redToolTypingElement) redToolTypingElement.remove();
    redToolTypingElement = null;
    appendRedToolMessage("Red Tool", "I don't know.");
    redToolReplyTimer = null;
    if (redToolInput && isRedToolVisible()) {
      redToolInput.disabled = false;
      redToolInput.placeholder = "Type a message and press Enter";
      redToolInput.focus();
    }
    if (redToolSend && isRedToolVisible()) {
      redToolSend.disabled = false;
    }
  }, RED_TOOL_REPLY_BASE_DELAY_MS + sampleRedToolReplyDelay());
};

const showRedToolWindow = () => {
  showManagedRandomEventWindow(redToolWindow, {
    onFront: () => {
      if (redToolInput && !redToolInput.disabled) redToolInput.focus();
    },
    beforeShow: resetRedToolTyping,
    afterShow: () => {
      requestAnimationFrame(() => {
        if (redToolInput) redToolInput.focus();
      });
    },
  });
};

const closeRedToolWindow = () => {
  closeManagedRandomEventWindow(redToolWindow, {
    beforeClose: resetRedToolTyping,
  });
};

registerRandomEvent({
  id: "red-tool",
  preloadTargets: () => [redToolWindow],
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isRedToolVisible,
  canTrigger: () => !isRedToolVisible(),
  run: () => {
    showRedToolWindow();
  },
  bind: () => {
    if (redToolClose) {
      redToolClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRedToolWindow();
      });
    }

    if (redToolInput) {
      redToolInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        sendRedToolMessage();
      });
    }

    if (redToolSend) {
      redToolSend.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        sendRedToolMessage();
      });
    }

    bindManagedRandomEventWindowAnimation(redToolWindow);
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  redToolWindow,
]);

window.homeEventRedTool = Object.freeze({
  redToolWindow,
});
})();
