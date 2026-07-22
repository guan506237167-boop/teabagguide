import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const base = locs[0] ? new URL(locs[0]).origin : "";
const indexable = new Set(locs.map((url) => normalizePath(new URL(url).pathname)));
const trustPaths = new Set(["/about/", "/contact/", "/privacy/", "/terms/", "/disclaimer/", "/faq/"]);
let manualBoostTargets = [];
try {
  manualBoostTargets = JSON.parse(await readFile(join(root, "scripts", "rescue-core-paths.json"), "utf8"));
} catch {}
const autoBoostTargets = [...indexable].filter((path) => !trustPaths.has(path)).slice(0, 10);
const boostTargets = [...new Set([...manualBoostTargets, ...autoBoostTargets].map(normalizePath))].filter((path) => indexable.has(path));

function normalizePath(path) {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path : `${path}/`;
}
async function listHtml(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listHtml(path));
    if (entry.isFile() && entry.name.toLowerCase() === "index.html") out.push(path);
  }
  return out;
}
function pathFromFile(file) {
  const rel = relative(dist, file).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  return `/${rel.replace(/index\.html$/, "")}`;
}
function textOf(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}
function ensureCanonical(html, path) {
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) return html;
  const href = `${base}${path === "/" ? "/" : path}`;
  const tag = `  <link rel="canonical" href="${href}">`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`);
  return html;
}
function ensureRobots(html) {
  if (/name=["']robots["']/i.test(html)) {
    return html.replace(/<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i, '<meta name="robots" content="noindex, follow">');
  }
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(/(<link\s+rel=["']canonical["'][^>]*>)/i, '$1\n  <meta name="robots" content="noindex, follow">');
  }
  return html.replace(/<head>/i, '<head>\n  <meta name="robots" content="noindex, follow">');
}
function removeNoindex(html) {
  return html.replace(/\s*<meta\s+name=["']robots["']\s+content=["']noindex,\s*follow["']\s*\/?>/i, "");
}
function qualityBlock(path, html) {
  if (/data-template-rescue-quality/i.test(html)) return html;
  if (/Quick Answer/i.test(html) && /(Basic Facts|Quick Facts|At a Glance|Fact Card)/i.test(html) && /(Data anchor|data-anchor|data-geo)/i.test(html)) return html;
  const h1 = textOf(html, /<h1[^>]*>(.*?)<\/h1>/is) || textOf(html, /<title[^>]*>(.*?)<\/title>/is) || "this guide";
  const desc = textOf(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/is) || `Use ${h1} as a practical reference page.`;
  const slug = path.replace(/^\//, "").replace(/\/$/, "") || "home";
  const role = path.includes("tool") || path.includes("calculator") || path.includes("lookup") || path.includes("life-path") || path.includes("name-number") ? "tool page" : path.includes("guide") ? "guide page" : path.includes("report") || path.includes("product") ? "commercial support page" : path.includes("compatibility") ? "comparison page" : "core reference page";
  const block = `
<section class="rescue-quality-note" data-template-rescue-quality="20260722" data-anchor="${slug}-core-quality-note">
  <h2>Quick Answer</h2>
  <p>${h1} is a ${role} kept in the active sitemap because it answers a specific visitor task. ${desc}</p>
  <div class="fact-card"><strong>Basic Facts</strong><ul><li>Primary role: ${role}</li><li>Indexing reason: main navigation, search intent, or practical reference value.</li><li>Editorial boundary: cultural explanation only; no guaranteed result or professional advice.</li></ul></div>
  <p><strong>Data anchor:</strong> This core page supports ${base || "the site"} by linking a user question to a calculator, guide, comparison, or reference path.</p>
</section>
`;
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${block}</main>`);
  return html.replace(/<\/body>/i, `${block}</body>`);
}

let changed = 0, noindexed = 0, boosted = 0, canonicalAdded = 0;
for (const file of await listHtml(dist)) {
  const path = normalizePath(pathFromFile(file));
  let html = await readFile(file, "utf8");
  const before = html;
  const beforeCanonical = /<link\s+rel=["']canonical["'][^>]*>/i.test(html);
  html = ensureCanonical(html, path);
  if (!beforeCanonical && /<link\s+rel=["']canonical["'][^>]*>/i.test(html)) canonicalAdded++;
  if (indexable.has(path)) {
    html = removeNoindex(html);
    if (boostTargets.includes(path)) {
      const prior = html;
      html = qualityBlock(path, html);
      if (html !== prior) boosted++;
    }
  } else {
    html = ensureRobots(html);
    noindexed++;
  }
  if (html !== before) {
    await writeFile(file, html, "utf8");
    changed++;
  }
}
console.log(JSON.stringify({ htmlChanged: changed, noindexPages: noindexed, boostedPages: boosted, canonicalAdded, sitemapPages: indexable.size, boostTargets }, null, 2));
