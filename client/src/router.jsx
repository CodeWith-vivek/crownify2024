import { Routes, Route, Outlet } from "react-router-dom";
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
import { CartPage } from "@/features/cart/CartPage";
import { WishlistPage } from "@/features/wishlist/WishlistPage";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { CheckoutPage } from "@/features/checkout/CheckoutPage";
import { PaymentSuccessPage } from "@/features/payment/PaymentSuccessPage";
import { PaymentFailurePage } from "@/features/payment/PaymentFailurePage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { AccountDetailsPage } from "@/features/profile/AccountDetailsPage";
import { OrdersPage } from "@/features/order/OrdersPage";
import { AddressPage } from "@/features/address/AddressPage";
import { WalletPage } from "@/features/wallet/WalletPage";

import { AdminAuthProvider } from "@/store/AdminAuthContext";
import { AdminProtectedRoute } from "@/features/admin/AdminProtectedRoute";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { AdminLoginPage } from "@/features/admin/AdminLoginPage";
import { DashboardPage } from "@/features/admin/DashboardPage";
import { OrderListPage } from "@/features/admin/orders/OrderListPage";
import { OrderDetailsPage } from "@/features/admin/orders/OrderDetailsPage";
import { CustomersPage } from "@/features/admin/customers/CustomersPage";
import { CategoryPage } from "@/features/admin/category/CategoryPage";
import { BrandPage as AdminBrandPage } from "@/features/admin/brand/BrandPage";
import { ProductListPage } from "@/features/admin/products/ProductListPage";
import { ProductFormPage } from "@/features/admin/products/ProductFormPage";
import { CouponManagementPage } from "@/features/admin/coupons/CouponManagementPage";
import { ContactMessagesPage } from "@/features/admin/contact/ContactMessagesPage";
import { SalesReportPage } from "@/features/admin/report/SalesReportPage";

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

        <Route element={<ProtectedRoute />}>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/Address" element={<AddressPage />} />
          <Route path="/AccountDetails" element={<AccountDetailsPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Route>

        <Route path="/payment-Success" element={<PaymentSuccessPage />} />
        <Route path="/payment-Failure" element={<PaymentFailurePage />} />

        <Route path="*" element={<ComingSoon title="404 — Not Found" />} />
      </Route>

      <Route element={<AdminAuthProvider><AdminAuthOutlet /></AdminAuthProvider>}>
        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/sales-report" element={<SalesReportPage />} />
            <Route path="/admin/orderlist" element={<OrderListPage />} />
            <Route path="/admin/orderDetails/:id" element={<OrderDetailsPage />} />
            <Route path="/admin/users" element={<CustomersPage />} />
            <Route path="/admin/category" element={<CategoryPage />} />
            <Route path="/admin/brands" element={<AdminBrandPage />} />
            <Route path="/admin/products" element={<ProductListPage />} />
            <Route path="/admin/addProducts" element={<ProductFormPage />} />
            <Route path="/admin/editProduct/:id" element={<ProductFormPage />} />
            <Route path="/admin/coupon-management" element={<CouponManagementPage />} />
            <Route path="/admin/contactMessages" element={<ContactMessagesPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

// Thin pass-through so AdminAuthProvider (a component, not usable directly as
// a route element with children) can wrap this whole route subtree via a
// parent <Route element={...}> the way React Router expects.
function AdminAuthOutlet() {
  return <Outlet />;
}
