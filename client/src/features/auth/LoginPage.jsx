import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/store/AuthContext";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { authApi } from "./authApi";
import { GoogleButton } from "./GoogleButton";
import { validateEmailStrict, validateStrongPassword } from "@/lib/validators";

export function LoginPage() {
  usePageAssets("user", "header2", userProfiles);

  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { refreshMe } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const nextForm = { ...form, [e.target.name]: e.target.value };
    setForm(nextForm);
    if (e.target.name === "email") setFieldErrors((prev) => ({ ...prev, email: validateEmailStrict(nextForm.email) }));
    if (e.target.name === "password") setFieldErrors((prev) => ({ ...prev, password: validateStrongPassword(nextForm.password) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const emailErr = validateEmailStrict(form.email);
    const passErr = validateStrongPassword(form.password);
    setFieldErrors({ email: emailErr, password: passErr });
    if (emailErr || passErr) return;
    setSubmitting(true);
    try {
      const res = await authApi.login(form);
      if (res?.success) {
        toast.success(res.message || "Login successful");
        await refreshMe();
        navigate("/");
      } else {
        setError(res?.message || "Login failed");
      }
    } catch (err) {
      setError(err.message || "Login failed");
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
                className="text-wrap p-4 p-lg-5 d-flex img d-flex align-items-end"
                style={{ backgroundImage: "url(/assets/images/loginpic.webp)" }}
              >
                <div className="text w-100">
                  <h2 className="mb-4">Welcome Back to Crownify</h2>
                  <p style={{ lineHeight: 1.6, color: "white" }}>
                    Log in to your account to continue exploring our exclusive headwear collection and personalized offers!
                  </p>
                </div>
              </div>

              <div
                className="login-wrap p-4 p-md-5"
                style={{
                  backgroundImage: "url(/assets/images/logindesign4.webp)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  lineHeight: 1.6,
                }}
              >
                <h3 className="mb-3" style={{ fontWeight: 600 }}>
                  Login
                </h3>
                {error && <div style={{ color: "red" }}>{error}</div>}

                <form onSubmit={handleSubmit} className="signup-form" id="signform">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="email">
                          Email Address
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          name="email"
                          id="email"
                          placeholder="Enter email"
                          value={form.email}
                          onChange={handleChange}
                        />
                        <div id="error1" className="error-message" style={{ display: fieldErrors.email ? "block" : "none", color: "red" }}>{fieldErrors.email}</div>
                      </div>
                    </div>

                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="password">
                          Password
                        </label>
                        <div className="input-group">
                          <input
                            type="password"
                            id="password"
                            className="form-control"
                            name="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={handleChange}
                          />
                          <span className="input-group-text" style={{ cursor: "pointer" }}>
                            <i className="fa fa-eye"></i>
                          </span>
                        </div>
                        <div id="error2" className="error-message" style={{ display: fieldErrors.password ? "block" : "none", color: "red" }}>{fieldErrors.password}</div>
                      </div>
                    </div>

                    <div className="col-md-12 my-4">
                      <div className="form-group">
                        <div className="w-100">
                          <label className="checkbox-wrap checkbox-primary">
                            <Link to="/forget-password">Forgot Password ?</Link>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-12 text-center">
                      <div className="form-group">
                        <button type="submit" className="btn btn-secondary submit" disabled={submitting}>
                          {submitting ? "Logging in..." : "Login"}
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
                    <GoogleButton from="login" />
                  </p>
                </div>
                <div className="w-100 text-center">
                  <p className="mt-4">
                    Don't have an account? <Link to="/signup">Sign up here</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
