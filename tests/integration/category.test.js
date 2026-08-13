const { startTestDb } = require("../setup/testDb");
const { addCategory } = require("../../src/modules/category/categoryController");
const Category = require("../../src/modules/category/categorySchema");

let db;

beforeAll(async () => {
  db = await startTestDb();
});

afterEach(async () => {
  await db.clear();
});

afterAll(async () => {
  await db.stop();
});

function mockRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe("addCategory", () => {
  test("creates a category, name stored uppercase", async () => {
    const req = { body: { name: "snapbacks", description: "Snapback caps" } };
    const res = mockRes();

    await addCategory(req, res);

    expect(res.statusCode).toBe(201);
    const saved = await Category.findOne({});
    expect(saved.name).toBe("SNAPBACKS");
  });

  test("rejects a duplicate name case-insensitively", async () => {
    await Category.create({ name: "SNAPBACKS", description: "Existing" });
    const req = { body: { name: "snapbacks", description: "Duplicate attempt" } };
    const res = mockRes();

    await addCategory(req, res);

    expect(res.statusCode).toBe(409);
    const count = await Category.countDocuments({});
    expect(count).toBe(1);
  });

  test("rejects missing name or description", async () => {
    const req = { body: { name: "", description: "" } };
    const res = mockRes();

    await addCategory(req, res);

    expect(res.statusCode).toBe(400);
  });
});
