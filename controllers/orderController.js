const Order = require("../models/orderSchema"); 
const Product = require("../models/productSchema"); 
const Cart = require("../models/cartSchema"); 
const Address = require("../models/addressSchema");

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      primaryAddressId,
      subtotal,
      shipping,
      total,
      paymentMethod,
    } = req.body;

   
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

    
      product.variants[variantIndex].quantity -= cartItem.quantity;
      await product.save();

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
    });
  
    

    await order.save();

    // Clear the cart after order placement
    await Cart.deleteOne({ userId });

    // Return order details along with items
    res.json({
      success: true,
      message: "Order placed successfully",
      orderId: order._id,
      orderedItems: orderProducts, // Ordered items from cart
    });
  } catch (error) {
    console.error("Order placement error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error placing order",
    });
  }
};

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


module.exports={
    placeOrder,
    cancelOrder,
    returnItem
}
