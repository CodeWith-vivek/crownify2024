const mongoose = require("mongoose");
const { startTestDb } = require("../setup/testDb");

// Image handling is the one part of the product module that reaches
// outside the database. Stubbed so these tests exercise the rules, not
// Cloudinary or sharp.
jest.mock("../../src/modules/product/helpers/productMedia", () => {
  const actual = jest.requireActual("../../src/modules/product/helpers/productMedia");
  return {
    ...actual,
    uploadProductImages: jest.fn(async (files = []) =>
      files.map((_, i) => `https://cdn.test/img${i}.webp`)
    ),
  };
});
jest.mock("../../src/shared/utils/cloudinaryUpload", () => ({
  destroyByUrl: jest.fn(async () => {}),
  uploadBufferToCloudinary: jest.fn(async () => ({ secure_url: "https://cdn.test/x.webp" })),
}));

const productService = require("../../src/modules/product/product.service");
const { destroyByUrl } = require("../../src/shared/utils/cloudinaryUpload");
const Product = require("../../src/modules/product/productSchema");
const Category = require("../../src/modules/category/categorySchema");
const Brand = require("../../src/modules/brand/brandSchema");

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
  Category.create({ name: "Caps", description: "Caps", ...overrides });

const seedProduct = (category, overrides = {}) =>
  Product.create({
    productName: "Snapback",
    description: "A cap",
    brand: "Acme",
    category: category._id,
    regularPrice: 1000,
    salePrice: 1000,
    productImage: ["a.jpg"],
    variants: [{ color: "Black", size: "ONESIZE", quantity: 5 }],
    ...overrides,
  });

const addBody = (overrides = {}) => ({
  productName: "Fitted",
  description: "A cap",
  brand: "Acme",
  category: "Caps",
  regularPrice: "1000",
  salePrice: "900",
  colors: "Black",
  sizes: "ONESIZE",
  quantities: "5",
  ...overrides,
});

describe("productService.createProduct", () => {
  test("creates the product and stores the uploaded image URLs", async () => {
    await seedCategory();

    const res = await productService.createProduct({
      body: addBody(),
      files: [{ buffer: Buffer.from("a") }, { buffer: Buffer.from("b") }],
    });

    expect(res.message).toMatch(/added successfully/i);

    const saved = await Product.findOne({ productName: "Fitted" });
    expect(saved.productImage).toEqual([
      "https://cdn.test/img0.webp",
      "https://cdn.test/img1.webp",
    ]);
    expect(saved.salePrice).toBe(900);
    expect(saved.variants).toHaveLength(1);
  });

  test("a live category offer overrides the typed sale price", async () => {
    await seedCategory({ categoryOffer: 20 });

    await productService.createProduct({ body: addBody(), files: [] });

    // 20% off 1000, not the 900 that was typed in.
    expect((await Product.findOne({ productName: "Fitted" })).salePrice).toBe(800);
  });

  test("rejects a duplicate name regardless of case", async () => {
    const category = await seedCategory();
    await seedProduct(category, { productName: "Fitted" });

    await expect(
      productService.createProduct({ body: addBody({ productName: "fItTeD" }), files: [] })
    ).rejects.toMatchObject({ isAppError: true, status: 400, message: /already exists/ });
  });

  test("rejects an unknown category", async () => {
    await expect(
      productService.createProduct({ body: addBody({ category: "Nope" }), files: [] })
    ).rejects.toMatchObject({ status: 400, message: "Invalid category name" });
  });
});

describe("productService.updateProduct", () => {
  const editUpdates = (overrides = {}) => ({
    productName: "Snapback v2",
    description: "Updated",
    brand: "Acme",
    regularPrice: "1200",
    salePrice: "1100",
    colors: ["Black"],
    sizes: ["ONESIZE"],
    quantities: ["7"],
    ...overrides,
  });

  test("updates fields and rebuilds variants", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);

    await productService.updateProduct({
      productId: product._id.toString(),
      updates: editUpdates(),
      files: [],
    });

    const saved = await Product.findById(product._id);
    expect(saved.productName).toBe("Snapback v2");
    expect(saved.regularPrice).toBe(1200);
    expect(saved.salePrice).toBe(1100);
    expect(saved.variants[0].quantity).toBe(7);
  });

  test("rejects a missing name and a negative price", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);
    const id = product._id.toString();

    await expect(
      productService.updateProduct({ productId: id, updates: editUpdates({ productName: "" }) })
    ).rejects.toMatchObject({ status: 400, message: "Product name is required." });

    await expect(
      productService.updateProduct({ productId: id, updates: editUpdates({ regularPrice: "-5" }) })
    ).rejects.toMatchObject({ status: 400, message: /Regular price/ });

    await expect(
      productService.updateProduct({ productId: id, updates: editUpdates({ salePrice: "abc" }) })
    ).rejects.toMatchObject({ status: 400, message: /Sale price/ });
  });

  test("404s on an unknown product", async () => {
    await expect(
      productService.updateProduct({
        productId: new mongoose.Types.ObjectId().toString(),
        updates: editUpdates(),
      })
    ).rejects.toMatchObject({ status: 404, message: "Product not found" });
  });

  test("caps total images at four", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category, {
      productImage: ["1.jpg", "2.jpg", "3.jpg"],
    });

    await expect(
      productService.updateProduct({
        productId: product._id.toString(),
        updates: editUpdates(),
        files: [{ buffer: Buffer.from("a") }, { buffer: Buffer.from("b") }],
      })
    ).rejects.toMatchObject({ status: 400, message: /cannot upload more than 4 images/ });

    // Nothing was persisted by the rejected edit.
    expect((await Product.findById(product._id)).productName).toBe("Snapback");
  });

  test("mismatched variant arrays are a 400, not a 500", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);

    await expect(
      productService.updateProduct({
        productId: product._id.toString(),
        updates: editUpdates({ colors: ["Black", "Red"], sizes: ["ONESIZE"] }),
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "Colors, sizes, and quantities must have the same length.",
    });
  });
});

describe("productService.removeProductImage", () => {
  test("pulls the URL from the product and asks Cloudinary to drop it", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category, { productImage: ["a.jpg", "b.jpg"] });

    await productService.removeProductImage({
      productId: product._id.toString(),
      imageUrl: "a.jpg",
    });

    expect((await Product.findById(product._id)).productImage).toEqual(["b.jpg"]);
    expect(destroyByUrl).toHaveBeenCalledWith("a.jpg");
  });
});

describe("productService.applyProductOffer", () => {
  test("discounts the sale price off the regular price", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);

    const res = await productService.applyProductOffer({
      productId: product._id.toString(),
      percentage: 25,
    });

    expect(res.status).toBe(true);
    const saved = await Product.findById(product._id);
    expect(saved.productOffer).toBe(25);
    expect(saved.salePrice).toBe(750);
  });

  test("refuses over the 80% ceiling, as a readable message not an error", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);

    await expect(
      productService.applyProductOffer({ productId: product._id.toString(), percentage: 90 })
    ).resolves.toMatchObject({ status: false, message: /cannot exceed 80%/ });

    expect((await Product.findById(product._id)).productOffer).toBe(0);
  });

  test("refuses an offer the category already beats", async () => {
    const category = await seedCategory({ categoryOffer: 30 });
    const product = await seedProduct(category);

    await expect(
      productService.applyProductOffer({ productId: product._id.toString(), percentage: 20 })
    ).resolves.toMatchObject({ status: false, message: /higher or equal category offer/ });
  });

  test("clears a category offer once no product is left relying on it", async () => {
    const category = await seedCategory({ categoryOffer: 10 });
    const product = await seedProduct(category);

    await productService.applyProductOffer({
      productId: product._id.toString(),
      percentage: 40,
    });

    expect((await Category.findById(category._id)).categoryOffer).toBe(0);
  });

  test("keeps the category offer while another product still relies on it", async () => {
    const category = await seedCategory({ categoryOffer: 10 });
    const product = await seedProduct(category);
    await seedProduct(category, { productName: "Other" });

    await productService.applyProductOffer({
      productId: product._id.toString(),
      percentage: 40,
    });

    expect((await Category.findById(category._id)).categoryOffer).toBe(10);
  });

  test("404s on an unknown product instead of throwing a TypeError", async () => {
    await expect(
      productService.applyProductOffer({
        productId: new mongoose.Types.ObjectId().toString(),
        percentage: 10,
      })
    ).rejects.toMatchObject({ status: 404, message: "Product not found" });
  });
});

describe("productService.clearProductOffer", () => {
  test("returns the product to full price", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category, { productOffer: 25, salePrice: 750 });

    await productService.clearProductOffer({ productId: product._id.toString() });

    const saved = await Product.findById(product._id);
    expect(saved.productOffer).toBe(0);
    expect(saved.salePrice).toBe(1000);
  });

  test("falls back to the category offer rather than full price", async () => {
    const category = await seedCategory({ categoryOffer: 10 });
    const product = await seedProduct(category, { productOffer: 25, salePrice: 750 });

    await productService.clearProductOffer({ productId: product._id.toString() });

    expect((await Product.findById(product._id)).salePrice).toBe(900);
  });

  test("404s on an unknown product instead of throwing a TypeError", async () => {
    await expect(
      productService.clearProductOffer({ productId: new mongoose.Types.ObjectId().toString() })
    ).rejects.toMatchObject({ status: 404, message: "Product not found" });
  });
});

describe("productService list/edit queries", () => {
  test("paginates, sums variant stock, and reports the page count", async () => {
    const category = await seedCategory();
    for (let i = 0; i < 8; i++) {
      await seedProduct(category, {
        productName: `Cap ${i}`,
        variants: [
          { color: "Black", size: "S / M", quantity: 2 },
          { color: "Red", size: "M / L", quantity: 3 },
        ],
      });
    }

    const first = await productService.listProducts({ page: 1 });
    expect(first.data).toHaveLength(6);
    expect(first.totalPages).toBe(2);
    expect(first.data[0].totalQuantity).toBe(5);

    expect((await productService.listProducts({ page: 2 })).data).toHaveLength(2);
  });

  test("search matches name or brand", async () => {
    const category = await seedCategory();
    await seedProduct(category, { productName: "Beanie", brand: "Acme" });
    await seedProduct(category, { productName: "Fedora", brand: "Zenith" });

    expect((await productService.listProducts({ search: "beanie" })).data).toHaveLength(1);
    expect((await productService.listProducts({ search: "zenith" })).data).toHaveLength(1);
  });

  test("add-form options exclude unlisted categories and blocked brands", async () => {
    await seedCategory();
    await seedCategory({ name: "Hidden", isListed: false });
    await Brand.create({ brandName: "Acme", brandImage: ["b.png"] });
    await Brand.create({ brandName: "Banned", brandImage: ["b.png"], isBlocked: true });

    const { cat, brand } = await productService.getAddFormOptions();
    expect(cat.map((c) => c.name)).toEqual(["Caps"]);
    expect(brand.map((b) => b.brandName)).toEqual(["Acme"]);
  });

  test("the edit form keeps unlisted categories so the current value renders", async () => {
    const hidden = await seedCategory({ name: "Hidden", isListed: false });
    const product = await seedProduct(hidden);

    const { cat } = await productService.getEditFormData(product._id.toString());
    expect(cat.map((c) => c.name)).toContain("Hidden");
  });
});

describe("productService.setProductBlocked", () => {
  test("toggles storefront visibility both ways", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category);
    const id = product._id.toString();

    await productService.setProductBlocked({ productId: id, isBlocked: true });
    expect((await Product.findById(id)).isBlocked).toBe(true);

    await productService.setProductBlocked({ productId: id, isBlocked: false });
    expect((await Product.findById(id)).isBlocked).toBe(false);
  });
});
