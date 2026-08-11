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

export function CategoryPage() {
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState(null);
  const [offerCategoryId, setOfferCategoryId] = useState(null);
  const [offerPercentage, setOfferPercentage] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories", page],
    queryFn: () => adminApi.categories(page),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] });

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await adminApi.addCategory(form);
      toast.success("Category added");
      setForm({ name: "", description: "" });
      await refresh();
    } catch (err) {
      toast.error(err.message || "Could not add category");
    }
  };

  const toggleListed = async (cat) => {
    try {
      const res = cat.isListed ? await adminApi.listCategory(cat._id) : await adminApi.unlistCategory(cat._id);
      if (res?.success) {
        toast.success(cat.isListed ? "Category unlisted" : "Category listed");
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await adminApi.editCategory(editing._id, {
        categoryName: editing.name,
        description: editing.description,
      });
      if (res?.success) {
        toast.success("Category updated");
        setEditing(null);
        await refresh();
      } else {
        toast.error(res?.error || "Could not update category");
      }
    } catch (err) {
      toast.error(err.message || "Could not update category");
    }
  };

  const handleApplyOffer = async () => {
    try {
      const res = await adminApi.addCategoryOffer({
        categoryId: offerCategoryId,
        percentage: Number(offerPercentage),
      });
      if (res?.status) {
        toast.success("Offer applied");
        setOfferCategoryId(null);
        setOfferPercentage("");
        await refresh();
      } else {
        toast.error(res?.message || "Could not apply offer");
      }
    } catch (err) {
      toast.error(err.message || "Could not apply offer");
    }
  };

  const handleRemoveOffer = async (categoryId) => {
    try {
      const res = await adminApi.removeCategoryOffer(categoryId);
      if (res?.status) {
        toast.success("Offer removed");
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Could not remove offer");
    }
  };

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Categories</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap gap-3">
            <Input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="max-w-xs" />
            <Input placeholder="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="max-w-sm" />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="mt-6 h-96 w-full" />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.cat?.map((cat) => (
                <TableRow key={cat._id}>
                  <TableCell>{cat.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{cat.description}</TableCell>
                  <TableCell>
                    {cat.categoryOffer > 0 ? (
                      <div className="flex items-center gap-2">
                        <Badge>{cat.categoryOffer}%</Badge>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveOffer(cat._id)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setOfferCategoryId(cat._id)}>
                        Add Offer
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cat.isListed ? "outline" : "destructive"}>{cat.isListed ? "Listed" : "Unlisted"}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(cat)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleListed(cat)}>
                      {cat.isListed ? "Unlist" : "List"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!offerCategoryId} onOpenChange={(open) => !open && setOfferCategoryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              placeholder="Percentage (max 80)"
              value={offerPercentage}
              onChange={(e) => setOfferPercentage(e.target.value)}
            />
            <Button onClick={handleApplyOffer}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
