/**
 * Single source of truth for sales-report date ranges.
 *
 * This logic used to be copy-pasted into four places (generateSalesReport,
 * salesChart, reportPdf, downloadExcel), each with slightly different bugs:
 *
 *  - "monthly" ended at `new Date(y, m+1, 0)` — midnight on the last day of
 *    the month, so every order placed ON the last day was excluded.
 *  - "yearly" ended at `new Date(y, 11, 31)` — midnight on Dec 31, so the
 *    whole of Dec 31 was excluded.
 *  - "weekly" never normalised hours, so the window started/ended at the
 *    current time of day rather than covering whole days.
 *  - "custom" in generateSalesReport/salesChart used the raw `new Date(endDate)`
 *    (midnight), silently dropping the entire end day the admin selected.
 *  - "daily" called `today.setHours(...)` twice, mutating the shared `today`
 *    between the two reads.
 *
 * Returns { start, end } as inclusive Date boundaries, or null when the type
 * is unknown, plus a human label for report headers.
 */

function startOfDay(d) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d) {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function resolveReportRange(type, startDate, endDate, now = new Date()) {
  switch (type) {
    case "daily":
      return { start: startOfDay(now), end: endOfDay(now) };

    case "weekly": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(now);
      end.setDate(now.getDate() + (6 - now.getDay()));
      return { start: startOfDay(start), end: endOfDay(end) };
    }

    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      // Day 0 of next month === last day of this month.
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }

    case "yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start: startOfDay(start), end: endOfDay(end) };
    }

    case "custom": {
      if (!startDate || !endDate) {
        return { error: "Start date and end date are required for custom reports" };
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return { error: "Invalid date format" };
      }
      if (start > end) {
        return { error: "Start date must be before end date" };
      }
      return { start: startOfDay(start), end: endOfDay(end) };
    }

    default:
      return { error: "Invalid report type" };
  }
}

/** Human-readable period label used in PDF/Excel headers. */
function describeRange(type, range) {
  const fmt = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (!range || !range.start || !range.end) return String(type || "");
  const label = String(type || "").charAt(0).toUpperCase() + String(type || "").slice(1);
  return `${label}: ${fmt(range.start)} - ${fmt(range.end)}`;
}

module.exports = { resolveReportRange, describeRange, startOfDay, endOfDay };
