const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const PDFDocument = require("pdfkit");
const path = require("path");
const xlsx = require("xlsx");
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");
pdfMake.vfs = pdfFonts.pdfMake.vfs;

const fs = require("fs");
const User = require("../models/userSchema");

//code to download sales report in excel format


const downloadExcel = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    if (type === "custom" && (!startDate || !endDate)) {
      return res.status(400).json({
        status: false,
        message: "Start date and end date are required for custom reports",
      });
    }

    let query = {};
    const today = new Date();

    switch (type) {
      case "daily":
        query.orderedAt = {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(today.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date();
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date();
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        query.orderedAt = {
          $gte: startOfWeek,
          $lte: endOfWeek,
        };
        break;
      case "monthly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), today.getMonth(), 1),
          $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
        };
        break;
      case "yearly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), 0, 1),
          $lte: new Date(today.getFullYear(), 11, 31),
        };
        break;
      case "custom":
        query.orderedAt = {
          $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
        break;
      default:
        return res
          .status(400)
          .json({ status: false, message: "Invalid report type" });
    }

    const orders = await Order.find(query)
      .populate({
        path: "items.productId",
        select: "productName brand regularPrice salePrice variants category",
        populate: {
          path: "category",
          select: "name",
        },
      })
      .sort({ orderedAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No orders found for the specified period",
      });
    }

    const processedData = orders
      .map((order) => {
        const orderItems = order.items.map((item) => {
          const product = item.productId;
          const variant = product.variants[0];

          return {
            orderNumber: order.orderNumber,
            date: order.orderedAt.toISOString().split("T")[0],
            productName: product.productName,
            brand: product.brand,
            category: product.category ? product.category.name : "N/A",
            color: variant ? variant.color : "N/A",
            size: variant ? variant.size : "N/A",
            quantity: item.quantity,
            regularPrice: item.regularPrice,
            salePrice: item.salePrice,
            itemDiscount: (item.regularPrice - item.salePrice) * item.quantity,
            couponDiscount: order.discount / order.items.length,
            shipping: order.shipping / order.items.length,
            itemTotal: item.salePrice * item.quantity,
          };
        });

        return orderItems;
      })
      .flat();

    const summary = {
      totalOrders: orders.length,
      totalQuantity: processedData.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
      totalRegularPrice: processedData.reduce(
        (sum, item) => sum + item.regularPrice * item.quantity,
        0
      ),
      totalSalePrice: processedData.reduce(
        (sum, item) => sum + item.salePrice * item.quantity,
        0
      ),
      totalItemDiscount: processedData.reduce(
        (sum, item) => sum + item.itemDiscount,
        0
      ),
      totalCouponDiscount: processedData.reduce(
        (sum, item) => sum + item.couponDiscount,
        0
      ),
      totalShipping: processedData.reduce(
        (sum, item) => sum + item.shipping,
        0
      ),
      totalRevenue: processedData.reduce(
        (sum, item) => sum + item.itemTotal + item.shipping,
        0
      ),
    };

    const workbook = xlsx.utils.book_new();

    const detailsWorksheet = xlsx.utils.json_to_sheet(processedData);

    const summaryData = [
      ["Sales Report Summary"],
      [""],
      ["Period", getReportPeriod(type, startDate, endDate)],
      ["Generated On", new Date().toLocaleString()],
      [""],
      ["Metric", "Value"],
      ["Total Orders", summary.totalOrders],
      ["Total Quantity Sold", summary.totalQuantity],
      ["Total Regular Price", summary.totalRegularPrice],
      ["Total Sale Price", summary.totalSalePrice],
      ["Total Item Discounts", summary.totalItemDiscount],
      ["Total Coupon Discounts", summary.totalCouponDiscount],
      ["Total Shipping", summary.totalShipping],
      ["Total Revenue", summary.totalRevenue],
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
      { wch: 12 }, 
      { wch: 12 }, 
      { wch: 30 }, 
      { wch: 15 }, 
      { wch: 15 }, 
      { wch: 10 }, 
      { wch: 10 }, 
      { wch: 10 }, 
      { wch: 12 }, 
      { wch: 12 }, 
      { wch: 12 }, 
      { wch: 12 },
      { wch: 12 }, 
      { wch: 12 }, 
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

// code for to get report period period

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
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  try {
    let query = {};
    const today = new Date();

    switch (type) {
      case "daily":
        query.orderedAt = {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(today.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date();
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date();
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        query.orderedAt = {
          $gte: startOfWeek,
          $lte: endOfWeek,
        };
        break;
      case "monthly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), today.getMonth(), 1),
          $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
        };
        break;
      case "yearly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), 0, 1),
          $lte: new Date(today.getFullYear(), 11, 31),
        };
        break;
      case "custom":
        if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
          return res
            .status(400)
            .json({ status: false, message: "Invalid date range" });
        }
        query.orderedAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
        break;
      default:
        return res
          .status(400)
          .json({ status: false, message: "Invalid report type" });
    }

    const totalOrders = await Order.countDocuments(query);
    if (totalOrders === 0) {
      return res.status(404).json({
        status: false,
        message: "No orders found for the selected criteria.",
        report: [],
        totals: {},
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalOrders: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .populate({
        path: "items.productId",
        select: "productName brand regularPrice salePrice variants category",
        populate: {
          path: "category",
          select: "name",
        },
      })
      .sort({ orderedAt: -1 })
      .skip(skip)
      .limit(limit);

    let totalQuantity = 0;
    let totalRegularPrice = 0;
    let totalSalePrice = 0; 
    let totalItemDiscount = 0;
    let totalCouponDiscount = 0; 
    let totalItemTotal = 0;
    let totalShipping = 0;
    let totalOrderTotal = 0;

    const report = orders.map((order) => {
      const orderItemTotals = order.items.map((item) => {
        const product = item.productId;
        const variant = product.variants[0];

        const itemTotal = item.salePrice * item.quantity;
        const shipping = order.shipping / order.items.length;

        totalQuantity += item.quantity;
        totalRegularPrice += item.regularPrice * item.quantity; 
        totalSalePrice += item.salePrice * item.quantity; 
        totalItemDiscount +=
          (item.regularPrice - item.salePrice) * item.quantity; 
        totalCouponDiscount += order.discount / order.items.length; 
        totalItemTotal += itemTotal; 
        totalShipping += shipping; 
        totalOrderTotal += itemTotal + shipping; 

        return {
          name: product.productName,
          brand: product.brand,
          color: variant ? variant.color : "N/A",
          size: variant ? variant.size : "N/A",
          category: product.category ? product.category.name : "N/A",
          quantity: item.quantity,
          regularPrice: item.regularPrice,
          salePrice: item.salePrice,
          itemDiscount: item.regularPrice - item.salePrice,
          couponDiscount: order.discount / order.items.length,
          itemTotal: itemTotal,
          shipping: shipping,
        };
      });

      return {
        orderNumber: order.orderNumber,
        date: order.orderedAt.toISOString().split("T")[0],
        items: orderItemTotals,
      };
    });

    return res.json({
      status: true,
      report,
      totals: {
        totalQuantity,
        totalRegularPrice, 
        totalSalePrice, 
        totalItemDiscount, 
        totalCouponDiscount,
        totalItemTotal,
        totalShipping,
        totalOrderTotal,
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
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
      {
        $group: {
          _id: null, 
          totalRevenue: { $sum: "$grandTotal" }, 
          totalDiscount: { $sum: "$discount" },
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
    let query = {};
    const today = new Date();

    switch (type) {
      case "daily":
        query.orderedAt = {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(today.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date();
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date();
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        query.orderedAt = {
          $gte: startOfWeek,
          $lte: endOfWeek,
        };
        break;
      case "monthly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), today.getMonth(), 1),
          $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
        };
        break;
      case "yearly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), 0, 1),
          $lte: new Date(today.getFullYear(), 11, 31),
        };
        break;
      case "custom":
        if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
          return res
            .status(400)
            .json({ status: false, message: "Invalid date range" });
        }
        query.orderedAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
        break;
      default:
        return res
          .status(400)
          .json({ status: false, message: "Invalid report type" });
    }

    const orders = await Order.find(query);

    const labels = []; 
    const revenue = []; 
    const orderCounts = []; 

    if (type === "daily") {
      labels.push(today.toLocaleDateString());
      revenue.push(
        orders.reduce((total, order) => total + order.grandTotal, 0)
      );
      orderCounts.push(orders.length);
    } else if (type === "weekly") {
      for (let i = 0; i < 7; i++) {
        const day = new Date();
        day.setDate(today.getDate() - today.getDay() + i);
        labels.push(day.toLocaleDateString());
        const dailyOrders = orders.filter((order) => {
          const orderDate = new Date(order.orderedAt);
          return orderDate.toDateString() === day.toDateString();
        });
        revenue.push(
          dailyOrders.reduce((total, order) => total + order.grandTotal, 0)
        );
        orderCounts.push(dailyOrders.length);
      }
    } else if (type === "monthly") {
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        labels.push(i.toString());
        const dailyOrders = orders.filter((order) => {
          const orderDate = new Date(order.orderedAt);
          return (
            orderDate.getDate() === i &&
            orderDate.getMonth() === today.getMonth() &&
            orderDate.getFullYear() === today.getFullYear()
          );
        });
        revenue.push(
          dailyOrders.reduce((total, order) => total + order.grandTotal, 0)
        );
        orderCounts.push(dailyOrders.length);
      }
    } else if (type === "yearly") {
      for (let i = 0; i < 12; i++) {
        const month = new Date(today.getFullYear(), i);
        labels.push(month.toLocaleString("default", { month: "long" }));
        const monthlyOrders = orders.filter((order) => {
          const orderDate = new Date(order.orderedAt);
          return (
            orderDate.getFullYear() === today.getFullYear() &&
            orderDate.getMonth() === i
          );
        });
        revenue.push(
          monthlyOrders.reduce((total, order) => total + order.grandTotal, 0)
        );
        orderCounts.push(monthlyOrders.length);
      }
    }

    return res.json({
      status: true,
      [type]: {
        labels,
        revenue,
        orders: orderCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

//code to download report in pdf



const reportPdf = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    if (type === "custom" && (!startDate || !endDate)) {
      return res.status(400).json({
        status: false,
        message: "Start date and end date are required for custom reports",
      });
    }

    let query = {};
    const today = new Date();

    switch (type) {
      case "daily": {
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        query.orderedAt = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
        break;
      }
      case "weekly": {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        query.orderedAt = {
          $gte: startOfWeek,
          $lte: endOfWeek,
        };
        break;
      }
      case "monthly": {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0
        );
        endOfMonth.setHours(23, 59, 59, 999);
        query.orderedAt = {
          $gte: startOfMonth,
          $lte: endOfMonth,
        };
        break;
      }
      case "yearly": {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        const endOfYear = new Date(today.getFullYear(), 11, 31);
        endOfYear.setHours(23, 59, 59, 999);
        query.orderedAt = {
          $gte: startOfYear,
          $lte: endOfYear,
        };
        break;
      }
      case "custom": {
        const customStartDate = new Date(startDate);
        customStartDate.setHours(0, 0, 0, 0);
        const customEndDate = new Date(endDate);
        customEndDate.setHours(23, 59, 59, 999);
        query.orderedAt = {
          $gte: customStartDate,
          $lte: customEndDate,
        };
        break;
      }
    }

    const orders = await Order.find(query)
      .populate({
        path: "items.productId",
        select: "productName brand regularPrice salePrice variants category",
        populate: {
          path: "category",
          select: "name",
        },
      })
      .sort({ orderedAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No orders found for the specified period",
      });
    }

    let totals = {
      totalQuantity: 0,
      totalRegularPrice: 0,
      totalSalePrice: 0,
      totalItemDiscount: 0,
      totalCouponDiscount: 0,
      totalItemTotal: 0,
      totalShipping: 0,
      totalOrderTotal: 0,
    };

    const reportData = orders
      .map((order) => {
        if (!order || !order.items) return null;

        const orderDetails = {
          orderNumber: order.orderNumber || "N/A",
          date: order.orderedAt
            ? order.orderedAt.toISOString().split("T")[0]
            : "N/A",
          items: order.items
            .map((item) => {
              const product = item.productId || {};
              const variant = (product.variants && product.variants[0]) || {};
              const quantity = item.quantity || 0;
              const regularPrice = item.regularPrice || 0;
              const salePrice = item.salePrice || 0;
              const shipping =
                (order.shipping || 0) / (order.items.length || 1);
              const itemTotal = salePrice * quantity;

              totals.totalQuantity += quantity;
              totals.totalRegularPrice += regularPrice * quantity;
              totals.totalSalePrice += salePrice * quantity;
              totals.totalItemDiscount += (regularPrice - salePrice) * quantity;
              totals.totalCouponDiscount +=
                (order.discount || 0) / (order.items.length || 1);
              totals.totalItemTotal += itemTotal;
              totals.totalShipping += shipping;
              totals.totalOrderTotal += itemTotal + shipping;

              return {
                name: product.productName || "N/A",
                brand: product.brand || "N/A",
                color: variant.color || "N/A",
                size: variant.size || "N/A",
                category: (product.category && product.category.name) || "N/A",
                quantity: quantity,
                regularPrice: regularPrice,
                salePrice: salePrice,
                itemDiscount: regularPrice - salePrice,
                couponDiscount:
                  (order.discount || 0) / (order.items.length || 1),
                itemTotal: itemTotal,
                shipping: shipping,
              };
            })
            .filter(Boolean),
        };
        return orderDetails;
      })
      .filter(Boolean); 

    if (!reportData || reportData.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No valid order data found for the specified period",
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
      totals
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

const generateEnhancedPdfContent = (
  doc,
  type,
  startDate,
  endDate,
  reportData,
  totals
) => {

  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("SALES REPORT", { align: "center" })
    .fontSize(14)
    .font("Helvetica")
    .text(getReportPeriodText(type, startDate, endDate), { align: "center" });

  doc.moveDown(1);

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Summary", { align: "center", underline: true });

  doc.moveDown(0.5);

  const formattedSummary = {
    headers: ["Metric", "Value"],
    rows: [
      ["Total Orders", reportData.length],
      ["Total Items Sold", totals.totalQuantity],
      ["Total Regular Price", totals.totalRegularPrice],
      ["Total Sale Price", totals.totalSalePrice],
      ["Total Item Discounts", totals.totalItemDiscount],
      ["Total Coupon Discounts", totals.totalCouponDiscount],
      ["Total Shipping", totals.totalShipping],
      ["Total Order Value", totals.totalOrderTotal],
    ],
  };

  generateTable(doc, formattedSummary, true);
  doc.moveDown(1);

  doc.addPage();

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Order Details", { align: "center", underline: true });

  doc.moveDown(0.5);

  const columnWidths = {
    orderNumber: 0.1,
    name: 0.2,
    brand: 0.1,
    category: 0.1,
    quantity: 0.07,
    salePrice: 0.1,
    itemDiscount: 0.11,
    shipping: 0.07,
    couponDiscount: 0.08,
    total: 0.07,
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

      const row = [
        order.orderNumber || "N/A",
        item.name || "N/A",
        item.brand || "N/A",
        item.category || "N/A",
        (item.quantity || 0).toString(),
        item.salePrice || 0,
        (item.itemDiscount || 0) * (item.quantity || 0),
        item.shipping || 0,
        item.couponDiscount || 0,
        item.itemTotal || 0,
      ];

      const safeRow = row.map((value) => String(value || "N/A"));
      orderTable.rows.push(safeRow);
    });
  });

  generateTable(doc, orderTable, false);
};

const generateTable = (doc, tableData, isSimpleTable) => {
  const { headers, rows, columnWidths } = tableData;
  const tablePadding = 10;
  const cellPadding = 5;
  const fontSize = 7;
  const extraRowSpace = 10;
  const tableWidth = doc.page.width - 2 * tablePadding;

  let startX = tablePadding;
  let startY = doc.y + cellPadding;

  let colWidths;
  if (isSimpleTable) {
    colWidths = headers.map(() => tableWidth / headers.length);
  } else {
    colWidths = Object.values(columnWidths).map((width) => tableWidth * width);
  }

  const drawTableHeader = () => {
    doc.fontSize(fontSize).font("Helvetica-Bold");
    let x = startX;
    headers.forEach((header, i) => {
      doc.text(String(header || ""), x, startY, {
        width: colWidths[i],
        align: "center",
        lineBreak: false,
      });
      x += colWidths[i];
    });

    doc
      .moveTo(startX, startY + fontSize + 2)
      .lineTo(startX + tableWidth, startY + fontSize + 2)
      .stroke();

    return startY + fontSize + cellPadding;
  };

  startY = drawTableHeader();
  doc.font("Helvetica").fontSize(fontSize);
  let rowCount = 0;

  rows.forEach((row) => {
    const rowHeight = fontSize + cellPadding + extraRowSpace;

    if (rowCount >= 30) {
      doc.addPage();
      startY = tablePadding;
      startY = drawTableHeader();
      rowCount = 0;
    }

    let x = startX;
    row.forEach((cell, i) => {
      const cellText = String(cell || "N/A");
      const maxWidth = colWidths[i] - cellPadding;

      doc.text(cellText, x, startY, {
        width: maxWidth,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      });

      x += colWidths[i];
    });

    startY += rowHeight;
    rowCount++;
  });

  doc.y = startY + cellPadding;
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

    const user = await User.findById(userId);

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Invoice_${order.orderNumber}.pdf`;
    const filePath = path.join(__dirname, "../public/invoices", fileName);

    const dirPath = path.join(__dirname, "../public/invoices");
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
      "../public/assets/images/logoCrownify.png"
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

    doc.fontSize(18).text("Invoice", 50, 160);
    generateHr(doc, 185);

    const customerInformationTop = 200;
    doc
      .fontSize(10)
      .text(`Invoice Number: ${order.orderNumber}`, 50, customerInformationTop)
      .text(
        `Invoice Date: ${new Date(order.orderedAt).toLocaleDateString()}`,
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
      .text(user.name, 300, customerInformationTop)
      .text(user.email, 300, customerInformationTop + 15)
      .text(order.shippingAddress.address, 300, customerInformationTop + 30)
      .moveDown();

    generateHr(doc, 252);

    let i;
    const invoiceTableTop = 330;
    generateTableRow(
      doc,
      invoiceTableTop,
      "Item",
      "Status",
      "Quantity",
      "Unit Sale Price",
      "Total"
    );
    generateHr(doc, invoiceTableTop + 20);

    let position = invoiceTableTop + 30;
    for (i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      position = generateTableRow(
        doc,
        position,
        item.productId.productName,
        item.orderStatus || "N/A", 
        item.quantity,
        item.productId.salePrice,
        item.quantity * item.productId.salePrice
      );
      generateHr(doc, position + 20);
    }

    const subtotalPosition = position + 30;
    generateTableRow(
      doc,
      subtotalPosition,
      "",
      "",
      "",
      "Subtotal",
      order.subtotal
    );
    const discountPosition = subtotalPosition + 20;
    generateTableRow(
      doc,
      discountPosition,
      "",
      "",
      "",
      "Discount",
      order.discount
    );
    const shippingPosition = discountPosition + 20;
    generateTableRow(doc, shippingPosition, "", "", "", "Shipping", 40);
    const grandTotalPosition = shippingPosition + 25;
    doc.font("Helvetica-Bold");
    generateTableRow(
      doc,
      grandTotalPosition,
      "",
      "",
      "",
      "Grand Total",
      order.grandTotal
    );
    doc.font("Helvetica");

    doc.fontSize(10).text("Thank you for shopping with Crownify!", 50, 700, {
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

function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
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
  downloadExcel,
};
