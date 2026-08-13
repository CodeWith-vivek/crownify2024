const Brand=require("./brandSchema")
const Product=require("../product/productSchema")


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
        res.json({ success: true, ...brandPageData });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error loading brands" });
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
      res.status(201).json({ success: true, message: "Brand added successfully", brand: newBrand });
    } else {
      res.status(409).json({ success: false, message: "Brand already exists" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error adding brand" });
  }
};

//code to block brand

const blockBrand =async(req,res)=>{
    try {
        const id=req.query.id
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
        res.json({ success: true, message: "Brand blocked" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not block brand" });
    }
}


// code to block brand

const unBlockBrand =async(req,res)=>{
    try{
        const id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.json({ success: true, message: "Brand unblocked" });
    }catch(error){
        res.status(500).json({ success: false, message: "Could not unblock brand" });
    }
}

// code to delete brand


const deleteBrand=async(req,res)=>{
    try {
        const {id} =req.query;
        if(!id){
            return res.status(400).json({ success: false, message: "Brand id required" });
        }
        await Brand.deleteOne({_id:id})
        res.json({ success: true, message: "Brand deleted" });
    } catch (error) {
        console.error("Error deleting brand",error);
        res.status(500).json({ success: false, message: "Could not delete brand" });
    }
}

module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}
