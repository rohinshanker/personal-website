import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const STUDY_ROOT = path.join(REPOSITORY_ROOT, "assets", "study resources");
const MANIFEST_PATH = path.join(STUDY_ROOT, "manifest.json");

const toUrlPath = (filePath) =>
  path
    .relative(REPOSITORY_ROOT, filePath)
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join("/");

const isPdf = (name) => name.toLowerCase().endsWith(".pdf");

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      if (!entry.isFile() || !isPdf(entry.name)) return [];

      const relativeFolder = path.relative(STUDY_ROOT, path.dirname(fullPath));
      const folderPath = relativeFolder ? relativeFolder.split(path.sep) : [];
      const stats = fs.statSync(fullPath);

      return [
        {
          name: entry.name,
          path: toUrlPath(fullPath),
          folderPath,
          sizeBytes: stats.size,
          thumbnailPages: [1, 2, 3],
          downloadName: entry.name,
        },
      ];
    });
};

export const buildStudyResourcesManifest = () => ({
  root: "Study Resources",
  basePath: "assets/study%20resources",
  files: walk(STUDY_ROOT),
});

export const renderStudyResourcesManifest = (manifest) =>
  `${JSON.stringify(manifest, null, 2)}\n`;

const readCurrentManifest = () => {
  try {
    return fs.readFileSync(MANIFEST_PATH, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

const checkManifest = process.argv.includes("--check");
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const manifest = buildStudyResourcesManifest();
  const expectedManifest = renderStudyResourcesManifest(manifest);

  if (readCurrentManifest() === expectedManifest) {
    process.stdout.write(
      `Study resources manifest is current with ${manifest.files.length} PDF entries.\n`
    );
  } else if (checkManifest) {
    process.stderr.write(
      "Study resources manifest is stale. Run: node scripts/build-study-resources-manifest.mjs\n"
    );
    process.exitCode = 1;
  } else {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, expectedManifest);
    process.stdout.write(
      `Wrote ${manifest.files.length} PDF entries to ${path.relative(
        REPOSITORY_ROOT,
        MANIFEST_PATH
      )}.\n`
    );
  }
}
