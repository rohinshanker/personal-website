import { readFile } from "node:fs/promises";

import { listHomeScriptFiles, repositoryRoot } from "./home-scripts.mjs";

/**
 * The Home page's load-time dependency graph, read from the scripts themselves.
 *
 * Each script publishes one frozen contract on `window` and destructures the
 * contracts it needs at the top, so the graph is exactly what those two shapes
 * say. Deriving it here means no test has to keep a hand-written copy.
 */

const CONTRACT_NAME = "(?:home[A-Za-z]*|rohinAdminOrchestrator)";
const CONTRACT_IMPORT = new RegExp(`\\}\\s*=\\s*window\\.(${CONTRACT_NAME})\\s*;`, "g");
const CONTRACT_PUBLISH = new RegExp(
  `window\\.(${CONTRACT_NAME})\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\n\\}\\)\\s*;`,
  "g"
);

/** Names a destructuring or object-literal block binds, ignoring comments. */
export function blockNames(block) {
  return block
    .replace(/\/\/[^\n]*/g, "")
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(":")[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

/** Every `const { … } = window.<contract>;` block in one script. */
export function contractImports(source) {
  const imports = [];
  for (const match of source.matchAll(CONTRACT_IMPORT)) {
    const open = source.lastIndexOf("{", match.index);
    if (open === -1) continue;
    imports.push({
      contract: match[1],
      names: blockNames(source.slice(open + 1, match.index)),
    });
  }
  return imports;
}

/**
 * Every `window.<contract> = Object.freeze({ … });` block in one script.
 * `shorthand` are the keys that are also the local binding name, which is what
 * a declaration check can verify.
 */
export function contractPublications(source) {
  const published = [];
  for (const match of source.matchAll(CONTRACT_PUBLISH)) {
    const lines = match[2]
      .replace(/\/\/[^\n]*/g, "")
      .split("\n")
      .map((line) => line.trim());
    published.push({
      contract: match[1],
      names: blockNames(match[2]),
      shorthand: lines
        .filter((line) => /^[A-Za-z_$][\w$]*,$/.test(line))
        .map((line) => line.slice(0, -1)),
    });
  }
  return published;
}

/**
 * `{ files, sources, publishedBy, dependencies }` for every Home script, where
 * `dependencies` maps a script to the scripts whose contracts it reads while
 * loading.
 */
export async function loadHomeContractGraph() {
  const files = listHomeScriptFiles();
  const sources = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        await readFile(new URL(file, repositoryRoot), "utf8"),
      ])
    )
  );

  const publishedBy = new Map();
  const duplicates = [];
  for (const file of files) {
    for (const { contract, names, shorthand } of contractPublications(sources[file])) {
      if (publishedBy.has(contract)) {
        duplicates.push(`window.${contract}: ${publishedBy.get(contract).file} and ${file}`);
        continue;
      }
      publishedBy.set(contract, { file, names: new Set(names), shorthand });
    }
  }

  const dependencies = new Map();
  for (const file of files) {
    const needed = new Set();
    for (const { contract } of contractImports(sources[file])) {
      const owner = publishedBy.get(contract);
      if (owner && owner.file !== file) needed.add(owner.file);
    }
    dependencies.set(file, needed);
  }

  return { files, sources, publishedBy, dependencies, duplicates };
}

/** The given scripts plus everything they transitively read at load time. */
export function loadTimeClosure(dependencies, seeds) {
  const closure = new Set();
  const visit = (file) => {
    if (closure.has(file)) return;
    closure.add(file);
    for (const dependency of dependencies.get(file) || []) visit(dependency);
  };
  seeds.forEach(visit);
  return closure;
}
