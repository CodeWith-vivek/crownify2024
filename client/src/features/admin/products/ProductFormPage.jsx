import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { adminApi } from "../adminApi";
import { AdminError } from "@/components/admin/AdminError";

const SIZE_OPTIONS = ["ONESIZE", "S / M", "M / L", "L / XL", "YOUTH"];
const emptyVariant = { size: "", color: "", quantity: "" };
const IMAGE_SLOTS = [1, 2, 3, 4];

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const fileRefs = useRef({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [cropModal, setCropModal] = useState(null); // { slot, src }
  const cropImgRef = useRef(null);
  const cropperRef = useRef(null);

  const { data, isError, refetch } = useQuery({
    queryKey: isEdit ? ["admin-product-edit", id] : ["admin-product-add-page"],
    queryFn: () => (isEdit ? adminApi.getEditProduct(id) : adminApi.productAddPage()),
  });

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [variants, setVariants] = useState([{ ...emptyVariant }]);
  const [existingImages, setExistingImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && data?.product) {
      const p = data.product;
      setProductName(p.productName || "");
      setDescription(p.description || "");
      setBrand(p.brand || "");
      setCategory(p.category?._id || p.category || "");
      setRegularPrice(p.regularPrice ?? "");
      setSalePrice(p.salePrice ?? "");
      setVariants(p.variants?.length ? p.variants.map((v) => ({ size: v.size, color: v.color, quantity: v.quantity })) : [{ ...emptyVariant }]);
      setExistingImages(p.productImage || []);
    }
  }, [isEdit, data]);

  const updateVariant = (idx, field, value) => setVariants((v) => v.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  const addVariantRow = () => setVariants((v) => [...v, { ...emptyVariant }]);
  const removeVariantRow = (idx) => setVariants((v) => v.filter((_, i) => i !== idx));

  const handleImageChange = (slot, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropModal({ slot, src: reader.result });
    reader.readAsDataURL(file);
  };

  // Mirrors the original product-add.ejs Cropper.js step: every uploaded
  // image gets forced to a 1:1 crop before it's usable, so listings render
  // consistently in the storefront's square product tiles.
  useEffect(() => {
    if (!cropModal || !cropImgRef.current) return;
    const cropper = new Cropper(cropImgRef.current, {
      aspectRatio: 1,
      viewMode: 1,
      guides: true,
      background: false,
      autoCropArea: 1,
      zoomable: true,
    });
    cropperRef.current = cropper;
    return () => {
      cropper.destroy();
      cropperRef.current = null;
    };
  }, [cropModal]);

  const handleCancelCrop = () => {
    const slot = cropModal?.slot;
    if (slot && fileRefs.current[slot]) fileRefs.current[slot].value = "";
    setCropModal(null);
  };

  const handleSaveCrop = () => {
    const cropper = cropperRef.current;
    const slot = cropModal?.slot;
    if (!cropper || !slot) return;
    const canvas = cropper.getCroppedCanvas();
    canvas.toBlob((blob) => {
      const fileName = `cropped-img-${Date.now()}-${slot}.png`;
      const croppedFile = new File([blob], fileName, { type: "image/png" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(croppedFile);
      const input = fileRefs.current[slot];
      if (input) input.files = dataTransfer.files;
      setImagePreviews((prev) => ({ ...prev, [slot]: canvas.toDataURL("image/jpeg", 1.0) }));
      setCropModal(null);
    });
  };

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

    if (!productName.trim()) return toast.error("Please enter a product name.");
    if (!description.trim()) return toast.error("Please enter a product description.");
    if (!brand) return toast.error("Please select a brand.");
    if (!/^\d+(\.\d{1,2})?$/.test(String(regularPrice)) || parseFloat(regularPrice) < 0) return toast.error("Enter a valid regular price.");
    if (!/^\d+(\.\d{1,2})?$/.test(String(salePrice)) || parseFloat(salePrice) < 0) return toast.error("Enter a valid sale price.");
    if (parseFloat(regularPrice) <= parseFloat(salePrice)) return toast.error("Regular price must be greater than sale price.");
    if (!category) return toast.error("Please select a category.");
    for (const v of variants) {
      if (!v.size) return toast.error("Select a size for every variant.");
      if (!String(v.color).trim()) return toast.error("Enter a color for every variant.");
      if (String(v.quantity).trim() === "" || parseInt(v.quantity, 10) < 0) return toast.error("Enter a valid quantity for every variant.");
    }
    if (!isEdit) {
      const filled = IMAGE_SLOTS.filter((slot) => fileRefs.current[slot]?.files?.length);
      if (filled.length !== 4) return toast.error("Please upload all 4 product images.");

      const validImageTypes = ["image/jpeg", "image/png", "image/jpg"];
      const maxFileSize = 5 * 1024 * 1024;
      for (const slot of IMAGE_SLOTS) {
        const file = fileRefs.current[slot]?.files?.[0];
        if (!validImageTypes.includes(file.type)) {
          return toast.error(`Invalid image type for Image ${slot}. Only JPEG, PNG, and JPG are allowed.`);
        }
        if (file.size > maxFileSize) {
          return toast.error(`Image ${slot} size should be less than 5MB.`);
        }
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("productName", productName);
      formData.append("description", description);
      formData.append("brand", brand);
      formData.append("category", category);
      formData.append("regularPrice", regularPrice);
      formData.append("salePrice", salePrice);
      variants.forEach((v) => {
        formData.append("sizes[]", v.size);
        formData.append("colors[]", v.color);
        formData.append("quantities[]", v.quantity);
      });
      IMAGE_SLOTS.forEach((slot) => {
        const file = fileRefs.current[slot]?.files?.[0];
        if (file) formData.append("images", file);
      });

      const res = isEdit ? await adminApi.editProduct(id, formData) : await adminApi.addProducts(formData);
      if (res?.success !== false) {
        toast.success(res?.message || (isEdit ? "Product updated" : "Product added"));
        navigate("/admin/products");
      } else {
        toast.error(res?.message || "Something went wrong");
      }
    } catch (err) {
      toast.error(err.message || "Unable to submit product");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = data?.cat || [];
  const brands = data?.brand || [];

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
    <form onSubmit={handleSubmit}>
      <div className="adm-page-head">
        <div>
          <h1>{isEdit ? "Edit product" : "Add product"}</h1>
          <p>{isEdit ? "Update catalog details, variants, and imagery." : "Create a new listing for the storefront."}</p>
        </div>
        <div className="adm-page-head__actions">
          <Link to="/admin/products" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Publish product"}
          </button>
        </div>
      </div>

      <div className="adm-grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div className="adm-card">
            <div className="adm-card__head">Details</div>
            <div className="adm-card__body">
              <div className="adm-field">
                <label className="form-label">Product name</label>
                <input type="text" className="form-control" placeholder="e.g. Classic Wool Cap" value={productName} onChange={(e) => setProductName(e.target.value)} />
              </div>
              <div className="adm-field">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={5} placeholder="Describe the product" value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="adm-field">
                    <label className="form-label">Brand</label>
                    <select className="form-select" value={brand} onChange={(e) => setBrand(e.target.value)}>
                      <option value="">Select brand</option>
                      {brands.map((b) => (
                        <option key={b._id} value={b.brandName}>
                          {b.brandName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="adm-field">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c._id} value={isEdit ? c._id : c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="adm-field" style={{ marginBottom: 0 }}>
                    <label className="form-label">Regular price</label>
                    <input type="text" className="form-control" placeholder="₹0.00" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="adm-field" style={{ marginBottom: 0 }}>
                    <label className="form-label">Sale price</label>
                    <input type="text" className="form-control" placeholder="₹0.00" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card__head">
              <span>Variants</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addVariantRow}>
                <i className="material-icons">add</i>
                Add variant
              </button>
            </div>
            <div className="adm-card__body">
              {variants.map((v, idx) => (
                <div key={idx} className="row" style={{ alignItems: "flex-end", marginBottom: idx === variants.length - 1 ? 0 : 14 }}>
                  <div className="col-md-4">
                    <div className="adm-field" style={{ marginBottom: 8 }}>
                      <label className="form-label">Size</label>
                      <select className="form-select" value={v.size} onChange={(e) => updateVariant(idx, "size", e.target.value)}>
                        <option value="">Select</option>
                        {SIZE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="adm-field" style={{ marginBottom: 8 }}>
                      <label className="form-label">Color</label>
                      <input type="text" className="form-control" placeholder="Black" value={v.color} onChange={(e) => updateVariant(idx, "color", e.target.value)} />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="adm-field" style={{ marginBottom: 8 }}>
                      <label className="form-label">Qty</label>
                      <input type="number" className="form-control" min="0" placeholder="0" value={v.quantity} onChange={(e) => updateVariant(idx, "quantity", e.target.value)} />
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="adm-field" style={{ marginBottom: 8 }}>
                      {variants.length > 1 && (
                        <button type="button" className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={() => removeVariantRow(idx)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card__head">Images</div>
          <div className="adm-card__body">
            {isEdit && existingImages.length > 0 && (
              <>
                <p className="adm-section-title">Current</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                  {existingImages.map((img) => (
                    <div key={img} style={{ position: "relative" }}>
                      <img src={`/uploads/product-image/${img}`} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--adm-border)" }} />
                      <button
                        type="button"
                        onClick={() => handleDeleteExistingImage(img)}
                        title="Remove image"
                        style={{
                          position: "absolute",
                          top: -7,
                          right: -7,
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: "none",
                          background: "var(--adm-accent)",
                          color: "#fff",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 15,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="adm-section-title">{isEdit ? "Replace / add" : "Upload 4 images"}</p>
            {IMAGE_SLOTS.map((slot) => (
              <div className="adm-field" key={slot}>
                <label className="form-label">Image {slot}</label>
                {imagePreviews[slot] && (
                  <img src={imagePreviews[slot]} alt="" style={{ display: "block", width: 84, height: 84, objectFit: "cover", borderRadius: 10, marginBottom: 8, border: "1px solid var(--adm-border)" }} />
                )}
                <input
                  className="form-control"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  ref={(el) => (fileRefs.current[slot] = el)}
                  onChange={(e) => handleImageChange(slot, e)}
                />
              </div>
            ))}
            <p className="adm-help">JPEG or PNG, up to 5MB each.</p>
          </div>
        </div>
      </div>
    </form>

    {cropModal && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div className="adm-card" style={{ width: "min(520px, 92vw)" }}>
          <div className="adm-card__head">Crop image {cropModal.slot}</div>
          <div className="adm-card__body">
            <div style={{ maxHeight: "60vh", overflow: "hidden" }}>
              <img ref={cropImgRef} src={cropModal.src} alt="" style={{ display: "block", maxWidth: "100%" }} />
            </div>
            <p className="adm-help">Drag to reposition, resize the box to zoom — the final image is cropped to a 1:1 square.</p>
            <div className="adm-btn-group" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancelCrop}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveCrop}>
                Save crop
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
