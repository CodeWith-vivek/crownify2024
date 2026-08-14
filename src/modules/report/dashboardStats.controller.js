const Order = require("../order/orderSchema");
const Product = require("../product/productSchema");
const Category = require("../category/categorySchema");

// Simple count/aggregate endpoints backing the admin dashboard's stat
// cards. Each is its own request so a slow or failing one doesn't block
// the rest of the dashboard from rendering.

const getOverallRevenue = async (req, res) => {
  try {
    const overallRevenue = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { "items.orderStatus": "Delivered" } },
      {
        $group: {
          _id: "$_id",
          orderTotal: { $sum: "$items.salePrice" },
          orderDiscount: { $first: "$discount" },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$orderTotal" },
          totalDiscount: { $sum: "$orderDiscount" },
        },
      },
    ]);

    if (overallRevenue.length === 0) {
      console.warn("No revenue data available.");
      return res.json({
        status: true,
        message: "No revenue data available",
        revenue: {
          totalRevenue: 0,
          totalDiscount: 0,
          netRevenue: 0,
        },
      });
    }

    const { totalRevenue, totalDiscount } = overallRevenue[0];
    const netRevenue = totalRevenue - totalDiscount;

    return res.json({
      status: true,
      revenue: {
        totalRevenue,
        totalDiscount,
        netRevenue,
      },
    });
  } catch (error) {
    console.error("Error calculating overall revenue:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

const getTotalOrders = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({});

    return res.json({
      status: true,
      totalOrders,
    });
  } catch (error) {
    console.error("Error fetching total orders:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

const getTotalProducts = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({});

    return res.json({
      status: true,
      totalProducts,
    });
  } catch (error) {
    console.error("Error fetching total products:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

const getTotalCategories = async (req, res) => {
  try {
    const totalCategories = await Category.countDocuments({});

    return res.json({
      status: true,
      totalCategories,
    });
  } catch (error) {
    console.error("Error fetching total categories:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

module.exports = {
  getOverallRevenue,
  getTotalOrders,
  getTotalProducts,
  getTotalCategories,
};
