import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "../adminApi";

export function BrandPage() {
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const fileRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-brands", page],
    queryFn: () => adminApi.brands(page),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-brands"] });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!fileRef.current?.files?.[0]) {
      toast.error("Please choose a brand image");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("image", fileRef.current.files[0]);
      const res = await adminApi.addBrand(formData);
      if (res?.success) {
        toast.success("Brand added");
        setName("");
        fileRef.current.value = "";
        await refresh();
      } else {
        toast.error(res?.message || "Could not add brand");
      }
    } catch (err) {
      toast.error(err.message || "Could not add brand");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (action, id) => {
    try {
      const res = await action(id);
      if (res?.success) {
        toast.success(res.message);
        await refresh();
      } else {
        toast.error(res?.message || "Action failed");
      }
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Brands</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Add Brand</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-3">
            <Input placeholder="Brand name" required value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
            <input ref={fileRef} type="file" accept="image/*" required className="text-sm" />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Brand"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="mt-6 h-64 w-full" />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {data?.data?.map((brand) => (
            <Card key={brand._id}>
              <CardContent className="p-4 text-center">
                <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-muted">
                  {brand.brandImage?.[0] && (
                    <img src={`/uploads/re-image/${brand.brandImage[0]}`} alt={brand.brandName} className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="mt-2 font-medium">{brand.brandName}</p>
                <Badge variant={brand.isBlocked ? "destructive" : "outline"} className="mt-1">
                  {brand.isBlocked ? "Blocked" : "Active"}
                </Badge>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(brand.isBlocked ? adminApi.unblockBrand : adminApi.blockBrand, brand._id)}
                  >
                    {brand.isBlocked ? "Unblock" : "Block"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction(adminApi.deleteBrand, brand._id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
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
