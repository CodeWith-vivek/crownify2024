const Order = require("../models/orderSchema"); 
const PDFDocument = require("pdfkit");
const fs = require("fs");

const generateSalesReport = async (req, res) =>  {
  const { type, startDate, endDate } = req.body; 

  try {
    let query = {};
    const today = new Date();

    // Filter based on report type
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
        // Validate and parse dates
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

    // Fetch orders based on the query
    const orders = await Order.find(query);

    // Calculate totals
    const totalSalesCount = orders.length;
    const totalOrderAmount = orders.reduce(
      (total, order) => total + order.grandTotal,
      0
    );
    const totalDiscount = orders.reduce(
      (total, order) => total + order.discount,
      0
    );
    const couponDeductions = orders.reduce((total, order) => {
      return  total + order.discount 
    }, 0);

    // Send the response
    return res.json({
      status: true,
      report: {
        totalSalesCount,
        totalOrderAmount,
        totalDiscount,
        couponDeduction: couponDeductions,
      },
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}
const reportPdf = async (req, res) => {
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
        // Validate and parse dates
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

   
    const totalSalesCount = orders.length;
    const totalOrderAmount = orders.reduce(
      (total, order) => total + order.grandTotal,
      0
    );
    const totalDiscount = orders.reduce(
      (total, order) => total + order.discount,
      0
    );
    const couponDeductions = orders.reduce((total, order) => {
      return total + order.discount;
    }, 0);

   
    const doc = new PDFDocument();
    let filename = `Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader(
      "Content-disposition",
      'attachment; filename="' + filename + '"'
    );
    res.setHeader("Content-type", "application/pdf");

  
    doc.pipe(res);

    // Add title
    doc.fontSize(25).text("Sales Report", { align: "center" });
    doc.moveDown(2);

   
    doc.fontSize(12);
    const tableTop = 100;
    const tableBottom = tableTop + 50; 
    const rowHeight = 20;

    // Draw header
    doc.text("Total Sales Count:", 50, tableTop);
    doc.text(totalSalesCount, 300, tableTop);

    doc.text("Total Order Amount:", 50, tableTop + rowHeight);
    doc.text(`₹${totalOrderAmount}`, 300, tableTop + rowHeight);

    doc.text("Total Discount:", 50, tableTop + rowHeight * 2);
    doc.text(`₹${totalDiscount}`, 300, tableTop + rowHeight * 2);

    doc.text("Coupon Deductions:", 50, tableTop + rowHeight * 3);
    doc.text(`₹${couponDeductions}`, 300, tableTop + rowHeight * 3);

    // Add a line to separate the header from the content
    doc.moveTo(50, tableBottom).lineTo(550, tableBottom).stroke();

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

module.exports = {
  generateSalesReport,
  reportPdf
};
