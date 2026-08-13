const multer=require("multer")

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

// Memory storage, not disk: uploaded files go straight to Cloudinary from
// the in-memory buffer (see cloudinaryUpload.js). Render's free tier and
// serverless hosts don't guarantee local disk survives a redeploy/cold
// start, so nothing here should ever depend on the file still being there
// after the request that wrote it.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error("Only image files (jpeg, png, webp, gif) are allowed"));
    }
    cb(null, true);
};

module.exports = {
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
};