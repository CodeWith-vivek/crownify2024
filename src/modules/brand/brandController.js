const Brand=require("./brandSchema")
const Product=require("../product/productSchema")
const { wantsJson } = require("../../shared/utils/wantsJson");


//code to load brand page admin side

const getBrandPage=async(req,res)=>{
    try {
        const page=parseInt(req.query.page) || 1
        const limit=4
        const skip =(page-1)*limit
        const brandData =await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit)
        const totalBrands= await Brand.countDocuments()
        const totalPages =Math.ceil(totalBrands/limit)
        const reverseBrand =brandData.reverse()
        const brandPageData = {
            data:reverseBrand,
            currentPage:page,
            totalPages:totalPages,
            totalBrands:totalBrands,
        };
        if (wantsJson(req)) return res.json({ success: true, ...brandPageData });
        res.render("brands", brandPageData)
    } catch (error) {
        if (wantsJson(req)) return res.status(500).json({ success: false, message: "Error loading brands" });
        res.redirect("/admin/pageerror")


    }


}

//code to add new brand

const addBrand = async (req, res) => {
  try {
    const brand = req.body.name;


    const findBrand = await Brand.findOne({
      brandName: new RegExp(`^${brand}$`, "i"),
    });

    if (!findBrand) {
      const image = req.file.filename;
      const newBrand = new Brand({
        brandName: brand,
        brandImage: image,
      });
      await newBrand.save();
      if (wantsJson(req)) return res.status(201).json({ success: true, message: "Brand added successfully", brand: newBrand });
      res.redirect("/admin/brands");
    } else {
      if (wantsJson(req)) return res.status(409).json({ success: false, message: "Brand already exists" });
      res.redirect("/admin/brands?error=Brand already exists");
    }
  } catch (error) {
    console.error(error);
    if (wantsJson(req)) return res.status(500).json({ success: false, message: "Error adding brand" });
    res.redirect("/admin/pageerror");
  }
};

//code to block brand

const blockBrand =async(req,res)=>{
    try {
        const id=req.query.id
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
        if (wantsJson(req)) return res.json({ success: true, message: "Brand blocked" });
        res.redirect("/admin/brands")

    } catch (error) {
        if (wantsJson(req)) return res.status(500).json({ success: false, message: "Could not block brand" });
        res.redirect("/admin/pageerror")

    }

}


// code to block brand

const unBlockBrand =async(req,res)=>{
    try{
        const id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        if (wantsJson(req)) return res.json({ success: true, message: "Brand unblocked" });
        res.redirect("/admin/brands");

    }catch(error){
        if (wantsJson(req)) return res.status(500).json({ success: false, message: "Could not unblock brand" });
        res.redirect("/admin/pageerror")

    }

}

// code to delete brand


const deleteBrand=async(req,res)=>{
    try {
        const {id} =req.query;
        if(!id){
            if (wantsJson(req)) return res.status(400).json({ success: false, message: "Brand id required" });
            return res.status(400).redirect("/pageerror")
        }
        await Brand.deleteOne({_id:id})
        if (wantsJson(req)) return res.json({ success: true, message: "Brand deleted" });
        res.redirect("/admin/brands")

    } catch (error) {
        console.error("Error deleting brand",error);
        if (wantsJson(req)) return res.status(500).json({ success: false, message: "Could not delete brand" });
        res.status(500).redirect("/admin/pageerror")


    }
}

module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}
