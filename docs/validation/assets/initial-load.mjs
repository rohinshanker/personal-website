// initial-load.mjs — static estimate of bytes fetched on first paint for a page.
// Run: node initial-load.mjs /repo home.html
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(process.argv[2]); const PAGE = process.argv[3];
const html = fs.readFileSync(path.join(ROOT, PAGE), "utf8");
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const size = (p) => { const f = path.join(ROOT, dec(p).replace(/[?#].*$/, "")); try { return fs.statSync(f).size; } catch { return null; } };
const res = []; const add = (kind, p, note = "") => { if (!p || /^(https?:|data:|\/\/|mailto:)/.test(p)) { if (p && /^https?:/.test(p)) res.push({ kind, p, size: null, note: "external " + note }); return; } res.push({ kind, p: p.replace(/^\.\//, ""), size: size(p), note }); };
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i")) || [])[1];
for (const m of html.matchAll(/<link\b[^>]*>/gi)) { const t = m[0]; const rel = (attr(t, "rel") || "").toLowerCase(); const href = attr(t, "href"); if (/stylesheet/.test(rel)) add("css", href); else if (/preload|prefetch|modulepreload/.test(rel)) add("preload:" + rel, href, attr(t, "as") || ""); else if (/icon/.test(rel)) add("icon", href, rel); }
for (const m of html.matchAll(/<script\b[^>]*\ssrc\s*=\s*"([^"]+)"[^>]*>/gi)) add("js", m[1], /\b(defer|async)\b/i.test(m[0]) ? "defer/async" : "blocking");
let eager = 0, lazy = 0, dataSrc = 0;
for (const m of html.matchAll(/<img\b[^>]*>/gi)) { const t = m[0]; const src = attr(t, "src"); const ds = attr(t, "data-src"); if (src) { if (/loading\s*=\s*"lazy"/i.test(t)) { lazy++; add("img:lazy", src); } else { eager++; add("img:eager", src, attr(t, "fetchpriority") ? "fetchpriority=" + attr(t, "fetchpriority") : ""); } } else if (ds) dataSrc++; }
for (const m of html.matchAll(/<(video|audio|source|iframe|embed|object)\b[^>]*>/gi)) { const t = m[0]; const s = attr(t, "src") || attr(t, "poster"); if (s) add(m[1] + (attr(t, "preload") ? " preload=" + attr(t, "preload") : ""), s); }
for (const m of html.matchAll(/style\s*=\s*"[^"]*url\((['"]?)([^'")]+)\1\)/gi)) add("inline-style-url", m[2]);
// CSS url() from linked stylesheets and <style> blocks (fetched only when the rule applies; listed separately)
const cssRefs = []; const cssTexts = [];
for (const r of res.filter((x) => x.kind === "css" && x.size)) cssTexts.push([r.p.replace(/[?#].*$/, ""), fs.readFileSync(path.join(ROOT, dec(r.p).replace(/[?#].*$/, "")), "utf8")]);
for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) cssTexts.push(["<inline style>", m[1]]);
for (const [file, text] of cssTexts) { const base = file.startsWith("<") ? "" : path.dirname(file); const seen = new Set(); for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) { let u = m[2]; if (/^(data:|https?:|#)/.test(u)) continue; const p = path.posix.normalize(path.posix.join(base, u)); if (seen.has(p)) continue; seen.add(p); const fontFace = /@font-face/.test(text.slice(Math.max(0, m.index - 400), m.index)); cssRefs.push({ file, p, size: size(p), fontFace }); } }
const sum = (a) => a.reduce((n, x) => n + (x.size || 0), 0);
const doc = { kind: "html", p: PAGE, size: size(PAGE) };
const first = [doc, ...res.filter((r) => !/lazy/.test(r.kind))];
console.log(`PAGE ${PAGE}: html ${doc.size} B; <img> eager=${eager} lazy=${lazy} data-src(JS-inserted)=${dataSrc}`);
console.log(`Guaranteed first-paint fetches (html+css+js+eager img+icons/preloads): ${first.length} resources, ${(sum(first) / 1024).toFixed(0)} KB`);
for (const r of first.sort((a, b) => (b.size || 0) - (a.size || 0))) console.log("  ", String(r.size ?? "?").padStart(8), r.kind.padEnd(16), r.p, r.note || "");
console.log(`CSS url() refs (conditional on rule applying): ${cssRefs.length}, total ${(sum(cssRefs) / 1024).toFixed(0)} KB; fonts ${cssRefs.filter((c) => c.fontFace).length} = ${(sum(cssRefs.filter((c) => c.fontFace)) / 1024).toFixed(0)} KB`);
for (const c of cssRefs.sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 25)) console.log("  ", String(c.size ?? "MISSING").padStart(8), c.fontFace ? "font" : "url ", c.p, "  <-", c.file);
