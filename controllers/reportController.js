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
    // Validate input for custom date range
    if (type === "custom" && (!startDate || !endDate)) {
      return res.status(400).json({
        status: false,
        message: "Start date and end date are required for custom reports",
      });
    }

    // Get all orders for the period without pagination
    let query = {};
    const today = new Date();

    // Date range query logic based on the report type
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

    // Fetch orders with detailed product information
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

    // Process orders data for Excel
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

    // Calculate summary data
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

    // Create workbook and worksheets
    const workbook = xlsx.utils.book_new();

    // Detailed orders worksheet
    const detailsWorksheet = xlsx.utils.json_to_sheet(processedData);

    // Summary worksheet
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

    // Apply styling
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4472C4" } },
      alignment: { horizontal: "center" },
    };

    const currencyStyle = { numFmt: '"₹"#,##0.00' };

    // Apply styles to details worksheet
    const detailsRange = xlsx.utils.decode_range(detailsWorksheet["!ref"]);
    for (let C = detailsRange.s.c; C <= detailsRange.e.c; ++C) {
      const headerCell = xlsx.utils.encode_cell({ r: 0, c: C });
      detailsWorksheet[headerCell].s = headerStyle;
    }

    // Set column widths
    detailsWorksheet["!cols"] = [
      { wch: 12 }, // Order Number
      { wch: 12 }, // Date
      { wch: 30 }, // Product Name
      { wch: 15 }, // Brand
      { wch: 15 }, // Category
      { wch: 10 }, // Color
      { wch: 10 }, // Size
      { wch: 10 }, // Quantity
      { wch: 12 }, // Regular Price
      { wch: 12 }, // Sale Price
      { wch: 12 }, // Item Discount
      { wch: 12 }, // Coupon Discount
      { wch: 12 }, // Shipping
      { wch: 12 }, // Item Total
    ];

    // Add worksheets to workbook
    xlsx.utils.book_append_sheet(workbook, detailsWorksheet, "Order Details");
    xlsx.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");

    // Generate Excel file
    const excelBuffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Set response headers
    const filename = `Sales_Report_${type}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Send the file
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

// Helper function to get report period
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

        // Date range query logic based on the report type
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

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(query);
        if (totalOrders === 0) {
            return res.json({
                status: true,
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

        // Fetch orders with detailed product information
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

        // // Calculate totals for all orders
      
        let totalQuantity = 0;
        let totalRegularPrice = 0; // New variable for total regular price
        let totalSalePrice = 0; // New variable for total sale price
        let totalItemDiscount = 0; // New variable for total item discount
        let totalCouponDiscount = 0; // New variable for total coupon discount
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
            totalRegularPrice += item.regularPrice * item.quantity; // Accumulate regular price
            totalSalePrice += item.salePrice * item.quantity; // Accumulate sale price
            totalItemDiscount +=
              (item.regularPrice - item.salePrice) * item.quantity; // Accumulate item discount
            totalCouponDiscount += order.discount / order.items.length; // Accumulate coupon discount
            totalItemTotal += itemTotal; // Accumulate item total
            totalShipping += shipping; // Accumulate shipping
            totalOrderTotal += itemTotal + shipping; // Accumulate order total

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
            totalRegularPrice, // Add total regular price to the totals
            totalSalePrice, // Add total sale price to the totals
            totalItemDiscount, // Add total item discount to the totals
            totalCouponDiscount, // Add total coupon discount to the totals
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
        return res.status(500).json({ status: false, message: "Internal server error" });
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

    // Use the same date query logic from your original report generation
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
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
        break;
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

    // Calculate totals
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

    const reportData = orders.map((order) => {
      const orderDetails = {
        orderNumber: order.orderNumber,
        date: order.orderedAt.toISOString().split("T")[0],
        items: order.items.map((item) => {
          const product = item.productId;
          const variant = product.variants[0];
          const itemTotal = item.salePrice * item.quantity;
          const shipping = order.shipping / order.items.length;

          // Update totals
          totals.totalQuantity += item.quantity;
          totals.totalRegularPrice += item.regularPrice * item.quantity;
          totals.totalSalePrice += item.salePrice * item.quantity;
          totals.totalItemDiscount +=
            (item.regularPrice - item.salePrice) * item.quantity;
          totals.totalCouponDiscount += order.discount / order.items.length;
          totals.totalItemTotal += itemTotal;
          totals.totalShipping += shipping;
          totals.totalOrderTotal += itemTotal + shipping;

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
        }),
      };
      return orderDetails;
    });

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

    // Generate PDF content
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
  // Header
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("SALES REPORT", { align: "center" })
    .fontSize(14)
    .font("Helvetica")
    .text(getReportPeriodText(type, startDate, endDate), { align: "center" });

  doc.moveDown(1);

  // Summary Section
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Summary", { align: "center", underline: true });

  doc.moveDown(0.5);

  // Format numbers for summary
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

  // Add a new page for Order Details
  doc.addPage();

  // Order Details Section
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Order Details", { align: "center", underline: true });

  doc.moveDown(0.5);

  // Define column widths as percentages of the table width
  const columnWidths = {
    orderNumber: 0.1, // 10%
    name: 0.2, // 20%
    brand: 0.1, // 10%
    category: 0.1, // 10%
    quantity: 0.07, // 7%
    salePrice: 0.1, // 10%
    itemDiscount: 0.11, // 11%
    shipping: 0.07, // 7%
    couponDiscount: 0.08, // 8%
    total: 0.07, // 7%
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
      "Coupon ",
      "Total",
    ],
    columnWidths,
    rows: [],
  };

  // Prepare order details rows
  reportData.forEach((order) => {
    order.items.forEach((item) => {
      orderTable.rows.push([
        order.orderNumber,
        item.name,
        item.brand,
        item.category,
        item.quantity.toString(),
        item.salePrice,
        item.itemDiscount * item.quantity,
        item.shipping,
        item.couponDiscount,
        item.itemTotal,
      ]);
    });
  });

  generateTable(doc, orderTable, false);
};




const generateTable = (doc, tableData, isSimpleTable) => {
  const { headers, rows, columnWidths } = tableData;
  const tablePadding = 10;
  const cellPadding = 5;
  const fontSize = 7; // Font size
  const extraRowSpace = 10; // Additional space after each row
  const tableWidth = doc.page.width - 2 * tablePadding;

  let startX = tablePadding;
  let startY = doc.y + cellPadding;

  // Calculate column widths
  let colWidths;
  if (isSimpleTable) {
    colWidths = headers.map(() => tableWidth / headers.length);
  } else {
    colWidths = Object.values(columnWidths).map((width) => tableWidth * width);
  }

  // Function to draw table header
  const drawTableHeader = () => {
    doc.fontSize(fontSize).font("Helvetica-Bold"); // Set font size and bold font for header
    let x = startX;
    headers.forEach((header, i) => {
      doc.text(header, x, startY, {
        width: colWidths[i],
        align: "center", // Center-align the header
        lineBreak: false,
      });
      x += colWidths[i];
    });

    // Draw header separator line
    doc
      .moveTo(startX, startY + fontSize + 2)
      .lineTo(startX + tableWidth, startY + fontSize + 2)
      .stroke();

    return startY + fontSize + cellPadding;
  };

  // Draw initial header
  startY = drawTableHeader();

  // Draw rows
  doc.font("Helvetica").fontSize(fontSize); // Set font size for rows

  let rowCount = 0; // Initialize row count

  rows.forEach((row) => {
    const rowHeight = fontSize + cellPadding + extraRowSpace; // Increased row height

    // Check if we need a new page
    if (rowCount >= 30) {
      // Limit to 10 rows per page
      doc.addPage();
      startY = tablePadding;
      startY = drawTableHeader();
      rowCount = 0; // Reset row count for new page
    }

    let x = startX;
    row.forEach((cell, i) => {
      // Truncate long text and add ellipsis if necessary
      let cellText = cell.toString();
      const maxWidth = colWidths[i] - cellPadding;

      doc.text(cellText, x, startY, {
        width: maxWidth,
        align: "center", // Center-align the cell text
        lineBreak: false,
        ellipsis: true,
      });

      x += colWidths[i];
    });

    startY += rowHeight; // Move down by the new row height
    rowCount++; // Increment row count
  });

  // Update document Y position
  doc.y = startY + cellPadding;
};
const getReportPeriodText = (type, startDate, endDate) => {
  const today = new Date();
  switch (type) {
    case "daily":
      return `Daily Report - ${today.toLocaleDateString()}`;
    case "weekly":
      return `Weekly Report - Week of ${today.toLocaleDateString()}`;
    case "monthly":
      return `Monthly Report - ${today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      })}`;
    case "yearly":
      return `Yearly Report - ${today.getFullYear()}`;
    case "custom":
      return `Custom Report (${new Date(
        startDate
      ).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()})`;
    default:
      return "Sales Report";
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
