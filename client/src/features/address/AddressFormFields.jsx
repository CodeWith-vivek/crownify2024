import { validateAddressField, ADDRESS_FIELDS } from "@/lib/validators";

export function validateAddressForm(form) {
  const errors = {};
  ADDRESS_FIELDS.forEach((f) => {
    errors[f] = validateAddressField(f, form[f]);
  });
  if (!form.addressType) errors.addressType = "Please select an address type";
  return errors;
}

export function AddressFormFields({ form, setForm, errors, setErrors, idPrefix }) {
  const setField = (field, value) => {
    setForm({ ...form, [field]: value });
    setErrors((prev) => ({ ...prev, [field]: validateAddressField(field, value) }));
  };
  const fieldError = (field) =>
    errors[field] ? <div className="error-message" style={{ color: "red" }}>{errors[field]}</div> : null;

  return (
    <div className="row">
      <div className="col-md-6 mb-3">
        <label htmlFor={`${idPrefix}addressType`} className="form-label">
          Address Type:
        </label>
        <select
          className="form-select"
          id={`${idPrefix}addressType`}
          required
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
      <div className="col-md-12 mb-3">
        <label htmlFor={`${idPrefix}name`} className="form-label">
          Full Name (First and Last Name)
        </label>
        <input type="text" className="form-control" id={`${idPrefix}name`} placeholder="Enter name" value={form.name} onChange={(e) => setField("name", e.target.value)} />
        {fieldError("name")}
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor={`${idPrefix}country`} className="form-label">
          Country / Region
        </label>
        <input
          type="text"
          className="form-control"
          id={`${idPrefix}country`}
          placeholder="Enter your country"
          value={form.country}
          onChange={(e) => setField("country", e.target.value)}
        />
        {fieldError("country")}
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor={`${idPrefix}phone`} className="form-label">
          Mobile Number
        </label>
        <input type="text" className="form-control" id={`${idPrefix}phone`} placeholder="Enter phone number" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
        {fieldError("phone")}
      </div>
      <div className="col-md-12 mb-3">
        <label htmlFor={`${idPrefix}pincode`} className="form-label">
          Pincode / Zipcode
        </label>
        <input type="text" className="form-control" id={`${idPrefix}pincode`} placeholder="Enter pincode" value={form.pincode} onChange={(e) => setField("pincode", e.target.value)} />
        {fieldError("pincode")}
      </div>
      <div className="col-md-12 mb-3">
        <label htmlFor={`${idPrefix}home`} className="form-label">
          Flat, House no., Company
        </label>
        <input type="text" className="form-control" id={`${idPrefix}home`} placeholder="Enter flat / house no" value={form.home} onChange={(e) => setField("home", e.target.value)} />
        {fieldError("home")}
      </div>
      <div className="col-md-12 mb-3">
        <label htmlFor={`${idPrefix}area`} className="form-label">
          Area, Street
        </label>
        <input type="text" className="form-control" id={`${idPrefix}area`} placeholder="Enter area / street" value={form.area} onChange={(e) => setField("area", e.target.value)} />
        {fieldError("area")}
      </div>
      <div className="col-md-12 mb-3">
        <label htmlFor={`${idPrefix}landmark`} className="form-label">
          Landmark
        </label>
        <input
          type="text"
          className="form-control"
          id={`${idPrefix}landmark`}
          placeholder="Enter landmark"
          value={form.landmark}
          onChange={(e) => setField("landmark", e.target.value)}
        />
        {fieldError("landmark")}
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor={`${idPrefix}town`} className="form-label">
          Town / City
        </label>
        <input type="text" className="form-control" id={`${idPrefix}town`} placeholder="Enter city / town" value={form.town} onChange={(e) => setField("town", e.target.value)} />
        {fieldError("town")}
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor={`${idPrefix}state`} className="form-label">
          State / Province
        </label>
        <input
          type="text"
          className="form-control"
          id={`${idPrefix}state`}
          placeholder="Enter state or province"
          value={form.state}
          onChange={(e) => setField("state", e.target.value)}
        />
        {fieldError("state")}
      </div>
    </div>
  );
}
