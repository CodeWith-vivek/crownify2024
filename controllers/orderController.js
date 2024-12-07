const Order = require("../models/orderSchema"); 
const Product = require("../models/productSchema"); 
const Cart = require("../models/cartSchema"); 
const Address = require("../models/addressSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const env = require("dotenv").config();


//code to place order


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { primaryAddressId, subtotal, shipping, total, paymentMethod } =
      req.body;

    // Find user's cart
    const cart = await Cart.findOne({ userId });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No items in the cart to proceed",
      });
    }

    // Prepare order products and validate stock
    const orderProducts = [];
    for (let i = 0; i < cart.items.length; i++) {
      const cartItem = cart.items[i];
      const product = await Product.findById(cartItem.productId);

      if (!product) {
        throw new Error(`Product not found: ${cartItem.productId}`);
      }

      // Find variant index
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

      // Check stock availability
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
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        totalPrice: product.salePrice * cartItem.quantity,
        productImage: product.productImage[0],
      });
    }

    // Validate primary address
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

    // Handle different payment methods
    if (paymentMethod === "RazorPay") {
      // Create Razor Pay order
      const razorpayOrderOptions = {
        amount: Math.round(total * 100), // amount in paise
        currency: "INR",
        receipt: `order_${Date.now()}`,
        payment_capture: 1, // Auto capture payment
      };

      const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

      // Create preliminary order in database
      const preliminaryOrder = new Order({
        userId,
        primaryAddressId,
        items: orderProducts,
        subtotal,
        shipping,
        total,
        grandTotal: total,
        totalAmount: Number(subtotal) + Number(shipping),
        paymentMethod,
        shippingAddress: primaryAddressId,
        razorpayOrderId: razorpayOrder.id,
        status: "Pending Payment",
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
      // Create COD order
      const order = new Order({
        userId,
        primaryAddressId,
        items: orderProducts,
        subtotal,
        shipping,
        total,
        grandTotal: total,
        totalAmount: Number(subtotal) + Number(shipping),
        paymentMethod,
        shippingAddress: primaryAddressId,
        status: "Confirmed",
      });

      await order.save();

      // Reduce stock for each product
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

      // Clear cart
      await Cart.deleteOne({ userId });

      return res.json({
        success: true,
        message: "Order placed successfully",
        orderId: order._id,
        orderedItems: orderProducts,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }
  } catch (error) {
    console.error("Order placement error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error placing order",
    });
  }
};


// code to cancel order


const cancelOrder = async (req, res) => {
  try {
  

    const {
      orderId,
      productSize,
      productColor,
      cancelComment,
    } = req.body;


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
      updatedOrder: order,
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

    if (
      orderItem.orderStatus === "Return requested" 
    ) {
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


module.exports={
    placeOrder,
    cancelOrder,
    returnItem,
    verifyRazorpayPayment
}
