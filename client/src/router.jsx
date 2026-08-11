import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { LoginPage } from "@/features/auth/LoginPage";
import { SignupPage } from "@/features/auth/SignupPage";
import { VerifyOtpPage } from "@/features/auth/VerifyOtpPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { HomePage } from "@/features/product/HomePage";
import { ShopPage } from "@/features/product/ShopPage";
import { ProductDetailsPage } from "@/features/product/ProductDetailsPage";
import { BrandPage } from "@/features/brand/BrandPage";

// Each ComingSoon stub below is replaced with its real feature page in a
// later chunk (see the SPA conversion plan) — this route tree exists now so
// URL structure mirrors the current EJS app 1:1 from day one.
export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/brand" element={<BrandPage />} />
        <Route path="/product/:id" element={<ProductDetailsPage />} />
        <Route path="/About" element={<ComingSoon title="About" />} />
        <Route path="/contact" element={<ComingSoon title="Contact" />} />
        <Route path="/faq" element={<ComingSoon title="FAQ" />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/forget-password" element={<ForgotPasswordPage />} />

        <Route path="/cart" element={<ComingSoon title="Cart" />} />
        <Route path="/wishlist" element={<ComingSoon title="Wishlist" />} />
        <Route path="/checkout" element={<ComingSoon title="Checkout" />} />
        <Route path="/payment-Success" element={<ComingSoon title="Payment Success" />} />
        <Route path="/payment-Failure" element={<ComingSoon title="Payment Failure" />} />

        <Route path="/profile" element={<ComingSoon title="Profile" />} />
        <Route path="/orders" element={<ComingSoon title="Orders" />} />
        <Route path="/Address" element={<ComingSoon title="Addresses" />} />
        <Route path="/AccountDetails" element={<ComingSoon title="Account Details" />} />
        <Route path="/wallet" element={<ComingSoon title="Wallet" />} />

        <Route path="*" element={<ComingSoon title="404 — Not Found" />} />
      </Route>

      <Route path="/admin/*" element={<ComingSoon title="Admin (Chunk 7/8)" />} />
    </Routes>
  );
}
