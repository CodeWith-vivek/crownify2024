import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { reportApi } from "./reportApi";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminError } from "@/components/admin/AdminError";

const TYPE_OPTIONS = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "yearly", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function Stat({ icon, tone, label, value, hint }) {
  return (
    <div className="adm-stat">
      <span className={`adm-stat__icon${tone ? ` adm-stat__icon--${tone}` : ""}`}>
        <i className="material-icons">{icon}</i>
      </span>
      <div>
        <p className="adm-stat__label">{label}</p>
        <p className="adm-stat__value">{value}</p>
        {hint && (
          <p className="adm-stat__label" style={{ marginTop: 2, opacity: 0.75 }}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function SalesReportPage() {
  const [type, setType] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const enabled = type !== "custom" || (!!startDate && !!endDate);
  const rangeArgs = { type, startDate, endDate };

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-sales-report", type, startDate, endDate, page],
    queryFn: () => reportApi.salesReport({ ...rangeArgs, page, limit: 10 }),
    enabled,
  });

  // The chart covers the whole selected period, so it must not be re-fetched
  // per page — its key deliberately excludes `page`.
  const chartQuery = useQuery({
    queryKey: ["admin-sales-report-chart", type, startDate, endDate],
    queryFn: () => reportApi.salesChart(rangeArgs),
    enabled,
  });

  const handleDownload = async (format) => {
    setDownloading(true);
    try {
      if (format === "pdf") await reportApi.downloadPdf(rangeArgs);
      else await reportApi.downloadExcel(rangeArgs);
      toast.success(`${format === "pdf" ? "PDF" : "Excel"} download started`);
    } catch (err) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const totals = data?.totals;
  const rows =
    data?.report?.flatMap((order) =>
      order.items.map((item, idx) => ({
        ...item,
        orderNumber: order.orderNumber,
        date: order.date,
        key: `${order.orderNumber}-${idx}`,
      }))
    ) || [];

  const returnRows = data?.returns || [];

  const series = chartQuery.data?.series;
  const chartData =
    series?.labels?.map((label, i) => ({
      label,
      revenue: series.revenue[i],
      orders: series.orders[i],
    })) || [];

  const hasData = (totals?.totalOrders ?? 0) > 0 || returnRows.length > 0;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Sales Report</h1>
          <p>
            {data?.period?.label
              ? `${data.period.label} · sales booked when ordered, returns booked when processed`
              : "Review performance over a period and export the data."}
          </p>
        </div>
        <div className="adm-page-head__actions">
          <button
            className="btn btn-secondary"
            disabled={downloading || !hasData}
            onClick={() => handleDownload("pdf")}
          >
            <i className="material-icons">picture_as_pdf</i>
            PDF
          </button>
          <button
            className="btn btn-secondary"
            disabled={downloading || !hasData}
            onClick={() => handleDownload("excel")}
          >
            <i className="material-icons">table_view</i>
            Excel
          </button>
        </div>
      </div>

      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div
          className="adm-card__body"
          style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <div style={{ minWidth: 180 }}>
            <label className="form-label">Period</label>
            <select
              className="form-select"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {type === "custom" && (
            <>
              <div style={{ minWidth: 170 }}>
                <label className="form-label">From</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div style={{ minWidth: 170 }}>
                <label className="form-label">To</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {!enabled ? (
        <div className="adm-card">
          <div className="adm-empty">
            <i className="material-icons">date_range</i>
            <p style={{ margin: 0 }}>Pick a start and end date to run the report.</p>
          </div>
        </div>
      ) : isError ? (
        // A failed request is NOT the same as "no sales". The old page showed
        // "No orders found" for both, so a server outage looked like a period
        // with zero revenue.
        <AdminError
          title="Couldn't load the sales report"
          message="We couldn't reach the server, so no figures can be shown. Please try again."
          onRetry={refetch}
        />
      ) : (
        <>
          {totals && (
            <div className="adm-stats">
              <Stat
                icon="payments"
                tone="success"
                label="Net revenue"
                value={inr(totals.netRevenue)}
                hint="after coupon discounts"
              />
              <Stat
                icon="receipt_long"
                tone="info"
                label="Orders"
                value={totals.totalOrders ?? 0}
                hint={`${totals.totalQuantity ?? 0} items sold`}
              />
              <Stat
                icon="trending_up"
                label="Avg order value"
                value={inr(totals.averageOrderValue)}
              />
              <Stat
                icon="local_offer"
                tone="warning"
                label="Total discounts"
                value={inr((totals.totalItemDiscount || 0) + (totals.totalCouponDiscount || 0))}
                hint="product + coupon"
              />
              <Stat
                icon="assignment_return"
                tone="warning"
                label="Returns this period"
                value={inr(totals.totalReturns)}
                hint={
                  totals.totalReturnedItems
                    ? `${totals.totalReturnedItems} item(s) — processed here, may have sold earlier`
                    : "none processed"
                }
              />
            </div>
          )}

          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__head">
              <h2>Revenue trend</h2>
            </div>
            <div className="adm-card__body" style={{ height: 300 }}>
              {chartQuery.isLoading ? (
                <div className="adm-empty">Loading chart…</div>
              ) : chartData.length === 0 ? (
                <div className="adm-empty">No data to plot for this period.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="salesRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc0909" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#dc0909" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={(v) => inr(v)} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "revenue" ? [inr(value), "Revenue"] : [value, "Orders"]
                      }
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#dc0909"
                      fill="url(#salesRevenue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Qty</th>
                    <th>Sale price</th>
                    <th style={{ textAlign: "right" }}>Item total</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="adm-empty">
                        Loading report…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="adm-empty">
                          <i className="material-icons">receipt</i>
                          <p style={{ margin: 0 }}>
                            No delivered orders in this period.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <span className="adm-cell-title">#{row.orderNumber}</span>
                        </td>
                        <td>
                          <span className="adm-cell-sub">{row.date}</span>
                        </td>
                        <td>
                          <span className="adm-cell-title">{row.name}</span>
                          <span className="adm-cell-sub">{row.brand}</span>
                        </td>
                        <td>
                          <span className="adm-cell-sub">
                            {row.size} · {row.color}
                          </span>
                        </td>
                        <td>{row.quantity}</td>
                        <td>{inr(row.salePrice)}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className="adm-cell-title">{inr(row.itemTotal)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {returnRows.length > 0 && (
            <div className="adm-card" style={{ marginTop: 20 }}>
              <div className="adm-card__head">
                <h2>Returns processed this period</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--adm-text-muted, #6b7280)" }}>
                  Dated by when the return was processed — the original sale may have happened in
                  an earlier period and still appears in that period's report above.
                </p>
              </div>
              <div className="adm-tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Return date</th>
                      <th>Product</th>
                      <th>Variant</th>
                      <th>Qty</th>
                      <th style={{ textAlign: "right" }}>Refunded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnRows.map((row, idx) => (
                      <tr key={`${row.orderNumber}-${idx}`}>
                        <td>
                          <span className="adm-cell-title">#{row.orderNumber}</span>
                        </td>
                        <td>
                          <span className="adm-cell-sub">{row.date}</span>
                        </td>
                        <td>
                          <span className="adm-cell-title">{row.name}</span>
                          <span className="adm-cell-sub">{row.brand}</span>
                        </td>
                        <td>
                          <span className="adm-cell-sub">
                            {row.size} · {row.color}
                          </span>
                        </td>
                        <td>{row.quantity}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className="adm-cell-title" style={{ color: "#dc0909" }}>
                            −{inr(Math.abs(row.itemTotal))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AdminPagination
            currentPage={page}
            totalPages={data?.pagination?.totalPages || 1}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
