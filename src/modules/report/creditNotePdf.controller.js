const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Order = require("../order/orderSchema");
const User = require("../user/userSchema");
const { generateHr, formatINR, generateTableRow } = require("./helpers/pdfPrimitives");

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

module.exports = { generateCreditNotePDF };
