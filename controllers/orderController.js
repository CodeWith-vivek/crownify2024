const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const env = require("dotenv").config();
const Coupon = require("../models/couponSchema");
const User = require("../models/userSchema");
const Transaction = require("../models/transactionSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");



const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//code to place order

const placeOrder = async (req, res) => {
  try {
 
    const userId = req.session.user;

    const { primaryAddressId, subtotal, shipping, paymentMethod } =
      req.body;

     if (req.session.coupon && req.session.coupon.temporary) {
       const couponExists = await Coupon.findOne({
         code: req.session.coupon.code,
       });
       if (!couponExists) {
         return res.status(400).json({
           success: false,
           message: "The applied coupon is no longer valid. Please refresh and try again.",
         });
       }
     }

    const subtotalValue = Math.floor(Number(subtotal)); 
    const totalBeforeDiscount = Math.floor(subtotalValue + Number(shipping)); 
    console.log(
      "Subtotal:",
      subtotalValue,
      "Total Before Discount:",
      totalBeforeDiscount
    );


    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
   
      return res.status(404).json({
        success: false,
        message: "No items in the cart to proceed",
      });
    }


    const orderProducts = [];
    for (let i = 0; i < cart.items.length; i++) {
      const cartItem = cart.items[i];


      const product = await Product.findById(cartItem.productId);
      if (!product) {
        throw new Error(`Product not found: ${cartItem.productId}`);
      }
     
      if (product.isBlocked) {
   
        return res.status(400).json({
          success: false,
          message: `Product ${product.productName} is currently unavailable`,
        });
      }

      const category = await Category.findById(product.category);
      if (category && category.isListed === false) {
     
        return res.status(400).json({
          success: false,
          message: `Category of product ${product.productName} is currently unavailable`,
        });
      }

      const brand = await Brand.findById(product.brandName);
      if (brand && brand.isBlocked) {
       
        return res.status(400).json({
          success: false,
          message: `Brand of product ${product.productName} is currently unavailable`,
        });
      }

      const variantIndex = product.variants.findIndex(
        (v) =>
          v.size === cartItem.variant.size && v.color === cartItem.variant.color
      );

      if (variantIndex === -1) {
       
        return res.status(400).json({
          success: false,
          message: `Variant not found for product ${product.productName}`,
        });
      }

      if (product.variants[variantIndex].quantity < cartItem.quantity) {
   
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.productName} in selected variant`,
        });
      }

      orderProducts.push({
        productId: cartItem.productId,
        productName: product.productName,
        variant: {
          color: cartItem.variant.color,
          size: cartItem.variant.size,
        },
        quantity: cartItem.quantity,
        regularPrice: Math.floor(product.regularPrice), 
        salePrice: Math.floor(product.salePrice), 
        totalPrice: Math.floor(product.salePrice * cartItem.quantity), 
        productImage: product.productImage[0],
      });
    }
   

 
    const primaryAddress = await Address.findOne({
      _id: primaryAddressId,
      userId,
    });
    if (!primaryAddress) {
    
      return res.status(404).json({
        success: false,
        message: "Primary address not found",
      });
    }
    
    let discount = 0;
    let appliedCoupon = null;
    let couponToApply = null;
    if (req.session.coupon && req.session.coupon.temporary) {

      const coupon = await Coupon.findOne({ code: req.session.coupon.code });

    if (!coupon) {
  
      return res.status(400).json({
        success: false,
        message:
          "The applied coupon is no longer valid. Please refresh and try again.",
      });
    }
      couponToApply = coupon;
      appliedCoupon = coupon.code;

      if (coupon.discountType === "percentage") {
        discount = Math.floor(
          Math.min(
            (totalBeforeDiscount * coupon.discountAmount) / 100,
            coupon.maxDiscount || Infinity
          )
        ); 
      
      } else if (coupon.discountType === "fixed") {
        discount = Math.floor(
          Math.min(coupon.discountAmount, totalBeforeDiscount)
        ); 
       
      }
    }
  
    const grandTotal = Math.floor(totalBeforeDiscount - discount); 

if (paymentMethod === "Wallet") {

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (user.wallet < grandTotal) {
    return res.status(400).json({
      success: false,
      message: "Insufficient wallet balance",
    });
  }

  user.wallet -= grandTotal;
  await user.save();

  const generateOrderNumber = () => {
    return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const order = new Order({
    userId,
    primaryAddressId,
    items: orderProducts,
    subtotal: subtotalValue,
    total: totalBeforeDiscount,
    shipping,
    discount,
    grandTotal,
    couponCode: appliedCoupon,
    paymentMethod,
    shippingAddress: primaryAddressId,
    paymentStatus: "Completed",
    orderNumber: generateOrderNumber(),
  });

  if (couponToApply) {
    order.couponDetails = {
      code: appliedCoupon,
      discountType: couponToApply.discountType,
      discountAmount: discount,
    };

    const userEntry = couponToApply.users_applied.find(
      (entry) => entry.user.toString() === userId.toString()
    );
    if (!userEntry) {
      couponToApply.users_applied.push({ user: userId, used_count: 1 });
    } else {
      userEntry.used_count += 1;
    }
    await couponToApply.save();
  }

  await order.save();

  const transaction = new Transaction({
    userId,
    amount: grandTotal,
    type: "debit",
    description: `Order payment for Order ID: ${order.orderNumber}`,
  });
  await transaction.save();

  for (let i = 0; i < cart.items.length; i++) {
    const cartItem = cart.items[i];
    const product = await Product.findById(cartItem.productId);
    const variantIndex = product.variants.findIndex(
      (v) =>
        v.size === cartItem.variant.size && v.color === cartItem.variant.color
    );
    product.variants[variantIndex].quantity -= cartItem.quantity;
    await product.save();
  }


  req.session.coupon = null;
  await Cart.deleteOne({ userId });

  return res.json({
    success: true,
    message: "Order placed successfully using wallet",
    orderId: order._id,
    orderedItems: orderProducts,
  });
} else if (paymentMethod === "RazorPay") {
  console.log("Processing RazorPay Payment...");
  const razorpayOrderOptions = {
    amount: Math.round(grandTotal * 100), 
    currency: "INR",
    receipt: `order_${Date.now()}`,
    payment_capture: 1,
  };
 

  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);
  } catch (err) {
    console.error("RazorPay Order Creation Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create RazorPay order",
      error: err.message || err,
    });
  }
  const generateOrderNumber = () => {
    return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`; 
  };

  const preliminaryOrder = new Order({
    userId,
    primaryAddressId,
    items: orderProducts,
    subtotal: subtotalValue,
    total: totalBeforeDiscount,
    shipping,
    discount,
    grandTotal,
    couponDetails: couponToApply
      ? {
          code: appliedCoupon,
          discountType: couponToApply.discountType,
          discountAmount: discount,
        }
      : null,
    paymentMethod,
    shippingAddress: primaryAddressId,
    razorpayOrderId: razorpayOrder.id,
    paymentStatus: "Pending",
    orderNumber: generateOrderNumber(),
  });

  await preliminaryOrder.save();
 
  return res.json({
    success: true,
    message: "Razorpay order created",
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrderOptions.amount,
    key: process.env.RAZORPAY_KEY_ID,
    orderId: preliminaryOrder._id,
  });
} else if (paymentMethod === "COD") {
  const generateOrderNumber = () => {
    return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`; 
  };


  if (couponToApply) {
    const userEntry = couponToApply.users_applied.find(
      (entry) => entry.user && entry.user.toString() === userId.toString()
    );
    if (!userEntry) {
      couponToApply.users_applied.push({ user: userId, used_count: 1 });
    } else {
      userEntry.used_count += 1;
    }
    await couponToApply.save();
  }

  const order = new Order({
    userId,
    primaryAddressId,
    items: orderProducts,
    subtotal: subtotalValue,
    total: totalBeforeDiscount,
    shipping,
    discount,
    grandTotal,
    couponCode: appliedCoupon,
    paymentMethod,
    shippingAddress: primaryAddressId,
    paymentStatus: "Pending",
    orderNumber: generateOrderNumber(),
  });

  await order.save();

  for (let i = 0; i < cart.items.length; i++) {
    const cartItem = cart.items[i];
    const product = await Product.findById(cartItem.productId);

    const variantIndex = product.variants.findIndex(
      (v) =>
        v.size === cartItem.variant.size && v.color === cartItem.variant.color
    );

    product.variants[variantIndex].quantity -= cartItem.quantity;
    await product.save();
  }

  req.session.coupon = null;
  await Cart.deleteOne({ userId });

  return res.json({
    success: true,
    message: "Order placed successfully with Cash on Delivery",
    orderId: order._id,
    orderedItems: orderProducts,
  });
}
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({
      success: false,
      message: "Error placing order",
      error: error.message || error,
    });
  }
};

// code to cancel order

const cancelOrder = async (req, res) => {
  try {
    const { orderNumber, productSize, productColor, cancelComment } = req.body;
    console.log(req.body);

    if (!orderNumber || !productSize || !productColor) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        receivedData: req.body,
      });
    }

    const userId = req.session.user;

    const order = await Order.findOne({ orderNumber, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderItemIndex = order.items.findIndex((item) => {
      if (!item.variant) return false;

      const itemSize = item.variant.size.toUpperCase();
      const requestSize = productSize.toUpperCase();

      const itemColor = item.variant.color.toUpperCase();
      const requestColor = productColor.toUpperCase();

      return itemSize === requestSize && itemColor === requestColor;
    });

    if (orderItemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in order",
      });
    }

    const orderItem = order.items[orderItemIndex];

    if (orderItem.orderStatus === "canceled") {
      return res.status(400).json({
        success: false,
        message: "This item is already canceled",
      });
    }

    const productIdFromOrder = orderItem.productId;

    const product = await Product.findById(productIdFromOrder);
    if (product) {
      const variantIndex = product.variants.findIndex(
        (v) =>
          v.size.toUpperCase() === productSize.toUpperCase() &&
          v.color.toUpperCase() === productColor.toUpperCase()
      );

      if (variantIndex !== -1) {
        product.variants[variantIndex].quantity += orderItem.quantity;
        await product.save();
      }
    }

    const totalOrderPrice = order.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    const itemShare = orderItem.totalPrice / totalOrderPrice;

    const discountForItem = order.discount * itemShare;

    const refundAmount = Math.floor(orderItem.totalPrice - discountForItem);
    let refundShipping = 0;

    if (
      order.paymentMethod === "RazorPay" ||
      order.paymentMethod === "Wallet"
    ) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found for wallet refund",
        });
      }

      user.wallet = (user.wallet || 0) + refundAmount;

      const totalShippingCharge = order.shipping || 0;
      const itemsCount = order.items.length;

      const shippingPerItem =
        itemsCount > 0 ? totalShippingCharge / itemsCount : 0;

      const remainingItems = order.items.filter(
        (item, index) =>
          item.orderStatus !== "canceled" && index !== orderItemIndex
      );

      if (remainingItems.length === 0) {
        refundShipping = totalShippingCharge;
        order.shipping = 0;
      } else {
        refundShipping = Math.floor(shippingPerItem); 
        order.shipping -= refundShipping;
      }

      user.wallet += refundShipping;

      await user.save();

      const transaction = new Transaction({
        userId,
        amount: refundAmount + refundShipping, 
        type: "credit",
        description: `Refund for canceled order item: ${orderItem.productName}`,
      });
      await transaction.save();
    }

    console.log("Updated Shipping Charge:", order.shipping);

    order.items[orderItemIndex].orderStatus = "canceled";
    if (cancelComment) {
      order.items[orderItemIndex].cancelComment = cancelComment;
    }
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order item canceled successfully",
      refundAmount,
      refundShipping,
    });
  } catch (error) {
    console.error("Cancel product error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error canceling product from order",
      receivedData: req.body,
    });
  }
};

//code to return item

const deletepremilinaryOrder = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "Order ID is required for deletion",
    });
  }

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be deleted",
      });
    }

    await Order.findByIdAndDelete(orderId);
    console.log("DEBUG: Preliminary order deleted:", orderId);

    return res.json({
      success: true,
      message: "Preliminary order deleted successfully",
    });
  } catch (err) {
    console.error("DEBUG: Error deleting preliminary order:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete preliminary order",
      error: err.message,
    });
  }
};
const returnItem = async (req, res) => {
  try {
    const { orderNumber, productSize, productColor, returnComment } = req.body;

    if (!orderNumber || !productSize || !productColor) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        receivedData: req.body,
      });
    }

    const userId = req.session.user;


    const order = await Order.findOne({ orderNumber, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderItemIndex = order.items.findIndex((item) => {
      if (!item.variant) return false;

      const itemSize = item.variant.size.toUpperCase();
      const requestSize = productSize.toUpperCase();

      const itemColor = item.variant.color.toUpperCase();
      const requestColor = productColor.toUpperCase();

      return itemSize === requestSize && itemColor === requestColor;
    });

    if (orderItemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in order",
      });
    }

    const orderItem = order.items[orderItemIndex];

    if (orderItem.orderStatus === "Return requested") {
      return res.status(400).json({
        success: false,
        message: "This item is already in the return process",
      });
    }

    order.items[orderItemIndex].orderStatus = "Return requested";
    if (returnComment) {
      order.items[orderItemIndex].returnComment = returnComment;
    }

    const productIdFromOrder = orderItem.productId;
    const product = await Product.findById(productIdFromOrder);
    if (product) {
      const variantIndex = product.variants.findIndex(
        (v) =>
          v.size.toUpperCase() === productSize.toUpperCase() &&
          v.color.toUpperCase() === productColor.toUpperCase()
      );

      if (variantIndex !== -1) {
        product.variants[variantIndex].quantity += orderItem.quantity; 
        await product.save();
      }
    }

    await order.save();

    res.json({
      success: true,
      message: "Return request submitted successfully",
      updatedOrder: order,
    });
  } catch (error) {
    console.error("Return request error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error requesting return for product",
      receivedData: req.body,
    });
  }
};

//code to cancel return request

const cancelReturn = async (req, res) => {
  const { orderNumber, itemIndex } = req.body;

  try {

    const order = await Order.findByOne(orderNumber);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (itemIndex < 0 || itemIndex >= order.items.length) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid item index" });
    }


    const orderItem = order.items[itemIndex];

    if (orderItem.orderStatus === "Canceled") {
      return res.status(400).json({
        success: false,
        message: "This item return request is already canceled",
      });
    }

    const refundAmount = Math.floor(orderItem.totalPrice); 

    orderItem.orderStatus = "Placed"; s

    await order.save();

    return res.json({
      success: true,
      message: "Return request canceled successfully",
      refundAmount, 
    });
  } catch (error) {
    console.error("Error canceling return request:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

//code to verify razorpay payment

const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isSignatureValid = generatedSignature === razorpay_signature;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!isSignatureValid) {

      order.paymentStatus = "Failed";
      order.paymentDetails = {
        razorpayOrderId: razorpay_order_id,
        paymentStatus: "Signature Invalid",
        failureReason: "Invalid payment signature",
        paymentDate: new Date(),
      };

      await order.save();

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature. Payment failed.",
      });
    }

    if (order.couponCode) {
      const coupon = await Coupon.findOne({ code: order.couponCode });
      if (coupon) {
        const userEntry = coupon.users_applied.find(
          (entry) =>
            entry.user && entry.user.toString() === order.userId.toString()
        );
        if (!userEntry) {
          coupon.users_applied.push({ user: order.userId, used_count: 1 });
        } else {
          userEntry.used_count += 1;
        }
        await coupon.save();
      }
    }

    for (let item of order.items) {
      const product = await Product.findById(item.productId);

      const variantIndex = product.variants.findIndex(
        (v) => v.size === item.variant.size && v.color === item.variant.color
      );

      product.variants[variantIndex].quantity -= item.quantity;
      await product.save();
    }

    order.paymentStatus = "Completed";
    order.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentDate: new Date(),
    };

    await order.save();

    req.session.coupon = null;
    await Cart.deleteOne({ userId: order.userId });

    res.json({
      success: true,
      message: "Payment successful",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    if (req.body.orderId) {
      const order = await Order.findById(req.body.orderId);
      if (order) {
        order.paymentStatus = "Failed";
        order.paymentDetails = {
          razorpayOrderId: req.body.razorpay_order_id,
          paymentStatus: "Error During Verification",
          failureReason: error.message || "Unknown error",
          paymentDate: new Date(),
        };
        await order.save();
      }
    }

    res.status(500).json({
      success: false,
      message: "Error verifying payment",
    });
  }
};

module.exports = {
  placeOrder,
  cancelOrder,
  returnItem,
  verifyRazorpayPayment,
  cancelReturn,
  deletepremilinaryOrder,
 
};
