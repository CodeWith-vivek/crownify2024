const Order = require("../models/orderSchema");
const Product = require("../models/productSchema");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const env = require("dotenv").config();
const Coupon = require("../models/couponSchema");
const User = require("../models/userSchema");
const Transaction=require("../models/transactionSchema")

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

    const subtotalValue = Math.floor(Number(subtotal)); // Floor subtotal
    const totalBeforeDiscount = Math.floor(subtotalValue + Number(shipping)); // Floor total before discount
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
        regularPrice: Math.floor(product.regularPrice), // Floor regular price
        salePrice: Math.floor(product.salePrice), // Floor sale price
        totalPrice: Math.floor(product.salePrice * cartItem.quantity), // Floor total price
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
    let couponToApply = null;
    if (req.session.coupon && req.session.coupon.temporary) {
      console.log("Preparing Coupon:", req.session.coupon);

      const coupon = await Coupon.findOne({ code: req.session.coupon.code });
      if (coupon) {
        couponToApply = coupon;
        appliedCoupon = coupon.code;

        if (coupon.discountType === "percentage") {
          discount = Math.floor(
            Math.min(
              (totalBeforeDiscount * coupon.discountAmount) / 100,
              coupon.maxDiscount || Infinity
            )
          ); // Floor percentage discount
          console.log("Percentage Discount Calculated:", discount);
        } else if (coupon.discountType === "fixed") {
          discount = Math.floor(
            Math.min(coupon.discountAmount, totalBeforeDiscount)
          ); // Floor fixed discount
          console.log("Fixed Discount Calculated:", discount);
        }
      }
    }
    console.log("Discount:", discount);

    // Adjust grand total
    const grandTotal = Math.floor(totalBeforeDiscount - discount); // Floor grand total
    console.log("Grand Total:", grandTotal);

 if (paymentMethod === "Wallet") {
   console.log("Processing Wallet Payment...");
   const user = await User.findById(userId);

   if (!user) {
     console.log("User  not found:", userId);
     return res.status(404).json({
       success: false,
       message: "User  not found",
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

   const generateOrderNumber = () => {
     return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`; // e.g., ORD-1692287123456-1234
   };

   // Save coupon usage
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

   // Create the order first
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

   await order.save();
   console.log("Wallet Order Saved:", order);

   // Create a transaction record for the wallet payment
   const transaction = new Transaction({
     userId,
     amount: grandTotal,
     type: "debit", // Since we are deducting from the wallet
     description: `Order payment for Order ID: ${order.orderNumber}`, // Now order is defined
   });
   await transaction.save(); // Save the transaction
   console.log("Transaction recorded:", transaction);

   // Update product quantities
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

   // Clear session coupon and cart
   req.session.coupon = null;
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
   const generateOrderNumber = () => {
     return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`; // e.g., ORD-1692287123456-1234
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
     couponCode: appliedCoupon,
     paymentMethod,
     shippingAddress: primaryAddressId,
     razorpayOrderId: razorpayOrder.id,
     paymentStatus: "Pending",
     orderNumber: generateOrderNumber(),
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
   const generateOrderNumber = () => {
     return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`; // e.g., ORD-1692287123456-1234
   };
   console.log("Processing Cash on Delivery...");

   // Save coupon usage
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
   console.log("COD Order Saved:", order);

   // Update product quantities
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

   // Clear session coupon and cart
   req.session.coupon = null;
   await Cart.deleteOne({ userId });
   console.log("Cart Cleared for User:", userId);

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

    console.log("Received orderNumber:", orderNumber); // Log orderNumber for debugging

    // Use orderNumber to find the order
    const order = await Order.findOne({ orderNumber, userId });

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

    // Floor the refund amount
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
        // Refund full shipping charge if no items are left
        refundShipping = totalShippingCharge;
        order.shipping = 0;
      } else {
        // Refund the shipping per item for the canceled item
        refundShipping = Math.floor(shippingPerItem); // Floor shipping refund
        order.shipping -= refundShipping;
      }

      user.wallet += refundShipping;

      await user.save();

      // Log the refund transaction
      const transaction = new Transaction({
        userId,
        amount: refundAmount + refundShipping, // Total refund amount
        type: 'credit', // Since we are adding to the wallet
        description: `Refund for canceled order item: ${orderItem.productName}`,
      });
      await transaction.save();
    }

    console.log("Updated Shipping Charge:", order.shipping);

    // Update the order item status to canceled
    order.items[orderItemIndex].orderStatus = "canceled";
    if (cancelComment) {
      order.items[orderItemIndex].cancelComment = cancelComment;
    }
    await order.save();

    res.status(200 
    ).json({
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



const deletepremilinaryOrder=async(req,res)=>{
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
}
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

    // Update order item status to "Return requested"
    order.items[orderItemIndex].orderStatus = "Return requested";
    if (returnComment) {
      order.items[orderItemIndex].returnComment = returnComment;
    }

    // Calculate refund amount
    const refundAmount = Math.floor(orderItem.totalPrice); // Assuming totalPrice exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User  not found for wallet refund",
      });
    }

    // Add refund amount to user's wallet
    user.wallet = (user.wallet || 0) + refundAmount;
    await user.save();

    // Log the transaction
    const transaction = new Transaction({
      userId,
      amount: refundAmount,
      type: "credit",
      description: "Refund for returned item",
    });
    await transaction.save();

    await order.save();

    res.json({
      success: true,
      message: "Return request submitted successfully",
      updatedOrder: order,
      refundAmount,
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
  const { orderNumber, itemIndex } = req.body;

  try {
    // Find the order by ID
    const order = await Order.findByOne(orderNumber);
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

    // Get the item to be canceled
    const orderItem = order.items[itemIndex];

    // Check if the order item is already canceled or in a state that cannot be changed
    if (orderItem.orderStatus === "Canceled") {
      return res.status(400).json({
        success: false,
        message: "This item return request is already canceled",
      });
    }

    // Calculate potential refund amount (if applicable)
    const refundAmount = Math.floor(orderItem.totalPrice); // Assuming totalPrice exists
    // You can include any logic to update user's wallet or similar actions here

    // Update the item's status to "Placed" or whatever is appropriate
    orderItem.orderStatus = "Placed"; // Change this to your desired status

    // Save the updated order
    await order.save();

    // Respond with success and the refund amount (if applicable)
    return res.json({
      success: true,
      message: "Return request canceled successfully",
      refundAmount, // Include refund amount if necessary
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

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!isSignatureValid) {
      // Update order status to failed
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

    // If signature is valid, continue processing the order
    // Apply coupon if used
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

    // Reduce stock for each product
    for (let item of order.items) {
      const product = await Product.findById(item.productId);

      const variantIndex = product.variants.findIndex(
        (v) => v.size === item.variant.size && v.color === item.variant.color
      );

      product.variants[variantIndex].quantity -= item.quantity;
      await product.save();
    }

    // Update order status to completed
    order.paymentStatus = "Completed";
    order.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentDate: new Date(),
    };

    await order.save();

    // Clear cart
    req.session.coupon = null;
    await Cart.deleteOne({ userId: order.userId });

    res.json({
      success: true,
      message: "Payment successful",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    // Handle the failed payment case
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
  deletepremilinaryOrder
  // cancelOrderModal

};
