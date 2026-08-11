import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ComingSoon } from "@/components/layout/ComingSoon";

// Each ComingSoon stub below is replaced with its real feature page in a
// later chunk (see the SPA conversion plan) — this route tree exists now so
// URL structure mirrors the current EJS app 1:1 from day one.
export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<ComingSoon title="Home" />} />
        <Route path="/shop" element={<ComingSoon title="Shop" />} />
        <Route path="/brand" element={<ComingSoon title="Brand" />} />
        <Route path="/product/:id" element={<ComingSoon title="Product Details" />} />
        <Route path="/About" element={<ComingSoon title="About" />} />
        <Route path="/contact" element={<ComingSoon title="Contact" />} />
        <Route path="/faq" element={<ComingSoon title="FAQ" />} />

        <Route path="/login" element={<ComingSoon title="Login" />} />
        <Route path="/signup" element={<ComingSoon title="Signup" />} />
        <Route path="/verify-otp" element={<ComingSoon title="Verify OTP" />} />
        <Route path="/forget-password" element={<ComingSoon title="Forgot Password" />} />
        <Route path="/reset-password" element={<ComingSoon title="Reset Password" />} />

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
