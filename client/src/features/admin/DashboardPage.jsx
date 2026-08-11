import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { IndianRupee, ShoppingBag, Package, FolderTree } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { reportApi } from "./report/reportApi";

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="rounded-full bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-1 h-6 w-20" /> : <p className="text-2xl font-bold text-primary">{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-primary">Dashboard</h1>
        <Button asChild variant="outline">
          <Link to="/admin/sales-report">Sales Report</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={IndianRupee}
          label="Net Revenue"
          loading={revenueQuery.isLoading}
          value={`₹${revenueQuery.data?.revenue?.netRevenue ?? 0}`}
        />
        <StatCard icon={ShoppingBag} label="Total Orders" loading={ordersQuery.isLoading} value={ordersQuery.data?.totalOrders ?? 0} />
        <StatCard icon={Package} label="Total Products" loading={productsQuery.isLoading} value={productsQuery.data?.totalProducts ?? 0} />
        <StatCard
          icon={FolderTree}
          label="Total Categories"
          loading={categoriesQuery.isLoading}
          value={categoriesQuery.data?.totalCategories ?? 0}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Revenue This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {chartQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#291616" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No sales data for this month yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSellingQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              topSellingQuery.data?.data?.topProducts?.slice(0, 5).map((p) => (
                <div key={p._id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.productName}</span>
                  <span className="font-medium text-primary">{p.salesCount}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSellingQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              topSellingQuery.data?.data?.topCategories?.slice(0, 5).map((c) => (
                <div key={c._id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.categoryName}</span>
                  <span className="font-medium text-primary">{c.salesCount}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Brands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSellingQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              topSellingQuery.data?.data?.topBrands?.slice(0, 5).map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{b.brandName}</span>
                  <span className="font-medium text-primary">{b.salesCount}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
