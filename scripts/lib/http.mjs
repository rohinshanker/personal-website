/**
 * The bounded outbound-request guard shared by the release-gate scripts. Each
 * caller supplies its own wording so failures name the thing that failed; the
 * request, response-shape, status, and body-read handling is defined once.
 */

export const assertPositiveInteger = (value, label) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
};

/**
 * Validates the injected transport dependencies. `purpose` completes the
 * sentence "A fetch implementation is required <purpose>".
 */
export const assertFetchDependencies = ({
  fetchImpl,
  timeoutMs,
  createTimeoutSignal,
  purpose,
  timeoutLabel,
}) => {
  if (typeof fetchImpl !== "function") {
    throw new TypeError(`A fetch implementation is required ${purpose}`);
  }
  assertPositiveInteger(timeoutMs, timeoutLabel);
  if (typeof createTimeoutSignal !== "function") {
    throw new TypeError(`A timeout signal factory is required ${purpose}`);
  }
};

/**
 * Fetches `url` under a timeout signal and reads its body with `readAs`,
 * rejecting an unusable response shape, a non-OK status, and an unreadable body
 * separately. `messages.statusFailed` receives the status, or `"unknown"` when
 * the response omits an integer status.
 */
export const fetchGuardedBody = async (
  url,
  { fetchImpl, timeoutMs, createTimeoutSignal, init = {}, readAs, messages }
) => {
  let response;
  try {
    response = await fetchImpl(url, {
      ...init,
      signal: createTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    throw new Error(messages.requestFailed, { cause: error });
  }

  if (
    !response ||
    typeof response !== "object" ||
    typeof response[readAs] !== "function"
  ) {
    throw new Error(messages.invalidResponse);
  }
  if (!response.ok) {
    const status = Number.isInteger(response.status) ? response.status : "unknown";
    throw new Error(messages.statusFailed(status));
  }

  try {
    return await response[readAs]();
  } catch (error) {
    throw new Error(messages.bodyUnreadable, { cause: error });
  }
};
