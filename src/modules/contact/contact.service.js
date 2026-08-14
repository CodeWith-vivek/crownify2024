const Contact = require("./contactSchema");
const { badRequest } = require("../../shared/errors/AppError");

// Contact form rules, free of Express.

const MESSAGES_PER_PAGE = 8;

async function submitContactForm({ name, email, phone, message }) {
  if (!name || !email || !phone || !message) {
    throw badRequest("All fields are required.");
  }

  await new Contact({ name, email, phone, message }).save();

  return { message: "Your message has been submitted!" };
}

async function getCustomerMessages({ search = "", page = 1, limit = MESSAGES_PER_PAGE }) {
  // Built once and reused for both the page and the count — the original
  // repeated the same $or filter verbatim in two separate queries.
  const filter = {
    $or: [
      { email: { $regex: ".*" + search + ".*", $options: "i" } },
      { message: { $regex: ".*" + search + ".*", $options: "i" } },
    ],
  };

  const [messages, count] = await Promise.all([
    Contact.find(filter)
      .sort({ submittedOn: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec(),
    Contact.countDocuments(filter),
  ]);

  return { messages, search, currentPage: page, totalPages: Math.ceil(count / limit) };
}

module.exports = { submitContactForm, getCustomerMessages, MESSAGES_PER_PAGE };
