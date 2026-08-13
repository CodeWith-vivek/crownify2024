const cloudinary = require("../config/cloudinary");

/**
 * Uploads an in-memory buffer (from multer.memoryStorage()) to Cloudinary.
 * Local disk was never a real option in production — Render's free tier and
 * any serverless host both have ephemeral/non-persistent filesystems, so an
 * uploaded product image could vanish on the next redeploy or cold start.
 */
function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Cloudinary secure_urls look like:
 *   https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<id>.<ext>
 * The public_id (needed to delete the asset) is everything after
 * "/upload/v<version>/" up to the final extension.
 */
function extractPublicId(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/);
  return match ? match[1] : null;
}

/** No-op (not an error) if the URL isn't a Cloudinary asset — covers images
 * uploaded before this migration, which stayed on local disk and have
 * nothing in Cloudinary to clean up. */
async function destroyByUrl(url) {
  const publicId = extractPublicId(url);
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadBufferToCloudinary, extractPublicId, destroyByUrl };
