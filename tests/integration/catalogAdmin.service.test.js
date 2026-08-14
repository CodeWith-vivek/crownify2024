const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");

jest.mock("../../src/shared/utils/cloudinaryUpload", () => ({
  uploadBufferToCloudinary: jest.fn(async () => ({ secure_url: "https://cdn.test/brand.webp" })),
  destroyByUrl: jest.fn(async () => {}),
}));

const categoryService = require("../../src/modules/category/category.service");
const brandService = require("../../src/modules/brand/brand.service");
const topsellingService = require("../../src/modules/topselling/topselling.service");
const { destroyByUrl } = require("../../src/shared/utils/cloudinaryUpload");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");
const Product = require("../../src/modules/product/productSchema");
const Order = require("../../src/modules/order/orderSchema");
const User = require("../../src/modules/user/userSchema");
const Address = require("../../src/modules/address/addressSchema");

let db;

beforeAll(async () => {
  db = await startTestDb();
});

afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});

afterAll(async () => {
  await db.stop();
});

const seedCategory = (overrides = {}) =>
  Category.create({ name: "CAPS", description: "Caps", ...overrides });

const seedProduct = (category, overrides = {}) =>
  Product.create({
    productName: `Cap${Math.random()}`,
    description: "d",
    brand: "Acme",
    category: category._id,
    regularPrice: 1000,
    salePrice: 1000,
    productImage: ["i.jpg"],
    variants: [{ color: "Black", size: "ONESIZE", quantity: 10 }],
    ...overrides,
  });

describe("categoryService create/update", () => {
  test("stores the name uppercased", async () => {
    await categoryService.createCategory({ name: "beanies", description: "d" });

    expect(await Category.findOne({ name: "BEANIES" })).not.toBeNull();
  });

  test("rejects a duplicate name regardless of case", async () => {
    await seedCategory();

    await expect(
      categoryService.createCategory({ name: "caps", description: "d" })
    ).rejects.toMatchObject({ isAppError: true, status: 409, message: "Category already exists." });
  });

  test("requires a name and a description", async () => {
    await expect(
      categoryService.createCategory({ name: "", description: "d" })
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      categoryService.createCategory({ name: "X", description: "" })
    ).rejects.toMatchObject({ status: 400 });
  });

  test("an edit cannot introduce a case-variant duplicate", async () => {
    await seedCategory();
    const other = await seedCategory({ name: "BEANIES" });

    // A case-sensitive check let "Caps" through alongside "CAPS".
    await expect(
      categoryService.updateCategory({
        categoryId: other._id.toString(),
        name: "Caps",
        description: "d",
      })
    ).rejects.toMatchObject({ status: 400, message: /please choose another name/ });
  });

  test("renaming a category to its own name is allowed", async () => {
    const category = await seedCategory();

    const { category: saved } = await categoryService.updateCategory({
      categoryId: category._id.toString(),
      name: "caps",
      description: "updated",
    });

    expect(saved.name).toBe("CAPS");
    expect(saved.description).toBe("updated");
  });

  test("404s when editing an unknown category", async () => {
    await expect(
      categoryService.updateCategory({
        categoryId: new mongoose.Types.ObjectId().toString(),
        name: "GONE",
        description: "d",
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  test("lists with pagination and toggles visibility", async () => {
    for (let i = 0; i < 8; i++) await seedCategory({ name: `CAT${i}` });

    const page1 = await categoryService.listCategories({ page: 1 });
    expect(page1.cat).toHaveLength(6);
    expect(page1.totalPages).toBe(2);
    expect(page1.totalCategories).toBe(8);

    const target = page1.cat[0];
    await categoryService.setCategoryListed({ categoryId: target._id, isListed: false });
    expect((await Category.findById(target._id)).isListed).toBe(false);

    await categoryService.setCategoryListed({ categoryId: target._id, isListed: true });
    expect((await Category.findById(target._id)).isListed).toBe(true);
  });
});

describe("categoryService offers", () => {
  test("applies to products with no offer of their own", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);

    const res = await categoryService.applyCategoryOffer({
      categoryId: category._id.toString(),
      percentage: 20,
    });

    expect(res.status).toBe(true);
    expect((await Category.findById(category._id)).categoryOffer).toBe(20);
    expect((await Product.findById(product._id)).salePrice).toBe(800);
  });

  test("parks a weaker product offer so it can be restored later", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category, { productOffer: 10, salePrice: 900 });

    await categoryService.applyCategoryOffer({
      categoryId: category._id.toString(),
      percentage: 30,
    });

    let saved = await Product.findById(product._id);
    expect(saved.productOffer).toBe(0);
    expect(saved.previousProductOffer).toBe(10);
    expect(saved.salePrice).toBe(700);

    await categoryService.clearCategoryOffer({ categoryId: category._id.toString() });

    saved = await Product.findById(product._id);
    expect(saved.productOffer).toBe(10);
    expect(saved.salePrice).toBe(900);
    expect((await Category.findById(category._id)).categoryOffer).toBe(0);
  });

  test("a product with a better offer of its own keeps it", async () => {
    const category = await seedCategory();
    const strong = await seedProduct(category, { productOffer: 50, salePrice: 500 });

    const res = await categoryService.applyCategoryOffer({
      categoryId: category._id.toString(),
      percentage: 20,
    });

    // Nothing was eligible, and something had a higher offer.
    expect(res.status).toBe(false);
    expect(res.message).toMatch(/already have a higher product offer/);
    expect((await Product.findById(strong._id)).productOffer).toBe(50);
  });

  test("refuses over the 80% ceiling as a readable message", async () => {
    const category = await seedCategory();

    await expect(
      categoryService.applyCategoryOffer({ categoryId: category._id.toString(), percentage: 95 })
    ).resolves.toMatchObject({ status: false, message: /cannot exceed 80%/ });

    expect((await Category.findById(category._id)).categoryOffer).toBe(0);
  });

  test("clearing returns products with no parked offer to full price", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);

    await categoryService.applyCategoryOffer({
      categoryId: category._id.toString(),
      percentage: 25,
    });
    expect((await Product.findById(product._id)).salePrice).toBe(750);

    await categoryService.clearCategoryOffer({ categoryId: category._id.toString() });
    expect((await Product.findById(product._id)).salePrice).toBe(1000);
  });

  test("restored prices are whole rupees", async () => {
    const category = await seedCategory();
    // 33% of 999 is 329.67 — a fractional sale price if it isn't floored.
    const product = await seedProduct(category, {
      regularPrice: 999,
      productOffer: 33,
      salePrice: 669,
    });

    await categoryService.applyCategoryOffer({
      categoryId: category._id.toString(),
      percentage: 40,
    });
    await categoryService.clearCategoryOffer({ categoryId: category._id.toString() });

    const saved = await Product.findById(product._id);
    expect(Number.isInteger(saved.salePrice)).toBe(true);
    // floor(999 - 329.67), the same rounding the apply path uses.
    expect(saved.salePrice).toBe(669);
  });

  test("404s on an unknown category, both ways", async () => {
    const missing = new mongoose.Types.ObjectId().toString();

    await expect(
      categoryService.applyCategoryOffer({ categoryId: missing, percentage: 10 })
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      categoryService.clearCategoryOffer({ categoryId: missing })
    ).rejects.toMatchObject({ status: 404 });

    await expect(categoryService.clearCategoryOffer({})).rejects.toMatchObject({ status: 400 });
  });
});

describe("brandService", () => {
  const file = { buffer: Buffer.from("img") };

  test("creates a brand with its uploaded image", async () => {
    const { brand } = await brandService.createBrand({ name: "Acme", file });

    expect(brand.brandName).toBe("Acme");
    expect(brand.brandImage[0]).toBe("https://cdn.test/brand.webp");
  });

  test("rejects a duplicate name regardless of case", async () => {
    await brandService.createBrand({ name: "Acme", file });

    await expect(brandService.createBrand({ name: "ACME", file })).rejects.toMatchObject({
      status: 409,
      message: "Brand already exists",
    });
  });

  test("requires a name and an image", async () => {
    await expect(brandService.createBrand({ name: "", file })).rejects.toMatchObject({
      status: 400,
      message: "Brand name is required",
    });

    // The old handler read req.file.buffer straight away, so a missing
    // upload was a TypeError and surfaced as a 500.
    await expect(brandService.createBrand({ name: "Acme" })).rejects.toMatchObject({
      status: 400,
      message: "Brand image is required",
    });
  });

  test("paginates four to a page", async () => {
    for (let i = 0; i < 6; i++) await brandService.createBrand({ name: `Brand${i}`, file });

    const page1 = await brandService.listBrands({ page: 1 });
    expect(page1.data).toHaveLength(4);
    expect(page1.totalPages).toBe(2);
    expect(page1.totalBrands).toBe(6);

    expect((await brandService.listBrands({ page: 2 })).data).toHaveLength(2);
  });

  test("blocks and unblocks", async () => {
    const { brand } = await brandService.createBrand({ name: "Acme", file });
    const id = brand._id.toString();

    await brandService.setBrandBlocked({ brandId: id, isBlocked: true });
    expect((await Brand.findById(id)).isBlocked).toBe(true);

    await brandService.setBrandBlocked({ brandId: id, isBlocked: false });
    expect((await Brand.findById(id)).isBlocked).toBe(false);
  });

  test("deletes the brand and its image", async () => {
    const { brand } = await brandService.createBrand({ name: "Acme", file });

    await brandService.deleteBrand(brand._id.toString());

    expect(await Brand.findById(brand._id)).toBeNull();
    expect(destroyByUrl).toHaveBeenCalledWith("https://cdn.test/brand.webp");
  });

  test("deleting an unknown brand is a 404, and a missing id a 400", async () => {
    await expect(
      brandService.deleteBrand(new mongoose.Types.ObjectId().toString())
    ).rejects.toMatchObject({ status: 404 });

    await expect(brandService.deleteBrand(undefined)).rejects.toMatchObject({ status: 400 });
  });
});

describe("topsellingService", () => {
  let seq = 0;

  async function seedOrderFor(product, { quantity = 1, orderStatus = "Delivered" } = {}) {
    seq += 1;
    const user = await User.create({ name: "T", email: `top${seq}@svc.com` });
    const address = await Address.create({
      userId: user._id,
      addressType: "Home",
      fullName: "T",
      country: "India",
      mobileNumber: "9999999999",
      postalCode: "600001",
      flatHouseCompany: "1",
      areaStreet: "Street",
      city: "Chennai",
      state: "TN",
    });

    return Order.create({
      userId: user._id,
      orderNumber: `TOP-${seq}-${new mongoose.Types.ObjectId()}`,
      shippingAddress: address._id,
      items: [
        {
          productId: product._id,
          productName: product.productName,
          productImage: "i.jpg",
          variant: { color: "Black", size: "ONESIZE" },
          quantity,
          salePrice: 400,
          regularPrice: 500,
          totalPrice: 400 * quantity,
          orderStatus,
        },
      ],
      subtotal: 400 * quantity,
      shipping: 40,
      total: 400 * quantity + 40,
      grandTotal: 400 * quantity + 40,
      paymentMethod: "COD",
    });
  }

  test("ranks products by units sold, highest first", async () => {
    const category = await seedCategory();
    const quiet = await seedProduct(category, { productName: "Quiet" });
    const popular = await seedProduct(category, { productName: "Popular" });

    await seedOrderFor(quiet, { quantity: 1 });
    await seedOrderFor(popular, { quantity: 9 });

    const { topProducts, totalSoldProducts } = await topsellingService.getTopSellingStats();

    // The old handler sorted into a variable it then never sent, so this
    // list came back in whatever order Mongo returned the products.
    expect(topProducts.map((p) => p.productName)).toEqual(["Popular", "Quiet"]);
    expect(topProducts[0].salesCount).toBe(9);
    expect(totalSoldProducts).toBe(10);
  });

  test("cancelled and failed items are not sales", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category, { productName: "Cap" });

    await seedOrderFor(product, { quantity: 2, orderStatus: "Delivered" });
    await seedOrderFor(product, { quantity: 50, orderStatus: "canceled" });
    await seedOrderFor(product, { quantity: 50, orderStatus: "Failed" });

    const { totalSoldProducts, topProducts } = await topsellingService.getTopSellingStats();

    expect(totalSoldProducts).toBe(2);
    expect(topProducts[0].salesCount).toBe(2);
  });

  test("a returned item still counts as having been sold", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);

    await seedOrderFor(product, { quantity: 3, orderStatus: "Returned" });

    expect((await topsellingService.getTopSellingStats()).totalSoldProducts).toBe(3);
  });

  test("rolls up by category and brand", async () => {
    const category = await seedCategory();
    await Brand.create({ brandName: "Acme", brandImage: ["b.png"] });
    const product = await seedProduct(category);

    await seedOrderFor(product, { quantity: 4 });

    const { topCategories, topBrands } = await topsellingService.getTopSellingStats();

    expect(topCategories[0]).toMatchObject({ categoryName: "CAPS", salesCount: 4 });
    expect(topBrands[0]).toMatchObject({ brandName: "Acme", salesCount: 4 });
  });

  test("an empty database reports zeroes rather than crashing", async () => {
    await expect(topsellingService.getTopSellingStats()).resolves.toEqual({
      totalSoldProducts: 0,
      topProducts: [],
      topCategories: [],
      topBrands: [],
    });
  });
});
