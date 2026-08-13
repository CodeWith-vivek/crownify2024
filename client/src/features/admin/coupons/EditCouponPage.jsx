import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminError } from "@/components/admin/AdminError";

const emptyForm = {
  code: "",
  discountType: "",
  discountAmount: "",
  maxDiscount: "",
  minPurchase: "",
  expiryDate: "",
  usageLimit: "",
  description: "",
};

// Mirrors the original editCoupon.ejs validateForm() — deliberately stricter
// than the add-coupon form in two ways: expiry can't be in the past, and
// usage limit has no "0 = unlimited" allowance (must be 1+).
function validate(form) {
  const errors = {};
  if (!form.code.trim()) errors.code = "Coupon code is required.";
  if (!form.discountType) errors.type = "Discount type is required.";

  const discountAmount = parseFloat(form.discountAmount);
  if (isNaN(discountAmount) || discountAmount < 0) {
    errors.amount = "Discount amount must be a positive number.";
  } else if (form.discountType === "percentage" && discountAmount > 80) {
    errors.amount = "Percentage discount cannot exceed 80%.";
  }

  if (form.maxDiscount.trim() !== "") {
    const maxDiscount = parseFloat(form.maxDiscount);
    if (isNaN(maxDiscount) || maxDiscount < 0) errors.max = "Maximum discount must be a positive number.";
  }

  const minPurchase = parseFloat(form.minPurchase);
  if (isNaN(minPurchase) || minPurchase < 0) errors.min = "Minimum purchase amount must be a positive number.";

  if (!form.expiryDate) {
    errors.expiry = "Please enter a valid expiry date.";
  } else {
    const expiry = new Date(form.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) errors.expiry = "Expiry date cannot be in the past.";
  }

  const usageLimit = parseInt(form.usageLimit, 10);
  if (isNaN(usageLimit) || usageLimit < 1) errors.usage = "Usage limit must be at least 1.";

  if (!form.description.trim()) errors.description = "Description is required.";

  return errors;
}

export function EditCouponPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-edit-coupon", id],
    queryFn: () => adminApi.getEditCoupon(id),
  });

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.coupon) {
      const c = data.coupon;
      setForm({
        code: c.code || "",
        discountType: c.discountType || "",
        discountAmount: c.discountAmount ?? "",
        maxDiscount: c.maxDiscount ?? "",
        minPurchase: c.minPurchase ?? "",
        expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : "",
        usageLimit: c.usageLimit ?? "",
        description: c.description || "",
      });
    }
  }, [data]);

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const res = await adminApi.updateCoupon(id, {
        couponCode: form.code.trim(),
        discountType: form.discountType,
        discountAmount: parseFloat(form.discountAmount),
        maxDiscount: parseFloat(form.maxDiscount) || 0,
        minPurchase: parseFloat(form.minPurchase),
        expiryDate: form.expiryDate,
        usageLimit: parseInt(form.usageLimit, 10),
        description: form.description.trim(),
      });
      toast.success(res?.message || "Coupon updated successfully");
      navigate("/admin/coupon-management");
    } catch (err) {
      toast.error(err.message || "Failed to update coupon. Please try again later.");
    } finally {
      setSaving(false);
    }
  };

  if (isError) return <AdminError onRetry={refetch} />;
  if (isLoading) return <p style={{ color: "var(--adm-text-muted)" }}>Loading…</p>;
  if (!data?.coupon) return <p style={{ color: "var(--adm-text-muted)" }}>Coupon not found.</p>;

  return (
    <form onSubmit={handleUpdate}>
      <div className="adm-page-head">
        <div>
          <h1>Edit coupon</h1>
          <p>Update the terms of this promotional code.</p>
        </div>
        <div className="adm-page-head__actions">
          <Link to="/admin/coupon-management" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="adm-card" style={{ maxWidth: 520 }}>
        <div className="adm-card__body">
          <div className="adm-field">
            <label className="form-label">Coupon code</label>
            <input type="text" className="form-control" maxLength={20} value={form.code} onChange={(e) => setField("code", e.target.value)} />
            {errors.code && <span className="text-danger">{errors.code}</span>}
          </div>

          <div className="adm-field">
            <label className="form-label">Discount type</label>
            <select className="form-select" value={form.discountType} onChange={(e) => setField("discountType", e.target.value)}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
            {errors.type && <span className="text-danger">{errors.type}</span>}
          </div>

          <div className="adm-field">
            <label className="form-label">Discount amount</label>
            <input type="number" className="form-control" min="0" step="0.01" value={form.discountAmount} onChange={(e) => setField("discountAmount", e.target.value)} />
            {errors.amount && <span className="text-danger">{errors.amount}</span>}
          </div>

          <div className="adm-field">
            <label className="form-label">Max discount</label>
            <input type="number" className="form-control" min="0" step="0.01" placeholder="Optional cap" value={form.maxDiscount} onChange={(e) => setField("maxDiscount", e.target.value)} />
            {errors.max && <span className="text-danger">{errors.max}</span>}
          </div>

          <div className="adm-field">
            <label className="form-label">Min purchase</label>
            <input type="number" className="form-control" min="0" step="0.01" value={form.minPurchase} onChange={(e) => setField("minPurchase", e.target.value)} />
            {errors.min && <span className="text-danger">{errors.min}</span>}
          </div>

          <div className="adm-field">
            <label className="form-label">Expiry date</label>
            <input type="date" className="form-control" value={form.expiryDate} onChange={(e) => setField("expiryDate", e.target.value)} />
            {errors.expiry && <span className="text-danger">{errors.expiry}</span>}
          </div>

          <div className="adm-field">
            <label className="form-label">Usage limit</label>
            <input type="number" className="form-control" min="1" value={form.usageLimit} onChange={(e) => setField("usageLimit", e.target.value)} />
            {errors.usage && <span className="text-danger">{errors.usage}</span>}
          </div>

          <div className="adm-field" style={{ marginBottom: 0 }}>
            <label className="form-label">Description</label>
            <textarea className="form-control" maxLength={500} value={form.description} onChange={(e) => setField("description", e.target.value)}></textarea>
            {errors.description && <span className="text-danger">{errors.description}</span>}
          </div>
        </div>
      </div>
    </form>
  );
}
