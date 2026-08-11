import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApi } from "../adminApi";

export function ProductListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [offerProductId, setOfferProductId] = useState(null);
  const [offerPercentage, setOfferPercentage] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", page, search],
    queryFn: () => adminApi.products(page, search),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-products"] });

  const toggleBlock = async (product) => {
    try {
      const res = product.isBlocked ? await adminApi.unblockProduct(product._id) : await adminApi.blockProduct(product._id);
      if (res?.success) {
        toast.success(res.message);
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleApplyOffer = async () => {
    try {
      const res = await adminApi.addProductOffer({ productId: offerProductId, percentage: Number(offerPercentage) });
      if (res?.status) {
        toast.success("Offer applied");
        setOfferProductId(null);
        setOfferPercentage("");
        await refresh();
      } else {
        toast.error(res?.message || "Could not apply offer");
      }
    } catch (err) {
      toast.error(err.message || "Could not apply offer");
    }
  };

  const handleRemoveOffer = async (productId) => {
    try {
      const res = await adminApi.removeProductOffer(productId);
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
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-primary">Products</h1>
        <div className="flex gap-3">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Button asChild>
            <Link to="/admin/addProducts">Add Product</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-96 w-full" />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.map((product) => (
                <TableRow key={product._id}>
                  <TableCell className="flex items-center gap-2">
                    {product.productImage?.[0] && (
                      <img
                        src={`/uploads/product-image/${product.productImage[0]}`}
                        alt={product.productName}
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    {product.productName}
                  </TableCell>
                  <TableCell>{product.category?.name}</TableCell>
                  <TableCell>₹{product.salePrice}</TableCell>
                  <TableCell>{product.totalQuantity}</TableCell>
                  <TableCell>
                    {product.productOffer > 0 ? (
                      <div className="flex items-center gap-2">
                        <Badge>{product.productOffer}%</Badge>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveOffer(product._id)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setOfferProductId(product._id)}>
                        Add Offer
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isBlocked ? "destructive" : "outline"}>
                      {product.isBlocked ? "Blocked" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/editProduct/${product._id}`}>Edit</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleBlock(product)}>
                      {product.isBlocked ? "Unblock" : "Block"}
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

      <Dialog open={!!offerProductId} onOpenChange={(open) => !open && setOfferProductId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="number" placeholder="Percentage (max 80)" value={offerPercentage} onChange={(e) => setOfferPercentage(e.target.value)} />
            <Button onClick={handleApplyOffer}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
