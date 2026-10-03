/**
 * Finds statements that run while a classic script loads and read a top-level
 * `const`/`let`/`class` binding declared further down the file. Those throw a
 * ReferenceError in the browser from the temporal dead zone and take the whole
 * script with them, so they are worth catching without a browser.
 */

/** Blanks comments, strings and regex bodies, keeping `${…}` expressions. */
export function stripLiterals(source) {
  const out = Array.from(source);
  const blank = (from, to) => {
    for (let index = from; index < to; index += 1) {
      if (out[index] !== "\n") out[index] = " ";
    }
  };
  let index = 0;
  let previous = "";
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === "/" && next === "/") {
      let end = index;
      while (end < source.length && source[end] !== "\n") end += 1;
      blank(index, end);
      index = end;
      continue;
    }
    if (character === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      const end = close === -1 ? source.length : close + 2;
      blank(index, end);
      index = end;
      continue;
    }
    if (character === '"' || character === "'") {
      let end = index + 1;
      while (end < source.length) {
        if (source[end] === "\\") {
          end += 2;
          continue;
        }
        if (source[end] === character) break;
        end += 1;
      }
      blank(index + 1, end);
      index = end + 1;
      previous = character;
      continue;
    }
    if (character === "`") {
      // Rewrite the delimiters to brackets so nesting stays balanced and the
      // `}` that closes `${…}` is never mistaken for the end of a block.
      let cursor = index + 1;
      let textStart = cursor;
      out[index] = "(";
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === "$" && source[cursor + 1] === "{") {
          blank(textStart, cursor);
          out[cursor] = "[";
          out[cursor + 1] = " ";
          cursor += 2;
          let depth = 1;
          while (cursor < source.length && depth > 0) {
            if (source[cursor] === "\\") {
              cursor += 2;
              continue;
            }
            if (source[cursor] === "{") depth += 1;
            else if (source[cursor] === "}") {
              depth -= 1;
              if (depth === 0) {
                out[cursor] = "]";
                break;
              }
            } else if ("\"'`".includes(source[cursor])) {
              const quote = source[cursor];
              const quoteStart = cursor;
              cursor += 1;
              while (cursor < source.length) {
                if (source[cursor] === "\\") {
                  cursor += 2;
                  continue;
                }
                if (source[cursor] === quote) break;
                cursor += 1;
              }
              blank(quoteStart + 1, cursor);
            }
            cursor += 1;
          }
          cursor += 1;
          textStart = cursor;
          continue;
        }
        if (source[cursor] === "`") {
          blank(textStart, cursor);
          out[cursor] = ")";
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      index = cursor;
      previous = ")";
      continue;
    }
    if (character === "/" && !/[A-Za-z0-9_$)\]]/.test(previous)) {
      let end = index + 1;
      let inClass = false;
      let closed = false;
      while (end < source.length) {
        const current = source[end];
        if (current === "\\") {
          end += 2;
          continue;
        }
        if (current === "\n") break;
        if (inClass) {
          if (current === "]") inClass = false;
        } else if (current === "[") inClass = true;
        else if (current === "/") {
          closed = true;
          end += 1;
          break;
        }
        end += 1;
      }
      if (closed) {
        blank(index, end);
        index = end;
        previous = ")";
        continue;
      }
    }
    if (!/\s/.test(character)) previous = character;
    index += 1;
  }
  return out.join("");
}

/**
 * The nesting depth at which a script's own top level sits. `(() => {` opens
 * two brackets before the body, so an IIFE's top level is depth two; an ES
 * module's is depth zero.
 */
export function topLevelDepth(code) {
  return /^\s*\(\(\)\s*=>\s*\{/.test(code) ? 2 : 0;
}

const BLOCK_KEYWORDS = ["if", "for", "while", "switch", "try", "catch", "finally", "else", "do"];
const CONTINUATION_KEYWORDS = ["else", "catch", "finally", "while"];

/** Line number for every character offset. */
function lineNumbers(code) {
  const lines = new Array(code.length);
  let line = 1;
  for (let index = 0; index < code.length; index += 1) {
    lines[index] = line;
    if (code[index] === "\n") line += 1;
  }
  return lines;
}

/** True when the token after a closing `}` keeps the same statement going. */
function continuesStatement(code, from) {
  let index = from;
  while (index < code.length && /\s/.test(code[index])) index += 1;
  if (index >= code.length) return false;
  if (";.,)]}(?:+-*/%&|=<>!".includes(code[index])) return true;
  return CONTINUATION_KEYWORDS.some(
    (keyword) =>
      code.startsWith(keyword, index) && !/[\w$]/.test(code[index + keyword.length] || "")
  );
}

/**
 * Top-level statements as `[line, code]` pairs. A statement ends at a
 * semicolon, or at a `}` that closes a block and is not continued by `else`,
 * `catch`, `finally` or a chained call.
 */
export function topLevelStatements(code, topDepth) {
  const lines = lineNumbers(code);
  const statements = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < code.length; index += 1) {
    const character = code[index];

    if (depth === topDepth && start === -1 && !/[\s;})\]]/.test(character)) {
      start = index;
    }
    if ("([{".includes(character)) {
      depth += 1;
      continue;
    }
    if (")]}".includes(character)) {
      depth -= 1;
      if (
        depth === topDepth &&
        character === "}" &&
        start !== -1 &&
        !continuesStatement(code, index + 1)
      ) {
        statements.push([lines[start], code.slice(start, index + 1)]);
        start = -1;
      }
      continue;
    }
    if (depth === topDepth && character === ";" && start !== -1) {
      statements.push([lines[start], code.slice(start, index + 1)]);
      start = -1;
    }
  }
  if (start !== -1) statements.push([lines[start], code.slice(start)]);
  return statements;
}

/** True when the `(` group ending at `index` belongs to a block keyword. */
function isBlockKeywordGroup(statement, parenStart) {
  const before = statement.slice(0, parenStart).trimEnd();
  return BLOCK_KEYWORDS.some(
    (keyword) => before.endsWith(keyword) && !/[\w$]/.test(before[before.length - keyword.length - 1] || "")
  );
}

/**
 * The statement with every function and arrow body blanked, so only what runs
 * while the script loads is left. A braced body that belongs to `if`, `for`,
 * `while`, `switch` or `try` is kept, because it runs now.
 *
 * A concise arrow body is blanked too, which is why a callback a load-time
 * `forEach` invokes straight away is not inspected. Everything this is for --
 * the object and array literals a script builds while loading -- is.
 */
export function blankDeferredBodies(statement) {
  const out = Array.from(statement);
  const blank = (from, to) => {
    for (let index = from; index < to; index += 1) {
      if (out[index] !== "\n") out[index] = " ";
    }
  };

  // Parameter lists bind names; they never read an outer binding.
  for (const match of statement.matchAll(/(?:\bfunction\b\s*[\w$]*\s*|=\s*)\(/g)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let end = open;
    for (; end < statement.length; end += 1) {
      if ("([{".includes(statement[end])) depth += 1;
      else if (")]}".includes(statement[end])) {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const after = statement.slice(end + 1).trimStart();
    if (after.startsWith("=>") || /^\{/.test(after)) blank(open + 1, end);
  }

  for (let index = 0; index < statement.length; index += 1) {
    if (statement[index] === "{") {
      const before = statement.slice(0, index).trimEnd();
      const isBody =
        before.endsWith("=>") ||
        /\bfunction\b\s*[\w$]*\s*$/.test(before) ||
        (before.endsWith(")") && !isBlockKeywordGroup(statement, before.lastIndexOf("(")));
      if (!isBody) continue;
      let depth = 0;
      let end = index;
      for (; end < statement.length; end += 1) {
        if ("([{".includes(statement[end])) depth += 1;
        else if (")]}".includes(statement[end])) {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      blank(index + 1, end);
      index = end;
      continue;
    }
    if (statement[index] === "=" && statement[index + 1] === ">") {
      let cursor = index + 2;
      while (cursor < statement.length && /\s/.test(statement[cursor])) cursor += 1;
      if (statement[cursor] === "{") continue;
      // Concise body: everything to the enclosing delimiter is deferred.
      let depth = 0;
      let end = cursor;
      for (; end < statement.length; end += 1) {
        const character = statement[end];
        if ("([{".includes(character)) depth += 1;
        else if (")]}".includes(character)) {
          if (depth === 0) break;
          depth -= 1;
        } else if (depth === 0 && (character === "," || character === ";")) break;
      }
      blank(cursor, end);
      index = end;
    }
  }
  return out.join("");
}

/** Top-level `const`/`let`/`class` bindings and the line each is declared on. */
export function topLevelDeclarations(code, topDepth) {
  const declarations = new Map();
  for (const [line, statement] of topLevelStatements(code, topDepth)) {
    const match = /^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/.exec(statement);
    if (match && !declarations.has(match[1])) declarations.set(match[1], line);
    // Destructuring declares several names on one line.
    const pattern = /^(?:const|let)\s*[{[]/.exec(statement);
    if (!pattern) continue;
    const close = statement.indexOf("} =");
    const body = statement.slice(pattern[0].length - 1, close === -1 ? undefined : close);
    for (const name of body.matchAll(/([A-Za-z_$][\w$]*)\s*(?:[,}\]]|$)/g)) {
      if (!declarations.has(name[1])) declarations.set(name[1], line);
    }
  }
  return declarations;
}

/**
 * Every load-time read of a later top-level binding in one script's source, as
 * `"<line> reads <name>, declared at line <n>"`.
 */
export function findForwardReferences(source) {
  const code = stripLiterals(source);
  const topDepth = topLevelDepth(code);
  const declaredAt = topLevelDeclarations(code, topDepth);
  const problems = [];

  for (const [line, statement] of topLevelStatements(code, topDepth)) {
    const eager = blankDeferredBodies(statement);
    const declaring = /^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/.exec(statement)?.[1];
    for (const match of eager.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)) {
      const name = match[1];
      if (name === declaring) continue;
      // A property key names nothing: `{ later: value }` reads `value`.
      if (/^\s*:/.test(eager.slice(match.index + name.length))) continue;
      const declarationLine = declaredAt.get(name);
      if (declarationLine === undefined || declarationLine <= line) continue;
      problems.push(`${line} reads ${name}, declared at line ${declarationLine}`);
    }
  }
  return problems;
}
