const sharp = require("sharp");
const { uploadBufferToCloudinary } = require("../../../shared/utils/cloudinaryUpload");

// Shared between the add and edit paths, which both resize to the same
// square and push to the same Cloudinary folder.

const PRODUCT_IMAGE_SIZE = 440;
const MAX_PRODUCT_IMAGES = 4;

/**
 * Resizes each uploaded buffer to a square and uploads it, returning the
 * resulting Cloudinary secure_urls in order.
 *
 * @param {Array} files  req.files from multer's memoryStorage
 */
async function uploadProductImages(files = []) {
  const urls = [];

  for (const file of files) {
    const resizedBuffer = await sharp(file.buffer)
      .resize({ width: PRODUCT_IMAGE_SIZE, height: PRODUCT_IMAGE_SIZE, fit: "cover" })
      .toBuffer();

    const result = await uploadBufferToCloudinary(resizedBuffer, "crownify/products");
    urls.push(result.secure_url);
  }

  return urls;
}

/**
 * The add/edit forms post colors/sizes/quantities as three parallel arrays
 * (or three bare values when only one variant row was filled in).
 *
 * @param {{colors, sizes, quantities}} body
 * @param {{requireEqualLengths?: boolean}} opts  the edit path rejects
 *   mismatched lengths outright; the add path pads with defaults instead,
 *   preserving each form's existing behaviour.
 */
function buildVariants(body, { requireEqualLengths = false } = {}) {
  const { colors, sizes, quantities } = body;

  if (Array.isArray(colors) && Array.isArray(sizes) && Array.isArray(quantities)) {
    if (
      requireEqualLengths &&
      (colors.length !== sizes.length || colors.length !== quantities.length)
    ) {
      throw new Error("Colors, sizes, and quantities must have the same length.");
    }

    return colors.map((color, index) => ({
      color,
      size: sizes[index] || null,
      quantity: Math.floor(Number(quantities[index])) || 1,
    }));
  }

  return [
    {
      color: colors || "Default",
      size: sizes || "ONESIZE",
      quantity: Math.floor(Number(quantities)) || 1,
    },
  ];
}

module.exports = { uploadProductImages, buildVariants, MAX_PRODUCT_IMAGES };
