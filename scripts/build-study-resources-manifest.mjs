import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const studyRoot = path.join(repoRoot, "assets", "study resources");
const manifestPath = path.join(repoRoot, "assets", "study resources", "manifest.json");

const toUrlPath = (filePath) =>
  path
    .relative(repoRoot, filePath)
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

      const relativeFolder = path.relative(studyRoot, path.dirname(fullPath));
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

const manifest = {
  root: "Study Resources",
  basePath: "assets/study%20resources",
  files: walk(studyRoot),
};

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${manifest.files.length} PDF entries to ${path.relative(repoRoot, manifestPath)}`);
