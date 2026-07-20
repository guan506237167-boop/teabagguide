import fs from "node:fs";
import path from "node:path";
const root = path.resolve("dist");
const html = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith(".html")) html.push(file);
  }
}
function words(value) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z0-9#]+;/gi, " ").trim().split(/\s+/).filter(Boolean).length;
}
walk(root);
let bad = 0;
const requiredPages = ["index.html", "about/index.html", "contact/index.html", "privacy/index.html", "terms/index.html", "guide/index.html", "tools/index.html", "faq/index.html"];
for (const page of requiredPages) {
  if (!fs.existsSync(path.join(root, page))) {
    console.error("Missing required page:", page);
    bad++;
  }
}
const articleFiles = html.filter((file) => {
  const rel = path.relative(root, file).split(path.sep).join("/");
  return rel.startsWith("guide/") && rel !== "guide/index.html";
});
if (articleFiles.length < 20) {
  console.error("Too few article pages:", articleFiles.length, "expected at least", 20);
  bad++;
}
for (const file of html) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("Coming soon")) {
    console.error("Empty placeholder:", file);
    bad++;
  }
  if (!source.includes("<h1")) {
    console.error("Missing h1:", file);
    bad++;
  }
  if (/overflow-x\s*:\s*(scroll|auto)/i.test(source)) {
    console.error("Possible horizontal scroll style:", file);
    bad++;
  }
  for (const match of source.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) continue;
    const target = href.endsWith("/") ? path.join(root, href, "index.html") : path.join(root, href);
    const fallback = path.join(root, href.replace(/^\//, ""));
    if (!fs.existsSync(target) && !fs.existsSync(fallback)) {
      console.error("Broken link", href, "in", file);
      bad++;
    }
  }
}
for (const file of articleFiles) {
  const count = words(fs.readFileSync(file, "utf8"));
  if (count < 1000) {
    console.error("Thin article:", path.relative(root, file), count, "words");
    bad++;
  }
}
for (const required of ["robots.txt", "sitemap.xml", "llms.txt"]) {
  if (!fs.existsSync(path.join(root, required))) {
    console.error("Missing", required);
    bad++;
  }
}
if (bad) process.exitCode = 1;
else console.log("Audit passed:", html.length, "HTML pages checked;", articleFiles.length, "article pages passed depth check.");