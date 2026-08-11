const env = require("dotenv").config();
const express = require("express");
const path = require("path");
const flash = require("connect-flash");
const session=require("express-session")
const { MongoStore } = require("connect-mongo");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const passport=require("./shared/config/passport")
const db = require("./shared/config/db");
const nocache=require("nocache")
const csrf = require("./shared/middlewares/csrf");


const userRoutes = require("./modules/user/user.routes");
const profileRoutes = require("./modules/profile/profile.routes");
const orderRoutes = require("./modules/order/order.routes");
const wishlistRoutes = require("./modules/wishlist/wishlist.routes");
const walletRoutes = require("./modules/wallet/wallet.routes");
const cartRoutes = require("./modules/cart/cart.routes");
const checkoutRoutes = require("./modules/checkout/checkout.routes");
const paymentRoutes = require("./modules/payment/payment.routes");
const couponRoutes = require("./modules/coupon/coupon.routes");
const reportRoutes = require("./modules/report/report.routes");
const contactRoutes = require("./modules/contact/contact.routes");

const adminRoutes = require("./modules/admin/admin.routes");
const customerRoutes = require("./modules/customer/customer.routes");
const categoryRoutes = require("./modules/category/category.routes");
const brandRoutes = require("./modules/brand/brand.routes");
const productRoutes = require("./modules/product/product.routes");
const contactAdminRoutes = require("./modules/contact/contact.admin.routes");
const couponAdminRoutes = require("./modules/coupon/coupon.admin.routes");
const reportAdminRoutes = require("./modules/report/report.admin.routes");
const topsellingRoutes = require("./modules/topselling/topselling.routes");

const app = express();


db();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:true,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie:{
    secure: process.env.NODE_ENV === "production",
    httpOnly:true,
    sameSite: "lax",
    maxAge:72*60*60*1000
  }
}))
app.use(flash())
app.use((req, res, next) => {
  res.locals.messages = { error: req.flash("error") };
  next();
});

app.use(cookieParser());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(passport.initialize())
app.use(passport.session())
app.use(csrf.issueToken);
app.use(csrf.verifyToken);
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/partials"),
]);
app.use(express.static(path.join(__dirname, "..", "public")));

// user-facing routes, all mounted at "/" (paths were already absolute in the
// original single userRoute.js, so each module router is mounted at root)
app.use("/", nocache(), userRoutes);
// Also mounted under /api for the React client (Chunk 2+ of the SPA
// conversion) — same router, same controllers, reachable at both prefixes
// during the transition so the EJS app keeps working unmodified until the
// final cutover (see the SPA conversion plan) removes the bare-path mount.
app.use("/api", nocache(), userRoutes);
app.use("/", nocache(), profileRoutes);
app.use("/api", nocache(), profileRoutes);
app.use("/", nocache(), orderRoutes);
app.use("/api", nocache(), orderRoutes);
app.use("/", nocache(), wishlistRoutes);
app.use("/api", nocache(), wishlistRoutes);
app.use("/", nocache(), walletRoutes);
app.use("/api", nocache(), walletRoutes);
app.use("/", nocache(), cartRoutes);
app.use("/api", nocache(), cartRoutes);
app.use("/", nocache(), checkoutRoutes);
app.use("/api", nocache(), checkoutRoutes);
app.use("/", nocache(), paymentRoutes);
app.use("/api", nocache(), paymentRoutes);
app.use("/", nocache(), couponRoutes);
app.use("/api", nocache(), couponRoutes);
app.use("/", nocache(), reportRoutes);
app.use("/api", nocache(), reportRoutes);
app.use("/", nocache(), contactRoutes);
app.use("/api", nocache(), contactRoutes);

// admin routes, all mounted at "/admin" (matching the original
// app.use("/admin", nocache(), adminRoute) prefix). Also dual-mounted at
// /api/admin for the React admin panel (Chunk 7+ of the SPA conversion),
// same reasoning as the user-facing dual mounts above.
app.use("/admin", nocache(), adminRoutes);
app.use("/api/admin", nocache(), adminRoutes);
app.use("/admin", nocache(), customerRoutes);
app.use("/api/admin", nocache(), customerRoutes);
app.use("/admin", nocache(), categoryRoutes);
app.use("/api/admin", nocache(), categoryRoutes);
app.use("/admin", nocache(), brandRoutes);
app.use("/api/admin", nocache(), brandRoutes);
app.use("/admin", nocache(), productRoutes);
app.use("/api/admin", nocache(), productRoutes);
app.use("/admin", nocache(), contactAdminRoutes);
app.use("/api/admin", nocache(), contactAdminRoutes);
app.use("/admin", nocache(), couponAdminRoutes);
app.use("/api/admin", nocache(), couponAdminRoutes);
app.use("/admin", nocache(), reportAdminRoutes);
app.use("/api/admin", nocache(), reportAdminRoutes);
app.use("/admin", nocache(), topsellingRoutes);
app.use("/api/admin", nocache(), topsellingRoutes);

app.use((req,res)=>{
  res.status(404).render("page-404")
})

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const safeMessage =
    err.message && err.message.length < 200
      ? err.message
      : "Something went wrong. Please try again.";

  if (req.xhr || req.is("json") || req.accepts(["html", "json"]) === "json") {
    return res.status(status).json({ success: false, message: safeMessage });
  }
  if (req.path.startsWith("/admin")) {
    return res.status(status).render("admin-error");
  }
  return res.status(status).render("page-404");
});

module.exports = app;
