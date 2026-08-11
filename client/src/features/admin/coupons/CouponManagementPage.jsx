import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApi } from "../adminApi";

const emptyForm = {
  code: "",
  discountType: "percentage",
  discountAmount: "",
  maxDiscount: "",
  minPurchase: "",
  expiryDate: "",
  usageLimit: "",
  description: "",
};

export function CouponManagementPage() {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => adminApi.couponManagement(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await adminApi.addCoupon(form);
      if (res?.success) {
        toast.success("Coupon added");
        setForm(emptyForm);
        await refresh();
      } else {
        toast.error(res?.message || "Could not add coupon");
      }
    } catch (err) {
      toast.error(err.message || "Could not add coupon");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await adminApi.deleteCoupon(id);
      if (res?.success) {
        toast.success("Coupon deleted");
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Could not delete coupon");
    }
  };

  const openEdit = async (coupon) => {
    setEditing({
      _id: coupon._id,
      couponCode: coupon.code,
      discountType: coupon.discountType,
      discountAmount: coupon.discountAmount,
      maxDiscount: coupon.maxDiscount || "",
      minPurchase: coupon.minPurchase,
      expiryDate: coupon.expiryDate?.slice(0, 10),
      usageLimit: coupon.usageLimit,
      description: coupon.description || "",
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await adminApi.updateCoupon(editing._id, editing);
      if (res?.message) {
        toast.success(res.message);
        setEditing(null);
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Could not update coupon");
    }
  };

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Coupons</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Add Coupon</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input placeholder="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value })}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </select>
            <Input placeholder="Discount amount" type="number" required value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} />
            <Input placeholder="Max discount" type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
            <Input placeholder="Min purchase" type="number" required value={form.minPurchase} onChange={(e) => setForm({ ...form, minPurchase: e.target.value })} />
            <Input placeholder="Usage limit" type="number" required value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
            <Input type="date" required value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            <Input placeholder="Description" className="sm:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button type="submit">Add Coupon</Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="mt-6 h-64 w-full" />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min Purchase</TableHead>
                <TableHead>Usage Limit</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.coupons?.map((c) => (
                <TableRow key={c._id}>
                  <TableCell>
                    <Badge>{c.code}</Badge>
                  </TableCell>
                  <TableCell>
                    {c.discountType === "percentage" ? `${c.discountAmount}%` : `₹${c.discountAmount}`}
                  </TableCell>
                  <TableCell>₹{c.minPurchase}</TableCell>
                  <TableCell>{c.usageLimit}</TableCell>
                  <TableCell>{new Date(c.expiryDate).toLocaleDateString()}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c._id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Coupon</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleUpdate} className="space-y-3">
              <Input value={editing.couponCode} onChange={(e) => setEditing({ ...editing, couponCode: e.target.value })} />
              <Input type="number" value={editing.discountAmount} onChange={(e) => setEditing({ ...editing, discountAmount: e.target.value })} />
              <Input type="number" value={editing.minPurchase} onChange={(e) => setEditing({ ...editing, minPurchase: e.target.value })} />
              <Input type="number" value={editing.usageLimit} onChange={(e) => setEditing({ ...editing, usageLimit: e.target.value })} />
              <Input type="date" value={editing.expiryDate} onChange={(e) => setEditing({ ...editing, expiryDate: e.target.value })} />
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
