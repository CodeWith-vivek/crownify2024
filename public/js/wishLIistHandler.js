document.addEventListener("DOMContentLoaded", () => {
  const wishlistItems = document.querySelectorAll(".wishlist-item");

  wishlistItems.forEach((item) => {
    const sizeDropdown = item.querySelector(".size-dropdown");
    const colorDropdown = item.querySelector(".color-dropdown");
    const addToCartBtn = item.querySelector(".add-to-cart-btn");
    const stockStatus = item.querySelector(".stock-status");
    const productId = item.dataset.productId;

    sizeDropdown.addEventListener("change", async (event) => {
      const selectedSize = event.target.value;

      colorDropdown.innerHTML = '<option value="">Select Color</option>';
      colorDropdown.disabled = true;
      addToCartBtn.disabled = true;

      stockStatus.textContent = "Select Size & Color";
      stockStatus.className = "stock-status";

      if (!selectedSize) return;

      try {
        const response = await fetch(
          `/wishlist/colors?productId=${productId}&size=${selectedSize}`
        );
        const data = await response.json();

        if (data.colors && data.colors.length > 0) {
          data.colors.forEach((variant) => {
            const option = document.createElement("option");
            option.value = variant.color;
            option.textContent = variant.color;
            option.dataset.quantity = variant.quantity;
            colorDropdown.appendChild(option);
          });

          colorDropdown.disabled = false;
        } else {
          colorDropdown.innerHTML =
            '<option value="">No colors available</option>';
        }
      } catch (error) {
        console.error("Error fetching colors:", error);
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Failed to load colors. Please try again.",
        });
      }
    });

    colorDropdown.addEventListener("change", (event) => {
      const selectedOption = event.target.selectedOptions[0];
      const selectedColor = event.target.value;
      const selectedSize = sizeDropdown.value;
      const quantity = parseInt(selectedOption.dataset.quantity || "0");

      if (selectedColor && selectedSize) {
        if (quantity === 0) {
          stockStatus.textContent = "Out of Stock";
          stockStatus.className = "stock-status stock-status-out";
          addToCartBtn.disabled = true;
        } else if (quantity > 0 && quantity <= 10) {
          stockStatus.textContent = `${quantity} Left`;
          stockStatus.className = "stock-status stock-status-low";
          addToCartBtn.disabled = false;
        } else {
          stockStatus.textContent = "In Stock";
          stockStatus.className = "stock-status stock-status-available";
          addToCartBtn.disabled = false;
        }
      }
    });

    addToCartBtn.addEventListener("click", async () => {
      const selectedSize = sizeDropdown.value;
      const selectedColor = colorDropdown.value;

      if (selectedSize && selectedColor) {
        await addToCart(productId, selectedSize, selectedColor, item);
      }
    });
  });

  // Add to Cart Function
  async function addToCart(productId, size, color, itemRow) {
    try {
      Swal.fire({
        title: "Adding to Cart...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const response = await fetch("/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          size,
          color,
          quantity: 1,
        }),
      });

      const result = await response.json();

      if (result.success) {
        await removeFromWishlist(productId, itemRow);

        Swal.fire({
          icon: "success",
          title: "Added to Cart!",
          text: "The product has been added to your cart.",
          showConfirmButton: false,
          timer: 1500,
        }).then(() => {
          location.reload();
        });

        updateCartCount();
      } else {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: result.message || "Failed to add product to cart",
        }).then(() => {
          location.reload();
        });
      }
    } catch (error) {
      console.error("Add to Cart Error:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "An error occurred while adding product to cart",
      });
    }
  }

  // Remove from Wishlist Function
  async function removeFromWishlist(productId, itemRow) {
    try {
      const response = await fetch("/wishlist/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });

      const data = await response.json();

      if (response.ok) {
        if (itemRow) itemRow.remove();
      } else {
        console.error("Failed to remove item from wishlist:", data.message);
      }
    } catch (error) {
      console.error("Error removing item from wishlist:", error);
    }
  }

  // Update Cart Count Function
  function updateCartCount() {
    fetch("/cart/count")
      .then((response) => response.json())
      .then((data) => {
        const cartCountElement = document.querySelector(".cart-count");
        if (cartCountElement) {
          cartCountElement.textContent = data.count;
        }
      })
      .catch((error) => console.error("Error updating cart count:", error));
  }
});

   document.addEventListener("DOMContentLoaded", () => {
     const removeButtons = document.querySelectorAll(".remove-btn");

     removeButtons.forEach((button) => {
       button.addEventListener("click", async (event) => {
         const productId = button.getAttribute("data-product-id");

         Swal.fire({
           title: "Are you sure?",
           text: "You won't be able to revert this action!",
           icon: "warning",
           showCancelButton: true,
           confirmButtonColor: "#d33",
           cancelButtonColor: "#3085d6",
           confirmButtonText: "Yes, remove it!",
         }).then(async (result) => {
           if (result.isConfirmed) {
             try {
               const response = await fetch("/wishlist/remove", {
                 method: "POST",
                 headers: {
                   "Content-Type": "application/json",
                 },
                 body: JSON.stringify({ productId }),
               });

               const data = await response.json();

               if (response.ok) {
                 Swal.fire(
                   "Removed!",
                   data.message || "Product removed from wishlist.",
                   "success"
                 ).then(() => {
                   location.reload();
                 });
               } else {
                 Swal.fire(
                   "Error",
                   data.message || "Something went wrong. Please try again.",
                   "error"
                 );
               }
             } catch (error) {
               console.error("Error removing item:", error);
               Swal.fire(
                 "Error",
                 "Unable to remove the item. Please try again later.",
                 "error"
               );
             }
           }
         });
       });
     });
   });
