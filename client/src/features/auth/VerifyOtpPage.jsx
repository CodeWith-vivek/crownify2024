import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/store/AuthContext";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { authApi } from "./authApi";

const RESEND_COOLDOWN = 120;

const PAGE_STYLE = `
body, html { height: 100%; margin: 0; font-family: Arial, sans-serif; }
.otp-section { display: flex; flex-direction: row; height: 100vh; }
.left-side { background-size: cover; width: 50%; }
.right-side { padding: 100px; width: 50%; background-color: #f3f7ff; display: flex; justify-content: center; align-items: center; position: relative; flex-direction: column; }
.otp-card { background-color: white; padding: 30px; border-radius: 8px; width: 100%; max-width: 400px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); text-align: center; }
.otp-card h2 { margin-bottom: 20px; font-weight: 700; font-size: 24px; }
.otp-input { box-shadow: inset 0 0 12px -4px #888; border-radius: 16px; width: 40px; height: 40px; font-size: 24px; text-align: center; margin: 0 5px; border: 1px solid #ccc; }
.timer { margin-top: 15px; font-size: 14px; color: gray; }
.resend-link { color: #007bff; cursor: pointer; }
@media (max-width: 768px) { .otp-section { flex-direction: column; } .left-side, .right-side { width: 100%; height: 50%; } }
h2 { width: 300px; }
.timer-container { text-align: center; flex-direction: row; align-items: center; margin-top: 15px; font-size: 14px; color: gray; }
`;

export function VerifyOtpPage() {
  usePageAssets("user", "headerotpsignup", userProfiles);

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef([]);
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleDigitChange = (idx, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[idx] = value;
    setDigits(next);
    if (value && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const otp = digits.join("");
    if (otp.length !== 6) {
      toast.error("Enter the full 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.verifyOtp(otp);
      if (res?.success) {
        toast.success(res.message || "Verified");
        await refreshMe();
        navigate(res.redirectUrl || "/");
      } else {
        toast.error(res?.message || "Invalid OTP");
      }
    } catch (err) {
      toast.error(err.message || "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await authApi.resendOtp();
      if (res?.success) {
        toast.success(res.message || "OTP resent");
        setCooldown(RESEND_COOLDOWN);
      } else {
        toast.error(res?.message || "Could not resend OTP");
      }
    } catch (err) {
      toast.error(err.message || "Could not resend OTP");
    }
  };

  const mm = String(Math.floor(cooldown / 60)).padStart(2, "0");
  const ss = String(cooldown % 60).padStart(2, "0");

  return (
    <>
      <style>{PAGE_STYLE}</style>
      <section className="ftco-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="wrap d-md-flex">
                <div className="text-wrap p-4 p-lg-5 d-flex img d-flex align-items-end" style={{ backgroundImage: "url(/assets/images/otpverification.webp)" }}>
                  <div className="text w-100">
                    <h2 className="mb-4">Verify Your Account</h2>
                    <p style={{ color: "white" }}>Enter the OTP sent to your registered email or phone to complete your signup and start shopping with Crownify!</p>
                  </div>
                </div>

                <div
                  className="right-side justify-content-center"
                  style={{ backgroundImage: "url(/assets/images/logindesign4.webp)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
                >
                  <h2>OTP Verification</h2>
                  <p style={{ lineHeight: 1.6 }}>Enter the OTP sent to your email{user?.email ? <strong> {user.email}</strong> : null}</p>
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
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                      />
                    ))}
                  </div>

                  <div className="timer-container">
                    <div className="timer">
                      {cooldown > 0 ? `${mm}:${ss} Sec` : "Code expired"}
                    </div>
                    <div>
                      Don't receive code?{" "}
                      <span className="resend-link" onClick={cooldown > 0 ? undefined : handleResend} style={{ opacity: cooldown > 0 ? 0.5 : 1 }}>
                        Re-send
                      </span>
                    </div>
                  </div>

                  <button className="btn btn-primary w-70 mt-3 mb-3" style={{ borderRadius: 6 }} onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Verifying..." : "Continue"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
