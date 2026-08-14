// Recursively follows @import chains inside every CSS file actually loaded
// by the app, resolving every url()/@import reference transitively, and
// reports any that point at a file which no longer exists on disk — damage
// check after the unreferenced-assets cleanup, whose audit script only
// looked one level deep (React-loaded files) and missed CSS-internal
// @import chains.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function toPublicRelative(absPath) {
  return "/" + path.relative(PUBLIC, absPath).split(path.sep).join("/");
}

const clientSrcFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(full)) clientSrcFiles.push(full);
  }
}
walk(path.join(ROOT, "client", "src"));

const pathPattern = /\/assets2?\/[^"'()\s]+\.css/g;
const topLevelCss = new Set();
for (const file of clientSrcFiles) {
  const content = fs.readFileSync(file, "utf8");
  const matches = content.match(pathPattern) || [];
  matches.forEach((m) => topLevelCss.add(m.split("?")[0]));
}

const urlPattern = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
const importPattern = /@import\s+(?:url\()?['"]?([^'")\s;]+)['"]?\)?/g;

const visited = new Set();
const broken = [];

function processCss(cssRelPath) {
  if (visited.has(cssRelPath)) return;
  visited.add(cssRelPath);
  const cssAbsPath = path.join(PUBLIC, cssRelPath);
  if (!fs.existsSync(cssAbsPath)) {
    broken.push({ from: "(entry point)", ref: cssRelPath });
    return;
  }
  const content = fs.readFileSync(cssAbsPath, "utf8");
  const dir = path.dirname(cssAbsPath);

  let m;
  const allRefs = [];
  while ((m = urlPattern.exec(content))) allRefs.push(m[1]);
  importPattern.lastIndex = 0;
  while ((m = importPattern.exec(content))) allRefs.push(m[1]);

  for (const ref of allRefs) {
    if (ref.startsWith("data:") || ref.startsWith("http")) continue;
    const cleanRef = ref.split("?")[0].split("#")[0];
    const resolved = path.normalize(path.join(dir, cleanRef));
    if (!resolved.startsWith(PUBLIC)) continue;
    const relResolved = toPublicRelative(resolved);
    if (!fs.existsSync(resolved)) {
      broken.push({ from: cssRelPath, ref: relResolved });
    } else if (relResolved.endsWith(".css")) {
      processCss(relResolved);
    }
  }
}

for (const entry of topLevelCss) processCss(entry);

if (broken.length === 0) {
  console.log("No broken references found across", visited.size, "CSS files checked.");
} else {
  console.log("BROKEN REFERENCES FOUND (", broken.length, "):\n");
  for (const b of broken) {
    console.log(" ", b.ref, "  <- referenced from", b.from);
  }
}
