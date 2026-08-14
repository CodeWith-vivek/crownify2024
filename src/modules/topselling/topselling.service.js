const Product = require("../product/productSchema");
const Order = require("../order/orderSchema");
const { SALE_STATUSES } = require("../../shared/utils/salesAggregate");

// Top-selling aggregations behind the admin dashboard, free of Express.

const TOP_N = 10;

// Counted on the same basis as the sales report: an item is a sale once
// it's Delivered, and stays one if it's later Returned (the original sale
// still happened). Cancelled and Failed items are not sales.
//
// These aggregations previously counted every item on every order
// regardless of status, so "top selling" included abandoned and cancelled
// lines and read higher than the revenue figures beside it on the same
// dashboard.
const soldItemsOnly = [{ $unwind: "$items" }, { $match: { "items.orderStatus": { $in: SALE_STATUSES } } }];

const joinProduct = [
  {
    $lookup: {
      from: "products",
      localField: "items.productId",
      foreignField: "_id",
      as: "productInfo",
    },
  },
  { $unwind: "$productInfo" },
];

async function getTopProducts() {
  const counts = await Order.aggregate([
    ...soldItemsOnly,
    { $group: { _id: "$items.productId", salesCount: { $sum: "$items.quantity" } } },
    { $sort: { salesCount: -1 } },
    { $limit: TOP_N },
  ]);

  const products = await Product.find({ _id: { $in: counts.map((c) => c._id) } }).select(
    "productName productImage"
  );

  const byId = new Map(counts.map((c) => [c._id.toString(), c.salesCount]));

  // Sorted before returning. The old code built a `rankedProducts` array
  // and then sent the UNSORTED one, so the "top selling" table came back
  // in whatever order Mongo returned the products.
  return products
    .map((product) => ({
      ...product.toObject(),
      salesCount: byId.get(product._id.toString()) || 0,
    }))
    .sort((a, b) => b.salesCount - a.salesCount);
}

const getTopCategories = () =>
  Order.aggregate([
    ...soldItemsOnly,
    ...joinProduct,
    { $group: { _id: "$productInfo.category", salesCount: { $sum: "$items.quantity" } } },
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
        categoryName: { $ifNull: ["$categoryInfo.name", "Unknown Category"] },
      },
    },
    { $sort: { salesCount: -1 } },
    { $limit: TOP_N },
  ]);

const getTopBrands = () =>
  Order.aggregate([
    ...soldItemsOnly,
    ...joinProduct,
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
    { $limit: TOP_N },
  ]);

async function getTopSellingStats() {
  const [topProducts, topCategories, topBrands] = await Promise.all([
    getTopProducts(),
    getTopCategories(),
    getTopBrands(),
  ]);

  return {
    totalSoldProducts: topProducts.reduce((total, product) => total + product.salesCount, 0),
    topProducts,
    topCategories,
    topBrands,
  };
}

module.exports = { getTopSellingStats, getTopProducts, getTopCategories, getTopBrands, TOP_N };
