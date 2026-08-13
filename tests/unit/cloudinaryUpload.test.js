const { extractPublicId } = require("../../src/shared/utils/cloudinaryUpload");

describe("extractPublicId", () => {
  test("extracts the public_id (with folder) from a versioned secure_url", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1699999999/crownify/products/abc123.jpg";
    expect(extractPublicId(url)).toBe("crownify/products/abc123");
  });

  test("extracts the public_id from a URL without an explicit version", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/crownify/brands/xyz.png";
    expect(extractPublicId(url)).toBe("crownify/brands/xyz");
  });

  test("returns null for a pre-migration bare local filename (nothing to delete on Cloudinary)", () => {
    expect(extractPublicId("1699999999-logo.png")).toBeNull();
  });

  test("returns null for a non-string input", () => {
    expect(extractPublicId(undefined)).toBeNull();
    expect(extractPublicId(null)).toBeNull();
  });
});
