const Contact = require("../models/contactSchema");

//code to submit contact form

const submitContactForm = async (req, res) => {
  const { email, message, phone, name } = req.body;

  try {
  
    const newContact = new Contact({
      email,
      message,
      phone,
      name,
    });
    await newContact.save();

  
    res
      .status(200)
      .json({ success: true, message: "Your message has been submitted!" });
  } catch (error) {
    console.error("Error submitting contact form:", error);

  
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to submit your message. Please try again.",
      });
  }
};

//code to get contactPage

const customerMessages = async (req, res) => {
  try {
    let search = req.query.search || ""; 
    let page = parseInt(req.query.page) || 1; 
    const limit = 8; 

   
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

 
    const count = await Contact.find({
      $or: [
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
        { message: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    }).countDocuments();

   
    res.render("contactMessages", {
      messages,
      search,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error fetching customer messages:", error);
    res.redirect("/admin/pageerror"); 
  }
};

module.exports={
    submitContactForm,
    customerMessages
}