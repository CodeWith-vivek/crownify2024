const Order = require("../order/orderSchema");
const Product = require("../product/productSchema");
const Category = require("../category/categorySchema");
const PDFDocument = require("pdfkit");
const path = require("path");
const xlsx = require("xlsx");
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");
pdfMake.vfs = pdfFonts.pdfMake.vfs;

const fs = require("fs");
const User = require("../user/userSchema");
const { resolveReportRange, describeRange } = require("../../shared/utils/reportRange");
const { buildSalesRows, buildReturnRows, combineSalesAndReturns, DELIVERED, RETURNED, SALE_STATUSES } = require("../../shared/utils/salesAggregate");
const { computeOrderFinancials, VOID_STATUSES } = require("../../shared/utils/orderFinancials");

//code to download sales report in excel format



const downloadExcel = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    const range = resolveReportRange(type, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ status: false, message: range.error });
    }

    const populateOpts = {
      path: "items.productId",
      select: "productName brand regularPrice salePrice variants category",
      populate: { path: "category", select: "name" },
    };

    // Two separate queries: sales booked by when they were ORDERED (stays in
    // that period even if later returned), and returns booked by when the
    // return was actually PROCESSED — which can be a different period than
    // the original sale. See salesAggregate.js for why this replaced a
    // single Delivered-only query.
    const [salesOrders, returnOrders] = await Promise.all([
      Order.find({
        orderedAt: { $gte: range.start, $lte: range.end },
        "items.orderStatus": { $in: SALE_STATUSES },
      })
        .populate(populateOpts)
        .sort({ orderedAt: -1 }),
      Order.find({ "items.returnedAt": { $gte: range.start, $lte: range.end } }).populate(populateOpts),
    ]);

    const { rows, totals } = combineSalesAndReturns(buildSalesRows(salesOrders), buildReturnRows(returnOrders, range));

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

    const currencyStyle = { numFmt: '"₹"#,##0.00' };

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

// Helper function to get the report period
const getReportPeriod = (type, startDate, endDate) => {
  const today = new Date();
  switch (type) {
    case "daily":
      return today.toLocaleDateString();
    case "weekly":
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString()} to ${endOfWeek.toLocaleDateString()}`;
    case "monthly":
      return today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
    case "yearly":
      return today.getFullYear().toString();
    case "custom":
      return `${new Date(startDate).toLocaleDateString()} to ${new Date(
        endDate
      ).toLocaleDateString()}`;
    default:
      return "";
  }
};

//code to generate sales report


const generateSalesReport = async (req, res) => {
  const { type, startDate, endDate, page = 1, limit = 10 } = req.body;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);

  try {
    const range = resolveReportRange(type, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ status: false, message: range.error });
    }

    const populateOpts = {
      path: "items.productId",
      select: "productName brand regularPrice salePrice variants category",
      populate: { path: "category", select: "name" },
    };

    // Load the whole period, not just the current page. The period totals
    // shown on the stat cards previously only summed the 10 orders on the
    // visible page, so "Total sales" changed every time the admin paged —
    // a sales report has to report the period, not the page.
    //
    // Two separate queries: sales stay booked in the period they were
    // ORDERED (orderedAt), even if later returned; returns are booked in
    // the period they were actually PROCESSED (items.returnedAt), which can
    // be a different, later period. See salesAggregate.js.
    const [allOrders, returnOrders] = await Promise.all([
      Order.find({
        orderedAt: { $gte: range.start, $lte: range.end },
        "items.orderStatus": { $in: SALE_STATUSES },
      })
        .populate(populateOpts)
        .sort({ orderedAt: -1 }),
      Order.find({ "items.returnedAt": { $gte: range.start, $lte: range.end } }).populate(populateOpts),
    ]);

    const gross = buildSalesRows(allOrders);
    const returnsAgg = buildReturnRows(returnOrders, range);
    const { totals } = combineSalesAndReturns(gross, returnsAgg);

    const totalOrders = gross.orders.length;
    const totalPages = Math.max(1, Math.ceil(totalOrders / limitNum));
    const skip = (pageNum - 1) * limitNum;
    const pageOrders = gross.orders.slice(skip, skip + limitNum);

    // 200 with an empty result set, not 404. "No sales this period" is a
    // valid answer, not a failure — returning 404 made React Query treat it
    // as an error, fire the global error toast, and retry the request.
    return res.json({
      status: true,
      report: pageOrders,
      // Not paginated — returns are typically far fewer than sales in a
      // period, and the sales report should surface them plainly rather
      // than netting them silently into one number.
      returns: returnsAgg.rows,
      totals,
      period: { type, start: range.start, end: range.end, label: describeRange(type, range) },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalOrders,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};



//code to get overall revenue



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

//code for sales chart


const salesChart = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    const range = resolveReportRange(type, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ status: false, message: range.error });
    }

    const [orders, returnOrders] = await Promise.all([
      Order.find({
        orderedAt: { $gte: range.start, $lte: range.end },
        "items.orderStatus": { $in: SALE_STATUSES },
      }).sort({ orderedAt: 1 }),
      Order.find({ "items.returnedAt": { $gte: range.start, $lte: range.end } }),
    ]);

    // Revenue per order counts its Delivered AND Returned items — the
    // original sale stays booked in the bucket it happened in, matching
    // buildSalesRows. It previously used order.grandTotal (the whole order,
    // including cancelled items) and excluded anything later returned, so
    // the chart both overstated live orders and retroactively understated
    // orders that were later returned.
    const revenueOf = (order) =>
      (order.items || [])
        .filter((it) => SALE_STATUSES.includes(it.orderStatus))
        .reduce((sum, it) => sum + (it.salePrice || 0) * (it.quantity || 0), 0);

    // Refund amount for a returned item, dated by when the return was
    // processed — same value-share formula used everywhere else refunds are
    // computed (adminController, credit note, buildReturnRows).
    const refundOf = (order, item) => {
      const totalOrderValue = (order.items || []).reduce((sum, it) => sum + (it.totalPrice || 0), 0);
      const itemShare = totalOrderValue > 0 ? item.totalPrice / totalOrderValue : 0;
      const discountForItem = Math.round((order.discount || 0) * itemShare);
      return Math.round(item.totalPrice - discountForItem);
    };

    // Bucket by an explicit key so every branch shares one implementation.
    // The old code had no "custom" branch at all, so a custom range returned
    // empty labels/revenue arrays and rendered a blank chart.
    const dayMs = 24 * 60 * 60 * 1000;
    const spanDays = Math.round((range.end - range.start) / dayMs) + 1;

    let granularity;
    if (type === "daily") granularity = "hour";
    else if (type === "yearly") granularity = "month";
    else if (spanDays > 62) granularity = "month";
    else granularity = "day";

    const buckets = new Map();
    const pushBucket = (key, label) => {
      if (!buckets.has(key)) buckets.set(key, { label, revenue: 0, orders: 0 });
    };

    if (granularity === "hour") {
      for (let h = 0; h < 24; h++) {
        pushBucket(String(h), `${String(h).padStart(2, "0")}:00`);
      }
    } else if (granularity === "month") {
      const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      while (cursor <= range.end) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        pushBucket(key, cursor.toLocaleString("en-IN", { month: "short", year: "numeric" }));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(range.start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= range.end) {
        const key = cursor.toISOString().slice(0, 10);
        pushBucket(key, cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const keyFor = (date) => {
      if (granularity === "hour") return String(date.getHours());
      if (granularity === "month") return `${date.getFullYear()}-${date.getMonth()}`;
      return date.toISOString().slice(0, 10);
    };

    for (const order of orders) {
      const when = new Date(order.orderedAt);
      const bucket = buckets.get(keyFor(when));
      if (!bucket) continue;
      bucket.revenue += revenueOf(order);
      bucket.orders += 1;
    }

    // Returns land in the bucket they were PROCESSED in, not the bucket the
    // original sale was in — a return in week 2 of a "weekly" chart reduces
    // week 2's bar, even if the item was originally bought weeks earlier.
    for (const order of returnOrders) {
      for (const item of order.items || []) {
        if (item.orderStatus !== RETURNED || !item.returnedAt) continue;
        const returnedAt = new Date(item.returnedAt);
        if (returnedAt < range.start || returnedAt > range.end) continue;
        const bucket = buckets.get(keyFor(returnedAt));
        if (!bucket) continue;
        bucket.revenue -= refundOf(order, item);
      }
    }

    const series = [...buckets.values()];
    const payload = {
      labels: series.map((b) => b.label),
      revenue: series.map((b) => Number(b.revenue.toFixed(2))),
      orders: series.map((b) => b.orders),
    };

    // Keyed by type for backwards compatibility with the dashboard, which
    // reads data.monthly; `series` is the type-agnostic accessor.
    return res.json({ status: true, series: payload, [type]: payload });
  } catch (error) {
    console.error("Error fetching sales chart:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

//code to download report in pdf



const reportPdf = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    const range = resolveReportRange(type, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ status: false, message: range.error });
    }

    // This query previously had NO orderStatus filter, so the PDF counted
    // cancelled, returned and failed items as revenue while the on-screen
    // table and the Excel export both counted only Delivered. The three
    // never agreed. All of them now go through buildSalesRows(), and returns
    // are booked separately by when they were processed — see
    // salesAggregate.js and the sibling queries in generateSalesReport/
    // downloadExcel.
    const populateOpts = {
      path: "items.productId",
      select: "productName brand regularPrice salePrice variants category",
      populate: { path: "category", select: "name" },
    };
    const [orders, returnOrders] = await Promise.all([
      Order.find({
        orderedAt: { $gte: range.start, $lte: range.end },
        "items.orderStatus": { $in: SALE_STATUSES },
      })
        .populate(populateOpts)
        .sort({ orderedAt: -1 }),
      Order.find({ "items.returnedAt": { $gte: range.start, $lte: range.end } }).populate(populateOpts),
    ]);

    const gross = buildSalesRows(orders);
    const returnsAgg = buildReturnRows(returnOrders, range);
    const { orders: reportData, totals } = combineSalesAndReturns(gross, returnsAgg);

    if (reportData.length === 0 && returnsAgg.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No sales or returns found for the specified period",
      });
    }

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      bufferPages: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Sales_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    doc.pipe(res);

    generateEnhancedPdfContent(
      doc,
      type,
      startDate,
      endDate,
      reportData,
      totals,
      returnsAgg.rows
    );

    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({
      status: false,
      message: "Error generating PDF report",
      error: error.message,
    });
  }
};

// Report amounts were printed as bare numbers with full float precision
// (e.g. "13.333333333333334" for an apportioned shipping share). "Rs." rather
// than the rupee sign because PDFKit's built-in Helvetica has no glyph for
// U+20B9 and silently drops it.
const money = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const generateEnhancedPdfContent = (
  doc,
  type,
  startDate,
  endDate,
  reportData,
  totals,
  returnRows = []
) => {

  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("CROWNIFY", { align: "center" })
    .fontSize(16)
    .text("Sales Report", { align: "center" })
    .fontSize(11)
    .font("Helvetica")
    .text(getReportPeriodText(type, startDate, endDate), { align: "center" })
    .fontSize(9)
    .fillColor("#666666")
    .text(
      `Generated ${new Date().toLocaleString("en-IN")}  |  Sales booked when ordered; returns booked when processed`,
      { align: "center" }
    )
    .fillColor("#000000");

  doc.moveDown(1);

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Summary", { align: "center", underline: true });

  doc.moveDown(0.5);

  const formattedSummary = {
    headers: ["Metric", "Value"],
    rows: [
      ["Total Orders", String(totals.totalOrders ?? reportData.length)],
      ["Total Items Sold", String(totals.totalQuantity ?? 0)],
      ["Gross Sales (at MRP)", money(totals.totalRegularPrice)],
      ["Sales (at sale price)", money(totals.totalSalePrice)],
      ["Product Discounts", money(totals.totalItemDiscount)],
      ["Coupon Discounts", money(totals.totalCouponDiscount)],
      ["Shipping Collected", money(totals.totalShipping)],
      ["Returns Processed This Period", money(totals.totalReturns)],
      ["Net Revenue", money(totals.netRevenue)],
      ["Average Order Value", money(totals.averageOrderValue)],
    ],
  };

  generateTable(doc, formattedSummary, true);
  doc.moveDown(1);

  // Landscape for the line-item table: ten columns across a portrait A4 left
  // roughly 45pt per column, so order numbers, product names and every
  // currency value were truncated to "ORD-1786..." / "Rs. 10,500....".
  // Landscape gives ~50% more usable width and the columns fit.
  doc.addPage({ layout: "landscape", margin: 40 });

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Order Details", { align: "center", underline: true });

  doc.moveDown(0.5);

  const columnWidths = {
    orderNumber: 0.15,
    name: 0.2,
    brand: 0.09,
    category: 0.1,
    quantity: 0.04,
    salePrice: 0.09,
    itemDiscount: 0.09,
    shipping: 0.07,
    couponDiscount: 0.07,
    total: 0.1,
  };

  const orderTable = {
    headers: [
      "Order Number",
      "Product",
      "Brand",
      "Category",
      "Qty",
      "Price",
      "Offer Discount",
      "Shipping",
      "Coupon",
      "Total",
    ],
    columnWidths,
    rows: [],
  };

  reportData.forEach((order) => {
    if (!order || !order.items) return;

    order.items.forEach((item) => {
      if (!item) return;

      // Numeric cells are pre-formatted to strings here. The old code built
      // raw numbers then ran `String(value || "N/A")` over the whole row,
      // which turned every legitimate ZERO (no discount, free shipping) into
      // the text "N/A", because 0 is falsy.
      const row = [
        order.orderNumber || "N/A",
        item.name || "N/A",
        item.brand || "N/A",
        item.category || "N/A",
        String(item.quantity ?? 0),
        money(item.salePrice),
        money(item.itemDiscount),
        money(item.shipping),
        money(item.couponDiscount),
        money(item.itemTotal),
      ];

      orderTable.rows.push(row.map((value) => (value == null ? "N/A" : String(value))));
    });
  });

  generateTable(doc, orderTable, false);

  // Returns processed in this period — a separate section rather than
  // folded into Order Details, since these rows are dated by when the
  // RETURN happened (item.returnedAt), not when the item was ordered, and
  // can reference orders from a completely different period.
  if (returnRows.length > 0) {
    doc.addPage({ layout: "landscape", margin: 40 });

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Returns Processed This Period", { align: "center", underline: true });
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Dated by when the return was processed, not when the item was originally ordered.", {
        align: "center",
      })
      .fillColor("#000000");

    doc.moveDown(0.5);

    const returnsTable = {
      headers: ["Order Number", "Return Date", "Product", "Category", "Qty", "Item Value", "Refunded"],
      columnWidths: {
        orderNumber: 0.16,
        date: 0.12,
        name: 0.28,
        category: 0.14,
        quantity: 0.06,
        itemValue: 0.12,
        refunded: 0.12,
      },
      rows: returnRows.map((r) => [
        r.orderNumber,
        r.date,
        r.name,
        r.category,
        String(r.quantity ?? 0),
        money(r.salePrice * r.quantity),
        money(Math.abs(r.itemTotal)),
      ]),
    };

    generateTable(doc, returnsTable, false);
  }
};

const generateTable = (doc, tableData, isSimpleTable) => {
  const { headers, rows, columnWidths } = tableData;
  const cellPadding = 4;
  const fontSize = isSimpleTable ? 9 : 7;
  const rowHeight = fontSize + cellPadding * 2 + 4;
  const left = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - rowHeight;

  const colWidths = isSimpleTable
    ? [tableWidth * 0.6, tableWidth * 0.4]
    : Object.values(columnWidths).map((w) => tableWidth * w);

  // Right-align numeric columns; the old table centred everything, so
  // currency values in the same column never lined up on the decimal point.
  const isNumericCol = (i) =>
    isSimpleTable ? i === 1 : i >= 4;

  // PDFKit's `ellipsis` option only applies when lineBreak is enabled, so the
  // previous { lineBreak: false, ellipsis: true } combination silently did
  // neither — long product names wrapped anyway and pushed every following
  // row out of alignment with its neighbours. Measure and clip manually.
  const fit = (text, maxWidth) => {
    let str = String(text ?? "");
    if (doc.widthOfString(str) <= maxWidth) return str;
    while (str.length > 1 && doc.widthOfString(str + "...") > maxWidth) {
      str = str.slice(0, -1);
    }
    return str + "...";
  };

  let y = doc.y + cellPadding;

  const drawHeader = () => {
    doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#ffffff");
    doc.rect(left, y, tableWidth, rowHeight).fill("#291616");
    doc.fillColor("#ffffff");
    let x = left;
    headers.forEach((header, i) => {
      const w = colWidths[i] - cellPadding * 2;
      doc.text(fit(header, w), x + cellPadding, y + cellPadding + 1, {
        width: w,
        align: isNumericCol(i) ? "right" : "left",
        lineBreak: false,
      });
      x += colWidths[i];
    });
    doc.fillColor("#000000");
    y += rowHeight;
  };

  drawHeader();

  doc.font("Helvetica").fontSize(fontSize);
  rows.forEach((row, rowIndex) => {
    if (y > bottomLimit) {
      // Inherit the current page's geometry — a bare addPage() would fall
      // back to the document default (portrait) mid-table and the remaining
      // rows would be laid out against the wrong width.
      doc.addPage({
        size: doc.page.size,
        layout: doc.page.layout,
        margins: doc.page.margins,
      });
      y = doc.page.margins.top;
      doc.font("Helvetica-Bold").fontSize(fontSize);
      drawHeader();
      doc.font("Helvetica").fontSize(fontSize);
    }

    if (rowIndex % 2 === 1) {
      doc.rect(left, y, tableWidth, rowHeight).fill("#f5f2f2");
      doc.fillColor("#000000");
    }

    let x = left;
    row.forEach((cell, i) => {
      const w = colWidths[i] - cellPadding * 2;
      doc.text(fit(cell, w), x + cellPadding, y + cellPadding + 1, {
        width: w,
        align: isNumericCol(i) ? "right" : "left",
        lineBreak: false,
      });
      x += colWidths[i];
    });

    doc
      .strokeColor("#dddddd")
      .lineWidth(0.5)
      .moveTo(left, y + rowHeight)
      .lineTo(left + tableWidth, y + rowHeight)
      .stroke();

    y += rowHeight;
  });

  doc.y = y + cellPadding * 2;
  doc.x = left;
};

const getReportPeriodText = (type, startDate, endDate) => {
  const today = new Date();

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  switch (type) {
    case "daily":
      return `Daily Report - ${formatDate(today)}`;
    case "weekly": {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
      return `Weekly Report - ${formatDate(startOfWeek)} to ${formatDate(
        endOfWeek
      )}`;
    }
    case "monthly":
      return `Monthly Report - ${today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      })}`;
    case "yearly":
      return `Yearly Report - ${today.getFullYear()}`;
    case "custom":
      return `Custom Report - ${formatDate(startDate)} to ${formatDate(
        endDate
      )}`;
    default:
      return "Sales Report";
  }
};



//code to get total orders

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

//code to total products

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

//code to get total category

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

//code to generate invoice for user



// Items in these states were never actually billed to the customer — a
// cancelled line item has no valid tax transaction behind it, and a failed
// payment means nothing was collected. A "Tax Invoice" that includes them
// would be claiming a sale that didn't happen. Returned items stay ON the
// invoice (the original sale did happen); their refund gets its own Credit
// Note document instead — see generateCreditNotePDF below.
const INVOICE_EXCLUDED_STATUSES = ["canceled", "Failed"];

const generateInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;

    const order = await Order.findOne({ orderNumber: orderId, userId })
      .populate("items.productId")
      .populate("shippingAddress")
      .exec();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const billableItems = order.items.filter((item) => !INVOICE_EXCLUDED_STATUSES.includes(item.orderStatus));
    if (billableItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No invoice is available — every item in this order was cancelled or failed, so nothing was billed.",
      });
    }
    const excludedCount = order.items.length - billableItems.length;

    const user = await User.findById(userId);

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Invoice_${order.orderNumber}.pdf`;
    const filePath = path.join(__dirname, "../../../public/invoices", fileName);

    const dirPath = path.join(__dirname, "../../../public/invoices");
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (dirError) {
      console.error("Error creating directory:", dirError);
      return res.status(500).send("Error creating invoice directory");
    }

    const logoPath = path.join(
      __dirname,
      "../../../public/assets/images/logoCrownify.png"
    );

    const stream = fs.createWriteStream(filePath);
    stream.on("error", (streamError) => {
      console.error("Stream error:", streamError);
      res.status(500).send("Error generating invoice");
    });

    doc.pipe(stream);

    try {
      doc.image(logoPath, 50, 45, { width: 50 });
    } catch (error) {
      console.warn("Logo image not found, proceeding without it.");
    }

    doc
      .fillColor("#444444")
      .fontSize(20)
      .text("Crownify", 110, 57)
      .fontSize(10)
      .text("Maradu", 200, 65, { align: "right" })
      .text("Kochi", 200, 80, { align: "right" })
      .moveDown();

    doc.fontSize(18).text("Tax Invoice", 50, 160);
    generateHr(doc, 185);

    // The address ref used to be printed as order.shippingAddress.address,
    // a field that doesn't exist on the Address schema (it has fullName,
    // flatHouseCompany, areaStreet, city, state, postalCode, country) — the
    // invoice was silently printing "undefined" for every customer's address.
    const shipTo = order.shippingAddress;
    const addressLines = shipTo
      ? [
          shipTo.fullName,
          shipTo.flatHouseCompany,
          shipTo.areaStreet,
          [shipTo.city, shipTo.state, shipTo.postalCode].filter(Boolean).join(", "),
          shipTo.country,
          shipTo.mobileNumber ? `Phone: ${shipTo.mobileNumber}` : null,
        ].filter(Boolean)
      : ["Address not available"];

    const customerInformationTop = 200;
    doc
      .fontSize(10)
      .text(`Invoice Number: ${order.orderNumber}`, 50, customerInformationTop)
      .text(
        `Invoice Date: ${new Date(order.orderedAt).toLocaleDateString("en-IN")}`,
        50,
        customerInformationTop + 15
      )
      .text(
        `Payment Status: ${order.paymentStatus}`,
        50,
        customerInformationTop + 30
      )
      .text(
        `Payment Method: ${order.paymentMethod}`,
        50,
        customerInformationTop + 45
      )
      .text("Bill To:", 300, customerInformationTop)
      .text(user.name, 300, customerInformationTop + 15)
      .text(user.email, 300, customerInformationTop + 30);

    addressLines.forEach((line, idx) => {
      doc.text(line, 300, customerInformationTop + 45 + idx * 13);
    });
    doc.moveDown();

    const addressBottom = customerInformationTop + 45 + addressLines.length * 13 + 10;
    generateHr(doc, Math.max(252, addressBottom));

    let i;
    const invoiceTableTop = Math.max(330, addressBottom + 30);
    generateTableRow(
      doc,
      invoiceTableTop,
      "Item",
      "Status",
      "Quantity",
      "Unit Price",
      "Total"
    );
    generateHr(doc, invoiceTableTop + 20);

    const PAGE_BOTTOM = 680;
    let position = invoiceTableTop + 30;
    for (i = 0; i < billableItems.length; i++) {
      const item = billableItems[i];
      if (position > PAGE_BOTTOM) {
        doc.addPage();
        position = 50;
      }
      // Priced from the order line itself (frozen at purchase), not the
      // live product — item.productId.salePrice reflects whatever the
      // product costs TODAY, which drifts from what the customer actually
      // paid the moment an admin changes the price.
      position = generateTableRow(
        doc,
        position,
        item.productName,
        item.orderStatus || "N/A",
        item.quantity,
        formatINR(item.salePrice),
        formatINR(item.totalPrice)
      );
      generateHr(doc, position + 20);
    }

    if (position + 130 > PAGE_BOTTOM + 20) {
      doc.addPage();
      position = 50;
    }

    const returnedCount = order.items.filter((item) => item.orderStatus === "Returned").length;

    if (excludedCount > 0) {
      doc
        .fontSize(8)
        .fillColor("#999999")
        .text(
          `${excludedCount} item(s) cancelled/failed and excluded from this invoice — not billed.`,
          50,
          position + 5
        )
        .fillColor("#000000");
      position += 18;
    }
    if (returnedCount > 0) {
      doc
        .fontSize(8)
        .fillColor("#999999")
        .text(
          `${returnedCount} item(s) below have been returned and refunded — shown for record, but excluded from the total. See your Credit Note for the refund.`,
          50,
          position + 5,
          { width: 500 }
        )
        .fillColor("#000000");
      position += 26;
    }

    // Totals exclude Returned items too, not just cancelled/failed — a
    // returned item was refunded, so it isn't part of what's actually owed.
    // This reuses computeOrderFinancials, the same function that produces
    // "Amount Payable" everywhere else in the app (Orders page, admin order
    // list/details), so the invoice total always matches what's shown there
    // instead of drifting out of sync with its own separate math.
    const financials = computeOrderFinancials(order);
    const { activeSubtotal: payableSubtotal, discountShare, amountPayable: grandTotal } = financials;
    // When every item is voided, amountPayable is forced to exactly 0 (a
    // fully-returned/cancelled order shouldn't still owe shipping) — the
    // displayed Shipping line has to match that, or the rows visually don't
    // add up to the Grand Total shown below them.
    const shippingAmount = financials.allVoided ? 0 : financials.shipping;

    const subtotalPosition = position + 30;
    generateTableRow(
      doc,
      subtotalPosition,
      "",
      "",
      "",
      "Subtotal",
      formatINR(payableSubtotal)
    );
    const discountPosition = subtotalPosition + 20;
    generateTableRow(
      doc,
      discountPosition,
      "",
      "",
      "",
      "Discount",
      formatINR(discountShare)
    );
    const shippingPosition = discountPosition + 20;
    generateTableRow(doc, shippingPosition, "", "", "", "Shipping", formatINR(shippingAmount));
    const grandTotalPosition = shippingPosition + 25;
    doc.font("Helvetica-Bold");
    generateTableRow(
      doc,
      grandTotalPosition,
      "",
      "",
      "",
      "Grand Total",
      formatINR(grandTotal)
    );
    doc.font("Helvetica");

    let footerPosition = grandTotalPosition + 30;
    if (footerPosition > 730) {
      doc.addPage();
      footerPosition = 50;
    }

    doc
      .fontSize(8)
      .fillColor("#777777")
      .text("All prices are inclusive of applicable taxes.", 50, footerPosition);
    doc.fillColor("#444444");

    doc.fontSize(10).text("Thank you for shopping with Crownify!", 50, footerPosition + 25, {
      align: "center",
      width: 500,
    });

    doc.end();

    stream.on("finish", async () => {
      res.download(filePath, fileName, async (err) => {
        if (err) {
          console.error("Error downloading invoice:", err);
        }
        try {
          await fs.promises.unlink(filePath);
        } catch (unlinkError) {
          console.error("Error deleting file after download:", unlinkError);
        }
      });
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Credit Note for returned items — the original Tax Invoice is left
// untouched (the sale itself did happen and stays on record) and this is
// the separate document that reflects the refund, matching real invoicing
// practice: a return doesn't rewrite the original invoice, it's offset by
// its own credit note.
const generateCreditNotePDF = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;

    const order = await Order.findOne({ orderNumber: orderId, userId })
      .populate("shippingAddress")
      .exec();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const returnedItems = order.items.filter((item) => item.orderStatus === "Returned");
    if (returnedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No returned items on this order — there's nothing to issue a credit note for.",
      });
    }

    const user = await User.findById(userId);

    // Same value-share formula the admin refund flow uses when crediting the
    // wallet (src/modules/admin/adminController.js), recomputed here rather
    // than re-reading the wallet Transaction log — transactions are stored
    // as free-text descriptions with no order/item reference, so they can't
    // be reliably matched back to a specific line when a product name
    // repeats. This will only drift from the actual credited amount for
    // returns processed before the refund rounding was corrected to
    // Math.round (previously Math.floor, off by at most a few paise).
    const orderTotalValue = order.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const creditRows = returnedItems.map((item) => {
      const itemShare = orderTotalValue > 0 ? item.totalPrice / orderTotalValue : 0;
      const discountForItem = Math.round((order.discount || 0) * itemShare);
      const refundAmount = Math.round(item.totalPrice - discountForItem);
      return { item, refundAmount };
    });
    const totalRefund = creditRows.reduce((sum, r) => sum + r.refundAmount, 0);

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `CreditNote_${order.orderNumber}.pdf`;
    const dirPath = path.join(__dirname, "../../../public/invoices");
    const filePath = path.join(dirPath, fileName);

    try {
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    } catch (dirError) {
      console.error("Error creating directory:", dirError);
      return res.status(500).send("Error creating credit note directory");
    }

    const logoPath = path.join(__dirname, "../../../public/assets/images/logoCrownify.png");
    const stream = fs.createWriteStream(filePath);
    stream.on("error", (streamError) => {
      console.error("Stream error:", streamError);
      res.status(500).send("Error generating credit note");
    });

    doc.pipe(stream);

    try {
      doc.image(logoPath, 50, 45, { width: 50 });
    } catch (error) {
      console.warn("Logo image not found, proceeding without it.");
    }

    doc
      .fillColor("#444444")
      .fontSize(20)
      .text("Crownify", 110, 57)
      .fontSize(10)
      .text("Maradu", 200, 65, { align: "right" })
      .text("Kochi", 200, 80, { align: "right" });

    doc.fontSize(18).text("Credit Note", 50, 160);
    generateHr(doc, 185);

    const top = 200;
    doc
      .fontSize(10)
      .text(`Credit Note For Order: ${order.orderNumber}`, 50, top)
      .text(`Date Issued: ${new Date().toLocaleDateString("en-IN")}`, 50, top + 15)
      .text("Refunded To: Crownify Wallet", 50, top + 30)
      .text("Issued To:", 300, top)
      .text(user.name, 300, top + 15)
      .text(user.email, 300, top + 30);

    generateHr(doc, top + 55);

    const tableTop = top + 85;
    generateTableRow(doc, tableTop, "Item", "Size/Colour", "Quantity", "Item Total", "Refunded");
    generateHr(doc, tableTop + 20);

    let position = tableTop + 30;
    creditRows.forEach(({ item, refundAmount }) => {
      position = generateTableRow(
        doc,
        position,
        item.productName,
        `${item.variant?.size || "N/A"} / ${item.variant?.color || "N/A"}`,
        item.quantity,
        formatINR(item.totalPrice),
        formatINR(refundAmount)
      );
      generateHr(doc, position + 20);
    });

    doc.font("Helvetica-Bold");
    generateTableRow(doc, position + 30, "", "", "", "Total Refunded", formatINR(totalRefund));
    doc.font("Helvetica");

    doc
      .fontSize(8)
      .fillColor("#777777")
      .text(
        "This credit note reflects the amount refunded to your Crownify wallet for the returned item(s) above. It does not replace your original tax invoice.",
        50,
        position + 65,
        { width: 500 }
      );
    doc.fillColor("#444444");

    doc.end();

    stream.on("finish", async () => {
      res.download(filePath, fileName, async (err) => {
        if (err) console.error("Error downloading credit note:", err);
        try {
          await fs.promises.unlink(filePath);
        } catch (unlinkError) {
          console.error("Error deleting file after download:", unlinkError);
        }
      });
    });
  } catch (error) {
    console.error("Error generating credit note:", error);
    res.status(500).send("Internal Server Error");
  }
};

function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

// Amounts used to be printed as bare numbers (no currency symbol, no fixed
// decimals) — indistinguishable from any other currency, and JS float math
// on the totals could render something like "3190.5000000004".
function formatINR(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generateTableRow(doc, y, item, status, quantity, unitCost, lineTotal) {
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(status, 200, y, { width: 70, align: "right" })
    .text(quantity, 280, y, { width: 90, align: "right" })
    .text(unitCost, 370, y, { width: 90, align: "right" })
    .text(lineTotal, 0, y, { align: "right" });
  return y + 20;
}

module.exports = {
  generateSalesReport,
  reportPdf,
  salesChart,
  getOverallRevenue,
  getTotalOrders,
  getTotalProducts,
  getTotalCategories,
  generateInvoicePDF,
  generateCreditNotePDF,
  downloadExcel,
};
