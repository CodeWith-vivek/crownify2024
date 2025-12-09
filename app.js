const env = require("dotenv").config();
const express = require("express");
const path = require("path");
const flash = require("connect-flash");
const session=require("express-session")
const passport=require("./config/passport")
const db = require("./config/db");
const nocache=require("nocache")


const userRoute = require("./routes/userRoute");
const adminRoute=require("./routes/adminRoute")

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
app.use(express.static(path.join(__dirname, "public")));

app.use("/",nocache(), userRoute);
app.use("/admin",nocache(),adminRoute)
const PORT = process.env.PORT || 3000;
app.use((req,res)=>{
  res.status(404).render("page-404")
})
app.listen(PORT, () => console.log(`server running on ${PORT}`));
