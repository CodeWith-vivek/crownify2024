import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "./authApi";

export function ForgotPasswordPage() {
  const [step, setStep] = useState("email"); // email -> otp -> done
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authApi.forgotEmailValid(email);
      if (res?.success) {
        toast.success(res.message || "OTP sent");
        setStep("otp");
      } else {
        toast.error(res?.message || "Email not found");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
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
      toast[res?.success ? "success" : "error"](res?.message || "Something went wrong");
    } catch (err) {
      toast.error(err.message || "Could not resend OTP");
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const password = form.get("password");
    const cPassword = form.get("cPassword");
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

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl text-primary">
            {step === "email" && "Forgot Password"}
            {step === "otp" && "Verify OTP"}
            {step === "reset" && "Set New Password"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input id="otp" required value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Verifying..." : "Verify OTP"}
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={handleResendOtp}>
                Resend OTP
              </Button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cPassword">Confirm password</Label>
                <Input id="cPassword" name="cPassword" type="password" required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving..." : "Reset Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
