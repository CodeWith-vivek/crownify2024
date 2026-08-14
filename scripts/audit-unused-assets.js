// Finds every file under public/assets and public/assets2 that is NOT
// reachable from the app: not loaded as a CSS/JS bundle by
// userProfiles.js/adminProfiles.js, not referenced via url(...) inside any
// of those loaded CSS files (fonts, background images, sprites), and not
// referenced directly as a string literal anywhere in client/src or the
// root-level HTML/CSS the app itself controls.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function toPublicRelative(absPath) {
  return "/" + path.relative(PUBLIC, absPath).split(path.sep).join("/");
}

// 1. All files that physically exist under assets/assets2.
const allAssetFiles = [
  ...walk(path.join(PUBLIC, "assets")),
  ...walk(path.join(PUBLIC, "assets2")),
].map(toPublicRelative);

// 2. Every /assets... or /assets2... string literal anywhere in client/src
//    (JSX image refs, and the profile files' own CSS/JS bundle lists).
const clientSrcFiles = walk(path.join(ROOT, "client", "src")).filter((f) =>
  /\.(jsx?|css|html)$/.test(f)
);
const rootHtml = path.join(ROOT, "client", "index.html");
const scanFiles = [...clientSrcFiles, rootHtml];

const reachable = new Set();
const pathPattern = /\/assets2?\/[^"'()\s]+/g;

function addReachable(p) {
  // Strip query strings (e.g. cache-busting ?fq2zl9) before recording.
  reachable.add(p.split("?")[0].split("#")[0]);
}

for (const file of scanFiles) {
  const content = fs.readFileSync(file, "utf8");
  const matches = content.match(pathPattern) || [];
  matches.forEach(addReachable);
}

// 3. Every loaded CSS file might itself reference more assets via url(...)
//    or @import (fonts, background sprites, chain-imported vendor/plugin
//    CSS), using paths relative to ITS OWN directory — and any CSS file
//    discovered THAT way can itself import/reference further files, so this
//    has to be a worklist processed to a fixpoint, not a single pass. A
//    single pass is exactly the bug that shipped once already: it missed
//    fonts referenced by vendor CSS that was only reachable via a chain
//    import (main.css -> @import vendors/evara-font.css -> @font-face
//    url(../../fonts/evara-font/...)), and silently deleted live files.
const urlPattern = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
const importPattern = /@import\s+(?:url\()?['"]?([^'")\s;]+)['"]?\)?/g;
const processedCss = new Set();

function processCssForReferences(cssRelPath) {
  if (processedCss.has(cssRelPath)) return;
  processedCss.add(cssRelPath);

  const cssAbsPath = path.join(PUBLIC, cssRelPath);
  if (!fs.existsSync(cssAbsPath)) return;
  const content = fs.readFileSync(cssAbsPath, "utf8");
  const dir = path.dirname(cssAbsPath);

  const refs = [];
  let m;
  urlPattern.lastIndex = 0;
  while ((m = urlPattern.exec(content))) refs.push(m[1]);
  importPattern.lastIndex = 0;
  while ((m = importPattern.exec(content))) refs.push(m[1]);

  for (const ref of refs) {
    if (ref.startsWith("data:") || ref.startsWith("http")) continue;
    const cleanRef = ref.split("?")[0].split("#")[0];
    const resolved = path.normalize(path.join(dir, cleanRef));
    if (!resolved.startsWith(PUBLIC)) continue;
    const relResolved = toPublicRelative(resolved);
    addReachable(relResolved);
    if (relResolved.endsWith(".css")) processCssForReferences(relResolved);
  }
}

// Seed with every directly loaded CSS file, then let it cascade.
for (const p of [...reachable].filter((p) => p.endsWith(".css"))) {
  processCssForReferences(p);
}

// Report
const unreferenced = allAssetFiles.filter((f) => !reachable.has(f));
let unreferencedSize = 0;
let totalSize = 0;
for (const f of allAssetFiles) {
  const size = fs.statSync(path.join(PUBLIC, f)).size;
  totalSize += size;
}
for (const f of unreferenced) {
  unreferencedSize += fs.statSync(path.join(PUBLIC, f)).size;
}

console.log("Total files under assets/assets2:", allAssetFiles.length, "(", (totalSize / 1024 / 1024).toFixed(1), "MB )");
console.log("Reachable (referenced somewhere):", allAssetFiles.length - unreferenced.length);
console.log("UNREFERENCED:", unreferenced.length, "(", (unreferencedSize / 1024 / 1024).toFixed(1), "MB )");
console.log();

// Breakdown by top-level dir under assets/assets2 for the unreferenced set
const byDir = {};
for (const f of unreferenced) {
  const parts = f.split("/").filter(Boolean);
  const key = parts.slice(0, 2).join("/");
  byDir[key] = (byDir[key] || 0) + fs.statSync(path.join(PUBLIC, f)).size;
}
console.log("Unreferenced size by folder:");
for (const [dir, size] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) {
  console.log(" ", dir, (size / 1024 / 1024).toFixed(2), "MB");
}

fs.writeFileSync(path.join(__dirname, "unreferenced-assets.json"), JSON.stringify(unreferenced, null, 2));
console.log("\nFull list written to scripts/unreferenced-assets.json");
