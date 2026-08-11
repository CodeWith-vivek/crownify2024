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

// Static assets (product/brand images, invoices, and anything else under
// public/) — served at the same unprefixed paths the client has always used
// (e.g. /uploads/product-image/...), same as before the SPA cutover.
app.use(express.static(path.join(__dirname, "..", "public")));

// JSON API — the entire app surface now lives under /api (and /api/admin).
// This used to be dual-mounted at both a bare path (for the EJS app) and
// /api (for the React client) during the SPA conversion; the bare mounts
// are gone now that the EJS frontend has been fully retired.
app.use("/api", nocache(), userRoutes);
app.use("/api", nocache(), profileRoutes);
app.use("/api", nocache(), orderRoutes);
app.use("/api", nocache(), wishlistRoutes);
app.use("/api", nocache(), walletRoutes);
app.use("/api", nocache(), cartRoutes);
app.use("/api", nocache(), checkoutRoutes);
app.use("/api", nocache(), paymentRoutes);
app.use("/api", nocache(), couponRoutes);
app.use("/api", nocache(), reportRoutes);
app.use("/api", nocache(), contactRoutes);

app.use("/api/admin", nocache(), adminRoutes);
app.use("/api/admin", nocache(), customerRoutes);
app.use("/api/admin", nocache(), categoryRoutes);
app.use("/api/admin", nocache(), brandRoutes);
app.use("/api/admin", nocache(), productRoutes);
app.use("/api/admin", nocache(), contactAdminRoutes);
app.use("/api/admin", nocache(), couponAdminRoutes);
app.use("/api/admin", nocache(), reportAdminRoutes);
app.use("/api/admin", nocache(), topsellingRoutes);

// The built React app (client/dist) — served as static files, with a
// catch-all so client-side routes (React Router) resolve correctly on a
// full page load/refresh. Must come after the /api mounts and the public/
// static mount above so neither is shadowed by this fallback.
app.use(express.static(path.join(__dirname, "..", "client", "dist")));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "dist", "index.html"));
});

// Anything left unmatched at this point is an unknown /api/* route.
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const safeMessage =
    err.message && err.message.length < 200
      ? err.message
      : "Something went wrong. Please try again.";
  res.status(status).json({ success: false, message: safeMessage });
});

module.exports = app;
