// One-time batch resize/recompress for legacy theme images that were never
// optimized for the web (some as large as 6000x4000 for a 675px display
// slot). Lighthouse flagged ~10.8MB of avoidable image weight on the
// homepage. Targets are the actual rendered size (from the Lighthouse
// report) x2 for retina, same file path/format so nothing referencing these
// paths (JSX, theme CSS) needs to change.
//
// Writes to a .tmp file and renames over the original rather than
// overwriting in place — direct overwrite intermittently hit Windows
// EPERM/UNKNOWN errors on some files (antivirus/indexer holding a read
// handle), and write-then-rename sidesteps that.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const JPEGS = [
  { file: "public/assets/images/slideshow-banners/img19.jpg", width: 1920 },
  { file: "public/assets/images/slideshow-banners/hero14.jpg", width: 1920 },
  { file: "public/assets/images/parallax-banners/banner2.jpg", width: 1920 },
  { file: "public/assets/images/collection/nikecap.jpg", width: 1350 },
  { file: "public/assets/images/collection/post1.jpg", width: 1350 },
  { file: "public/assets/images/collection/cap4.jpg", width: 1350 },
];

const PNGS = [
  { file: "public/assets/images/logoCrownify.png", width: 188 },
  { file: "public/assets/images/logo/nike2.png", width: 318 },
  { file: "public/assets/images/logo/puma7.png", width: 422 },
  { file: "public/assets/images/logo/Adidas.png", width: 376 },
  { file: "public/assets/images/logo/Urbanmonkey1.png", width: 332 },
  { file: "public/assets/images/logo/Crownify_logo_text.png", width: 564 },
];

async function processOne(relFile, width, isPng) {
  const file = path.join(__dirname, "..", relFile);
  const tmp = file + ".tmp";
  const before = fs.statSync(file).size;

  let pipeline = sharp(file).resize({ width, withoutEnlargement: true, fit: "inside" });
  pipeline = isPng ? pipeline.png({ compressionLevel: 9, quality: 85 }) : pipeline.jpeg({ quality: 78, mozjpeg: true });
  await pipeline.toFile(tmp);

  fs.rmSync(file);
  fs.renameSync(tmp, file);

  const after = fs.statSync(file).size;
  console.log(relFile, (before / 1024).toFixed(0) + "KB ->", (after / 1024).toFixed(0) + "KB");
  return { before, after };
}

async function run() {
  let totalBefore = 0;
  let totalAfter = 0;

  for (const { file, width } of JPEGS) {
    const { before, after } = await processOne(file, width, false);
    totalBefore += before;
    totalAfter += after;
  }
  for (const { file, width } of PNGS) {
    const { before, after } = await processOne(file, width, true);
    totalBefore += before;
    totalAfter += after;
  }

  console.log("\nTotal:", (totalBefore / 1024 / 1024).toFixed(2) + "MB ->", (totalAfter / 1024 / 1024).toFixed(2) + "MB");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
