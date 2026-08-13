import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { profileApi } from "./profileApi";
import { useAuth } from "@/store/AuthContext";
import { validateNameMinLen, validatePhoneSimple } from "@/lib/validators";
import { PageError } from "@/components/layout/PageError";

export function AccountDetailsPage() {
  const { refreshMe } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["accountDetails"],
    queryFn: profileApi.accountDetails,
  });

  const [details, setDetails] = useState({ name: "", phone: "" });
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const [password, setPassword] = useState("");
  const [npassword, setNpassword] = useState("");
  const [cpassword, setCpassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [npasswordError, setNpasswordError] = useState("");
  const [cpasswordError, setCpasswordError] = useState("");
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNpassword, setShowNpassword] = useState(false);
  const [showCpassword, setShowCpassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.user) {
      setDetails({ name: data.user.name || "", phone: data.user.phone || "" });
    }
  }, [data]);

  const user = data?.user;

  // Live current-password check, debounced (the original ran this on every
  // keystroke — this app hits the same /api/validate-current-password
  // endpoint but waits briefly so it isn't one request per character).
  useEffect(() => {
    if (password.length < 8) {
      setCurrentPasswordVerified(false);
      setPasswordError(password ? "Current password must be at least 8 characters long" : "");
      return;
    }
    setPasswordError("");
    setCheckingPassword(true);
    const timer = setTimeout(async () => {
      try {
        const res = await profileApi.validateCurrentPassword(password);
        if (res?.valid) {
          setCurrentPasswordVerified(true);
          setPasswordError("");
        } else {
          setCurrentPasswordVerified(false);
          setPasswordError("Incorrect current password");
        }
      } catch {
        setCurrentPasswordVerified(false);
        setPasswordError("Error validating password. Please try again.");
      } finally {
        setCheckingPassword(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [password]);

  useEffect(() => {
    if (npassword && npassword.length < 8) {
      setNpasswordError("New password must be at least 8 characters long");
      setCpasswordError("");
      return;
    }
    setNpasswordError("");
    if (cpassword) setCpasswordError(npassword !== cpassword ? "Passwords do not match" : "");
  }, [npassword, cpassword]);

  const handleNameChange = (e) => {
    setDetails({ ...details, name: e.target.value });
    setNameError(validateNameMinLen(e.target.value));
  };

  const handlePhoneChange = (e) => {
    setDetails({ ...details, phone: e.target.value });
    setPhoneError(validatePhoneSimple(e.target.value));
  };

  const npasswordEnabled = password.length >= 8 && currentPasswordVerified;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nErr = validateNameMinLen(details.name);
    const pErr = validatePhoneSimple(details.phone);
    setNameError(nErr);
    setPhoneError(pErr);
    if (nErr || pErr) return;
    if (password && !currentPasswordVerified) {
      toast.error("Please enter your correct current password");
      return;
    }
    if (npassword && npassword.length < 8) return;
    if (npassword && npassword !== cpassword) {
      toast.error("New password and confirm password do not match");
      return;
    }
    setSavingDetails(true);
    setSaving(true);
    try {
      const payload = { name: details.name, phone: details.phone };
      if (password) {
        payload.password = password;
        payload.npassword = npassword;
      }
      const res = await profileApi.updateUser(payload);
      if (res?.success) {
        toast.success("Details updated successfully");
        setPassword("");
        setNpassword("");
        setCpassword("");
        await refreshMe();
      } else {
        toast.error(res?.error || res?.message || "Could not update details");
      }
    } catch (err) {
      toast.error(err.message || "Could not update details");
    } finally {
      setSavingDetails(false);
      setSaving(false);
    }
  };

  // isError must be checked first: on a failed request `data` is undefined,
  // so the !user branch below would swallow it and render a blank panel.
  if (isError) return <PageError onRetry={refetch} />;

  if (isLoading || !user) {
    return <div className="col-md-9" />;
  }

  return (
      <div className="col-md-9">
        <div className="tab-pane " id="account-detail">
          <div className="card">
            <div className="card-header">
              <h5>Account Details</h5>
            </div>
            <div className="card-body">
              <div className="avatar-section">
                <div className="avatar" style={{ backgroundImage: `url('${user.avatar || ""}')` }}>
                  {!user.avatar && user.name.charAt(0).toUpperCase()}
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="form-group col-md-12">
                    <label>Full Name </label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      value={details.name}
                      onChange={handleNameChange}
                      placeholder="Enter full name"
                    />
                    {nameError && <div className="error-message" style={{ color: "red" }}>{nameError}</div>}
                  </div>

                  <div className="form-group col-md-12">
                    <label>Email Address </label>
                    <input className="form-control" name="email" type="email" value={user.email} readOnly />
                  </div>
                  <div className="form-group col-md-12">
                    <label>Mobile Number</label>
                    <input
                      className="form-control"
                      name="phone"
                      type="text"
                      value={details.phone}
                      onChange={handlePhoneChange}
                      placeholder="Enter mobile number"
                    />
                    {phoneError && <div className="error-message" style={{ color: "red" }}>{phoneError}</div>}
                  </div>
                  <div className="form-group col-md-12">
                    <label>Current Password</label>
                    <div className="input-group">
                      <input
                        className="form-control"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your current password"
                      />
                      <div className="input-group-append">
                        <span className="input-group-text" style={{ cursor: "pointer" }} onClick={() => setShowPassword((v) => !v)}>
                          <i className={`fas fa-eye${showPassword ? "-slash" : ""}`}></i>
                        </span>
                      </div>
                    </div>
                    {passwordError && <div className="error-message" style={{ color: "red" }}>{passwordError}</div>}
                    {checkingPassword && <div style={{ color: "gray", fontSize: 12 }}>Checking...</div>}
                  </div>

                  <div className="form-group col-md-12">
                    <label>New Password</label>
                    <div className="input-group">
                      <input
                        className="form-control"
                        name="npassword"
                        type={showNpassword ? "text" : "password"}
                        value={npassword}
                        onChange={(e) => setNpassword(e.target.value)}
                        placeholder="Enter your new password"
                        disabled={!npasswordEnabled}
                      />
                      <div className="input-group-append">
                        <span className="input-group-text" style={{ cursor: "pointer" }} onClick={() => setShowNpassword((v) => !v)}>
                          <i className={`fas fa-eye${showNpassword ? "-slash" : ""}`}></i>
                        </span>
                      </div>
                    </div>
                    {npasswordError && <div className="error-message" style={{ color: "red" }}>{npasswordError}</div>}
                  </div>
                  <div className="form-group col-md-12">
                    <label>Confirm Password</label>
                    <div className="input-group">
                      <input
                        className="form-control"
                        name="cpassword"
                        type={showCpassword ? "text" : "password"}
                        value={cpassword}
                        onChange={(e) => setCpassword(e.target.value)}
                        placeholder="Confirm your new password"
                        disabled={!npasswordEnabled}
                      />
                      <div className="input-group-append">
                        <span className="input-group-text" style={{ cursor: "pointer" }} onClick={() => setShowCpassword((v) => !v)}>
                          <i className={`fas fa-eye${showCpassword ? "-slash" : ""}`}></i>
                        </span>
                      </div>
                    </div>
                    {cpasswordError && <div className="error-message" style={{ color: "red" }}>{cpasswordError}</div>}
                  </div>
                  <div className="col-md-12">
                    <button type="submit" className="btn btn-fill-out submit" style={{ backgroundColor: "brown" }} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
  );
}
