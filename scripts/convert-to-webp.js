// Converts every actually-referenced local theme image (grepped from
// client/src for /assets/images/... paths) to a sibling .webp file.
// Originals are kept only where something still needs the non-webp format
// (logoCrownify.png stays — it's also the favicon, and WebP favicon
// support is inconsistent across browsers/OS chrome); every other original
// gets deleted once its .webp sibling exists, since nothing references the
// old extension anymore after the JSX path swaps that follow this script.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "public", "assets", "images");

// { file, width?, keepOriginal? }
const IMAGES = [
  { file: "editAddress2.png" },
  { file: "Empty_Cart.png" },
  { file: "logo/Crownify_logo_text.png" },
  { file: "safepayment.png" },
  { file: "logoCrownify.png", keepOriginal: true },
  { file: "logindesign4.png" },
  { file: "empty-wishlist.png" },
  { file: "addressDesign.png" },
  { file: "signup2.png" },
  { file: "urbanWhite.png" },
  { file: "addidasWhite.png" },
  { file: "nikeWhite.png" },
  { file: "pumaWhite.png" },
  { file: "brand.png", width: 1920 },
  { file: "forgetPass2.png" },
  { file: "newpassDesign.png" },
  { file: "logo/puma7.png" },
  { file: "logo/Urbanmonkey1.png" },
  { file: "logo/nike2.png" },
  { file: "logo/Adidas.png" },
  { file: "slideshow-banners/hero14.jpg" },
  { file: "slideshow-banners/img19.jpg" },
  { file: "collection/nikecap.jpg" },
  { file: "collection/cap4.jpg" },
  { file: "collection/post1.jpg" },
  { file: "parallax-banners/banner2.jpg" },
  { file: "404.jpg", width: 1200 },
];

async function run() {
  let totalBefore = 0;
  let totalAfter = 0;

  for (const { file, width, keepOriginal } of IMAGES) {
    const full = path.join(ROOT, file);
    const webpFull = full.replace(/\.(png|jpe?g)$/i, ".webp");

    const before = fs.statSync(full).size;
    let pipeline = sharp(full);
    if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true, fit: "inside" });
    const buffer = await pipeline.webp({ quality: 80 }).toBuffer();
    fs.writeFileSync(webpFull, buffer);
    const after = buffer.length;

    totalBefore += before;
    totalAfter += after;
    console.log(file, "->", path.basename(webpFull), (before / 1024).toFixed(0) + "KB ->", (after / 1024).toFixed(0) + "KB");

    if (!keepOriginal) {
      fs.rmSync(full);
    }
  }

  console.log("\nTotal:", (totalBefore / 1024 / 1024).toFixed(2) + "MB ->", (totalAfter / 1024 / 1024).toFixed(2) + "MB");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
