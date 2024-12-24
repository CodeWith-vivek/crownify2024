const { query } = require("express");
const User=require("../models/userSchema")

//code to load users list

const customerInfo=async(req,res)=>{
    try{
        let search=""
        if(req.query.search){
            search=req.query.search
        
        }
        let page = parseInt(req.query.page) || 1;
        const limit = 4;
        const userData=await User.find({
            isAdmin:false,
            $or:[{name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},
            ],
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();
        const count = await User.find({
          isAdmin: false,
          $or: [
            { name: { $regex: ".*" + search + ".*" } },
            { email: { $regex: ".*" + search + ".*" } },
          ],
        }).countDocuments()
        res.render("customers", {
          users: userData,
          search,
          currentPage: page,
          totalPages: Math.ceil(count / limit),
        });

    }catch(error){
      console.log("error in loading customer info",error);
       res.redirect("/admin/pageerror");
      

    }
}

//code to block the user

const customerBlocked=async(req,res)=>{
     try {
       let id = req.query.id;
       await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
       res.redirect("/admin/users");
     } catch (error) {
       res.redirect("/admin/pageerror");
     }

}

//code to unlblock the user

const customerUnblocked=async(req,res)=>{
      try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/users");
      } catch (error) {
        res.redirect("/admin/pageerror");
      }

   

}


module.exports={
    customerInfo,
    customerBlocked,
    customerUnblocked
}