// Low-level PDFKit drawing primitives shared by the two customer-facing
// documents (Tax Invoice and Credit Note), which use the same fixed-column
// layout. The sales-report PDF does NOT use these — it has its own
// percentage-width table renderer for its far wider landscape tables.

function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

// Amounts used to be printed as bare numbers (no currency symbol, no fixed
// decimals) — indistinguishable from any other currency, and JS float math
// on the totals could render something like "3190.5000000004".
//
// "Rs." rather than the ₹ sign because PDFKit's built-in Helvetica has no
// glyph for U+20B9 and silently drops it.
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

module.exports = { generateHr, formatINR, generateTableRow };
