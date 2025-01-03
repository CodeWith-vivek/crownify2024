const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const Coupon = require("../models/couponSchema");

// code for secure password

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("password hash error", error);
  }
};

//code for loading homepage

const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      const [products, coupons] = await Promise.all([
        Product.find({
          isBlocked: false,
        }).populate("category"),
        Coupon.find({}),
      ]);

      return res.render("Home", {
        products,
        coupons,
        cartCount: 0,
        wishlistCount: 0,
      });
    }

    const [listedCategories, unblockedBrands, products, coupons, userData] =
      await Promise.all([
        Category.find({ isListed: true }),
        Brand.find({ isBlocked: false }),
        Product.find({
          isBlocked: false,
        }).populate("category"),
        Coupon.find({}),
        User.findById(userId)
          .populate({
            path: "cart",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          })
          .populate({
            path: "wishlist",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          }),
      ]);
    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const isValidProduct = (product) => {
      return (
        product &&
        !product.isBlocked &&
        listedCategoryIds.has(product.category?._id?.toString()) &&
        unblockedBrandNames.has(product.brand)
      );
    };

    const filteredProducts = products.filter((product) =>
      isValidProduct(product)
    );

    const cartCount = userData?.cart?.[0]?.items
      ? userData.cart[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    const wishlistCount = userData?.wishlist?.[0]?.items
      ? userData.wishlist[0].items.filter((item) =>
          isValidProduct(item.productId)
        ).length
      : 0;

    return res.render("Home", {
      user: userData,
      products: filteredProducts,
      coupons,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).send("Server error");
  }
};

//code to load contact page


const loadContactpage = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      const products = await Product.find({ isBlocked: false });
      return res.render("contact", {
        products,
        cartCount: 0,
        wishlistCount: 0,
      });
    }

    const [listedCategories, unblockedBrands, products, userData] =
      await Promise.all([
        Category.find({ isListed: true }),
        Brand.find({ isBlocked: false }),
        Product.find({ isBlocked: false }),
        User.findById(userId)
          .populate({
            path: "cart",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          })
          .populate({
            path: "wishlist",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          }),
      ]);

    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const isValidProduct = (product) => {
      return (
        product &&
        !product.isBlocked &&
        listedCategoryIds.has(product.category?._id?.toString()) &&
        unblockedBrandNames.has(product.brand)
      );
    };

    const cartCount = userData?.cart?.[0]?.items
      ? userData.cart[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    const wishlistCount = userData?.wishlist?.[0]?.items
      ? userData.wishlist[0].items.filter((item) =>
          isValidProduct(item.productId)
        ).length
      : 0;

    const filteredProducts = products.filter((product) =>
      isValidProduct(product)
    );

    return res.render("contact", {
      user: userData,
      products: filteredProducts,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Error loading contact page:", error);
    res.status(500).send("Server error");
  }
};

//code to load about page


const loadAboutpage = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      const [products, coupons] = await Promise.all([
        Product.find({ isBlocked: false }),
        Coupon.find({}),
      ]);

      return res.render("About", {
        products,
        coupons,
        cartCount: 0,
        wishlistCount: 0,
      });
    }

    const [listedCategories, unblockedBrands, products, coupons, userData] =
      await Promise.all([
        Category.find({ isListed: true }),
        Brand.find({ isBlocked: false }),
        Product.find({ isBlocked: false }),
        Coupon.find({}),
        User.findById(userId)
          .populate({
            path: "cart",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          })
          .populate({
            path: "wishlist",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          }),
      ]);

    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const isValidProduct = (product) => {
      return (
        product &&
        !product.isBlocked &&
        listedCategoryIds.has(product.category?._id?.toString()) &&
        unblockedBrandNames.has(product.brand)
      );
    };

    const cartCount = userData?.cart?.[0]?.items
      ? userData.cart[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    const wishlistCount = userData?.wishlist?.[0]?.items
      ? userData.wishlist[0].items.filter((item) =>
          isValidProduct(item.productId)
        ).length
      : 0;

    const filteredProducts = products.filter((product) =>
      isValidProduct(product)
    );

    return res.render("About", {
      user: userData,
      products: filteredProducts,
      coupons,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Error loading about page:", error);
    res.status(500).send("Server error");
  }
};

//code to load faq page


const loadFaqpage = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      const products = await Product.find({ isBlocked: false });
      return res.render("FAQ", {
        products,
        cartCount: 0,
        wishlistCount: 0,
      });
    }

    const [listedCategories, unblockedBrands, products, userData] =
      await Promise.all([
        Category.find({ isListed: true }),
        Brand.find({ isBlocked: false }),
        Product.find({ isBlocked: false }),
        User.findById(userId)
          .populate({
            path: "cart",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          })
          .populate({
            path: "wishlist",
            populate: {
              path: "items.productId",
              model: "Product",
              populate: {
                path: "category",
                model: "Category",
              },
            },
          }),
      ]);

    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const isValidProduct = (product) => {
      return (
        product &&
        !product.isBlocked &&
        listedCategoryIds.has(product.category?._id?.toString()) &&
        unblockedBrandNames.has(product.brand)
      );
    };

    const cartCount = userData?.cart?.[0]?.items
      ? userData.cart[0].items.filter((item) => isValidProduct(item.productId))
          .length
      : 0;

    const wishlistCount = userData?.wishlist?.[0]?.items
      ? userData.wishlist[0].items.filter((item) =>
          isValidProduct(item.productId)
        ).length
      : 0;

    const filteredProducts = products.filter((product) =>
      isValidProduct(product)
    );

    return res.render("FAQ", {
      user: userData,
      products: filteredProducts,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.error("Error loading FAQ page:", error);
    res.status(500).send("Server error");
  }
};


//code to load brand page


const loadBrandpage = async (req, res) => {
  try {
    const userId = req.session.user;

    const listedCategories = await Category.find({ isListed: true });
    const unblockedBrands = await Brand.find({ isBlocked: false });

    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );

    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const products = await Product.find({
      isBlocked: false,
      category: { $in: [...listedCategoryIds] },
      brand: { $in: [...unblockedBrandNames] },
    });

    if (userId) {
      const userData = await User.findById(userId)
        .populate({
          path: "cart",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        })
        .populate({
          path: "wishlist",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        });

      const isValidProduct = (product) => {
        return (
          product &&
          !product.isBlocked &&
          listedCategoryIds.has(product.category?._id?.toString()) &&
          unblockedBrandNames.has(product.brand)
        );
      };

      const cartCount = userData?.cart?.[0]?.items
        ? userData.cart[0].items.filter((item) =>
            isValidProduct(item.productId)
          ).length
        : 0;

      const wishlistCount = userData?.wishlist?.[0]?.items
        ? userData.wishlist[0].items.filter((item) =>
            isValidProduct(item.productId)
          ).length
        : 0;

      return res.render("Brand", {
        user: userData,
        products,
        cartCount,
        wishlistCount,
      });
    } else {
      return res.render("Brand", {
        products,
        cartCount: 0,
        wishlistCount: 0,
      });
    }
  } catch (error) {
    console.error("Error loading brand page:", error);
    res.status(500).send("Server error");
  }
};

//code for page not found

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    console.log("error loading page not found", error);
    res.redirect("/pageNotFound");
  }
};

// code load signup page

const loadSignup = async (req, res) => {

   try {
     const userId = req.session.user; 
     let userData = req.session.userData || {};

     if (userId) {
       const user = await User.findById(userId)
         .populate("cart")
         .populate("wishlist");

       const cartCount =
         user.cart && user.cart.length > 0 ? user.cart[0].items.length : 0; 
       const wishlistCount =
         user.wishlist && user.wishlist.length > 0
           ? user.wishlist[0].items.length
           : 0; 

       userData = {
         ...userData,
         cartCount,
         wishlistCount,
       };
     }

     req.session.userData = null; 

     res.render("signup", { data: userData });
   } catch (error) {
     console.log("Signup page not loading", error);
     res.status(500).redirect("/pageNotFound");
   }
};

//code to load otp page


const loadOtpverify = async (req, res) => {
  try {
    const userData = req.session.userData;
    if (!userData) {
      return res.redirect("/signup");
    }

    const userId = userData._id; 
    let cartCount = 0;
    let wishlistCount = 0;

    if (userId) {
      const user = await User.findById(userId)
        .populate("cart")
        .populate("wishlist");
      cartCount =
        user.cart && user.cart.length > 0 ? user.cart[0].items.length : 0;
      wishlistCount =
        user.wishlist && user.wishlist.length > 0
          ? user.wishlist[0].items.length
          : 0; 
    }

    req.session.countdownTime = 120;

    res.render("verify-otp", {
      userData,
      countdownTime: req.session.countdownTime,
      cartCount,
      wishlistCount,
    });
  } catch (error) {
    console.log("Verify OTP page not loading", error);
    res.status(500).send("server error");
  }
};

//code to generate otp

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `your otp is${otp}`,
      html: `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #333333;">Verify Your Account</h2>
        <p style="font-size: 16px; color: #555555;">
          Thank you for registering with us! Please use the OTP below to verify your account:
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
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.log("Error sending email ", error);
    return false;
  }
}

//code for sign up

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword } = req.body;

    if (password !== cPassword) {
      return res.json({
        success: false,
        message: "Passwords do not match",
        redirect: "/signup",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.googleId) {
        return res.json({
          success: false,
          message: "User with this email already registered via Google.",
          redirect: "/signup",
        });
      }

      return res.json({
        success: false,
        message: "User with this email already exists.",
        redirect: "/signup",
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      const hashedPassword = await securePassword(password);
      let avatarPath = req.file
        ? "/uploads/avatars/" + req.file.filename
        : null;

      req.session.userOtp = otp;
      
      req.session.userData = {
        name,
        phone,
        email,
        password: hashedPassword,
        avatar: avatarPath,
      };

      return res.json({
        success: true,
        message: "OTP sent successfully! Please verify.",
        redirect: "/verify-otp",
      });
    } else {
      return res.json({
        success: false,
        message: "Error sending verification email",
        redirect: "/signup",
      });
    }
  } catch (error) {
    console.log("signup error", error);
    return res.json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
      redirect: "/pageNotFound",
    });
  }
};


//code to verify otp

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;

    if (!sessionOtp) {
      return res.json({
        success: false,
        message: "Session expired. Please request a new OTP.",
      });
    }

    if (otp.toString() === sessionOtp.toString()) {
      const user = req.session.userData;

      
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User data is missing. Please try again.",
        });
      }

      const avatarPath = user.avatar || null; 

     
      const newUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password, 
        avatar: avatarPath,
        wishlist: [], 
      });

      await newUser.save().catch((saveError) => {
        return res.status(400).json({
          success: false,
          message: "Error saving user. Please try again.",
        });
      });

      
      req.session.user = newUser._id;
      req.session.userOtp = null;
      req.session.userData = null;

      return res.json({
        success: true,
        redirectUrl: "/",
        message: "Signup successful!",
      });
    } else {
      return res.json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.log("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
//code to resend otp

const resendOtp = async (req, res) => {
  try {
    const userData = req.session.userData;
    if (!userData) {
      return res
        .status(400)
        .json({ success: false, message: "User data not found." });
    }

    const newOtp = generateOtp();
    const emailSent = await sendVerificationEmail(userData.email, newOtp);

    if (emailSent) {
      req.session.userOtp = newOtp;
      return res.json({
        success: true,
        message: "New OTP sent to your email.",
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Error sending email." });
    }
  } catch (error) {
    console.log("Resend OTP error", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

//code to load login page


const loadLogin = async (req, res) => {
  try {

    if (!req.session.user) {
      return res.render("login", { data: null }); 
    } else {
      const userId = req.session.user; 
      const user = await User.findById(userId)
        .populate("cart")
        .populate("wishlist");

      const cartCount =
        user.cart && user.cart.length > 0 ? user.cart[0].items.length : 0; 
      const wishlistCount =
        user.wishlist && user.wishlist.length > 0
          ? user.wishlist[0].items.length
          : 0; 

      res.redirect("/");
    }
  } catch (error) {
    console.log("Error loading login page:", error);
    res.redirect("/pageNotFound");
  }
};

//code to login user

// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const existingUser = await User.findOne({ email });

//     if (!existingUser) {
//       return res.json({
//         success: false,
//         message: "User not registered",
//       });
//     }

//     if (existingUser.isBlocked) {
//       return res.json({
//         success: false,
//         message: "User is blocked by admin",
//       });
//     }

//     const passwordMatch = await bcrypt.compare(password, existingUser.password);

//     if (!passwordMatch) {
//       return res.json({
//         success: false,
//         message: "Password Incorrect",
//       });
//     }

//     const sixMonthsAgo = new Date();
//     sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

//     existingUser.status =
//       existingUser.lastLogin >= sixMonthsAgo ? "Active" : "Inactive";
//     await existingUser.save();

//     req.session.user = existingUser._id;
//     req.session.isLoggedIn = true;
//     req.session.userOtp = null;
//     req.session.email = null;
//     req.session.countdownTime = null;

//     return res.json({
//       success: true,
//       message: "Login Successful",
//       redirectUrl: "/",
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     return res.json({
//       success: false,
//       message: "An error occurred during login",
//     });
//   }
// };


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      return res.json({
        success: false,
        message: "User not registered",
      });
    }

    if (existingUser.isBlocked) {
      return res.json({
        success: false,
        message: "User is blocked by admin",
      });
    }

    // Check if the user has logged in with Google
    if (existingUser.googleId) {
      return res.json({
        success: false,
        message:
          "This email is associated with a Google account. Please log in using Google.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, existingUser.password);

    if (!passwordMatch) {
      return res.json({
        success: false,
        message: "Password Incorrect",
      });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    existingUser.status =
      existingUser.lastLogin >= sixMonthsAgo ? "Active" : "Inactive";
    await existingUser.save();

    req.session.user = existingUser._id;
    req.session.isLoggedIn = true;
    req.session.userOtp = null;
    req.session.email = null;
    req.session.countdownTime = null;

    return res.json({
      success: true,
      message: "Login Successful",
      redirectUrl: "/",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.json({
      success: false,
      message: "An error occurred during login",
    });
  }
};

//code to logout the user

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("session logout error", err);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/");
    });
  } catch (error) {
    console.log("logout error", error);
    res.redirect("/pageNotFound");
  }
};

//code to load shop page


const loadShopPage = async (req, res) => {
  try {
    const userId = req.session.user;

    const search = req.query.search || "";
    const limit = 12;

    const parseArrayParam = (param) =>
      req.query[param]
        ? Array.isArray(req.query[param])
          ? req.query[param]
          : [req.query[param]]
        : [];

    const isFiltered =
      search ||
      req.query.color ||
      req.query.priceRange ||
      req.query.categories ||
      req.query.brands ||
      req.query.sizes;

    const page = isFiltered ? 1 : parseInt(req.query.page) || 1;

    const sortOptions = {
      priceLowHigh: { salePrice: 1 },
      priceHighLow: { salePrice: -1 },
      alphaAsc: { productName: 1 },
      alphaDesc: { productName: -1 },
      newArrivals: { createdAt: -1 },
      popularity: { popularity: -1 },
    };
    const sortCriteria = sortOptions[req.query.sort] || { createdAt: -1 };

    const [activeCategories, activeBrands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
    ]);

    const productsQuery = {
      isBlocked: false,
      category: { $in: activeCategories.map((cat) => cat._id) },
      brand: { $in: activeBrands.map((brand) => brand.brandName) },
    };

    if (search) {
      productsQuery.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (req.query.color) {
      productsQuery.variants = { $elemMatch: { color: req.query.color } };
    }

    if (req.query.priceRange) {
      const [minPrice, maxPrice] = req.query.priceRange.split("-").map(Number);
      productsQuery.salePrice = { $gte: minPrice, $lte: maxPrice };
    }

    const selectedCategories = parseArrayParam("categories");
    if (selectedCategories.length > 0) {
      productsQuery.category = { $in: selectedCategories };
    }

    const selectedBrands = parseArrayParam("brands");
    if (selectedBrands.length > 0) {
      productsQuery.brand = { $in: selectedBrands };
    }

    const selectedSizes = parseArrayParam("sizes");
    if (selectedSizes.length > 0) {
      productsQuery.variants = { $elemMatch: { size: { $in: selectedSizes } } };
    }

    const [products, totalProducts, uniqueColors] = await Promise.all([
      Product.find(productsQuery)
        .sort(sortCriteria)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("category"),
      Product.countDocuments(productsQuery),
      Product.distinct("color"),
    ]);

    const productsWithDiscount = products.map((product) => {
      const discount =
        product.regularPrice > 0
          ? ((product.regularPrice - product.salePrice) /
              product.regularPrice) *
            100
          : 0;
      return {
        ...product._doc,
        discountPercentage: Math.round(discount),
      };
    });

    const categoriesWithCounts = await Promise.all(
      activeCategories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category._id,
          isBlocked: false,
        });
        return {
          ...category._doc,
          productCount,
        };
      })
    );

    const renderData = {
      products: productsWithDiscount,
      categories: categoriesWithCounts,
      brands: activeBrands,
      uniqueColors,
      search,
      sort: req.query.sort,
      selectedColor: req.query.color,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      productsPerPage: limit,
      totalProducts,
    };

    if (userId) {
      const userData = await User.findById(userId)
        .populate({
          path: "cart",
          populate: {
            path: "items.productId",
            model: "Product",
          },
        })
        .populate({
          path: "wishlist",
          populate: {
            path: "items.productId",
            model: "Product",
          },
        });

      const isValidProduct = (product) => {
        return (
          product &&
          !product.isBlocked &&
          activeCategories
            .map((cat) => cat._id.toString())
            .includes(product.category?.toString()) &&
          activeBrands.map((brand) => brand.brandName).includes(product.brand)
        );
      };

      const cartCount = userData?.cart?.[0]?.items
        ? userData.cart[0].items.filter((item) =>
            isValidProduct(item.productId)
          ).length
        : 0;

      const wishlistCount = userData?.wishlist?.[0]?.items
        ? userData.wishlist[0].items.filter((item) =>
            isValidProduct(item.productId)
          ).length
        : 0;

      return res.render("Shop", {
        user: userData,
        ...renderData,
        cartCount,
        wishlistCount,
      });
    } else {
      return res.render("Shop", renderData);
    }
  } catch (error) {
    console.error("Error in loadShopPage:", error.message, error.stack);
    return res.status(500).render("error", {
      message: "An error occurred while loading the shop page",
      error: process.env.NODE_ENV === "development" ? error : null,
    });
  }
};

//code to load product details page

const loadProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;

    const [listedCategories, unblockedBrands, product] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
      Product.findById(productId)
        .select({
          productName: 1,
          productImage: 1,
          description: 1,
          brand: 1,
          category: 1,
          regularPrice: 1,
          salePrice: 1,
          rating: 1,
          reviewsCount: 1,
          variants: 1,
          isBlocked: 1,
        })
        .lean()
        .exec(),
    ]);

    const listedCategoryIds = new Set(
      listedCategories.map((cat) => cat._id.toString())
    );
    const unblockedBrandNames = new Set(
      unblockedBrands.map((brand) => brand.brandName)
    );

    const isValidProduct = (checkProduct) => {
      return (
        checkProduct &&
        !checkProduct.isBlocked &&
        listedCategoryIds.has(checkProduct.category?._id?.toString()) &&
        unblockedBrandNames.has(checkProduct.brand)
      );
    };

    if (!product || !isValidProduct(product)) {
      return res.status(404).send("Product not found or unavailable");
    }

    const discount =
      product.regularPrice > 0
        ? Math.floor(
            ((product.regularPrice - product.salePrice) /
              product.regularPrice) *
              100
          )
        : 0;
    product.discountPercentage = discount;

    product.variants = Array.isArray(product.variants) ? product.variants : [];

    const totalQuantity = product.variants.reduce(
      (total, variant) => total + (variant.quantity || 0),
      0
    );

    const relatedProducts = await Product.find({
      brand: product.brand,
      _id: { $ne: productId },
      isBlocked: false,
    })
      .lean()
      .exec();

    const filteredRelatedProducts = relatedProducts.filter((relProduct) =>
      isValidProduct(relProduct)
    );

    const templateData = {
      product: {
        ...product,
        variants: product.variants.map((variant) => ({
          size: variant.size,
          color: variant.color,
          quantity: variant.quantity || 0,
        })),
        totalQuantity,
        discountPercentage: Math.round(discount),
      },
      relatedProducts: filteredRelatedProducts.slice(0, 4),
    };

    if (userId) {
      const userData = await User.findById(userId)
        .populate({
          path: "cart",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        })
        .populate({
          path: "wishlist",
          populate: {
            path: "items.productId",
            model: "Product",
            populate: {
              path: "category",
              model: "Category",
            },
          },
        });

      const cartCount = userData?.cart?.[0]?.items
        ? userData.cart[0].items.filter((item) =>
            isValidProduct(item.productId)
          ).length
        : 0;

      const wishlistCount = userData?.wishlist?.[0]?.items
        ? userData.wishlist[0].items.filter((item) =>
            isValidProduct(item.productId)
          ).length
        : 0;

      templateData.user = userData;
      templateData.cartCount = cartCount;
      templateData.wishlistCount = wishlistCount;
    } else {
      templateData.cartCount = 0;
      templateData.wishlistCount = 0;
    }

    const productScript = `
      <script>
        const product = ${JSON.stringify(templateData.product)};
        console.log('Product data loaded:', product);
      </script>
    `;

    return res.render("ProductDetails", {
      ...templateData,
      productScript,
    });
  } catch (error) {
    console.error("Error loading product details:", error);
    console.error("Error stack:", error.stack);
    res.status(500).send("Server error");
  }
};
module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignup,
  signup,
  loadOtpverify,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadShopPage,
  loadProductDetails,
  loadBrandpage,
  loadContactpage,
  loadAboutpage,
  loadFaqpage,
};
