const Product = require("../models/productSchema");
const Order = require("../models/orderSchema");

//code to get top selling 

const getTopSellingStats = async (req, res) => {
  try {

    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId", 
          salesCount: { $sum: "$items.quantity" }, 
        },
      },
      { $sort: { salesCount: -1 } }, 
      { $limit: 10 },
    ]);

    const populatedProducts = await Product.find({
      _id: { $in: topProducts.map((p) => p._id) },
    }).select("productName productImage");

    const productsWithSalesCount = populatedProducts.map((product) => {
      const salesData = topProducts.find(
        (p) => p._id.toString() === product._id.toString()
      );
      return {
        ...product.toObject(),
        salesCount: salesData ? salesData.salesCount : 0,
      };
    });

    const rankedProducts = productsWithSalesCount.sort(
      (a, b) => b.salesCount - a.salesCount
    );

    const totalSoldProducts = rankedProducts.reduce(
      (total, product) => total + product.salesCount,
      0
    );

    const topCategories = await Order.aggregate([
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.category",
          salesCount: { $sum: "$items.quantity" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          salesCount: 1,
          categoryName: {
            $ifNull: ["$categoryInfo.name", "Unknown Category"],
          },
        },
      },
      { $sort: { salesCount: -1 } },
      { $limit: 10 },
    ]);

  const topBrands = await Order.aggregate([
    { $unwind: "$items" },
    {
        $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productInfo",
        },
    },
    { $unwind: "$productInfo" },
    {
        $lookup: {
            from: "brands", 
            localField: "productInfo.brand",
            foreignField: "brandName", 
            as: "brandInfo",
        },
    },
    { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
    {
        $group: {
            _id: "$productInfo.brand",
            salesCount: { $sum: "$items.quantity" },
            brandName: { $first: "$brandInfo.brandName" }, 
        },
    },
    {
        $project: {
            _id: 0,
            salesCount: 1,
            brandName: { $ifNull: ["$brandName", "Unknown Brand"] },
        },
    },
    { $sort: { salesCount: -1 } },
    { $limit: 10 },
]);

    res.status(200).json({
      success: true,
      data: {
        totalSoldProducts,
        topProducts: productsWithSalesCount,
        topCategories,
        topBrands,
      },
    });
  } catch (error) {
    console.error("Error fetching top-selling stats:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTopSellingStats,
};
