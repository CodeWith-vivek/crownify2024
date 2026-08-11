import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "../adminApi";

const SIZE_OPTIONS = ["ONESIZE", "S / M", "M / L", "L / XL", "YOUTH"];
const emptyVariant = { color: "", size: "ONESIZE", quantity: "" };

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const { data } = useQuery({
    queryKey: isEdit ? ["admin-product-edit", id] : ["admin-product-add-page"],
    queryFn: () => (isEdit ? adminApi.getEditProduct(id) : adminApi.productAddPage()),
  });

  const [form, setForm] = useState({
    productName: "",
    description: "",
    brand: "",
    category: "",
    regularPrice: "",
    salePrice: "",
  });
  const [variants, setVariants] = useState([emptyVariant]);
  const [existingImages, setExistingImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && data?.product) {
      const p = data.product;
      setForm({
        productName: p.productName || "",
        description: p.description || "",
        brand: p.brand || "",
        category: p.category?._id || p.category || "",
        regularPrice: p.regularPrice ?? "",
        salePrice: p.salePrice ?? "",
      });
      setVariants(p.variants?.length ? p.variants.map((v) => ({ ...v })) : [emptyVariant]);
      setExistingImages(p.productImage || []);
    }
  }, [isEdit, data]);

  const updateVariant = (idx, field, value) => {
    setVariants((v) => v.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };
  const addVariantRow = () => setVariants((v) => [...v, { ...emptyVariant }]);
  const removeVariantRow = (idx) => setVariants((v) => v.filter((_, i) => i !== idx));

  const handleDeleteExistingImage = async (imageName) => {
    try {
      await adminApi.deleteImage({ imageNameToServer: imageName, productIdToServer: id });
      setExistingImages((imgs) => imgs.filter((i) => i !== imageName));
      toast.success("Image removed");
    } catch (err) {
      toast.error(err.message || "Could not remove image");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("productName", form.productName);
      formData.append("description", form.description);
      formData.append("brand", form.brand);
      formData.append("category", form.category);
      formData.append("regularPrice", form.regularPrice);
      formData.append("salePrice", form.salePrice);
      variants.forEach((v) => {
        formData.append("colors[]", v.color);
        formData.append("sizes[]", v.size);
        formData.append("quantities[]", v.quantity);
      });
      if (fileRef.current?.files?.length) {
        Array.from(fileRef.current.files).forEach((file) => formData.append("images", file));
      }

      const res = isEdit ? await adminApi.editProduct(id, formData) : await adminApi.addProducts(formData);
      if (res?.success) {
        toast.success(res.message || "Saved");
        navigate("/admin/products");
      } else {
        toast.error(res?.message || "Could not save product");
      }
    } catch (err) {
      toast.error(err.message || "Could not save product");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = data?.cat || [];
  const brands = data?.brand || [];

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl font-bold text-primary">{isEdit ? "Edit Product" : "Add Product"}</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Product Name</Label>
              <Input required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <textarea
                required
                className="w-full rounded-md border bg-background p-2 text-sm"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <select
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              >
                <option value="">Select brand</option>
                {brands.map((b) => (
                  <option key={b._id} value={b.brandName}>
                    {b.brandName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={isEdit ? c._id : c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Regular Price</Label>
              <Input type="number" required value={form.regularPrice} onChange={(e) => setForm({ ...form, regularPrice: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Sale Price</Label>
              <Input type="number" required value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Variants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {variants.map((v, idx) => (
              <div key={idx} className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Color</Label>
                  <Input required value={v.color} onChange={(e) => updateVariant(idx, "color", e.target.value)} />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Size</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={v.size}
                    onChange={(e) => updateVariant(idx, "size", e.target.value)}
                  >
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" required value={v.quantity} onChange={(e) => updateVariant(idx, "quantity", e.target.value)} />
                </div>
                {variants.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeVariantRow(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addVariantRow}>
              Add Variant
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEdit && existingImages.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {existingImages.map((img) => (
                  <div key={img} className="relative h-20 w-20 overflow-hidden rounded-md border">
                    <img src={`/uploads/product-image/${img}`} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingImage(img)}
                      className="absolute right-0 top-0 rounded-bl bg-destructive px-1 text-xs text-destructive-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <Label>{isEdit ? "Add more images (optional)" : "Product images (up to 4)"}</Label>
              <input ref={fileRef} type="file" accept="image/*" multiple className="mt-2 block text-sm" />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Update Product" : "Add Product"}
        </Button>
      </form>
    </div>
  );
}
