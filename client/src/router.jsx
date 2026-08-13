import { lazy, Suspense } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Preloader } from "@/components/layout/Preloader";
import { LoginPage } from "@/features/auth/LoginPage";
import { SignupPage } from "@/features/auth/SignupPage";
import { VerifyOtpPage } from "@/features/auth/VerifyOtpPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { HomePage } from "@/features/product/HomePage";
import { ShopPage } from "@/features/product/ShopPage";
import { ProductDetailsPage } from "@/features/product/ProductDetailsPage";
import { BrandPage } from "@/features/brand/BrandPage";
import { AboutPage } from "@/features/pages/AboutPage";
import { ContactPage } from "@/features/pages/ContactPage";
import { FaqPage } from "@/features/pages/FaqPage";
import { NotFoundPage } from "@/features/pages/NotFoundPage";
import { CartPage } from "@/features/cart/CartPage";
import { WishlistPage } from "@/features/wishlist/WishlistPage";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ProfileLayout } from "@/components/layout/ProfileLayout";
import { CheckoutPage } from "@/features/checkout/CheckoutPage";
import { PaymentSuccessPage } from "@/features/payment/PaymentSuccessPage";
import { PaymentFailurePage } from "@/features/payment/PaymentFailurePage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { AccountDetailsPage } from "@/features/profile/AccountDetailsPage";
import { OrdersPage } from "@/features/order/OrdersPage";
import { AddressPage } from "@/features/address/AddressPage";
import { WalletPage } from "@/features/wallet/WalletPage";

// Admin panel (recharts, tables, upload forms) is only ever needed by
// admins, not shoppers — lazy-loaded so the shop-facing bundle doesn't carry
// its weight (this is what fixed the >500kB Vite build warning).
const AdminAuthProvider = lazy(() =>
  import("@/store/AdminAuthContext").then((m) => ({ default: m.AdminAuthProvider }))
);
const AdminProtectedRoute = lazy(() =>
  import("@/features/admin/AdminProtectedRoute").then((m) => ({ default: m.AdminProtectedRoute }))
);
const AdminLayout = lazy(() => import("@/features/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() =>
  import("@/features/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage }))
);
const DashboardPage = lazy(() => import("@/features/admin/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const OrderListPage = lazy(() =>
  import("@/features/admin/orders/OrderListPage").then((m) => ({ default: m.OrderListPage }))
);
const OrderDetailsPage = lazy(() =>
  import("@/features/admin/orders/OrderDetailsPage").then((m) => ({ default: m.OrderDetailsPage }))
);
const CustomersPage = lazy(() =>
  import("@/features/admin/customers/CustomersPage").then((m) => ({ default: m.CustomersPage }))
);
const CategoryPage = lazy(() =>
  import("@/features/admin/category/CategoryPage").then((m) => ({ default: m.CategoryPage }))
);
const EditCategoryPage = lazy(() =>
  import("@/features/admin/category/EditCategoryPage").then((m) => ({ default: m.EditCategoryPage }))
);
const AdminBrandPage = lazy(() =>
  import("@/features/admin/brand/BrandPage").then((m) => ({ default: m.BrandPage }))
);
const ProductListPage = lazy(() =>
  import("@/features/admin/products/ProductListPage").then((m) => ({ default: m.ProductListPage }))
);
const ProductFormPage = lazy(() =>
  import("@/features/admin/products/ProductFormPage").then((m) => ({ default: m.ProductFormPage }))
);
const CouponManagementPage = lazy(() =>
  import("@/features/admin/coupons/CouponManagementPage").then((m) => ({ default: m.CouponManagementPage }))
);
const EditCouponPage = lazy(() =>
  import("@/features/admin/coupons/EditCouponPage").then((m) => ({ default: m.EditCouponPage }))
);
const ContactMessagesPage = lazy(() =>
  import("@/features/admin/contact/ContactMessagesPage").then((m) => ({ default: m.ContactMessagesPage }))
);
const SalesReportPage = lazy(() =>
  import("@/features/admin/report/SalesReportPage").then((m) => ({ default: m.SalesReportPage }))
);
const AdminNotFoundPage = lazy(() =>
  import("@/features/admin/AdminNotFoundPage").then((m) => ({ default: m.AdminNotFoundPage }))
);

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/brand" element={<BrandPage />} />
        <Route path="/product/:id" element={<ProductDetailsPage />} />
        <Route path="/About" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FaqPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/forget-password" element={<ForgotPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          {/* Nested under one ProfileLayout instance so switching tabs doesn't
              unmount/remount the shared shell — that used to force its CSS
              to unload and reload on every click, flashing the preloader. */}
          <Route element={<ProfileLayout />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/Address" element={<AddressPage />} />
            <Route path="/AccountDetails" element={<AccountDetailsPage />} />
          </Route>
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Route>

        {/* Storefront catch-all. Must stay LAST inside MainLayout, and must
            not swallow /admin/* — the admin tree below has its own 404. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/payment-Success" element={<PaymentSuccessPage />} />
      <Route path="/payment-Failure" element={<PaymentFailurePage />} />

      <Route
        element={
          <Suspense fallback={<AdminLoadingFallback />}>
            <AdminAuthProvider>
              <Outlet />
            </AdminAuthProvider>
          </Suspense>
        }
      >
        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/sales-report" element={<SalesReportPage />} />
            <Route path="/admin/orderlist" element={<OrderListPage />} />
            <Route path="/admin/orderDetails/:id" element={<OrderDetailsPage />} />
            <Route path="/admin/users" element={<CustomersPage />} />
            <Route path="/admin/category" element={<CategoryPage />} />
            <Route path="/admin/editCategory/:id" element={<EditCategoryPage />} />
            <Route path="/admin/brands" element={<AdminBrandPage />} />
            <Route path="/admin/products" element={<ProductListPage />} />
            <Route path="/admin/addProducts" element={<ProductFormPage />} />
            <Route path="/admin/editProduct/:id" element={<ProductFormPage />} />
            <Route path="/admin/coupon-management" element={<CouponManagementPage />} />
            <Route path="/admin/edit-coupon/:id" element={<EditCouponPage />} />
            <Route path="/admin/contactMessages" element={<ContactMessagesPage />} />
            {/* Without this, an unknown /admin/* URL fell through to the
                storefront catch-all and rendered the shop's 404 page —
                shop header, nav and footer and all — inside the admin area. */}
            <Route path="/admin/*" element={<AdminNotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

// The admin bundle is lazy-loaded, so on a refresh of any /admin route this
// fallback is what's on screen until the chunk arrives. It used to be a bare
// <div> whose utility classes aren't in the admin stylesheet at all, which
// read as an unstyled flash; the shared Preloader is fully inline-styled and
// matches what the rest of the app shows.
function AdminLoadingFallback() {
  return <Preloader />;
}
