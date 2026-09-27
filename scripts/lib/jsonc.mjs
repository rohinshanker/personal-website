/**
 * Minimal JSONC support for the Worker's `wrangler.jsonc` configuration.
 *
 * Wrangler accepts `//` line comments, block comments, and trailing commas, so
 * every repository reader of that file must too. `JSON.parse` does not, which
 * is why these helpers exist instead of a direct parse.
 */

/** Index just past the closing quote of the string opening at `start`. */
const readStringEnd = (source, start) => {
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === '"') return index + 1;
  }
  return source.length;
};

/** Blanks a span while keeping its length and line breaks, so offsets and
 * reported error positions still line up with the original source. */
const blankSpan = (span) => span.replace(/[^\n\r]/g, " ");

export const stripJsoncComments = (source) => {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') {
      const end = readStringEnd(source, index);
      output += source.slice(index, end);
      index = end;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      const lineBreak = source.slice(index).search(/[\n\r]/);
      const end = lineBreak === -1 ? source.length : index + lineBreak;
      output += blankSpan(source.slice(index, end));
      index = end;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      const end = close === -1 ? source.length : close + 2;
      output += blankSpan(source.slice(index, end));
      index = end;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
};

export const stripJsoncTrailingCommas = (source) => {
  const characters = source.split("");
  let trailingCommaIndex = -1;
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') {
      index = readStringEnd(source, index);
      trailingCommaIndex = -1;
      continue;
    }
    if (character === ",") {
      trailingCommaIndex = index;
    } else if (character === "}" || character === "]") {
      if (trailingCommaIndex !== -1) characters[trailingCommaIndex] = " ";
      trailingCommaIndex = -1;
    } else if (!/\s/.test(character)) {
      trailingCommaIndex = -1;
    }
    index += 1;
  }
  return characters.join("");
};

export const parseJsonc = (source) => {
  if (typeof source !== "string") {
    throw new TypeError("JSONC source must be a string");
  }
  return JSON.parse(stripJsoncTrailingCommas(stripJsoncComments(source)));
};

/**
 * Replaces the value of the single top-level-unique string member named `key`,
 * leaving every other byte — comments included — untouched.
 */
export const replaceJsoncStringMember = (source, key, value) => {
  const pattern = new RegExp(
    `("${key}"\\s*:\\s*)("(?:\\\\.|[^"\\\\])*")`,
    "g"
  );
  const matches = [...stripJsoncComments(source).matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(
      `JSONC source must contain exactly one string member named ${key}`
    );
  }
  const [, prefix, currentValue] = matches[0];
  const start = matches[0].index + prefix.length;
  return (
    source.slice(0, start) +
    JSON.stringify(value) +
    source.slice(start + currentValue.length)
  );
};
