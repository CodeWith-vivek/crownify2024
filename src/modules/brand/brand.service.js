const Brand = require("./brandSchema");
const { uploadBufferToCloudinary, destroyByUrl } = require("../../shared/utils/cloudinaryUpload");
const { notFound, badRequest, AppError } = require("../../shared/errors/AppError");

// Brand rules, free of Express. Multer's parsed file is passed in as plain
// data — the service never sees req or res.

const BRANDS_PER_PAGE = 4;

async function listBrands({ page = 1, limit = BRANDS_PER_PAGE } = {}) {
  const [brands, totalBrands] = await Promise.all([
    Brand.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Brand.countDocuments(),
  ]);

  return {
    // Newest-first from the database, then flipped so each page reads
    // oldest-first — the order the admin table has always displayed.
    data: brands.reverse(),
    currentPage: page,
    totalPages: Math.ceil(totalBrands / limit),
    totalBrands,
  };
}

async function createBrand({ name, file }) {
  if (!name) throw badRequest("Brand name is required");
  if (!file) throw badRequest("Brand image is required");

  if (await Brand.findOne({ brandName: new RegExp(`^${name}$`, "i") })) {
    throw new AppError("Brand already exists", { status: 409 });
  }

  const { secure_url } = await uploadBufferToCloudinary(file.buffer, "crownify/brands");

  const brand = await new Brand({ brandName: name, brandImage: secure_url }).save();

  return { message: "Brand added successfully", brand };
}

async function setBrandBlocked({ brandId, isBlocked }) {
  await Brand.updateOne({ _id: brandId }, { $set: { isBlocked } });
  return { message: isBlocked ? "Brand blocked" : "Brand unblocked" };
}

async function deleteBrand(brandId) {
  if (!brandId) throw badRequest("Brand id required");

  const brand = await Brand.findByIdAndDelete(brandId);
  if (!brand) throw notFound("Brand not found");

  // No-ops for pre-Cloudinary images (bare local filenames rather than
  // Cloudinary URLs) — those were never findable by public_id anyway.
  if (brand.brandImage?.[0]) await destroyByUrl(brand.brandImage[0]);

  return { message: "Brand deleted" };
}

module.exports = {
  listBrands,
  createBrand,
  setBrandBlocked,
  deleteBrand,
  BRANDS_PER_PAGE,
};
