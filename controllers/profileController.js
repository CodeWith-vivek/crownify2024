const User = require("../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const Address = require("../models/addressSchema");
const express = require("express");
const sharp = require("sharp");
const Order = require("../models/orderSchema");

const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//code for secure password

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("password hash error", error);
  }
};

//code to generate otp

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

//code to load forgot password page

const getForgotPassPage = async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      return res.redirect("/"); 
    }
    res.render("forgot-password");
  } catch (error) {}
};

//code to send verification email

const sendVerificationEmail = async (email, otp) => {
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

    const info = await transporter.sendMail(mailOptions);

    return true;
  } catch (error) {
    console.log("error sending password resest email", error);
    return false;
  }
};

//code to load otp page

const loadOtpPage = async (req, res) => {
  if (!req.session.userOtp || !req.session.email) {
  
    return res.redirect("/forget-password");
  }

  // Render OTP page
  const countdownTime = req.session.countdownTime || 120; 
  res.render("forgetPass-otp", {
    userData: req.session.email, 
    countdownTime,
  });
};



const forgotEmailValid = async (req, res) => {
  try {
    
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

  
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

        
        const currentEmail = findUser.email;
        const previousEmail = req.session.previousEmail;

        if (previousEmail !== currentEmail) {
          req.session.previousEmail = currentEmail;
          req.session.countdownTime = 120; 
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

// code to verify otp forgot

const verifyOtpForgot = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;

    if (!sessionOtp) {
      return res.json({ success: false, message: "No OTP found in session." });
    }

    if (otp === sessionOtp) {
      req.session.userOtp = null;
      return res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      return res.json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// code to add new address
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
    isPrimary, 
  } = req.body;


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
   
    const user = await User.findById(userId).populate("addresses");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

   
    if (user.addresses.length >= 4) {
      return res.status(400).json({
        message: "You cannot add more than 4 addresses.",
      });
    }

    const setAsPrimary = isPrimary === "true" || user.addresses.length === 0; 

  
    if (setAsPrimary) {
      await Address.updateMany(
        { userId },
        { $set: { isPrimary: false } } 
      );
    }

  
    const newAddress = await Address.create({
      userId,
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
      isPrimary: setAsPrimary, 
    });

 
    user.addresses.push(newAddress._id);
    await user.save();

    res.status(201).json({
      message: "Address added successfully!",
      data: newAddress,
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({
      message: "Error adding address. Please try again.",
      error: error.message,
    });
  }
};

//code to resend otp forgot

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
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while resending the OTP.",
    });
  }
};

// code to load reset pass page

const getResetPassPage = async (req, res) => {
  try {
    if (req.session.isLoggedIn) {
      return res.redirect("/");
    }

    res.render("reset-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//code to set new password

const forgotNewPassword = async (req, res) => {
  try {
    const { password, cPassword } = req.body;
    const email = req.session.email;


    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "No email found in session." });
    }

   
    if (password !== cPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match." });
    }

   
    const passwordHash = await securePassword(password);

   
    await User.updateOne(
      { email: email },
      { $set: { password: passwordHash } }
    );

  
    req.session.userOtp = null;
    req.session.email = null;
    req.session.countdownTime = null;
    req.session.previousEmail = null;
   

    return res.json({
      success: true,
      message: "Your password has been reset successfully.",
      redirect: "/login", 
    });
  } catch (error) {
    console.error("Error in resetting password:", error);
    return res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

// code to load user profile 

const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;

   
    const userData = await User.findById(userId).populate("addresses"); 
    const userOrders = await Order.find({ userId })
      .populate("items.productId")
      .sort({
        orderedAt: -1,
      });

   
    res.render("profile", {
      user: userData,
      orders: userOrders,
    });
  } catch (error) {
    console.error("Error retrieving data:", error);
    res.redirect("/pageNotFound");
  }
};

// code to load add address page

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

// code to set primary address

const setPrimaryAddress = async (req, res) => {
  try {
    const userId = req.session.user;

    const addressId = req.params.id;

    
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

   
    await Address.updateMany(
      { userId: userId },
      { $set: { isPrimary: false } }
    );

  
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
};

//code to delete address

const deleteUserAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;

    
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
};

//code to load edit address page

const editUserAddress = async (req, res) => {
  try {
    const userId = req.session.user;

 
    const [userData, address] = await Promise.all([
      User.findById(userId),
      Address.findOne({
        _id: req.params.id,
        userId: userId,
      }),
    ]);

    
    if (!userData) {
      return res.redirect("/login");
    }

    if (!address) {
      return res.redirect("/profile");
    }

  
    res.render("editAddress", {
      address,
      user: userData,
      pageTitle: "Edit Address",
    });
  } catch (error) {
   
    console.error("Edit Address Error:", error);
    res.redirect("/user/profile#address");
  }
};

//code to edit user address

const updateUserAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;

 
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
    console.log("adadadadadadadadadad",req.body)

   
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
        new: true,
        runValidators: true,
      }
    );

  
    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message:
          "Address not found or you do not have permission to edit this address",
      });
    }

   
    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address: updatedAddress,
    });
  } catch (error) {
    console.error("Update Address Error:", error);

   
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((err) => err.message)[0],
      });
    }

    
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the address",
    });
  }
};

//code to update user profile details

const updateProfileDetails = async (req, res) => {
  const { name, phone, password, npassword } = req.body;
  const userId = req.session.user;

  try {
    const user = await User.findById(userId);

    
    if (password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.json({
          success: false,
          error: "Incorrect current password",
        });
      }
    }

    
    if (name && name !== user.name) user.name = name;
    if (phone && phone !== user.phone) user.phone = phone;
    if (npassword) user.password = await bcrypt.hash(npassword, 10);

    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
};

//code to validate current password

const validatCurrentPassword = async (req, res) => {
  const { password } = req.body; 
  const userId = req.session.user;

  try {
 
    const user = await User.findById(userId); 

    if (!user) {
      return res.status(404).json({ valid: false, message: "User  not found" });
    }

   
    const isValid = await bcrypt.compare(password, user.password);

    res.json({ valid: isValid });
  } catch (error) {
    console.error("Error validating password:", error);
    res.status(500).json({ valid: false, message: "Internal server error" });
  }
};



const loadUserOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = parseInt(req.query.limit) || 10; // Items per page
    const skip = (page - 1) * limit; // Calculate how many orders to skip

    const userData = await User.findById(userId).populate("addresses"); 
    const userOrders = await Order.find({ userId })
      .populate("items.productId")
      .sort({ orderedAt: -1 })
      .skip(skip) // Skip the previous pages
      .limit(limit); // Limit the number of orders returned

    const totalOrders = await Order.countDocuments({ userId }); // Get total number of orders

    // Function to get badge class based on order status
    const getBadgeClass = (status) => {
      const badgeClasses = {
        'Delivered': 'text-success',
        'Shipped': 'text-purple',
        'Return requested': 'text-orange',
        'Returned':'text-info',
        'Return Approved': 'text-info',
        'Return Rejected': 'text-danger',
        'Placed': 'text-warning',
        'Confirmed': 'text-warning',
        'canceled': 'text-danger'
      };
      return badgeClasses[status] || 'bg-secondary';
    };

    // Map over orders and their items to add badgeClass
    const ordersWithBadgeClasses = userOrders.map(order => {
      order.items = order.items.map(item => {
        item.badgeClass = getBadgeClass(item.orderStatus); // Add badge class
        return item;
      });
      return order;
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / limit);

    // Pass limit to the view
    res.render("Order", {
      user: userData,
      orders: ordersWithBadgeClasses, // Use the modified orders
      currentPage: page,
      totalPages: totalPages,
      limit: limit // Pass the limit to the view
    });
  } catch (error) {
    console.error("Error retrieving data:", error);
    res.redirect("/pageNotFound");
  }
};

//code to load user Address

const loadUserAddress = async (req, res) => {
  try {
    const userId = req.session.user;

  
    const userData = await User.findById(userId).populate("addresses");
       const addressCount = userData.addresses ? userData.addresses.length : 0;
   
    const userOrders = await Order.find({ userId })
      .populate("items.productId")
      .sort({
        orderedAt: -1,
      });

   
    res.render("Address", {
      user: userData,
      orders: userOrders,
      addressCount, // Added addressCount
    });
  } catch (error) {
    console.error("Error retrieving data:", error);
    res.redirect("/pageNotFound");
  }
};

//code to load user account details page

const loadUserAccountDetails = async (req, res) => {
  try {
    const userId = req.session.user;

  
    const userData = await User.findById(userId).populate("addresses");
    const userOrders = await Order.find({ userId })
      .populate("items.productId")
      .sort({
        orderedAt: -1,
      });

   
    res.render("AccountDetails", {
      user: userData,
      orders: userOrders,
    });
  } catch (error) {
    console.error("Error retrieving data:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
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
  updateProfileDetails,
  validatCurrentPassword,
  loadUserOrder,
  loadUserAddress,
  loadUserAccountDetails,
};
