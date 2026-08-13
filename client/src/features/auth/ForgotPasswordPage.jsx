import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { authApi } from "./authApi";
import { validateEmailLoose, validatePasswordPair } from "@/lib/validators";

const RESEND_COOLDOWN = 120;

const OTP_STYLE = `
body, html { height: 100%; margin: 0; font-family: Arial, sans-serif; }
.otp-section { display: flex; flex-direction: row; height: 100vh; }
.left-side { background-size: cover; width: 50%; }
.right-side { padding: 100px; width: 50%; background-color: #f3f7ff; display: flex; justify-content: center; align-items: center; position: relative; flex-direction: column; }
.otp-input { box-shadow: inset 0 0 12px -4px #888; border-radius: 16px; width: 40px; height: 40px; font-size: 24px; text-align: center; margin: 0 5px; border: 1px solid #ccc; }
.timer { margin-top: 15px; font-size: 14px; color: gray; }
.resend-link { color: #10973b; cursor: pointer; }
@media (max-width: 768px) { .otp-section { flex-direction: column; } .left-side, .right-side { width: 100%; height: 50%; } }
h2 { width: 300px; }
.timer-container { text-align: center; flex-direction: row; align-items: center; margin-top: 15px; font-size: 14px; color: gray; }
`;

const PROFILE_BY_STEP = { email: "headerforget", otp: "headerotp", reset: "headernewpassword" };

export function ForgotPasswordPage() {
  const [step, setStep] = useState("email");
  usePageAssets("user", PROFILE_BY_STEP[step], userProfiles);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef([]);
  const navigate = useNavigate();

  const [resetForm, setResetForm] = useState({ password: "", cPassword: "" });
  const [resetErrors, setResetErrors] = useState({ password: "", cPassword: "" });

  useEffect(() => {
    if (step !== "otp" || cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, cooldown]);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(validateEmailLoose(value));
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const err = validateEmailLoose(email);
    setEmailError(err);
    if (err) return;
    setSubmitting(true);
    try {
      const res = await authApi.forgotEmailValid(email);
      if (res?.success) {
        toast.success(res.message || "OTP sent");
        setStep("otp");
        setCooldown(RESEND_COOLDOWN);
      } else {
        toast.error(res?.message || "Email not found");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDigitChange = (idx, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[idx] = value;
    setDigits(next);
    if (value && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const handleOtpSubmit = async () => {
    const otp = digits.join("");
    if (otp.length !== 6) {
      toast.error("Enter the full 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.verifyOtpForgot(otp);
      if (res?.success) {
        toast.success(res.message || "OTP verified");
        setStep("reset");
      } else {
        toast.error(res?.message || "Invalid OTP");
      }
    } catch (err) {
      toast.error(err.message || "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await authApi.resendOtpForgot();
      if (res?.success) {
        toast.success(res.message || "OTP resent");
        setCooldown(RESEND_COOLDOWN);
      } else {
        toast.error(res?.message || "Something went wrong");
      }
    } catch (err) {
      toast.error(err.message || "Could not resend OTP");
    }
  };

  const handleResetChange = (e) => {
    const nextForm = { ...resetForm, [e.target.name]: e.target.value };
    setResetForm(nextForm);
    const pair = validatePasswordPair(nextForm.password, nextForm.cPassword);
    setResetErrors({ password: pair.password, cPassword: pair.confirm });
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const { password, cPassword } = resetForm;
    const pair = validatePasswordPair(password, cPassword);
    setResetErrors({ password: pair.password, cPassword: pair.confirm });
    if (pair.password || pair.confirm) return;
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword(password, cPassword);
      if (res?.success) {
        toast.success(res.message || "Password reset successful");
        navigate("/login");
      } else {
        toast.error(res?.message || "Reset failed");
      }
    } catch (err) {
      toast.error(err.message || "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  const mm = String(Math.floor(cooldown / 60)).padStart(2, "0");
  const ss = String(cooldown % 60).padStart(2, "0");

  if (step === "email") {
    return (
      <section className="ftco-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="wrap d-md-flex">
                <div className="login-wrap p-4 p-md-5" style={{ backgroundImage: "url(/assets/images/forgetPass2.webp)", backgroundSize: "cover", backgroundPosition: "center" }}>
                  <h3 className="mb-3" style={{ fontWeight: 600, paddingBottom: 24 }}>
                    Forget Password ?
                  </h3>
                  <form onSubmit={handleEmailSubmit} className="signupForm" id="signform">
                    <div className="row">
                      <div className="col-md-12">
                        <div className="form-group">
                          <label className="label" htmlFor="email">
                            Don't worry ! It happens. Please enter the phone number or email we will send the OTP in email.
                          </label>
                          <input type="email" className="form-control" name="email" id="email" placeholder="Enter the email" value={email} onChange={handleEmailChange} />
                          <div id="error2" className="error-message" style={{ display: emailError ? "block" : "none", color: "red" }}>{emailError}</div>
                        </div>
                      </div>
                      <div className="col-md-12 text-center">
                        <div className="form-group">
                          <button type="submit" className="btn btn-secondary submit" disabled={submitting}>
                            {submitting ? "Sending..." : "Continue"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
                <div className="text-wrap p-4 p-lg-5 d-flex img d-flex align-items-end" style={{ backgroundImage: "url(/assets/images/forget.webp)" }}>
                  <div className="text w-100">
                    <h2 className="mb-4">Forgot Your Password?</h2>
                    <p style={{ color: "white" }}>Don't worry! Enter your registered email to receive a link to reset your Crownify account password.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (step === "otp") {
    return (
      <>
        <style>{OTP_STYLE}</style>
        <section className="ftco-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-10">
                <div className="wrap d-md-flex">
                  <div
                    className="right-side justify-content-center"
                    style={{ backgroundImage: "url(/assets/images/forgetPass2.webp)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
                  >
                    <h2 className="mt-4">OTP for Password Reset</h2>
                    <p>
                      Enter the OTP sent to <strong>{email}</strong>
                    </p>
                    <div className="d-flex justify-content-center mb-3">
                      {digits.map((d, idx) => (
                        <input
                          key={idx}
                          type="text"
                          className="otp-input"
                          maxLength={1}
                          value={d}
                          ref={(el) => (inputRefs.current[idx] = el)}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        />
                      ))}
                    </div>
                    <div className="timer-container">
                      <div className="timer">{cooldown > 0 ? `${mm}:${ss} Sec` : "Code expired"}</div>
                      <div>
                        Don't receive code?{" "}
                        <span className="resend-link" onClick={cooldown > 0 ? undefined : handleResendOtp} style={{ opacity: cooldown > 0 ? 0.5 : 1 }}>
                          Re-send
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary w-70 mt-3 mb-3"
                      style={{ borderRadius: 6, backgroundColor: "#10973b" }}
                      onClick={handleOtpSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Verifying..." : "Continue"}
                    </button>
                  </div>
                  <div className="text-wrap p-4 p-lg-5 d-flex img d-flex align-items-end" style={{ backgroundImage: "url(/assets/images/otp2.webp)" }}>
                    <div className="text w-100">
                      <h2 className="mb-4">Verify OTP</h2>
                      <p style={{ color: "white" }}>Enter the OTP sent to your registered email to verify your identity and reset your Crownify account password.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <section className="ftco-section">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="wrap d-md-flex">
              <div className="text-wrap p-4 p-lg-5 d-flex img d-flex align-items-end" style={{ backgroundImage: "url(/assets/images/newpassword.webp)" }}>
                <div className="text w-100">
                  <h2 className="mb-4">Set Your New Password</h2>
                  <p style={{ color: "white" }}>Enter a new password to regain access to your Crownify account and continue exploring our premium headwear collection.</p>
                </div>
              </div>
              <div
                className="login-wrap p-4 p-md-5"
                style={{ backgroundImage: "url(/assets/images/newpassDesign.webp)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", height: 612 }}
              >
                <h3 className="mb-3" style={{ fontWeight: 600, paddingBottom: 40, marginTop: 30 }}>
                  New Password
                </h3>
                <form onSubmit={handleResetSubmit} className="signup-form" id="signform">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="password">
                          Password
                        </label>
                        <div className="input-group">
                          <input type="password" id="password" name="password" className="form-control" placeholder="Password" value={resetForm.password} onChange={handleResetChange} />
                          <span className="input-group-text" style={{ cursor: "pointer" }}>
                            <i className="fa fa-eye"></i>
                          </span>
                        </div>
                        <div id="error4" className="error-message" style={{ display: resetErrors.password ? "block" : "none", color: "red" }}>{resetErrors.password}</div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="form-group">
                        <label className="label" htmlFor="confirm-password">
                          Confirm Password
                        </label>
                        <div className="input-group">
                          <input type="password" className="form-control" name="cPassword" id="confirm-password" placeholder="Confirm Password" value={resetForm.cPassword} onChange={handleResetChange} />
                          <span className="input-group-text" style={{ cursor: "pointer" }}>
                            <i className="fa fa-eye"></i>
                          </span>
                        </div>
                        <div id="error5" className="error-message" style={{ display: resetErrors.cPassword ? "block" : "none", color: "red" }}>{resetErrors.cPassword}</div>
                      </div>
                    </div>
                    <div className="col-md-12 text-center">
                      <div className="form-group">
                        <button type="submit" className="btn btn-secondary submit" disabled={submitting}>
                          {submitting ? "Saving..." : "Continue"}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
