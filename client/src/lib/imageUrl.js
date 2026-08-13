// Product/brand images moved from local disk to Cloudinary — new uploads
// store a full secure_url, but existing dev-DB records predate that switch
// and still hold a bare local filename. Handle both without a data
// migration: a value that's already a URL is used as-is, anything else
// falls back to the local static path it always used.
const isUrl = (value) => typeof value === "string" && /^https?:\/\//.test(value);

// Cloudinary can transcode+compress on delivery instead of us managing
// static file formats — f_auto picks WebP/AVIF for browsers that support
// it (falling back to the original format otherwise), q_auto picks the
// smallest quality that still looks right. Inserting it right after
// /upload/ is the standard Cloudinary URL transformation syntax; no-op for
// any non-Cloudinary URL (or a legacy local filename, which isn't a URL at
// all and skips this branch entirely).
function withAutoFormat(url) {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/f_auto,q_auto/");
}

export function productImageUrl(name) {
  if (!name) return "";
  return isUrl(name) ? withAutoFormat(name) : `/uploads/product-image/${name}`;
}

export function brandImageUrl(name) {
  if (!name) return "";
  return isUrl(name) ? withAutoFormat(name) : `/uploads/re-image/${name}`;
}
