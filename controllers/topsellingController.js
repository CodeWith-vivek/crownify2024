const Product = require("../models/productSchema");
const Order = require("../models/orderSchema");


const getTopSellingStats = async (req, res) => {
  try {
    console.log("Fetching top-selling stats...");

    // Fetch Top Products
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId", // Group by productId
          salesCount: { $sum: "$items.quantity" }, // Sum the quantity sold
        },
      },
      { $sort: { salesCount: -1 } }, // Sort by salesCount descending
      { $limit: 10 }, // Limit to top 10 products
    ]);

    console.log("Top Products Aggregated:", topProducts);

    // Fetch details for top products
    const populatedProducts = await Product.find({
      _id: { $in: topProducts.map((p) => p._id) },
    }).select("productName productImage");

    console.log("Populated Products Details:", populatedProducts);

    // Merge sales count with product details
    const productsWithSalesCount = populatedProducts.map((product) => {
      const salesData = topProducts.find(
        (p) => p._id.toString() === product._id.toString()
      );
      return {
        ...product.toObject(),
        salesCount: salesData ? salesData.salesCount : 0,
      };
    });

    console.log("Products with Sales Count:", productsWithSalesCount);

    // Sort products based on salesCount in descending order
    const rankedProducts = productsWithSalesCount.sort(
      (a, b) => b.salesCount - a.salesCount
    );

    // Calculate total sales count for products
    const totalSoldProducts = rankedProducts.reduce(
      (total, product) => total + product.salesCount,
      0
    );

    console.log("Total Sold Products Count:", totalSoldProducts);

    // Fetch Top Categories
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

    console.log("Top Categories Aggregated:", topCategories);

    // Fetch Top Brands
  const topBrands = await Order.aggregate([
    { $unwind: "$items" },
    {
        $lookup: {
            from: "products", // Lookup in the products collection
            localField: "items.productId",
            foreignField: "_id",
            as: "productInfo",
        },
    },
    { $unwind: "$productInfo" },
    {
        $lookup: {
            from: "brands", // Lookup in the brands collection
            localField: "productInfo.brand", // This is the brand name (String)
            foreignField: "brandName", // Match against the brandName field in brands
            as: "brandInfo",
        },
    },
    { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
    {
        $group: {
            _id: "$productInfo.brand",
            salesCount: { $sum: "$items.quantity" },
            brandName: { $first: "$brandInfo.brandName" }, // Fetch the brand name from the joined result
        },
    },
    {
        $project: {
            _id: 0,
            salesCount: 1,
            brandName: { $ifNull: ["$brandName", "Unknown Brand"] }, // Use a default value if brand is not found
        },
    },
    { $sort: { salesCount: -1 } },
    { $limit: 10 },
]);

    console.log("Top Brands Aggregated:", topBrands);

    // Sending the response
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
