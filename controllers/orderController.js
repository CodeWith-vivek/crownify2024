const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const env = require("dotenv").config();
const Coupon = require("../models/couponSchema");
const User = require("../models/userSchema");

//code to place order

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const placeOrder = async (req, res) => {
  try {
    console.log("===== Place Order Start =====");
    const userId = req.session.user;
    console.log("User ID:", userId);

    const { primaryAddressId, subtotal, shipping, total, paymentMethod } =
      req.body;
    console.log("Request Body:", req.body);

    const subtotalValue = Number(subtotal); // Ensure subtotal is a number
    const totalBeforeDiscount = subtotalValue + Number(shipping); // Total before applying the discount
    console.log(
      "Subtotal:",
      subtotalValue,
      "Total Before Discount:",
      totalBeforeDiscount
    );

    // Find user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      console.log("Cart is empty or not found for user:", userId);
      return res.status(404).json({
        success: false,
        message: "No items in the cart to proceed",
      });
    }
    console.log("Cart Found:", cart);

    // Prepare order products and validate stock
    const orderProducts = [];
    for (let i = 0; i < cart.items.length; i++) {
      const cartItem = cart.items[i];
      console.log("Processing Cart Item:", cartItem);

      const product = await Product.findById(cartItem.productId);
      if (!product) {
        throw new Error(`Product not found: ${cartItem.productId}`);
      }

      const variantIndex = product.variants.findIndex(
        (v) =>
          v.size === cartItem.variant.size && v.color === cartItem.variant.color
      );

      if (variantIndex === -1) {
        console.log("Variant not found for product:", product.productName);
        return res.status(400).json({
          success: false,
          message: `Variant not found for product ${product.productName}`,
        });
      }

      if (product.variants[variantIndex].quantity < cartItem.quantity) {
        console.log("Insufficient stock for:", product.productName);
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
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        totalPrice: product.salePrice * cartItem.quantity,
        productImage: product.productImage[0],
      });
    }
    console.log("Order Products:", orderProducts);

    // Validate primary address
    const primaryAddress = await Address.findOne({
      _id: primaryAddressId,
      userId,
    });
    if (!primaryAddress) {
      console.log("Primary address not found:", primaryAddressId);
      return res.status(404).json({
        success: false,
        message: "Primary address not found",
      });
    }
    console.log("Primary Address Found:", primaryAddress);

    // Handle coupon usage and calculate discount
    let discount = 0;
    let appliedCoupon = null;
    if (req.session.coupon && req.session.coupon.temporary) {
      console.log("Applying Coupon:", req.session.coupon);

      const coupon = await Coupon.findOne({ code: req.session.coupon.code });
      if (coupon) {
        appliedCoupon = coupon.code;

        if (coupon.discountType === "percentage") {
          discount = Math.min(
            (totalBeforeDiscount * coupon.discountAmount) / 100,
            coupon.maxDiscount || Infinity
          );
          console.log("Percentage Discount Applied:", discount);
        } else if (coupon.discountType === "fixed") {
          discount = Math.min(coupon.discountAmount, totalBeforeDiscount);
          console.log("Fixed Discount Applied:", discount);
        }

        // Save user usage history in the coupon
        const userEntry = coupon.users_applied.find(
          (entry) => entry.user && entry.user.toString() === userId.toString()
        );
        if (!userEntry) {
          coupon.users_applied.push({ user: userId, used_count: 1 });
        } else {
          userEntry.used_count += 1;
        }
        await coupon.save();
        req.session.coupon = null;
        console.log("Coupon Saved and Session Cleared.");
      }
    }
    console.log("Discount:", discount);

    // Adjust grand total
    const grandTotal = totalBeforeDiscount - discount;
    console.log("Grand Total:", grandTotal);
    if (paymentMethod === "Wallet") {
      console.log("Processing Wallet Payment...");
      const user = await User.findById(userId);

      if (!user) {
        console.log("User not found:", userId);
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.wallet < grandTotal) {
        console.log("Insufficient wallet balance for user:", userId);
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance",
        });
      }

      // Deduct wallet balance
      user.wallet -= grandTotal;
      await user.save();
      console.log("Wallet balance updated for user:", userId);

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
        status: "Confirmed",
      });

      await order.save();
      console.log("Wallet Order Saved:", order);

      for (let i = 0; i < cart.items.length; i++) {
        const cartItem = cart.items[i];
        const product = await Product.findById(cartItem.productId);

        const variantIndex = product.variants.findIndex(
          (v) =>
            v.size === cartItem.variant.size &&
            v.color === cartItem.variant.color
        );

        product.variants[variantIndex].quantity -= cartItem.quantity;
        await product.save();
      }

      await Cart.deleteOne({ userId });
      console.log("Cart Cleared for User:", userId);

      return res.json({
        success: true,
        message: "Order placed successfully using wallet",
        orderId: order._id,
        orderedItems: orderProducts,
      });
    } else if (paymentMethod === "RazorPay") {
      console.log("Processing RazorPay Payment...");
      const razorpayOrderOptions = {
        amount: Math.round(grandTotal * 100), // Amount in paise
        currency: "INR",
        receipt: `order_${Date.now()}`,
        payment_capture: 1,
      };
      console.log("RazorPay Order Options:", razorpayOrderOptions);

      let razorpayOrder;
      try {
        razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);
        console.log("RazorPay Order Created:", razorpayOrder);
      } catch (err) {
        console.error("RazorPay Order Creation Error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to create RazorPay order",
          error: err.message || err,
        });
      }

      const preliminaryOrder = new Order({
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
        razorpayOrderId: razorpayOrder.id,
        status: "Pending Payment",
      });

      await preliminaryOrder.save();
      console.log("Preliminary Order Saved:", preliminaryOrder);

      return res.json({
        success: true,
        message: "Razorpay order created",
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrderOptions.amount,
        key: process.env.RAZORPAY_KEY_ID,
        orderId: preliminaryOrder._id,
      });
    } else if (paymentMethod === "COD") {
      console.log("Processing Cash on Delivery...");
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
        status: "Confirmed",
      });

      await order.save();
      console.log("COD Order Saved:", order);

      for (let i = 0; i < cart.items.length; i++) {
        const cartItem = cart.items[i];
        const product = await Product.findById(cartItem.productId);

        const variantIndex = product.variants.findIndex(
          (v) =>
            v.size === cartItem.variant.size &&
            v.color === cartItem.variant.color
        );

        product.variants[variantIndex].quantity -= cartItem.quantity;
        await product.save();
      }

      await Cart.deleteOne({ userId });
      console.log("Cart Cleared for User:", userId);

      return res.json({
        success: true,
        message: "Order placed successfully",
        orderId: order._id,
        orderedItems: orderProducts,
      });
    } else {
      console.log("Invalid Payment Method:", paymentMethod);
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }
  } catch (error) {
    console.error("Order Placement Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error placing order",
    });
  }
};

// code to cancel order


const cancelOrder = async (req, res) => {
  try {
    const { orderId, productSize, productColor, cancelComment } = req.body;

    if (!orderId || !productSize || !productColor) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        receivedData: req.body,
      });
    }

    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log("Original Shipping Charge:", order.shipping);

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


    const refundAmount = orderItem.totalPrice - discountForItem; 
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
      
        refundShipping = shippingPerItem;
        order.shipping -= shippingPerItem; 
      }

   
      user.wallet += refundShipping;

    
      await user.save();
    }

 
  

    console.log("Updated Shipping Charge:", order.shipping);

    // Update order item status to canceled
    order.items[orderItemIndex].orderStatus = "canceled";
    if (cancelComment) {
      order.items[orderItemIndex].cancelComment = cancelComment;
    }

    const allItemsCanceled = order.items.every(
      (item) => item.orderStatus === "canceled"
    );
    if (allItemsCanceled) {
      order.orderStatus = "canceled";
    }

    await order.save();

    res.json({
      success: true,
      message: "Product canceled successfully from order",
      refundAmount,
      refundShipping,
      // Do not include updatedOrder.discount
      updatedOrder: {
        ...order._doc, // Include all order details except the discount
        discount: undefined, // Explicitly set discount to undefined
      },
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

const returnItem = async (req, res) => {
  try {
    const { orderId, productSize, productColor, returnComment } = req.body;

    if (!orderId || !productSize || !productColor) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        receivedData: req.body,
      });
    }

    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });

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
        debug: {
          receivedData: {
            size: productSize,
            color: productColor,
          },
          availableItems: order.items.map((item) => ({
            variant: item.variant,
          })),
        },
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
const cancelReturn = async (req, res) => {
  const { orderId, itemIndex } = req.body;

  try {
    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Check if the itemIndex is valid
    if (itemIndex < 0 || itemIndex >= order.items.length) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid item index" });
    }

    // Update the item's status to "Placed" or whatever is appropriate
    order.items[itemIndex].orderStatus = "Placed"; // Change this to your desired status

    // Save the updated order
    await order.save();

    // Respond with success
    return res.json({
      success: true,
      message: "Return request canceled successfully",
    });
  } catch (error) {
    console.error("Error canceling return request:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isSignatureValid = generatedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Find and update the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Reduce stock for each product
    for (let item of order.items) {
      const product = await Product.findById(item.productId);

      const variantIndex = product.variants.findIndex(
        (v) => v.size === item.variant.size && v.color === item.variant.color
      );

      product.variants[variantIndex].quantity -= item.quantity;
      await product.save();
    }

    // Update order status
    order.status = "Confirmed";
    order.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentDate: new Date(),
    };

    await order.save();

    // Clear cart
    await Cart.deleteOne({ userId: order.userId });

    res.json({
      success: true,
      message: "Payment successful",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
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
};
