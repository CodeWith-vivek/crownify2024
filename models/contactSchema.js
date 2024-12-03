const mongoose = require("mongoose");
const { Schema } = mongoose;
const contactSchema = new mongoose.Schema({
  email: { type: String, required: true },
  message: { type: String, required: true },
  phone:{ type:String,required:true},
  name:{type:String,required:true},
  submittedOn: { type: Date, default: Date.now },
});

const Contact = mongoose.model("Contact", contactSchema);
module.exports = Contact;
