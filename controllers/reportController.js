const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const PDFDocument = require("pdfkit");
const path = require("path");
const xlsx = require("xlsx");

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

    const dateQuery = getDateQuery1(type, startDate, endDate);
    const orders = await Order.find({ orderedAt: dateQuery }).populate(
      "items.productId"
    );

    if (!orders || orders.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No orders found for the specified period",
      });
    }

    const reportData = processOrdersData1(orders, type, startDate, endDate);
    const finalReport = generateFinalReport(reportData);

    finalReport.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    const totals = calculateTotals(finalReport);

    const workbook = xlsx.utils.book_new();
    const worksheet = createMainWorksheet(
      finalReport,
      totals,
      type,
      startDate,
      endDate
    );
    const summarySheet = createSummaryWorksheet(totals);

    xlsx.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    xlsx.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const excelBuffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });
    const filename = getReportFileName(type, startDate, endDate);
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

// code  to get report period based on period  type
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
  }
};

// code to generate report file name

const getReportFileName = (type, startDate, endDate) => {
  const timestamp = new Date().toISOString().slice(0, 10);
  let periodStr = "";

  switch (type) {
    case "daily":
      periodStr = new Date().toISOString().slice(0, 10);
      break;
    case "weekly":
      periodStr = "Weekly";
      break;
    case "monthly":
      periodStr = new Date()
        .toLocaleString("default", { month: "long", year: "numeric" })
        .replace(" ", "_");
      break;
    case "yearly":
      periodStr = new Date().getFullYear().toString();
      break;
    case "custom":
      periodStr = `${new Date(startDate)
        .toISOString()
        .slice(0, 10)}_to_${new Date(endDate).toISOString().slice(0, 10)}`;
      break;
  }

  return `Sales_Report_${periodStr}_${timestamp}.xlsx`;
};

// code  to get date query based on report type

const getDateQuery1 = (type, startDate, endDate) => {
  const today = new Date();
  let query = {};

  switch (type) {
    case "daily":
      query = {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      };
      break;
    case "weekly":
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      query = {
        $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
        $lte: new Date(endOfWeek.setHours(23, 59, 59, 999)),
      };
      break;
    case "monthly":
      query = {
        $gte: new Date(today.getFullYear(), today.getMonth(), 1),
        $lte: new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0,
          23,
          59,
          59
        ),
      };
      break;
    case "yearly":
      query = {
        $gte: new Date(today.getFullYear(), 0, 1),
        $lte: new Date(today.getFullYear(), 11, 31, 23, 59, 59),
      };
      break;
    case "custom":
      query = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
      break;
  }
  return query;
};

// code to process orders data and generate report data
const processOrdersData1 = (orders, type, startDate = null, endDate = null) => {
  const reportData = {};

 
  const getDatesInRange = (startDate, endDate) => {
    const dates = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  if (type === "daily") {
    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10);
    reportData[dateKey] = createEmptyReportObject();
  } else if (type === "weekly") {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const datesInWeek = getDatesInRange(startOfWeek, endOfWeek);
    datesInWeek.forEach((date) => {
      reportData[date.toISOString().slice(0, 10)] = createEmptyReportObject();
    });
  } else if (type === "monthly") {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const datesInMonth = getDatesInRange(startOfMonth, endOfMonth);
    datesInMonth.forEach((date) => {
      reportData[date.toISOString().slice(0, 10)] = createEmptyReportObject();
    });
  } else if (type === "yearly") {
    const months = [];
    const currentYear = new Date().getFullYear();
    for (let month = 0; month < 12; month++) {
      const dateKey = new Date(currentYear, month, 1).toISOString().slice(0, 7);
      reportData[dateKey] = createEmptyReportObject();
    }
  } else if (type === "custom" && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const datesInRange = getDatesInRange(start, end);
    datesInRange.forEach((date) => {
      reportData[date.toISOString().slice(0, 10)] = createEmptyReportObject();
    });
  }

  orders.forEach((order) => {
    let dateKey;

    if (type === "yearly") {
      dateKey = new Date(order.orderedAt).toISOString().slice(0, 7); // YYYY-MM
    } else {
      dateKey = new Date(order.orderedAt).toISOString().slice(0, 10); // YYYY-MM-DD
    }

    if (!reportData[dateKey]) {
      reportData[dateKey] = createEmptyReportObject();
    }

    let orderTotalMRP = 0;
    let orderOfferDiscount = 0;
    let orderSalePrice = 0;

    order.items.forEach((item) => {
      orderTotalMRP += item.regularPrice * item.quantity;
      orderOfferDiscount +=
        (item.regularPrice - item.salePrice) * item.quantity;
      orderSalePrice += item.salePrice * item.quantity;
    });

    reportData[dateKey].totalSalesCount += 1;
    reportData[dateKey].totalOrderAmount += order.grandTotal;
    reportData[dateKey].couponDeduction += order.discount || 0;
    reportData[dateKey].totalMRP += orderTotalMRP;
    reportData[dateKey].offerDiscount += orderOfferDiscount;
    reportData[dateKey].salePrice += orderSalePrice;
    reportData[dateKey].deliveryCharge += order.shipping || 0;
    reportData[dateKey].totalDiscount =
      reportData[dateKey].couponDeduction + reportData[dateKey].offerDiscount;
    reportData[dateKey].averageOrderValue =
      reportData[dateKey].totalOrderAmount /
      reportData[dateKey].totalSalesCount;
  });

  return reportData;
};

const createEmptyReportObject = () => ({
  totalSalesCount: 0,
  totalOrderAmount: 0,
  totalDiscount: 0,
  couponDeduction: 0,
  totalMRP: 0,
  offerDiscount: 0,
  salePrice: 0,
  deliveryCharge: 0,
  averageOrderValue: 0,
});

const generateFinalReport = (reportData) => {
  return Object.entries(reportData).map(([date, data]) => ({
    Date: date,
    "Total Sales Count": data.totalSalesCount,
    "Total Order Amount": data.totalOrderAmount,
    "Total Discount": data.totalDiscount,
    "Coupon Deduction": data.couponDeduction,
    "Total MRP": data.totalMRP,
    "Offer Discount": data.offerDiscount,
    "Sale Price": data.salePrice,
    "Delivery Charge": data.deliveryCharge,
    "Average Order Value": data.averageOrderValue,
  }));
};

const calculateTotals = (finalReport) => {
  return {
    Date: "Grand Total",
    "Total Sales Count": finalReport.reduce(
      (sum, row) => sum + row["Total Sales Count"],
      0
    ),
    "Total Order Amount": finalReport.reduce(
      (sum, row) => sum + row["Total Order Amount"],
      0
    ),
    "Total Discount": finalReport.reduce(
      (sum, row) => sum + row["Total Discount"],
      0
    ),
    "Coupon Deduction": finalReport.reduce(
      (sum, row) => sum + row["Coupon Deduction"],
      0
    ),
    "Total MRP": finalReport.reduce((sum, row) => sum + row["Total MRP"], 0),
    "Offer Discount": finalReport.reduce(
      (sum, row) => sum + row["Offer Discount"],
      0
    ),
    "Sale Price": finalReport.reduce((sum, row) => sum + row["Sale Price"], 0),
    "Delivery Charge": finalReport.reduce(
      (sum, row) => sum + row["Delivery Charge"],
      0
    ),
    "Average Order Value":
      finalReport.reduce((sum, row) => sum + row["Average Order Value"], 0) /
      finalReport.length,
  };
};


const createMainWorksheet = (finalReport, totals, type, startDate, endDate) => {
  const worksheetData = [
    {
      A: `Sales Report - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      B: "",
      C: "",
      D: "",
      E: "",
    },
    {
      A: `Period: ${getReportPeriod(type, startDate, endDate)}`,
      B: "",
      C: "",
      D: "",
      E: "",
    },
    {
      A: `Generated on: ${new Date().toLocaleString()}`,
      B: "",
      C: "",
      D: "",
      E: "",
    },
    { A: "", B: "", C: "", D: "", E: "" }, 
    {
      Date: "Date",
      "Total Sales Count": "Total Sales Count",
      "Total Order Amount": "Total Order Amount",
      "Total Discount": "Total Discount",
      "Coupon Deduction": "Coupon Deduction",
      "Total MRP": "Total MRP",
      "Offer Discount": "Offer Discount",
      "Sale Price": "Sale Price",
      "Delivery Charge": "Delivery Charge",
      "Average Order Value": "Average Order Value",
    },
    ...finalReport,
    totals,
  ];

  const worksheet = xlsx.utils.json_to_sheet(worksheetData, {
    skipHeader: true,
  });

  applyStylesToWorksheet(worksheet);

  return worksheet;
};

const createSummaryWorksheet = (totals) => {
  const summaryData = [
    { A: "Sales Report Summary", B: "", C: "", D: "", E: "" },
    { A: "", B: "", C: "", D: "", E: "" },
    { A: "Key Metrics", B: "Value", C: "", D: "", E: "" },
    {
      A: "Total Orders",
      B: totals["Total Sales Count"],
      C: "",
      D: "",
      E: "",
    },
    {
      A: "Total Revenue",
      B: totals["Total Order Amount"],
      C: "",
      D: "",
      E: "",
    },
    {
      A: "Total Discounts",
      B: totals["Total Discount"],
      C: "",
      D: "",
      E: "",
    },
    { A: "Net Sales", B: totals["Sale Price"], C: "", D: "", E: "" },
    {
      A: "Average Order Value",
      B: totals["Average Order Value"],
      C: "",
      D: "",
      E: "",
    },
    {
      A: "Total Delivery Charges",
      B: totals["Delivery Charge"],
      C: "",
      D: "",
      E: "",
    },
  ];

  return xlsx.utils.json_to_sheet(summaryData, { skipHeader: true });
};


const applyStylesToWorksheet = (worksheet) => {
  const styles = {
    header: {
      font: { bold: true, size: 14 },
      fill: { fgColor: { rgb: "4F81BD" } },
      alignment: { horizontal: "center" },
    },
    subHeader: {
      font: { bold: true, size: 12 },
      fill: { fgColor: { rgb: "DCE6F1" } },
    },
    total: {
      font: { bold: true },
      fill: { fgColor: { rgb: "E4E4E4" } },
    },
    currency: {
      numFmt: '"₹"#,##0.00',
    },
    border: {
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    },
  };

  const range = xlsx.utils.decode_range(worksheet["!ref"]);


  for (let C = range.s.c; C <= range.e.c; ++C) {
    const headerAddress = xlsx.utils.encode_cell({ r: 4, c: C });
    if (!worksheet[headerAddress]) continue;
    worksheet[headerAddress].s = { ...styles.header, ...styles.border };
  }

  worksheet["A1"].s = {
    font: { bold: true, size: 16 },
    alignment: { horizontal: "center" },
    ...styles.border,
  };
  worksheet["A2"].s = styles.subHeader;
  worksheet["A3"].s = styles.subHeader;

  const lastRow = range.e.r;
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = xlsx.utils.encode_cell({ r: lastRow, c: C });
    if (!worksheet[address]) continue;
    worksheet[address].s = { ...styles.total, ...styles.border };
  }

  const colWidths = [
    { wch: 15 }, 
    { wch: 15 }, 
    { wch: 20 }, 
    { wch: 15 }, 
    { wch: 15 }, 
    { wch: 15 },
    { wch: 15 }, 
    { wch: 15 }, 
    { wch: 15 }, 
    { wch: 20 }, 
  ];
  worksheet["!cols"] = colWidths;

  for (let R = 5; R <= lastRow; ++R) {
    const currencyCols = [2, 3, 4, 5, 6, 7, 8, 9];
    currencyCols.forEach((C) => {
      const address = xlsx.utils.encode_cell({ r: R, c: C });
      if (!worksheet[address]) return;
      worksheet[address].s = {
        ...worksheet[address].s,
        ...styles.currency,
        ...styles.border,
      };
    });
  }
};

//code to generate sales report

const generateSalesReport = async (req, res) => {
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

    const orders = await Order.find(query).populate("items.productId"); 

    const reportData = {};
    orders.forEach((order) => {
      const dateKey =
        type === "yearly"
          ? new Date(order.orderedAt).toISOString().slice(0, 7) 
          : type === "monthly"
          ? new Date(order.orderedAt).toISOString().slice(0, 10) 
          : new Date(order.orderedAt).toISOString().slice(0, 10); 

      if (!reportData[dateKey]) {
        reportData[dateKey] = {
          totalSalesCount: 0,
          totalOrderAmount: 0,
          totalDiscount: 0,
          couponDeduction: 0,
          totalMRP: 0,
          offerDiscount: 0,
          salePrice: 0,
          deliveryCharge: 0,
        };
      }

      let orderTotalMRP = 0;
      let orderOfferDiscount = 0;
      let orderSalePrice = 0;

      order.items.forEach((item) => {
        orderTotalMRP += item.regularPrice * item.quantity; 
        orderOfferDiscount +=
          (item.regularPrice - item.salePrice) * item.quantity; 
        orderSalePrice += item.salePrice * item.quantity; 
      });

      reportData[dateKey].totalSalesCount += 1;
      reportData[dateKey].totalOrderAmount += order.grandTotal;

      reportData[dateKey].couponDeduction += order.discount; 

      reportData[dateKey].totalDiscount =
        reportData[dateKey].couponDeduction + reportData[dateKey].offerDiscount;

      reportData[dateKey].totalMRP += orderTotalMRP;
      reportData[dateKey].offerDiscount += orderOfferDiscount;
      reportData[dateKey].salePrice += orderSalePrice;

      reportData[dateKey].deliveryCharge += order.shipping;
    });

    const finalReport = Object.entries(reportData).map(([date, data]) => ({
      date,
      ...data,
    }));

    return res.json({
      status: true,
      report: finalReport,
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
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

    console.log("Overall revenue data:", overallRevenue);

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

    console.log("Total Revenue:", totalRevenue);
    console.log("Total Discount:", totalDiscount);
    console.log("Net Revenue:", netRevenue);

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

    const dateQuery = getDateQuery(type, startDate, endDate);
    const orders = await Order.find({
      orderedAt: dateQuery,
    }).populate("items.productId");

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No orders found for the specified period",
      });
    }

    const reportData = processOrdersData(orders);
    const finalReport = Object.entries(reportData).map(([date, data]) => ({
      date,
      ...data,
    }));

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

    generatePdfContent(doc, type, startDate, endDate, finalReport);

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

const getReportPeriodText = (type, startDate, endDate) => {
  switch (type) {
    case "daily":
      return `Daily Report - ${new Date().toLocaleDateString()}`;
    case "weekly":
      return "Weekly Report";
    case "monthly":
      return `Monthly Report - ${new Date().toLocaleString("default", {
        month: "long",
        year: "numeric",
      })}`;
    case "yearly":
      return `Yearly Report - ${new Date().getFullYear()}`;
    case "custom":
      return `Custom Report (${new Date(
        startDate
      ).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()})`;
    default:
      return "Sales Report";
  }
};

const getDateQuery = (type, startDate, endDate) => {
  const today = new Date();
  let query = {};

  switch (type) {
    case "daily":
      query = {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      };
      break;
    case "weekly":
      const startOfWeek = new Date();
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date();
      endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
      query = {
        $gte: startOfWeek,
        $lte: endOfWeek,
      };
      break;
    case "monthly":
      query = {
        $gte: new Date(today.getFullYear(), today.getMonth(), 1),
        $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
      break;
    case "yearly":
      query = {
        $gte: new Date(today.getFullYear(), 0, 1),
        $lte: new Date(today.getFullYear(), 11, 31),
      };
      break;
    case "custom":
      query = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
      break;
  }
  return query;
};

const processOrdersData = (orders) => {
  const reportData = {};

  orders.forEach((order) => {
    const dateKey = new Date(order.orderedAt).toISOString().slice(0, 10); 

    if (!reportData[dateKey]) {
      reportData[dateKey] = {
        totalSalesCount: 0,
        totalOrderAmount: 0,
        totalDiscount: 0,
        couponDeduction: 0,
        totalMRP: 0,
        offerDiscount: 0,
        salePrice: 0,
        deliveryCharge: 0,
        averageOrderValue: 0,
      };
    }

    let orderTotalMRP = 0;
    let orderOfferDiscount = 0;
    let orderSalePrice = 0;

    order.items.forEach((item) => {
      orderTotalMRP += item.regularPrice * item.quantity;
      orderOfferDiscount +=
        (item.regularPrice - item.salePrice) * item.quantity;
      orderSalePrice += item.salePrice * item.quantity;
    });

    reportData[dateKey].totalSalesCount += 1;
    reportData[dateKey].totalOrderAmount += order.grandTotal;
    reportData[dateKey].couponDeduction += order.discount || 0;
    reportData[dateKey].totalMRP += orderTotalMRP;
    reportData[dateKey].offerDiscount += orderOfferDiscount;
    reportData[dateKey].salePrice += orderSalePrice;
    reportData[dateKey].deliveryCharge += order.shipping || 0;
    reportData[dateKey].totalDiscount =
      reportData[dateKey].couponDeduction + reportData[dateKey].offerDiscount;
    reportData[dateKey].averageOrderValue =
      reportData[dateKey].totalOrderAmount /
      reportData[dateKey].totalSalesCount;
  });

  return reportData;
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
const generatePdfContent = (doc, type, startDate, endDate, finalReport) => {

  const colors = {
    primary: "#2563eb", 
    secondary: "#64748b", 
    accent: "#0284c7", 
    success: "#16a34a", 
    text: "#1e293b", 
    lightGray: "#f1f5f9", 
  };

  doc
    .fontSize(28)
    .font("Helvetica-Bold")
    .fillColor(colors.primary)
    .text("SALES REPORT", 50, 50)
    .fontSize(14)
    .font("Helvetica")
    .fillColor(colors.secondary)
    .text(getReportPeriodText(type, startDate, endDate), 50, doc.y + 10);

  doc.moveDown(2);
  doc.fontSize(12).fillColor(colors.text);
  finalReport.forEach((report) => {
    doc.text(`Date: ${report.date}`, 50);
    doc.text(`Total Sales Count: ${report.totalSalesCount}`, 50);
    doc.text(
      `Total Order Amount: ${formatCurrency(report.totalOrderAmount)}`,
      50
    );
    doc.text(`Total Discount: ${formatCurrency(report.totalDiscount)}`, 50);
    doc.text(
      `Average Order Value: ${formatCurrency(report.averageOrderValue)}`,
      50
    );
    doc.moveDown(1);
  });
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
        item.quantity,
        formatCurrency(item.productId.salePrice),
        formatCurrency(item.quantity * item.productId.salePrice)
      );
      generateHr(doc, position + 20);
    }

    const subtotalPosition = position + 30;
    generateTableRow(
      doc,
      subtotalPosition,
      "",
      "",
      "Subtotal",
      formatCurrency(order.subtotal)
    );
    const discountPosition = subtotalPosition + 20;
    generateTableRow(
      doc,
      discountPosition,
      "",
      "",
      "Discount",
      formatCurrency(order.discount)
    );
    const shippingPosition = discountPosition + 20;
    generateTableRow(
      doc,
      shippingPosition,
      "",
      "",
      "Shipping",
      formatCurrency(40)
    );
    const grandTotalPosition = shippingPosition + 25;
    doc.font("Helvetica-Bold");
    generateTableRow(
      doc,
      grandTotalPosition,
      "",
      "",
      "Grand Total",
      formatCurrency(order.grandTotal)
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

function formatCurrency(cents) {
  return "₹" + cents.toFixed(2);
}

function generateTableRow(doc, y, item, quantity, unitCost, lineTotal) {
  doc
    .fontSize(10)
    .text(item, 50, y)
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
