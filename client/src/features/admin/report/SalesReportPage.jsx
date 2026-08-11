import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reportApi } from "./reportApi";

const TYPE_OPTIONS = ["daily", "weekly", "monthly", "yearly", "custom"];

export function SalesReportPage() {
  const [type, setType] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const filters = { type, startDate, endDate, page, limit: 10 };
  const enabled = type !== "custom" || (!!startDate && !!endDate);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-sales-report", filters],
    queryFn: () => reportApi.salesReport(filters),
    enabled,
  });

  const handleDownload = async (format) => {
    setDownloading(true);
    try {
      if (format === "pdf") await reportApi.downloadPdf({ type, startDate, endDate });
      else await reportApi.downloadExcel({ type, startDate, endDate });
      toast.success("Download started");
    } catch (err) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const rows = data?.report?.flatMap((order) =>
    order.items.map((item, idx) => ({ ...item, orderNumber: order.orderNumber, date: order.date, key: `${order.orderNumber}-${idx}` }))
  ) || [];

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Sales Report</h1>

      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          {type === "custom" && (
            <>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </>
          )}
          <Button variant="outline" disabled={downloading} onClick={() => handleDownload("pdf")}>
            Download PDF
          </Button>
          <Button variant="outline" disabled={downloading} onClick={() => handleDownload("excel")}>
            Download Excel
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="mt-6 h-96 w-full" />
      ) : isError ? (
        <p className="mt-6 text-muted-foreground">No orders found for the selected criteria.</p>
      ) : (
        <>
          {data?.totals && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Quantity</p>
                  <p className="text-xl font-bold text-primary">{data.totals.totalQuantity}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="text-xl font-bold text-primary">₹{data.totals.totalSalePrice}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Item Discount</p>
                  <p className="text-xl font-bold text-primary">₹{data.totals.totalItemDiscount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Order Total</p>
                  <p className="text-xl font-bold text-primary">₹{Math.round(data.totals.totalOrderTotal)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Item Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.orderNumber}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>₹{row.salePrice}</TableCell>
                    <TableCell>₹{row.itemTotal}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data?.pagination?.totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: data.pagination.totalPages }).map((_, i) => (
                <Button key={i} size="sm" variant={page === i + 1 ? "default" : "outline"} onClick={() => setPage(i + 1)}>
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
