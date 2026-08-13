import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { reportApi } from "./report/reportApi";
import { usePageAssets } from "@/lib/usePageAssets";
import { adminProfiles } from "@/styles/adminProfiles";
import { AdminError } from "@/components/admin/AdminError";
import { inr } from "@/lib/format";

function StatCard({ icon, tone, label, value, loading }) {
  return (
    <div className="adm-stat">
      <span className={`adm-stat__icon${tone ? ` adm-stat__icon--${tone}` : ""}`}>
        <i className="material-icons">{icon}</i>
      </span>
      <div>
        <p className="adm-stat__label">{label}</p>
        <p className="adm-stat__value">{loading ? "—" : value}</p>
      </div>
    </div>
  );
}

function TopList({ title, rows, nameKey, loading }) {
  return (
    <div className="adm-card">
      <div className="adm-card__head">{title}</div>
      <div className="adm-card__body" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {loading ? (
          <p style={{ color: "var(--adm-text-muted)", fontSize: 14, margin: "12px 0" }}>Loading…</p>
        ) : rows?.length ? (
          rows.slice(0, 5).map((row, i) => (
            <div className="adm-list-row" key={row._id || i}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: "var(--adm-surface-2)",
                    color: "var(--adm-text-muted)",
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[nameKey]}</span>
              </span>
              <span className="adm-list-row__value">{row.salesCount}</span>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--adm-text-muted)", fontSize: 14, margin: "12px 0" }}>No data yet.</p>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  usePageAssets("admin", "headerdashboard", adminProfiles);

  const revenueQuery = useQuery({ queryKey: ["admin-overall-revenue"], queryFn: reportApi.overallRevenue });
  const ordersQuery = useQuery({ queryKey: ["admin-total-orders"], queryFn: reportApi.totalOrders });
  const productsQuery = useQuery({ queryKey: ["admin-total-products"], queryFn: reportApi.totalProducts });
  const categoriesQuery = useQuery({ queryKey: ["admin-total-categories"], queryFn: reportApi.totalCategories });
  const topSellingQuery = useQuery({ queryKey: ["admin-top-selling"], queryFn: reportApi.topSellingStats });
  const chartQuery = useQuery({
    queryKey: ["admin-sales-chart"],
    queryFn: () => reportApi.salesChart({ type: "monthly" }),
  });

  const chartData = chartQuery.data?.monthly
    ? chartQuery.data.monthly.labels.map((label, i) => ({
        label,
        revenue: chartQuery.data.monthly.revenue[i],
        orders: chartQuery.data.monthly.orders[i],
      }))
    : [];

  // Every stat here falls back to 0 when its request fails, so an
  // unreachable server renders a dashboard reporting ₹0 revenue and 0
  // orders — indistinguishable from a real quiet period. When all of them
  // fail (i.e. the API is down, not one flaky widget) say so instead.
  // Partial failures still surface via the global query-error toast.
  const statQueries = [revenueQuery, ordersQuery, productsQuery, categoriesQuery, topSellingQuery, chartQuery];
  if (statQueries.every((q) => q.isError)) {
    return (
      <AdminError
        title="Couldn't load dashboard data"
        message="We couldn't reach the server, so these figures would all read as zero. Nothing has changed — please try again."
        onRetry={() => statQueries.forEach((q) => q.refetch())}
      />
    );
  }

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Store performance at a glance.</p>
        </div>
        <div className="adm-page-head__actions">
          <Link to="/admin/sales-report" className="btn btn-secondary">
            <i className="material-icons">description</i>
            Sales Report
          </Link>
          <Link to="/admin/addProducts" className="btn btn-primary">
            <i className="material-icons">add</i>
            Add Product
          </Link>
        </div>
      </div>

      <div className="adm-stats">
        <StatCard icon="payments" tone="success" label="Net Revenue" loading={revenueQuery.isLoading} value={inr(revenueQuery.data?.revenue?.netRevenue)} />
        <StatCard icon="receipt_long" tone="info" label="Total Orders" loading={ordersQuery.isLoading} value={ordersQuery.data?.totalOrders ?? 0} />
        <StatCard icon="inventory_2" label="Total Products" loading={productsQuery.isLoading} value={productsQuery.data?.totalProducts ?? 0} />
        <StatCard icon="category" tone="warning" label="Categories" loading={categoriesQuery.isLoading} value={categoriesQuery.data?.totalCategories ?? 0} />
      </div>

      <div className="adm-card" style={{ marginBottom: 22 }}>
        <div className="adm-card__head">
          <span>Revenue this month</span>
        </div>
        <div className="adm-card__body">
          {chartQuery.isLoading ? (
            <p style={{ color: "var(--adm-text-muted)", fontSize: 14 }}>Loading chart…</p>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="admRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc0909" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#dc0909" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#98a2b3" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#98a2b3" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", boxShadow: "0 8px 16px rgba(16,24,40,.08)", fontSize: 13 }}
                  formatter={(value, name) => (name === "revenue" ? [inr(value), "Revenue"] : [value, "Orders"])}
                />
                <Area type="monotone" dataKey="revenue" stroke="#dc0909" strokeWidth={2} fill="url(#admRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="adm-empty">
              <i className="material-icons">show_chart</i>
              <p style={{ margin: 0 }}>No sales data for this month yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="adm-grid-2">
        <TopList title="Top products" rows={topSellingQuery.data?.data?.topProducts} nameKey="productName" loading={topSellingQuery.isLoading} />
        <TopList title="Top categories" rows={topSellingQuery.data?.data?.topCategories} nameKey="categoryName" loading={topSellingQuery.isLoading} />
        <TopList title="Top brands" rows={topSellingQuery.data?.data?.topBrands} nameKey="brandName" loading={topSellingQuery.isLoading} />
      </div>
    </>
  );
}
