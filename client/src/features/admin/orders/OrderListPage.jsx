import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminApi } from "../adminApi";

const STATUS_OPTIONS = ["Placed", "Shipped", "Delivered", "Returned", "Canceled", "Return Requested"];

export function OrderListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", page, search],
    queryFn: () => adminApi.orders(page, search),
  });

  const handleStatusChange = async (order, item, newStatus) => {
    try {
      const res = await adminApi.updateOrderStatus({
        orderId: order._id,
        productSize: item.variant?.size,
        productColor: item.variant?.color,
        newStatus,
      });
      if (res?.success) {
        toast.success("Status updated");
        await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      } else {
        toast.error(res?.message || "Could not update status");
      }
    } catch (err) {
      toast.error(err.message || "Could not update status");
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-primary">Orders</h1>
        <Input
          placeholder="Search orders..."
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-96 w-full" />
      ) : (
        <div className="mt-6 space-y-6">
          {data?.orders?.map((order) => (
            <div key={order._id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <p className="font-medium">#{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.userId?.name} — {order.userId?.email}
                  </p>
                </div>
                <p className="font-semibold text-primary">₹{order.grandTotal}</p>
              </div>

              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Update</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        {item.variant?.color} / {item.variant?.size}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.orderStatus}</Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          className="rounded-md border bg-background px-2 py-1 text-xs"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) handleStatusChange(order, item, e.target.value);
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            Change status
                          </option>
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/orderDetails/${order._id}?itemId=${item._id}`}>Details</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {data?.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: data.totalPages }).map((_, i) => (
            <Button key={i} size="sm" variant={data.currentPage === i + 1 ? "default" : "outline"} onClick={() => setPage(i + 1)}>
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
