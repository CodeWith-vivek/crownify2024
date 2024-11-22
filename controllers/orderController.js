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

    // Validate cart items by fetching the user's cart
    const cart = await Cart.findOne({ userId });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No items in the cart to proceed",
      });
    }

    // Prepare items for the order, validating against product availability
    const orderProducts = [];
    for (let i = 0; i < cart.items.length; i++) {
      const cartItem = cart.items[i];
      const product = await Product.findById(cartItem.productId);

      if (!product) {
        throw new Error(`Product not found: ${cartItem.productId}`);
      }

      // Log the variant information for debugging
      console.log("Product:", product.productName);
      console.log("Requested size:", cartItem.variant.size);
      console.log("Requested color:", cartItem.variant.color);

      // Check if the variant exists in the product variants array
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

      // Ensure there's enough stock
      if (product.variants[variantIndex].quantity < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.productName} in selected variant`,
        });
      }

      // Reduce stock and save the product
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
        productImage: product.productImage[0], // Adjust if you want to select the right image
      });
    }
    // Validate the shipping address
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

    // Create the order
    const order = new Order({
      userId,
      primaryAddressId,
      items: orderProducts, // Save the items array here
      subtotal,
      shipping,
      total,
      grandTotal: total,
      totalAmount: subtotal + shipping,
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

module.exports={
    placeOrder,
}
