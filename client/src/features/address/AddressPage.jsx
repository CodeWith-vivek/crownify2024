import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { addressApi } from "./addressApi";

const emptyForm = {
  addressType: "Home",
  name: "",
  country: "India",
  phone: "",
  pincode: "",
  home: "",
  area: "",
  landmark: "",
  town: "",
  state: "",
};

export function AddressPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["addresses"],
    queryFn: addressApi.list,
  });

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["addresses"] });

  const startEdit = (addr) => {
    setEditingId(addr._id);
    setShowAddForm(false);
    setForm({
      addressType: addr.addressType,
      name: addr.fullName,
      country: addr.country,
      phone: addr.mobileNumber,
      pincode: addr.postalCode,
      home: addr.flatHouseCompany,
      area: addr.areaStreet,
      landmark: addr.landmark || "",
      town: addr.city,
      state: addr.state,
    });
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowAddForm(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await addressApi.update(editingId, form);
        toast.success("Address updated");
      } else {
        await addressApi.add(form);
        toast.success("Address added");
      }
      cancelForm();
      await refresh();
    } catch (err) {
      toast.error(err.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await addressApi.delete(id);
      toast.success("Address deleted");
      await refresh();
    } catch (err) {
      toast.error(err.message || "Could not delete address");
    }
  };

  const handleSetPrimary = async (id) => {
    try {
      const res = await addressApi.setPrimary(id);
      if (res?.success) {
        toast.success("Primary address updated");
        await refresh();
      } else {
        toast.error(res?.message || "Could not update primary address");
      }
    } catch (err) {
      toast.error(err.message || "Could not update primary address");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Could not load addresses.
      </div>
    );
  }

  const addresses = data?.user?.addresses || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-primary">Addresses</h1>
        {!showAddForm && !editingId && (
          <Button onClick={() => setShowAddForm(true)} disabled={addresses.length >= 4}>
            Add Address
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {addresses.map((addr) => (
          <Card key={addr._id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{addr.fullName}</p>
                  <Badge variant="outline">{addr.addressType}</Badge>
                  {addr.isPrimary && <Badge>Primary</Badge>}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {addr.flatHouseCompany}, {addr.areaStreet}
                  {addr.landmark ? `, ${addr.landmark}` : ""}, {addr.city}, {addr.state} - {addr.postalCode}
                </p>
                <p className="text-muted-foreground">{addr.mobileNumber}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {!addr.isPrimary && (
                  <Button size="sm" variant="outline" onClick={() => handleSetPrimary(addr._id)}>
                    <Star className="mr-1 h-3 w-3" /> Set Primary
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => startEdit(addr)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(addr._id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {addresses.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground">No addresses saved yet.</p>
        )}
      </div>

      {(showAddForm || editingId) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Address" : "New Address"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2"
                value={form.addressType}
                onChange={(e) => setForm({ ...form, addressType: e.target.value })}
              >
                <option value="Home">Home</option>
                <option value="Office">Office</option>
                <option value="Other">Other</option>
              </select>
              <Input placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Flat / House / Company" required value={form.home} onChange={(e) => setForm({ ...form, home: e.target.value })} />
              <Input placeholder="Area / Street" required value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              <Input placeholder="Landmark" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
              <Input placeholder="Town / City" required value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} />
              <Input placeholder="State" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <Input placeholder="Pincode" required value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
