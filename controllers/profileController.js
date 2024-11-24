const User=require("../models/userSchema")
const nodemailer =require("nodemailer")
const bcrypt =require("bcrypt")
const env= require("dotenv").config();
const session =require("express-session")
const Address=require("../models/addressSchema")
const express = require("express");
const sharp = require("sharp");
const Order=require("../models/orderSchema")

const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
// Adjust the import according to your project structure

// Configure multer to use memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
  const userId = req.session.user; // Ensure this is the correct user ID
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

  console.log("Request Body:", req.body);
  console.log("User ID from session:", userId);

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

  try {
    // Fetch the user's current addresses count
    const user = await User.findById(userId).populate("addresses");

    if (user.addresses.length >= 4) {
      return res.status(400).json({
        message: "You cannot add more than 4 addresses.",
      });
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

    // If the new address is to be set as primary, unset primary from other addresses
    if (newAddress.isPrimary) {
      await Address.updateMany(
        { userId }, // Ensure you're targeting the correct user
        { $set: { "addresses.$[].isPrimary": false } } // Unset primary from all addresses
      );
    }

    // Create the address in the Address collection
    const addressDocument = await Address.create({
      userId, // Associate the address with the user
      ...newAddress,
    });

    console.log("Address Document Created:", addressDocument);

    // Update the user's addresses array in the User collection
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: addressDocument._id } }, // Push the new address ID to the addresses array
      { new: true, upsert: true } // Create a new document if not found
    );

    console.log("Updated User Document:", updatedUser);

    res.status(201).json({
      message: "Address added successfully!",
      data: addressDocument, // Include the created address
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
const userProfile = async (req, res) => {
    try {
        const userId = req.session.user;

        // Fetch user data
        const userData = await User.findById(userId).populate('addresses'); // Assuming addresses are populated
        const userOrders = await Order.find({ userId })
          .populate("items.productId")
          .sort({
            orderedAt: -1,
          });
        console.log("Ajith",userOrders);
        

        // If the user has addresses, they will be included in userData
        res.render("profile", {
          user: userData,
          orders: userOrders,
        });
    } catch (error) {
        console.error("Error retrieving data:", error);
        res.redirect("/pageNotFound");
    }
};
const loadAddAddressPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    
    res.render("addAddress", { user: userData });
  } catch (error) {
    console.error("Error loading add address page:", error);
    res.status(500).send("Server error");
  }
};
const setPrimaryAddress=async (req,res)=>{
  try {
      const userId = req.session.user;
      console.log(userId);
      
    const addressId = req.params.id;
    console.log("Received addressId:", addressId); // Debug log

    // Verify user is logged in
    if (!req.session.user ) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // const userId = req.session.user._id;
    console.log("User ID from session:", userId); // Debug log

    // Update all addresses to non-primary
    await Address.updateMany(
      { userId: userId },
      { $set: { isPrimary: false } }
    );

    // Set the selected address as primary
    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      { $set: { isPrimary: true } },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.json({
      success: true,
      message: "Primary address updated successfully",
    });
  } catch (error) {
    console.error("Error setting primary address:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating primary address",
    });
  }
}
const deleteUserAddress =async(req,res)=>{
  try {
    const addressId = req.params.id;
    const userId = req.session.user;

    // Verify the address belongs to the user
    const address = await Address.findOne({ _id: addressId, userId: userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const deletedAddress = await Address.findOneAndDelete({
      _id: addressId,
      userId: userId,
    });

    // If we deleted a primary address, set another one as primary
    if (deletedAddress.isPrimary) {
      const firstAddress = await Address.findOne({ userId: userId });
      if (firstAddress) {
        await Address.findByIdAndUpdate(firstAddress._id, {
          $set: { isPrimary: true },
        });
      }
    }

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting address",
    });
  }
}
const editUserAddress = async (req, res) => {
  try {
    const userId = req.session.user;

    // Use Promise.all for concurrent fetching
    const [userData, address] = await Promise.all([
      User.findById(userId),
      Address.findOne({
        _id: req.params.id,
        userId: userId, // More explicit userId check
      }),
    ]);

    // Enhanced logging with more context
    console.log({
      message: "Edit Address Details",
      userId: userId,
      addressId: req.params.id,
      addressFound: !!address,
    });

    // More robust error handling
    if (!userData) {
      req.flash("error", "User not found");
      return res.redirect("/login");
    }

    if (!address) {
      req.flash("error", "Address not found or you don't have permission");
      return res.redirect("/profile");
    }

    // Render with additional context
    res.render("editAddress", {
      address,
      user: userData,
      pageTitle: "Edit Address",
    });
  } catch (error) {
    // More detailed error logging
    console.error("Edit Address Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.session.user,
      addressId: req.params.id,
    });

    req.flash("error", "An unexpected error occurred");
    res.redirect("/user/profile#address");
  }
};
const updateUserAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;

    // Destructure the request body
    const {
      addressType,
      name,
      country,
      phone,
      pincode,
      home,
      area,
      landmark,
      town,
      state,
    } = req.body;

    // Find and update the address
    const updatedAddress = await Address.findOneAndUpdate(
      {
        _id: addressId,
        userId: userId,
      },
      {
        $set: {
          addressType,
          fullName: name,
          country,
          mobileNumber: phone,
          postalCode: pincode,
          flatHouseCompany: home,
          areaStreet: area,
          landmark,
          city: town,
          state,
        },
      },
      {
        new: true, // Return the updated document
        runValidators: true, // Run model validations
      }
    );

    // Check if address was found and updated
    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message:
          "Address not found or you do not have permission to edit this address",
      });
    }

    // Send success response
    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address: updatedAddress,
    });
  } catch (error) {
    console.error("Update Address Error:", error);

    // Handle specific validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((err) => err.message)[0],
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the address",
    });
  }
};
const uploadProfilePic=async(req,res)=>{
   try {
     if (!req.file) {
       return res
         .status(400)
         .json({ success: false, message: "No file uploaded" });
     }

     // Create uploads directory if it doesn't exist
     const uploadsDir = path.join(__dirname, "../public/uploads/avatars");
     await fs.mkdir(uploadsDir, { recursive: true });

     // Generate unique filename
     const filename = `avatar-${req.user._id}-${Date.now()}.jpg`;
     const filepath = path.join(uploadsDir, filename);

     // Process and save image
     await sharp(req.file.buffer)
       .resize(300, 300, {
         fit: "cover",
         position: "center",
       })
       .jpeg({ quality: 90 })
       .toFile(filepath);

     // Update user's avatar in database
     const avatarUrl = `/uploads/avatars/${filename}`;
     await User.findByIdAndUpdate(req.user._id, {
       avatar: avatarUrl,
       updatedAt: new Date(),
     });

     // Delete old avatar file if it exists
     if (req.user.avatar) {
       const oldAvatarPath = path.join(__dirname, "../public", req.user.avatar);
       try {
         await fs.access(oldAvatarPath);
         await fs.unlink(oldAvatarPath);
       } catch (error) {
         console.log("No old avatar file to delete");
       }
     }

     res.json({
       success: true,
       avatarUrl: avatarUrl,
     });
   } catch (error) {
     console.error("Avatar upload error:", error);
     res.status(500).json({
       success: false,
       message: "Error uploading avatar",
     });
   }
}

const updateProfileDetails=async(req,res)=>{
  const { name, phone, password, npassword } = req.body;
  const userId = req.session.user; // Assume user is logged in

  try {
    const user = await User.findById(userId);

    // Validate current password if provided
    if (password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.json({
          success: false,
          error: "Incorrect current password",
        });
      }
    }

    // Update fields if they have changed
    if (name && name !== user.name) user.name = name;
    if (phone && phone !== user.phone) user.phone = phone;
    if (npassword) user.password = await bcrypt.hash(npassword, 10);

    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }

}
const validatCurrentPassword= async(req,res)=>{
  const {  password } = req.body; // Assuming you send userId to identify the user
  const userId = req.session.user;

  try {
    // Retrieve the user from the database
    const user = await User.findById(userId); // Replace with your method to get the user

    if (!user) {
      return res.status(404).json({ valid: false, message: "User  not found" });
    }

    // Compare the entered password with the stored hashed password
    const isValid = await bcrypt.compare(password, user.password); // Assuming user.password is the hashed password

    res.json({ valid: isValid });
  } catch (error) {
    console.error("Error validating password:", error);
    res.status(500).json({ valid: false, message: "Internal server error" });
  }
}



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
    addAddress,
    setPrimaryAddress,
    deleteUserAddress,
    editUserAddress,
    updateUserAddress,
    uploadProfilePic,
    updateProfileDetails,
    validatCurrentPassword,
 
   

    
}