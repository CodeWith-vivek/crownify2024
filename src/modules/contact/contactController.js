const contactService = require("./contact.service");
const { sendError } = require("../../shared/errors/respond");

// HTTP adapters. Rules live in contact.service.js.

const submitContactForm = async (req, res) => {
  try {
    const result = await contactService.submitContactForm({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      message: req.body.message,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error submitting contact form");
  }
};

const customerMessages = async (req, res) => {
  try {
    const result = await contactService.getCustomerMessages({
      search: req.query.search || "",
      page: parseInt(req.query.page) || 1,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "Error fetching customer messages");
  }
};

module.exports = { submitContactForm, customerMessages };
