import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageError } from "@/components/layout/PageError";
import { addressApi } from "./addressApi";
import { Modal } from "@/components/ui/Modal";
import { validateAddressField, ADDRESS_FIELDS } from "@/lib/validators";
import { confirm } from "@/components/ui/ConfirmDialog";

const emptyForm = {
  addressType: "",
  name: "",
  country: "",
  phone: "",
  pincode: "",
  home: "",
  area: "",
  landmark: "",
  town: "",
  state: "",
};

function addressToForm(address) {
  return {
    addressType: address.addressType || "",
    name: address.fullName || "",
    country: address.country || "",
    phone: address.mobileNumber || "",
    pincode: address.postalCode || "",
    home: address.flatHouseCompany || "",
    area: address.areaStreet || "",
    landmark: address.landmark || "",
    town: address.city || "",
    state: address.state || "",
  };
}

function AddressForm({ title, form, setForm, onSubmit, submitting, onCancel, bannerImage, bannerTitle, bannerText }) {
  const [errors, setErrors] = useState({});

  const setField = (field, value) => {
    setForm({ ...form, [field]: value });
    setErrors((prev) => ({ ...prev, [field]: validateAddressField(field, value) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = {};
    ADDRESS_FIELDS.forEach((f) => {
      nextErrors[f] = validateAddressField(f, form[f]);
    });
    if (!form.addressType) nextErrors.addressType = "Please select an address type";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit(e);
  };

  const fieldError = (field) =>
    errors[field] ? <div className="error-message" style={{ color: "red" }}>{errors[field]}</div> : null;

  return (
    <div className="wrap d-md-flex" style={{ overflowY: "auto", maxHeight: "90vh" }}>
      <style>{`
        .address-modal-scroll::-webkit-scrollbar { width: 9px; }
        .address-modal-scroll::-webkit-scrollbar-track { background: #f1e9e7; }
        .address-modal-scroll::-webkit-scrollbar-thumb { background: #dc0909; border-radius: 6px; }
        .address-modal-scroll::-webkit-scrollbar-thumb:hover { background: #291616; }
      `}</style>
      <div
        className="text-wrap p-4 p-lg-5 d-flex img d-flex align-items-end"
        style={{ backgroundImage: `url(${bannerImage})`, maxHeight: "90vh", alignSelf: "stretch" }}
      >
        <div className="text w-100">
          <h2 className="mb-4">{bannerTitle}</h2>
          <p style={{ lineHeight: 1.6, color: "white" }}>{bannerText}</p>
        </div>
      </div>

      <div
        className="login-wrap p-4 p-md-5 address-modal-scroll"
        style={{
          backgroundImage: "url(/assets/images/addressDesign.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          lineHeight: 1.6,
          maxHeight: "90vh",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "#dc0909 #f1e9e7",
        }}
      >
        <h3 className="mb-3" style={{ fontWeight: 600 }}>
          {title}
        </h3>

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="row">
            <div className="col-md-6">
              <div className="form-group">
                <label htmlFor="addressType">Address Type:</label>
                <select
                  name="addressType"
                  id="addressType"
                  required
                  style={{ borderRadius: 36 }}
                  value={form.addressType}
                  onChange={(e) => {
                    setForm({ ...form, addressType: e.target.value });
                    setErrors((prev) => ({ ...prev, addressType: e.target.value ? "" : "Please select an address type" }));
                  }}
                >
                  <option value="">Select Address Type</option>
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Other">Other</option>
                </select>
                {fieldError("addressType")}
              </div>
            </div>

            <div className="col-md-12">
              <div className="form-group">
                <label className="label" style={{ width: 300, maxWidth: "100%" }} htmlFor="name">
                  Full Name ( First and Last Name )
                </label>
                <input type="text" className="form-control" name="name" id="name" placeholder="Enter name" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                {fieldError("name")}
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label className="label" htmlFor="country">
                  Country / Region
                </label>
                <input
                  type="text"
                  className="form-control"
                  name="country"
                  id="country"
                  placeholder="Enter your country"
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                />
                {fieldError("country")}
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label className="label" htmlFor="phone">
                  Mobile Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  name="phone"
                  id="phone"
                  placeholder="Enter phone number"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
                {fieldError("phone")}
              </div>
            </div>
            <div className="col-md-12">
              <div className="form-group">
                <label className="label" htmlFor="pincode">
                  Pincode / Zipcode
                </label>
                <input
                  type="text"
                  className="form-control"
                  name="pincode"
                  id="pincode"
                  placeholder="Enter pincode"
                  value={form.pincode}
                  onChange={(e) => setField("pincode", e.target.value)}
                />
                {fieldError("pincode")}
              </div>
            </div>

            <div className="col-md-12">
              <div className="form-group">
                <label className="label" style={{ width: 300, maxWidth: "100%" }} htmlFor="home">
                  Flat, House no.,Company
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    id="home"
                    className="form-control"
                    name="home"
                    placeholder="Enter flat / house no"
                    value={form.home}
                    onChange={(e) => setField("home", e.target.value)}
                  />
                </div>
                {fieldError("home")}
              </div>
            </div>
            <div className="col-md-12">
              <div className="form-group">
                <label className="label" htmlFor="area">
                  Area, Street
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    id="area"
                    className="form-control"
                    name="area"
                    placeholder="Enter area / street "
                    value={form.area}
                    onChange={(e) => setField("area", e.target.value)}
                  />
                </div>
                {fieldError("area")}
              </div>
            </div>
            <div className="col-md-12">
              <div className="form-group">
                <label className="label" htmlFor="landmark">
                  Landmark
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    id="landmark"
                    className="form-control"
                    name="landmark"
                    placeholder="Enter landmark"
                    value={form.landmark}
                    onChange={(e) => setField("landmark", e.target.value)}
                  />
                </div>
                {fieldError("landmark")}
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label className="label" htmlFor="town">
                  Town / City
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    id="town"
                    className="form-control"
                    name="town"
                    placeholder="Enter city / town "
                    value={form.town}
                    onChange={(e) => setField("town", e.target.value)}
                  />
                </div>
                {fieldError("town")}
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label className="label" htmlFor="state">
                  State /Province
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    id="state"
                    className="form-control"
                    name="state"
                    placeholder="Enter state or province"
                    value={form.state}
                    onChange={(e) => setField("state", e.target.value)}
                  />
                </div>
                {fieldError("state")}
              </div>
            </div>

            <div className="col-md-12 text-center">
              <div className="form-group ">
                <button type="button" className="btn btn-secondary" style={{ width: 170, marginRight: 10 }} onClick={onCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-secondary submit " style={{ width: 170 }} disabled={submitting}>
                  {submitting ? "Saving..." : title}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddressPage() {
  const queryClient = useQueryClient();
  const { data, isError, refetch } = useQuery({
    queryKey: ["addresses"],
    queryFn: addressApi.list,
  });

  const [editingId, setEditingId] = useState(null);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["addresses"] });

  const startEdit = (addr) => {
    setEditingId(addr._id);
    setEditForm(addressToForm(addr));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await addressApi.add(addForm);
      if (res?.success === false) {
        toast.error(res.message || "Could not add address");
      } else {
        toast.success("Address added");
        setAddForm(emptyForm);
        setShowAddForm(false);
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Could not add address");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await addressApi.update(editingId, editForm);
      if (res?.success === false) {
        toast.error(res.message || "Could not update address");
      } else {
        toast.success("Address updated");
        setEditingId(null);
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Could not update address");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm("You won't be able to revert this action!")) return;
    try {
      await addressApi.delete(id);
      toast.success("Address deleted");
      await refresh();
    } catch (err) {
      toast.error(err.message || "Could not delete address");
    }
  };

  const handleSetPrimary = async (id) => {
    if (!await confirm("Do you want to set this as your primary address?", { danger: false })) return;
    try {
      const res = await addressApi.setPrimary(id);
      if (res?.success) {
        toast.success("Primary address updated successfully.");
        await refresh();
      } else {
        toast.error(res?.message || "Failed to update primary address.");
      }
    } catch (err) {
      toast.error("An error occurred while updating primary address. Please try again.");
    }
  };

  const addresses = data?.user?.addresses || [];
  const addressCount = addresses.length;

  if (isError) {
    return (
      <div className="col-md-9">
        <PageError title="Couldn't load your addresses" message="We couldn't reach the server. Your saved addresses are safe — please try again." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="col-md-9">
      <div className="tab-pane " id="address">
        <div className="row">
          {addresses.length > 0 ? (
            addresses.map((addr) => (
              <div className="col-lg-6" key={addr._id}>
                <div className="card mb-3 mb-lg-0">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Address</h5>
                    {addr.isPrimary && (
                      <span className="badge bg-success" style={{ marginRight: 23, backgroundColor: "black" }}>
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="card-body">
                    <address>
                      {addr.fullName}
                      <br />
                      {addr.flatHouseCompany}, {addr.areaStreet}
                      <br />
                      {addr.city}, {addr.state} - {addr.postalCode}
                      <br />
                      {addr.country}
                      <br />
                      Phone: {addr.mobileNumber}
                      <br />
                    </address>
                    <div className="d-flex justify-content-between">
                      {!addr.isPrimary && (
                        <a href="#" className="btn-small btn-link" onClick={(e) => { e.preventDefault(); handleSetPrimary(addr._id); }}>
                          Set as Primary
                        </a>
                      )}
                      <a href="#" className="btn-small btn-link" onClick={(e) => { e.preventDefault(); startEdit(addr); }}>
                        <i className="fas fa-edit"></i> Edit
                      </a>
                      <a href="#" className="btn-small btn-link text-danger" onClick={(e) => { e.preventDefault(); handleDelete(addr._id); }}>
                        <i className="fas fa-trash"></i> Delete
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-12">
              <h3 className="text-center">No addresses found. Add a new address!</h3>
            </div>
          )}

          {addressCount < 4 && (
            <div className="col-lg-6 mt-4">
              <div className="card address-card">
                <div className="card-body text-center">
                  <h5 className="add-address-title" style={{ color: "red" }}>
                    Add Address
                  </h5>
                  <div className="plus-button">
                    <a href="#" className="btn" onClick={(e) => { e.preventDefault(); setShowAddForm(true); }}>
                      <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "red" }}>+</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Add New Address" dialogClassName="modal-xl" plain>
        <AddressForm
          title="Add New Address"
          form={addForm}
          setForm={setAddForm}
          onSubmit={handleAdd}
          submitting={saving}
          onCancel={() => setShowAddForm(false)}
          bannerImage="/assets/images/Address.webp"
          bannerTitle="Add a New Address"
          bannerText="Provide your delivery address to ensure seamless and timely delivery of your favorite Crownify headwear."
        />
      </Modal>

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title="Edit Address" dialogClassName="modal-xl" plain>
        <AddressForm
          title="Edit Address"
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleUpdate}
          submitting={saving}
          onCancel={() => setEditingId(null)}
          bannerImage="/assets/images/guitarcat.webp"
          bannerTitle="Edit Your Address"
          bannerText="Update your delivery details to ensure smooth and accurate delivery of your Crownify orders."
        />
      </Modal>
    </div>
  );
}
