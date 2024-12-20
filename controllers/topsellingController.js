const Product = require("../models/productSchema");
const Order = require("../models/orderSchema");


const getTopSellingStats = async (req, res) => {
  try {
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

    // Fetch details for top products
    const populatedProducts = await Product.find({
      _id: { $in: topProducts.map((p) => p._id) },
    }).select("productName productImage");

    // Merge sales count with product details
    const productsWithSalesCount = populatedProducts.map((product) => {
      const salesData = topProducts.find(
        (p) => p._id.toString() === product._id.toString()
      );
      return {
        ...product.toObject(), // Convert Mongoose document to plain object
        salesCount: salesData ? salesData.salesCount : 0, // Add sales count
      };
    });

    // Sort products based on salesCount in descending order
    const rankedProducts = productsWithSalesCount.sort(
      (a, b) => b.salesCount - a.salesCount
    );

    // Calculate total sales count for products
    const totalSoldProducts = rankedProducts.reduce(
      (total, product) => total + product.salesCount,
      0
    );

    // Fetch Top Categories
    const topCategories = await Order.aggregate([
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products", // Ensure this matches your products collection name
          localField: "items.productId", // ID of the product in the order
          foreignField: "_id", // ID of the product in the products collection
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.category", // Group by category ID
          salesCount: { $sum: "$items.quantity" }, // Sum the quantity sold
        },
      },
      {
        $lookup: {
          from: "categories", // Ensure this matches your categories collection name
          localField: "_id", // Grouped category ID
          foreignField: "_id", // ID of the category in categories collection
          as: "categoryInfo",
        },
      },
      { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } }, // Use preserveNullAndEmptyArrays to avoid dropping results without matching categories
      {
        $project: {
          _id: 1,
          salesCount: 1,
          categoryName: {
            $ifNull: ["$categoryInfo.name", "Unknown Category"], // Provide a default value
          },
        },
      },
      { $sort: { salesCount: -1 } }, // Sort by salesCount descending
      { $limit: 10 }, // Limit to top 10 categories
    ]);

    // Fetch Top Brands
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
        $group: {
          _id: "$productInfo.brand", // Group by brand
          salesCount: { $sum: "$items.quantity" }, // Sum the quantity sold
        },
      },
      { $sort: { salesCount: -1 } }, // Sort by salesCount descending
      { $limit: 10 }, // Limit to top 10 brands
    ]);

    // Sending the response
    res.status(200).json({
      success: true,
      data: {
        totalSoldProducts, // Include total sold products count in the response
        topProducts: productsWithSalesCount, // Use the merged products with sales count
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
