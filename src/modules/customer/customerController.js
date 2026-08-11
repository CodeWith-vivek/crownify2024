const { query } = require("express");
const User=require("../user/userSchema")
const { wantsJson } = require("../../shared/utils/wantsJson");

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
        const customerData = {
          users: userData,
          search,
          currentPage: page,
          totalPages: Math.ceil(count / limit),
        };
        if (wantsJson(req)) return res.json({ success: true, ...customerData });
        res.render("customers", customerData);

    }catch(error){
      console.log("error in loading customer info",error);
      if (wantsJson(req)) return res.status(500).json({ success: false, message: "Error loading customers" });
       res.redirect("/admin/pageerror");


    }
}

//code to block the user

const customerBlocked=async(req,res)=>{
     try {
       let id = req.query.id;
       await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
       if (wantsJson(req)) return res.json({ success: true, message: "Customer blocked" });
       res.redirect("/admin/users");
     } catch (error) {
       if (wantsJson(req)) return res.status(500).json({ success: false, message: "Could not block customer" });
       res.redirect("/admin/pageerror");
     }

}

//code to unlblock the user

const customerUnblocked=async(req,res)=>{
      try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        if (wantsJson(req)) return res.json({ success: true, message: "Customer unblocked" });
        res.redirect("/admin/users");
      } catch (error) {
        if (wantsJson(req)) return res.status(500).json({ success: false, message: "Could not unblock customer" });
        res.redirect("/admin/pageerror");
      }



}


module.exports={
    customerInfo,
    customerBlocked,
    customerUnblocked
}