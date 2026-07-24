import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT_URL = new URL("../", import.meta.url);
const ICON_DIRECTORY_URL = new URL("assets/app-icons/ico/", ROOT_URL);
const MANIFEST_URL = new URL("scripts/home/app-icon-manifest.js", ROOT_URL);

const compareCodeUnits = (first, second) => (first < second ? -1 : first > second ? 1 : 0);

export const getAppIconNames = async () => {
  const entries = await readdir(ICON_DIRECTORY_URL, { withFileTypes: true });
  const iconNames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".ico"))
    .map((entry) => entry.name)
    .sort(compareCodeUnits);

  if (new Set(iconNames).size !== iconNames.length) {
    throw new Error("Duplicate .ico filenames found in assets/app-icons/ico.");
  }

  return iconNames;
};

export const renderAppIconManifest = (iconNames) =>
  `window.rohinAppIconManifest = [\n${iconNames
    .map((iconName) => `  ${JSON.stringify(iconName)},`)
    .join("\n")}\n];\n`;

const checkManifest = process.argv.includes("--check");
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const expectedManifest = renderAppIconManifest(await getAppIconNames());
  const currentManifest = await readFile(MANIFEST_URL, "utf8");

  if (currentManifest === expectedManifest) {
    process.stdout.write("App icon manifest is current.\n");
  } else if (checkManifest) {
    process.stderr.write(
      "App icon manifest is stale. Run: node scripts/build-app-icon-manifest.mjs\n"
    );
    process.exitCode = 1;
  } else {
    await writeFile(MANIFEST_URL, expectedManifest, "utf8");
    process.stdout.write("Updated scripts/home/app-icon-manifest.js.\n");
  }
}
