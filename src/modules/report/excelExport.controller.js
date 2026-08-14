const xlsx = require("xlsx");
const { resolveReportRange, describeRange } = require("../../shared/utils/reportRange");
const { buildSalesRows, buildReturnRows, combineSalesAndReturns } = require("../../shared/utils/salesAggregate");
const { fetchSalesAndReturns } = require("./helpers/salesQuery");

// Excel export of the sales report — two sheets: per-line Order Details
// and a Summary of the period's totals. Goes through the same
// fetchSalesAndReturns + buildSalesRows/buildReturnRows pipeline as the
// on-screen table and the PDF so all three always report identical figures.

const downloadExcel = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    const range = resolveReportRange(type, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ status: false, message: range.error });
    }

    const { salesOrders, returnOrders } = await fetchSalesAndReturns(range);

    const { rows, totals } = combineSalesAndReturns(
      buildSalesRows(salesOrders),
      buildReturnRows(returnOrders, range)
    );

    if (rows.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No sales or returns found for the specified period",
      });
    }

    const processedData = rows.map((r) => ({
      "Order Number": r.orderNumber,
      Date: r.date,
      Type: r.type === "return" ? "Return" : "Sale",
      Product: r.name,
      Brand: r.brand,
      Category: r.category,
      Colour: r.color,
      Size: r.size,
      Quantity: r.quantity,
      "Regular Price": r.regularPrice,
      "Sale Price": r.salePrice,
      "Product Discount": r.itemDiscount,
      "Coupon Discount": Number(r.couponDiscount.toFixed(2)),
      Shipping: Number(r.shipping.toFixed(2)),
      "Item Total": r.itemTotal,
    }));

    const summary = {
      totalOrders: totals.totalOrders,
      totalQuantity: totals.totalQuantity,
      totalRegularPrice: totals.totalRegularPrice,
      totalSalePrice: totals.totalSalePrice,
      totalItemDiscount: totals.totalItemDiscount,
      totalCouponDiscount: totals.totalCouponDiscount,
      totalShipping: totals.totalShipping,
      totalReturns: totals.totalReturns,
      totalRevenue: totals.netRevenue,
      averageOrderValue: totals.averageOrderValue,
    };

    const workbook = xlsx.utils.book_new();

    const detailsWorksheet = xlsx.utils.json_to_sheet(processedData);

    const summaryData = [
      ["Crownify - Sales Report"],
      [""],
      ["Period", describeRange(type, range)],
      ["Generated On", new Date().toLocaleString("en-IN")],
      ["Basis", "Sales booked when ordered; returns booked when processed (may span a different period)"],
      [""],
      ["Metric", "Value"],
      ["Total Orders", summary.totalOrders],
      ["Total Quantity Sold", summary.totalQuantity],
      ["Gross Sales (at MRP)", Number(summary.totalRegularPrice.toFixed(2))],
      ["Sales (at sale price)", Number(summary.totalSalePrice.toFixed(2))],
      ["Product Discounts", Number(summary.totalItemDiscount.toFixed(2))],
      ["Coupon Discounts", Number(summary.totalCouponDiscount.toFixed(2))],
      ["Shipping Collected", Number(summary.totalShipping.toFixed(2))],
      ["Returns Processed This Period", Number((summary.totalReturns || 0).toFixed(2))],
      ["Net Revenue", Number(summary.totalRevenue.toFixed(2))],
      ["Average Order Value", Number(summary.averageOrderValue.toFixed(2))],
    ];
    const summaryWorksheet = xlsx.utils.aoa_to_sheet(summaryData);

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4472C4" } },
      alignment: { horizontal: "center" },
    };

    const detailsRange = xlsx.utils.decode_range(detailsWorksheet["!ref"]);
    for (let C = detailsRange.s.c; C <= detailsRange.e.c; ++C) {
      const headerCell = xlsx.utils.encode_cell({ r: 0, c: C });
      detailsWorksheet[headerCell].s = headerStyle;
    }

    detailsWorksheet["!cols"] = [
      { wch: 12 }, // Order Number
      { wch: 12 }, // Date
      { wch: 8 }, // Type
      { wch: 30 }, // Product
      { wch: 15 }, // Brand
      { wch: 15 }, // Category
      { wch: 10 }, // Colour
      { wch: 10 }, // Size
      { wch: 10 }, // Quantity
      { wch: 12 }, // Regular Price
      { wch: 12 }, // Sale Price
      { wch: 12 }, // Product Discount
      { wch: 12 }, // Coupon Discount
      { wch: 12 }, // Shipping
      { wch: 12 }, // Item Total
    ];

    xlsx.utils.book_append_sheet(workbook, detailsWorksheet, "Order Details");
    xlsx.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");

    const excelBuffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const filename = `Sales_Report_${type}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.status(200).send(excelBuffer);
  } catch (error) {
    console.error("Error generating Excel report:", error);
    res.status(500).json({
      status: false,
      message: "Error generating Excel report",
      error: error.message,
    });
  }
};

module.exports = { downloadExcel };
