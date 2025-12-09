const express=require("express")
const router=express.Router();
const adminController=require("../controllers/adminController")
const customerController=require("../controllers/customerController")
const categoryController=require("../controllers/categoryController")
const brandController=require("../controllers/brandController")
const productController=require("../controllers/productController")
const {adminAuth}=require("../middlewares/auth")
const contactController = require("../controllers/contactController");
const couponController=require("../controllers/couponController")
const  reportController  = require("../controllers/reportController");
const topsellingController=require("../controllers/topsellingController")

const multer =require("multer")
const storage=require("../helpers/multer")
const uploads=multer({storage:storage})
router.get("/pageerror",adminController.pageerror)
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/dashboard",adminAuth,adminController.loadDashboard)
router.post("/logout",adminAuth,adminController.logout)

//customer management
router.get("/users",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerUnblocked)

//category management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer)
router.get("/listCategory",adminAuth,categoryController.getListCategory)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.put("/editCategory/:id",adminAuth,categoryController.editCategory)

//brand management
router.get("/brands",adminAuth,brandController.getBrandPage)
router.post("/addBrand",adminAuth,uploads.single("image"),brandController.addBrand)
router.get("/blockBrand",adminAuth,brandController.blockBrand)
router.get("/unBlockBrand",adminAuth,brandController.unBlockBrand)
router.get("/deleteBrand",adminAuth,brandController.deleteBrand)

//product management
router.get("/addProducts",adminAuth,productController.getProductAddPage)
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts)
router.get("/products",adminAuth,productController.getAllProducts)
router.post("/addProductOffer",adminAuth,productController.addProductOffer)
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer)
router.get("/blockProduct",adminAuth,productController.blockProduct)
router.get("/unblockProduct",adminAuth,productController.unblockProduct)
router.get("/editProduct",adminAuth,productController.getEditProduct)
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct)
router.post("/deleteImage",adminAuth,productController.deleteSingleImage)

//order managemenr

router.get("/orderlist",adminAuth,adminController.loadOrderlist)
router.get("/orderDetails/:id",adminAuth,adminController.loadOrderDetails)
router.post("/update-status",adminAuth,adminController.updateOrderStatusByAdmin);

router.get("/contactMessages", adminAuth, contactController.customerMessages);

router.get("/coupon-management",adminAuth, couponController.loadCouponManagement);
router.get("/get-coupons",adminAuth, couponController.getCoupons);
router.post("/add-coupon",adminAuth, couponController.addCoupon);
router.delete("/coupons/:id",adminAuth, couponController.deleteCoupon);
router.get('/edit-coupon/:id',adminAuth,couponController.editCoupon)
router.post('/edit-coupon/:id',adminAuth,couponController.updateCoupon)

router.post("/sales-report", adminAuth,reportController.generateSalesReport);
router.post("/sales-chart", adminAuth, reportController.salesChart);
router.post("/sales-report/pdf",adminAuth,reportController.reportPdf)
router.get("/overall-revenue",adminAuth,reportController.getOverallRevenue);
router.get("/total-orders",adminAuth,reportController.getTotalOrders);
router.get("/total-products",adminAuth,reportController.getTotalProducts);
router.get("/total-categories",adminAuth,reportController.getTotalCategories);
router.get("/top-selling-stats",adminAuth,topsellingController.getTopSellingStats);
router.post(
  "/sales-report/excel",
  adminAuth,
  reportController.downloadExcel
);

module.exports=router