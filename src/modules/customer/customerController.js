const User=require("../user/userSchema")

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
        res.json({ success: true, ...customerData });

    }catch(error){
      console.log("error in loading customer info",error);
      res.status(500).json({ success: false, message: "Error loading customers" });
    }
}

//code to block the user

const customerBlocked=async(req,res)=>{
     try {
       let id = req.query.id;
       await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
       res.json({ success: true, message: "Customer blocked" });
     } catch (error) {
       res.status(500).json({ success: false, message: "Could not block customer" });
     }

}

//code to unlblock the user

const customerUnblocked=async(req,res)=>{
      try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.json({ success: true, message: "Customer unblocked" });
      } catch (error) {
        res.status(500).json({ success: false, message: "Could not unblock customer" });
      }
}


module.exports={
    customerInfo,
    customerBlocked,
    customerUnblocked
}
