const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Order = require("../order/orderSchema");
const User = require("../user/userSchema");
const { computeOrderFinancials } = require("../../shared/utils/orderFinancials");
const { generateHr, formatINR, generateTableRow } = require("./helpers/pdfPrimitives");

// Items in these states were never actually billed to the customer — a
// cancelled line item has no valid tax transaction behind it, and a failed
// payment means nothing was collected. A "Tax Invoice" that includes them
// would be claiming a sale that didn't happen. Returned items stay ON the
// invoice (the original sale did happen); their refund gets its own Credit
// Note document instead — see creditNotePdf.controller.js.
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

module.exports = { generateInvoicePDF, INVOICE_EXCLUDED_STATUSES };
