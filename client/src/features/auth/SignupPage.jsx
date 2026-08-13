import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { authApi } from "./authApi";
import { GoogleButton } from "./GoogleButton";
import { validateFullName, validateEmailStrict, validatePhone10, validatePasswordPair } from "@/lib/validators";

const initialForm = { name: "", phone: "", email: "", password: "", cPassword: "" };
const initialErrors = { name: "", email: "", phone: "", password: "", cPassword: "" };

export function SignupPage() {
  usePageAssets("user", "header", userProfiles);

  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState(initialErrors);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const validateField = (name, nextForm) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (name === "name") next.name = validateFullName(nextForm.name);
      if (name === "email") next.email = validateEmailStrict(nextForm.email);
      if (name === "phone") next.phone = validatePhone10(nextForm.phone);
      if (name === "password" || name === "cPassword") {
        const pair = validatePasswordPair(nextForm.password, nextForm.cPassword);
        next.password = pair.password;
        next.cPassword = pair.confirm;
      }
      return next;
    });
  };

  const handleChange = (e) => {
    const nextForm = { ...form, [e.target.name]: e.target.value };
    setForm(nextForm);
    validateField(e.target.name, nextForm);
  };

  const validateAll = () => {
    const nameErr = validateFullName(form.name);
    const emailErr = validateEmailStrict(form.email);
    const phoneErr = validatePhone10(form.phone);
    const pair = validatePasswordPair(form.password, form.cPassword);
    setFieldErrors({ name: nameErr, email: emailErr, phone: phoneErr, password: pair.password, cPassword: pair.confirm });
    return !nameErr && !emailErr && !phoneErr && !pair.password && !pair.confirm;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validateAll()) return;
    setSubmitting(true);
    try {
      const res = await authApi.signup(form);
      if (res?.success) {
        toast.success(res.message || "OTP sent");
        navigate(res.redirect || "/verify-otp");
      } else {
        setError(res?.message || "Signup failed");
      }
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ftco-section">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="wrap d-md-flex">
              <div
                className="login-wrap p-4 p-md-5"
                style={{ backgroundImage: "url(/assets/images/signup2.png)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
              >
                <h3 className="mb-3" style={{ fontWeight: 600 }}>
                  Sign Up
                </h3>

                {error && <div style={{ color: "red" }}>{error}</div>}

                <form onSubmit={handleSubmit} className="signup-form" id="signform">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="name">
                          Full Name
                        </label>
                        <input type="text" id="name" name="name" className="form-control" placeholder="Enter Name" value={form.name} onChange={handleChange} />
                        <div id="error1" className="error-message" style={{ display: fieldErrors.name ? "block" : "none", color: "red" }}>{fieldErrors.name}</div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="email">
                          Email Address
                        </label>
                        <input type="email" className="form-control" name="email" id="email" placeholder="Enter email" value={form.email} onChange={handleChange} />
                        <div id="error2" className="error-message" style={{ display: fieldErrors.email ? "block" : "none", color: "red" }}>{fieldErrors.email}</div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="phone">
                          Phone Number
                        </label>
                        <input type="text" className="form-control" name="phone" id="phone" placeholder="Enter phone number" value={form.phone} onChange={handleChange} />
                        <div id="error3" className="error-message" style={{ display: fieldErrors.phone ? "block" : "none", color: "red" }}>{fieldErrors.phone}</div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="password">
                          Password
                        </label>
                        <div className="input-group">
                          <input type="password" id="password" className="form-control" name="password" placeholder="Password" value={form.password} onChange={handleChange} />
                          <span className="input-group-text" style={{ cursor: "pointer" }}>
                            <i className="fa fa-eye"></i>
                          </span>
                        </div>
                        <div id="error4" className="error-message" style={{ display: fieldErrors.password ? "block" : "none", color: "red" }}>{fieldErrors.password}</div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="confirm-password">
                          Confirm Password
                        </label>
                        <div className="input-group">
                          <input
                            type="password"
                            className="form-control"
                            name="cPassword"
                            id="confirm-password"
                            placeholder="Confirm Password"
                            value={form.cPassword}
                            onChange={handleChange}
                          />
                          <span className="input-group-text" style={{ cursor: "pointer" }}>
                            <i className="fa fa-eye"></i>
                          </span>
                        </div>
                        <div id="error5" className="error-message" style={{ display: fieldErrors.cPassword ? "block" : "none", color: "red" }}>{fieldErrors.cPassword}</div>
                      </div>
                    </div>

                    <div className="col-md-12 text-center">
                      <div className="form-group">
                        <button type="submit" className="btn btn-secondary submit" disabled={submitting}>
                          {submitting ? "Signing up..." : "Sign Up"}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
                <div className="social-wrap">
                  <p className="or">
                    <span>or</span>
                  </p>
                  <p className="mb-3 text-center">Sign in with Google</p>
                  <p className="social-media d-flex justify-content-center">
                    <GoogleButton from="signup" />
                  </p>
                </div>
                <div className="w-100 text-center">
                  <p className="mt-4">
                    I'm already a member! <Link to="/login">Sign In</Link>
                  </p>
                </div>
              </div>
              <div className="text-wrap p-4 p-lg-5 d-flex img d-flex align-items-end" style={{ backgroundImage: "url(/assets/images/signuppic.webp)" }}>
                <div className="text w-100">
                  <h2 className="mb-4">Welcome to Crownify</h2>
                  <p>Join us and explore a world of premium headwear. Sign up today to access exclusive collections and special offers!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
