import { apiClient } from "@/lib/apiClient";

export const authApi = {
  signup: (data) => apiClient.post("/api/signup", data),
  verifyOtp: (otp) => apiClient.post("/api/verify-otp", { otp }),
  resendOtp: () => apiClient.post("/api/resend-otp", {}),
  login: (data) => apiClient.post("/api/login", data),
  logout: () => apiClient.get("/api/logout"),
  me: () => apiClient.get("/api/auth/me"),

  forgotEmailValid: (email) => apiClient.post("/api/forget-email-valid", { email }),
  verifyOtpForgot: (otp) => apiClient.post("/api/verify-otp-forgot", { otp }),
  resendOtpForgot: () => apiClient.post("/api/resend-otp-forgot", {}),
  resetPassword: (password, cPassword) =>
    apiClient.post("/api/reset-password", { password, cPassword }),
};

export const googleLoginUrl = (from = "login") => `/api/auth/google?from=${from}`;
