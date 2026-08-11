const User=require("../../modules/user/userSchema")

const wantsJson = (req) =>
    req.originalUrl.startsWith("/api") || req.xhr || req.get("accept")?.includes("json");

const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                if (wantsJson(req)) {
                    return res.status(401).json({ success: false, message: "Not authenticated" });
                }
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("error in user auth middleware",error)
            if (wantsJson(req)) {
                return res.status(500).json({ success: false, message: "Internal server error" });
            }
            res.status(500).send("Internal server error")


        })
    }else{
        if (wantsJson(req)) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }
        res.redirect("/login")
    }
}

const adminAuth=(req,res,next)=>{
  if(req.session.admin){
    next()
  }else{
    if (wantsJson(req)) {
        return res.status(401).json({ success: false, message: "Not authenticated as admin" });
    }
    res.redirect("/admin/login")
  }

}

module.exports={
    userAuth,
    adminAuth,
}
