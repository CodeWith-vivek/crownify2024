// Product/brand images moved from local disk to Cloudinary — new uploads
// store a full secure_url, but existing dev-DB records predate that switch
// and still hold a bare local filename. Handle both without a data
// migration: a value that's already a URL is used as-is, anything else
// falls back to the local static path it always used.
const isUrl = (value) => typeof value === "string" && /^https?:\/\//.test(value);

export function productImageUrl(name) {
  if (!name) return "";
  return isUrl(name) ? name : `/uploads/product-image/${name}`;
}

export function brandImageUrl(name) {
  if (!name) return "";
  return isUrl(name) ? name : `/uploads/re-image/${name}`;
}
