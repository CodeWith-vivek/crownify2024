const Contact = require("../models/contactSchema");

const submitContactForm = async (req, res) => {
  const { email, message, phone, name } = req.body;

  try {
    // Save the form data to the database
    const newContact = new Contact({
      email,
      message,
      phone,
      name,
    });
    await newContact.save();

    // Respond with success message
    res
      .status(200)
      .json({ success: true, message: "Your message has been submitted!" });
  } catch (error) {
    console.error("Error submitting contact form:", error);

    // Respond with error message
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to submit your message. Please try again.",
      });
  }
};
const customerMessages = async (req, res) => {
  try {
    let search = req.query.search || ""; // Retrieve search query
    let page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = 8; // Set limit of messages per page

    // Fetch messages with search filter, pagination, and sorting
    const messages = await Contact.find({
      $or: [
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
        { message: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .sort({ submittedOn :-1})
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    // Count total messages matching the search query
    const count = await Contact.find({
      $or: [
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
        { message: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    }).countDocuments();

    // Render the view with messages and pagination details
    res.render("contactMessages", {
      messages,
      search,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error fetching customer messages:", error);
    res.redirect("/admin/pageerror"); // Redirect to an error page
  }
};

module.exports={
    submitContactForm,
    customerMessages
}