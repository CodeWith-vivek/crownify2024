const { startTestDb } = require("../setup/testDb");
const contactService = require("../../src/modules/contact/contact.service");
const customerService = require("../../src/modules/customer/customer.service");
const Contact = require("../../src/modules/contact/contactSchema");
const User = require("../../src/modules/user/userSchema");

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

describe("contactService.submitContactForm", () => {
  test("saves a complete submission", async () => {
    const res = await contactService.submitContactForm({
      name: "T",
      email: "t@contact.com",
      phone: "9999999999",
      message: "hello",
    });

    expect(res.message).toMatch(/submitted/i);
    expect(await Contact.countDocuments({ email: "t@contact.com" })).toBe(1);
  });

  test("rejects a missing field before hitting the database", async () => {
    await expect(
      contactService.submitContactForm({ name: "T", email: "t@contact.com", phone: "1", message: "" })
    ).rejects.toMatchObject({ isAppError: true, status: 400 });

    expect(await Contact.countDocuments({})).toBe(0);
  });
});

describe("contactService.getCustomerMessages", () => {
  test("paginates, newest first", async () => {
    for (let i = 0; i < 10; i++) {
      await Contact.create({
        name: "T",
        email: `t${i}@contact.com`,
        phone: "1",
        message: "hi",
        submittedOn: new Date(Date.now() + i * 1000),
      });
    }

    const page1 = await contactService.getCustomerMessages({ page: 1 });
    expect(page1.messages).toHaveLength(8);
    expect(page1.totalPages).toBe(2);
    expect(page1.messages[0].email).toBe("t9@contact.com");

    expect((await contactService.getCustomerMessages({ page: 2 })).messages).toHaveLength(2);
  });

  test("search matches email or message text, case-insensitively", async () => {
    await Contact.create({ name: "T", email: "Alice@Shop.com", phone: "1", message: "refund please" });
    await Contact.create({ name: "T", email: "bob@shop.com", phone: "1", message: "shipping question" });

    const byEmail = await contactService.getCustomerMessages({ search: "alice" });
    expect(byEmail.messages).toHaveLength(1);

    const byMessage = await contactService.getCustomerMessages({ search: "REFUND" });
    expect(byMessage.messages).toHaveLength(1);
    expect(byMessage.messages[0].email).toBe("Alice@Shop.com");
  });
});

describe("customerService.listCustomers", () => {
  test("excludes admin accounts", async () => {
    await User.create({ name: "Shopper", email: "shopper@cust.com" });
    await User.create({ name: "Admin", email: "admin@cust.com", isAdmin: true });

    const res = await customerService.listCustomers({});
    expect(res.users).toHaveLength(1);
    expect(res.users[0].email).toBe("shopper@cust.com");
  });

  test("search is case-insensitive on name and email", async () => {
    await User.create({ name: "Alice Wonder", email: "alice@cust.com" });
    await User.create({ name: "Bob Marley", email: "bob@cust.com" });

    // The original regex had no "i" flag, so this returned nothing.
    const byName = await customerService.listCustomers({ search: "ALICE" });
    expect(byName.users).toHaveLength(1);
    expect(byName.users[0].name).toBe("Alice Wonder");

    const byEmail = await customerService.listCustomers({ search: "BOB@CUST" });
    expect(byEmail.users).toHaveLength(1);
  });

  test("paginates four to a page", async () => {
    for (let i = 0; i < 6; i++) {
      await User.create({ name: `Cust${i}`, email: `cust${i}@cust.com` });
    }

    const page1 = await customerService.listCustomers({ page: 1 });
    expect(page1.users).toHaveLength(4);
    expect(page1.totalPages).toBe(2);

    expect((await customerService.listCustomers({ page: 2 })).users).toHaveLength(2);
  });
});

describe("customerService.setCustomerBlocked", () => {
  test("toggles both ways", async () => {
    const user = await User.create({ name: "T", email: "block@cust.com" });
    const id = user._id.toString();

    await customerService.setCustomerBlocked({ customerId: id, isBlocked: true });
    expect((await User.findById(id)).isBlocked).toBe(true);

    await customerService.setCustomerBlocked({ customerId: id, isBlocked: false });
    expect((await User.findById(id)).isBlocked).toBe(false);
  });
});
