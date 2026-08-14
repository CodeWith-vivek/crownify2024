const PDFDocument = require("pdfkit");
const reportService = require("./report.service");
const { sendError } = require("../../shared/errors/respond");

// PDF export of the admin sales report. Uses its own percentage-width
// table renderer (generateTable below) rather than the fixed-column
// primitives in helpers/pdfPrimitives.js — those are sized for the
// portrait invoice/credit-note layout and can't fit this report's ten
// landscape columns.

// Report amounts were printed as bare numbers with full float precision
// (e.g. "13.333333333333334" for an apportioned shipping share). "Rs." rather
// than the rupee sign because PDFKit's built-in Helvetica has no glyph for
// U+20B9 and silently drops it.
const money = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const isNumericCol = (i) => (isSimpleTable ? i === 1 : i >= 4);

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

const reportPdf = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    // This query previously had NO orderStatus filter, so the PDF counted
    // cancelled, returned and failed items as revenue while the on-screen
    // table and the Excel export both counted only Delivered. The three
    // never agreed. All of them now go through reportService.loadSalesData,
    // and returns are booked separately by when they were processed — see
    // helpers/salesQuery.js and shared/utils/salesAggregate.js.
    const {
      orders: reportData,
      returnRows,
      totals,
    } = await reportService.loadSalesData({ type, startDate, endDate });

    if (reportData.length === 0 && returnRows.length === 0) {
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
      returnRows
    );

    doc.end();
  } catch (error) {
    return sendError(res, error, "Error generating PDF report", { flag: "status" });
  }
};

module.exports = { reportPdf };
