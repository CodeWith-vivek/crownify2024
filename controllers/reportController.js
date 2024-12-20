const Order = require("../models/orderSchema"); 
const Product =require("../models/productSchema")
const Category =require("../models/categorySchema")
const PDFDocument = require("pdfkit");
const path = require("path");



const fs = require("fs");
const User = require("../models/userSchema");



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
const getOverallRevenue = async (req, res) => {
  try {
    console.log("Fetching overall revenue...");

    // Fetch and calculate the total revenue
    const overallRevenue = await Order.aggregate([
      {
        $group: {
          _id: null, // Group all orders together
          totalRevenue: { $sum: "$grandTotal" }, // Sum of grandTotal
          totalDiscount: { $sum: "$discount" }, // Sum of discounts (assuming you have a discount field)
        },
      },
    ]);

    console.log("Overall revenue data:", overallRevenue);

    // Check if there is any revenue data
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

    // Extract results
    const { totalRevenue, totalDiscount } = overallRevenue[0];
    const netRevenue = totalRevenue - totalDiscount;

    console.log("Total Revenue:", totalRevenue);
    console.log("Total Discount:", totalDiscount);
    console.log("Net Revenue:", netRevenue);

    // Respond with the calculated revenue
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
const salesChart=async (req,res)=>{
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

   // Prepare data for the chart
   const labels = []; // This will hold the labels for the chart
   const revenue = []; // This will hold the revenue data
   const orderCounts = []; // This will hold the order counts

   // Calculate totals based on the timeframe
   if (type === "daily") {
     labels.push(today.toLocaleDateString());
     revenue.push(orders.reduce((total, order) => total + order.grandTotal, 0));
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

   // Send the response in the required format
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
const getTotalOrders = async (req, res) => {
  try {
    // Fetch total count of orders
    const totalOrders = await Order.countDocuments({});

    // Respond with the total order count
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
    console.log("Received request to fetch total products.");

    // Fetch total count of products
    const totalProducts = await Product.countDocuments({});
    console.log("Total products count fetched:", totalProducts);

    // Respond with the total product count
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
    // Fetch total count of categories
    const totalCategories = await Category.countDocuments({});

    // Respond with the total category count
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
const generateInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;

    // Fetch the order and user details
    const order = await Order.findOne({ orderNumber: orderId, userId })
      .populate("items.productId")
      .populate("shippingAddress")
      .exec();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const user = await User.findById(userId);

    // Create a new PDF document
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Invoice_${order.orderNumber}.pdf`;
    const filePath = path.join(__dirname, "../public/invoices", fileName);

    // Create invoices directory if it doesn't exist
    const dirPath = path.join(__dirname, "../public/invoices");
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (dirError) {
      console.error("Error creating directory:", dirError);
      return res.status(500).send("Error creating invoice directory");
    }

    // Logo path
    const logoPath = path.join(
      __dirname,
      "../public/assets/images/logoCrownify.png"
    );

    // Stream the PDF to a file
    const stream = fs.createWriteStream(filePath);
    stream.on("error", (streamError) => {
      console.error("Stream error:", streamError);
      res.status(500).send("Error generating invoice");
    });

    doc.pipe(stream);

    // Add logo
    try {
      doc.image(logoPath, 50, 45, { width: 50 });
    } catch (error) {
      console.warn("Logo image not found, proceeding without it.");
    }

    // Add company information
    doc
      .fillColor("#444444")
      .fontSize(20)
      .text("Crownify", 110, 57)
      .fontSize(10)
      .text("123 Main Street", 200, 65, { align: "right" })
      .text("New York, NY, 10025", 200, 80, { align: "right" })
      .moveDown();

    // Add invoice title
    doc.fontSize(18).text("Invoice", 50, 160);
    generateHr(doc, 185);

    // Add order details
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
      

    // Add table header
    let i;
    const invoiceTableTop = 330;
    generateTableRow(
      doc,
      invoiceTableTop,
      "Item",
      "Quantity",
      "Unit Price",
      "Total"
    );
    generateHr(doc, invoiceTableTop + 20);

    // Add table content
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

    // Add totals
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
      formatCurrency(order.shipping)
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

    // Add footer
    doc.fontSize(10).text("Thank you for shopping with Crownify!", 50, 700, {
      align: "center",
      width: 500,
    });

    // Finalize the PDF and close the stream
    doc.end();

    // Send the file as a download
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
  return "₹" + (cents ).toFixed(2);
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
  
};
