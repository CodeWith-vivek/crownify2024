const User=require("../models/userSchema")
const nodemailer =require("nodemailer")
const bcrypt =require("bcrypt")
const env= require("dotenv").config();
const session =require("express-session")
const Address=require("../models/addressSchema")

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("password hash error", error);
  }
};
function generateOtp(){
     return Math.floor(100000 + Math.random() * 900000).toString();
}

const getForgotPassPage=async(req,res)=>{
    try {
       if (req.session.isLoggedIn) {
         return res.redirect("/"); // Or to the user's dashboard or profile
       }
        res.render("forgot-password")

        
    } catch (error) {
        
    }
}

const sendVerificationEmail =async (email,otp)=>{
    try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD,
          },
        });

        const mailOptions = {
          from: process.env.NODEMAILER_EMAIL,
          to: email,
          subject: "Your OTP for password reset",
          text: `your otp is${otp}`,
          html: `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #333333;">Your OTP for password reset</h2>
        <p style="font-size: 16px; color: #555555;">
         Please use the OTP below to reset your password:
        </p>
        <div style="margin: 20px 0; font-size: 24px; font-weight: bold; background-color: #007BFF; color: white; padding: 10px; border-radius: 5px;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #777777;">
          If you did not request this, please ignore this email.
        </p>
        <p style="font-size: 12px; color: #999999;">
          &copy; ${new Date().getFullYear()} CROWNIFY. All rights reserved.
        </p>
      </div>
    </div>
  `,
        };

        const info =await transporter.sendMail(mailOptions)
        console.log("Email sent:",info.messageId);
        return true;
        
    } catch (error) {
        console.log("error sending password resest email",error);
        return false
        
        
    }
}

const loadOtpPage=async(req,res)=>{
   if (!req.session.userOtp || !req.session.email) {
     // If no OTP or email session exists, redirect to the password reset page
     return res.redirect("/forget-password");
   }

   // Render OTP page
   const countdownTime = req.session.countdownTime || 120; // Set countdown to 120 seconds or the stored value
   res.render("forgetPass-otp", {
     userData: req.session.email, // Pass the email to the view
     countdownTime, // Pass countdown time to the view
   });
}








const forgotEmailValid = async (req, res) => {
  try {
    // Prevent caching of the page to avoid resubmission
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Redirect if the user is already logged in
    if (req.session.isLoggedIn) {
      return res.json({
        success: false,
        message: "User is already logged in.",
        redirect: "/",
      });
    }

    const { email } = req.body;
    const findUser = await User.findOne({ email });

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;

        // Check for email change and reset countdown time if necessary
        const currentEmail = findUser.email;
        const previousEmail = req.session.previousEmail;

        if (previousEmail !== currentEmail) {
          req.session.previousEmail = currentEmail;
          req.session.countdownTime = 120; // Reset the countdown
        }

        return res.json({
          success: true,
          message: "OTP sent successfully.",
          redirect: "/otp-page",
        });
      } else {
        return res.json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }
    } else {
      // Email not found case
      return res.json({
        success: false,
        message: "Email not found.",
      });
    }
  } catch (error) {
    console.error("Error in forgotEmailValid:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred.",
    });
  }
};
const verifyOtpForgot = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.userOtp;

        if (!sessionOtp) {
            return res.json({ success: false, message: "No OTP found in session." });
        }

        if (otp === sessionOtp) {
            req.session.userOtp = null; // Clear OTP after verification
            return res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            return res.json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
const addAddress = async (req, res) => {
  const userId = req.session.user;
  const {
    addressType,
    name: fullName,
    country,
    phone: mobileNumber,
    pincode: postalCode,
    home: flatHouseCompany,
    area: areaStreet,
    landmark,
    town: city,
    state,
    isPrimary, // Optional: to set this address as primary
  } = req.body;

  console.log(req.body);

  // Input validation
  if (
    !addressType ||
    !fullName ||
    !country ||
    !mobileNumber ||
    !postalCode ||
    !flatHouseCompany ||
    !areaStreet ||
    !city ||
    !state
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Create a new address object
  const newAddress = {
    addressType,
    fullName,
    country,
    mobileNumber,
    postalCode,
    flatHouseCompany,
    areaStreet,
    landmark,
    city,
    state,
    isPrimary: isPrimary === "true", // Convert to boolean if sent as a string
  };

  try {
    // If the new address is to be set as primary, unset primary from other addresses
    if (newAddress.isPrimary) {
      await Address.updateOne(
        { userId },
        { $set: { "addresses.$[].isPrimary": false } } // Unset primary from all addresses
      );
    }

    // Find the user by userId and update their addresses array
    const updatedAddress = await Address.findOneAndUpdate(
      { userId }, // Filter by userId
      { $push: { addresses: newAddress } }, // Push new address to the addresses array
      { new: true, upsert: true } // Create a new document if not found
    );

    res.status(201).json({
      message: "Address added successfully!",
      data: updatedAddress, // Include the updated address list
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({
      message: "Error adding address. Please try again.",
      error: error.message, // Optionally include error message for debugging
    });
  }
};


  



const resendOtpForgot = async (req, res) => {
  try {
    const userEmail = req.session.email; 

    if (!userEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required ." });
    }

    const otp = generateOtp(); 
    const emailSent = await sendVerificationEmail(userEmail, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      return res.json({ success: true, message: "OTP resent successfully." });
    } else {
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to resend OTP. Please try again.",
        });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while resending the OTP.",
      });
  }
};

const getResetPassPage=async(req,res)=>{
  try {
  
       if (req.session.isLoggedIn) {
         return res.redirect("/"); // Or to the user's dashboard or profile
       }

    res.render("reset-password")
    
  } catch (error) {
    res.redirect("/pageNotFound")
    
  }

}

const forgotNewPassword = async (req, res) => {
  try {
    const { password, cPassword } = req.body;
    const email = req.session.email;

    // Check if email is present in session
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "No email found in session." });
    }

    // Check if passwords match
    if (password !== cPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match." });
    }

    // Hash the new password
    const passwordHash = await securePassword(password);

    // Update user's password in the database
    await User.updateOne(
      { email: email },
      { $set: { password: passwordHash } }
    );

    // Clear session variables and log in the user
    req.session.userOtp = null;
    req.session.email = null;
    req.session.countdownTime = null;
    req.session.previousEmail = null;
// Log in the user

    return res.json({
      success: true,
      message: "Your password has been reset successfully.",
      redirect: "/login", // Redirect to a dashboard or home page
    });
  } catch (error) {
    console.error("Error in resetting password:", error);
    return res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};
const userProfile=async(req,res)=>{
  try {

    const userId=req.session.user;
    const userData=await User.findById(userId)
    res.render("profile",{
      user:userData,
    })

    
  } catch (error) {
    console.error("error for retrieve data",error)
    res.redirect("/pageNotFound")
  }

}
const loadAddAddressPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    // For fresh page loads, no `addressData` will exist
    // const addressData = req.session.addressData || {};

    // // Clear session data after retrieval (optional, for fresh inputs)
    // req.session.addressData = null;

    // Render the Add Address form
    res.render("addAddress", { user: userData });
  } catch (error) {
    console.error("Error loading add address page:", error);
    res.status(500).send("Server error");
  }
};

module.exports={
    getForgotPassPage,
    forgotEmailValid,
    verifyOtpForgot,
    resendOtpForgot,
    getResetPassPage,
    forgotNewPassword,
    userProfile,
    loadOtpPage,
    loadAddAddressPage,
    addAddress
    
}