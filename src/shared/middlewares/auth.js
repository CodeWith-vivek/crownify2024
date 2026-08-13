const User=require("../../modules/user/userSchema")

const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.status(401).json({ success: false, message: "Not authenticated" });
            }
        })
        .catch(error=>{
            console.log("error in user auth middleware",error)
            res.status(500).json({ success: false, message: "Internal server error" });
        })
    }else{
        res.status(401).json({ success: false, message: "Not authenticated" });
    }
}

const adminAuth=(req,res,next)=>{
  if(req.session.admin){
    next()
  }else{
    res.status(401).json({ success: false, message: "Not authenticated as admin" });
  }
}

module.exports={
    userAuth,
    adminAuth,
}
