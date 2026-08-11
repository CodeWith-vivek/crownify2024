import { apiClient } from "@/lib/apiClient";

export const adminApi = {
  me: () => apiClient.get("/api/admin/me"),
  login: (payload) => apiClient.post("/api/admin/login", payload),
  logout: () => apiClient.post("/api/admin/logout", {}),
  dashboard: () => apiClient.get("/api/admin/dashboard"),

  // orders
  orders: (page = 1, search = "") =>
    apiClient.get(`/api/admin/orderlist?page=${page}&search=${encodeURIComponent(search)}`),
  orderDetails: (id, itemId) => apiClient.get(`/api/admin/orderDetails/${id}?itemId=${itemId}`),
  updateOrderStatus: (payload) => apiClient.post("/api/admin/update-status", payload),

  // customers
  customers: (page = 1, search = "") =>
    apiClient.get(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`),
  blockCustomer: (id) => apiClient.get(`/api/admin/blockCustomer?id=${id}`),
  unblockCustomer: (id) => apiClient.get(`/api/admin/unblockCustomer?id=${id}`),

  // categories
  categories: (page = 1) => apiClient.get(`/api/admin/category?page=${page}`),
  addCategory: (payload) => apiClient.post("/api/admin/addCategory", payload),
  addCategoryOffer: (payload) => apiClient.post("/api/admin/addCategoryOffer", payload),
  removeCategoryOffer: (categoryId) => apiClient.post("/api/admin/removeCategoryOffer", { categoryId }),
  listCategory: (id) => apiClient.get(`/api/admin/listCategory?id=${id}`),
  unlistCategory: (id) => apiClient.get(`/api/admin/unlistCategory?id=${id}`),
  getEditCategory: (id) => apiClient.get(`/api/admin/editCategory?id=${id}`),
  editCategory: (id, payload) => apiClient.put(`/api/admin/editCategory/${id}`, payload),

  // brands
  brands: (page = 1) => apiClient.get(`/api/admin/brands?page=${page}`),
  addBrand: (formData) => apiClient.uploadForm("/api/admin/addBrand", formData),
  blockBrand: (id) => apiClient.get(`/api/admin/blockBrand?id=${id}`),
  unblockBrand: (id) => apiClient.get(`/api/admin/unBlockBrand?id=${id}`),
  deleteBrand: (id) => apiClient.get(`/api/admin/deleteBrand?id=${id}`),

  // products
  productAddPage: () => apiClient.get("/api/admin/addProducts"),
  addProducts: (formData) => apiClient.uploadForm("/api/admin/addProducts", formData),
  products: (page = 1, search = "") =>
    apiClient.get(`/api/admin/products?page=${page}&search=${encodeURIComponent(search)}`),
  addProductOffer: (payload) => apiClient.post("/api/admin/addProductOffer", payload),
  removeProductOffer: (productId) => apiClient.post("/api/admin/removeProductOffer", { productId }),
  blockProduct: (id) => apiClient.get(`/api/admin/blockProduct?id=${id}`),
  unblockProduct: (id) => apiClient.get(`/api/admin/unblockProduct?id=${id}`),
  getEditProduct: (id) => apiClient.get(`/api/admin/editProduct?id=${id}`),
  editProduct: (id, formData) => apiClient.uploadForm(`/api/admin/editProduct/${id}`, formData),
  deleteImage: (payload) => apiClient.post("/api/admin/deleteImage", payload),

  // coupons
  couponManagement: () => apiClient.get("/api/admin/coupon-management"),
  addCoupon: (payload) => apiClient.post("/api/admin/add-coupon", payload),
  deleteCoupon: (id) => apiClient.delete(`/api/admin/coupons/${id}`),
  getEditCoupon: (id) => apiClient.get(`/api/admin/edit-coupon/${id}`),
  updateCoupon: (id, payload) => apiClient.post(`/api/admin/edit-coupon/${id}`, payload),

  // contact messages
  contactMessages: (page = 1, search = "") =>
    apiClient.get(`/api/admin/contactMessages?page=${page}&search=${encodeURIComponent(search)}`),
};
