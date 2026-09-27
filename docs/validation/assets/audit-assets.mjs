// audit-assets.mjs — read-only audit of assets/ references, duplicates, case mismatches.
// Run: node audit-assets.mjs /path/to/personal-website > report.json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.argv[2] || ".");
const SKIP_DIRS = new Set(["node_modules", ".git", ".playwright-cli", "test-results", "playwright-report", ".wrangler"]);
const NON_SHIPPED_TOP = new Set(["tests", "docs", "workers"]);
const CORPUS_EXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt", ".svg", ".md", ".yml"]);

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); }
    else if (e.isFile()) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

// ---- 1. assets inventory ----
const assetFiles = walk(path.join(ROOT, "assets")).map((p) => {
  const buf = fs.readFileSync(p);
  return { rel: rel(p), size: buf.length, sha: crypto.createHash("sha256").update(buf).digest("hex"), base: path.basename(p) };
});

// ---- 2. corpus ----
const corpus = walk(ROOT).filter((p) => CORPUS_EXT.has(path.extname(p).toLowerCase()) && !rel(p).startsWith("assets/") || (rel(p).startsWith("assets/") && [".json", ".css", ".js", ".svg"].includes(path.extname(p).toLowerCase())));
const isShipped = (r) => {
  const top = r.split("/")[0];
  if (NON_SHIPPED_TOP.has(top)) return false;
  if (top === "scripts") return r.startsWith("scripts/home/");
  if (top === ".github") return false;
  if (r === "package.json" || r === "package-lock.json" || r === "playwright.config.mjs") return false;
  return true;
};
const texts = corpus.map((p) => ({ rel: rel(p), text: fs.readFileSync(p, "utf8"), shipped: isShipped(rel(p)) }));

// ---- 3. extract literal refs ----
const REF_RE = /(?:\.\.\/)*\/?assets\/[^"'`()<>\s?#,]+/g;
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const refs = new Map(); // normalized path -> Set(files)
for (const f of texts) {
  for (const m of f.text.matchAll(REF_RE)) {
    let r = m[0].replace(/^(\.\.\/)+/, "").replace(/^\//, "");
    r = safeDecode(r).replace(/[.;:]+$/, "");
    if (!refs.has(r)) refs.set(r, new Set());
    refs.get(r).add(f.rel);
  }
}

// ---- 4. structured dynamic refs ----
const structured = new Map(); // path -> source description
const addStructured = (p, why) => { if (!structured.has(p)) structured.set(p, why); };
// modeling-portfolio.js
const mp = fs.readFileSync(path.join(ROOT, "scripts/home/modeling-portfolio.js"), "utf8");
for (const m of mp.matchAll(/folder:\s*"([^"]+)",\s*files:\s*\[([^\]]*)\]/g)) {
  for (const f of m[2].matchAll(/"([^"]+)"/g)) addStructured(`${m[1]}/${f[1]}`, "modeling-portfolio.js folder+files");
}
// app icon manifest
const manifest = fs.readFileSync(path.join(ROOT, "scripts/home/app-icon-manifest.js"), "utf8");
for (const m of manifest.matchAll(/"([^"]+\.ico)"/g)) addStructured(`assets/app-icons/ico/${m[1]}`, "app-icon-manifest.js");
// dynamic directory patterns
const DYNAMIC_DIRS = [
  { prefix: "assets/minesweeper_assets/cell_numbers/", test: (b) => /^cell_\d+\.png$/.test(b), why: "main.js template cell_${index+1}.png" },
  { prefix: "assets/cursor-assets/generated-png/", test: (b) => /^[a-z-]+-(light|dark)\.png$/.test(b), why: "video-editor/cursor.js template ${name}-${mode}.png" },
  { prefix: "assets/cursor-assets/Jeelh-Cursor-Light/working-in-background-frames/", test: (b) => /^working-in-background-light-\d+\.png$/.test(b), why: "video-editor/cursor.js frames template" },
  { prefix: "assets/cursor-assets/Jeelh-Cursor-Dark/working-in-background-frames/", test: (b) => /^working-in-background-\d+\.png$/.test(b), why: "video-editor/cursor.js frames template" },
];
// study resources manifest
const study = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/study resources/manifest.json"), "utf8"));
for (const f of study.files || []) addStructured(safeDecode(f.path), "study resources manifest.json");

// ---- 5. classify each asset ----
const shippedText = texts.filter((t) => t.shipped).map((t) => t.text).join("\n");
const shippedTextDecoded = safeDecode(shippedText.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
const allText = texts.map((t) => t.text).join("\n");
const basenameHit = (base, hay) => {
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\/"'\`\\s(=,])${esc}(?=$|["'\`\\s)?#,;<])`, "m").test(hay);
};
const results = assetFiles.map((a) => {
  const r = a.rel;
  const litFiles = refs.get(r);
  const litShipped = litFiles ? [...litFiles].filter(isShipped) : [];
  const litNon = litFiles ? [...litFiles].filter((f) => !isShipped(f)) : [];
  let status, via = [];
  if (litShipped.length) { status = "exact"; via = litShipped; }
  else if (structured.has(r)) { status = "structured"; via = [structured.get(r)]; }
  else {
    const dyn = DYNAMIC_DIRS.find((d) => r.startsWith(d.prefix) && d.test(a.base));
    if (dyn) { status = "dynamic-dir"; via = [dyn.why]; }
    else if (basenameHit(a.base, shippedTextDecoded)) { status = "basename-only"; via = texts.filter((t) => t.shipped && basenameHit(a.base, safeDecode(t.text.replace(/%(?![0-9A-Fa-f]{2})/g, "%25")))).map((t) => t.rel); }
    else if (litNon.length) { status = "non-shipped-only"; via = litNon; }
    else if (basenameHit(a.base, allText)) { status = "basename-non-shipped"; via = []; }
    else status = "unreferenced";
  }
  return { ...a, status, via };
});

// ---- 6. case + existence check of every literal ref ----
const existsExact = (p) => {
  let cur = ROOT;
  for (const part of p.split("/")) {
    if (!fs.existsSync(cur)) return false;
    const entries = fs.readdirSync(cur);
    if (!entries.includes(part)) return false;
    cur = path.join(cur, part);
  }
  return true;
};
const existsInsensitive = (p) => {
  let cur = ROOT;
  for (const part of p.split("/")) {
    if (!fs.existsSync(cur) || !fs.statSync(cur).isDirectory()) return null;
    const hit = fs.readdirSync(cur).find((e) => e.toLowerCase() === part.toLowerCase());
    if (!hit) return null;
    cur = path.join(cur, hit);
  }
  return rel(cur);
};
const refChecks = [];
for (const [r, files] of refs) {
  if (r.endsWith("/")) continue;
  if (!existsExact(r)) {
    const ci = existsInsensitive(r);
    refChecks.push({ ref: r, files: [...files], problem: ci ? "case-mismatch" : "missing", actual: ci });
  }
}

// ---- 7. duplicates ----
const byHash = new Map();
for (const a of assetFiles) { if (!byHash.has(a.sha)) byHash.set(a.sha, []); byHash.get(a.sha).push(a); }
const dups = [...byHash.values()].filter((g) => g.length > 1).map((g) => ({ size: g[0].size, wasted: g[0].size * (g.length - 1), paths: g.map((x) => x.rel) })).sort((a, b) => b.wasted - a.wasted);

// ---- output ----
const sum = (arr) => arr.reduce((n, a) => n + a.size, 0);
const byStatus = {};
for (const r of results) { byStatus[r.status] ??= { count: 0, bytes: 0 }; byStatus[r.status].count++; byStatus[r.status].bytes += r.size; }
const unref = results.filter((r) => r.status === "unreferenced" || r.status === "non-shipped-only" || r.status === "basename-non-shipped").sort((a, b) => b.size - a.size);
console.log(JSON.stringify({
  totals: { files: assetFiles.length, bytes: sum(assetFiles) },
  byStatus,
  unreferenced: { count: unref.length, bytes: sum(unref), top40: unref.slice(0, 40).map((r) => ({ path: r.rel, size: r.size, status: r.status, via: r.via })) },
  unreferencedAll: unref.map((r) => [r.rel, r.size, r.status]),
  basenameOnly: results.filter((r) => r.status === "basename-only").map((r) => ({ path: r.rel, size: r.size, via: r.via })),
  refProblems: refChecks,
  duplicates: { groups: dups.length, wastedBytes: dups.reduce((n, d) => n + d.wasted, 0), list: dups },
}, null, 2));
