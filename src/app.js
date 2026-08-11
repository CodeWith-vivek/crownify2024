const env = require("dotenv").config();
const express = require("express");
const path = require("path");
const flash = require("connect-flash");
const session=require("express-session")
const passport=require("./shared/config/passport")
const db = require("./shared/config/db");
const nocache=require("nocache")


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
app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:true,
  cookie:{
    secure:false,
    httpOnly:true,
    maxAge:72*60*60*1000
  }
}))
app.use(flash())
app.use((req, res, next) => {
  res.locals.messages = { error: req.flash("error") };
  next();
});


app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(passport.initialize())
app.use(passport.session())
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
app.use("/", nocache(), profileRoutes);
app.use("/", nocache(), orderRoutes);
app.use("/", nocache(), wishlistRoutes);
app.use("/", nocache(), walletRoutes);
app.use("/", nocache(), cartRoutes);
app.use("/", nocache(), checkoutRoutes);
app.use("/", nocache(), paymentRoutes);
app.use("/", nocache(), couponRoutes);
app.use("/", nocache(), reportRoutes);
app.use("/", nocache(), contactRoutes);

// admin routes, all mounted at "/admin" (matching the original
// app.use("/admin", nocache(), adminRoute) prefix)
app.use("/admin", nocache(), adminRoutes);
app.use("/admin", nocache(), customerRoutes);
app.use("/admin", nocache(), categoryRoutes);
app.use("/admin", nocache(), brandRoutes);
app.use("/admin", nocache(), productRoutes);
app.use("/admin", nocache(), contactAdminRoutes);
app.use("/admin", nocache(), couponAdminRoutes);
app.use("/admin", nocache(), reportAdminRoutes);
app.use("/admin", nocache(), topsellingRoutes);

app.use((req,res)=>{
  res.status(404).render("page-404")
})

module.exports = app;
