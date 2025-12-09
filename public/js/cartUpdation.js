document.addEventListener("DOMContentLoaded", () => {
  const checkoutButton = document.querySelector('a[href="/checkout"]');

  if (checkoutButton) {
    checkoutButton.addEventListener("click", async function (e) {
      e.preventDefault();

      try {
        const cartItems = document.querySelectorAll(".cart-item");
        let hasClientSideOutOfStock = false;
        let clientSideOutOfStockProducts = [];

        cartItems.forEach((item) => {
          const stockStatus = item.querySelector(".stock-status");
          const productName = item
            .querySelector(".product-info h6")
            .textContent.trim();

          if (
            stockStatus &&
            stockStatus.textContent.trim() === "Out of Stock"
          ) {
            hasClientSideOutOfStock = true;
            clientSideOutOfStockProducts.push(productName);
          }
        });

        if (hasClientSideOutOfStock) {
          Swal.fire({
            title: "Out of Stock Items Detected",
            html: `
              <p>Please remove the following out-of-stock items from your cart to proceed to checkout:</p>
              <ul>
                ${clientSideOutOfStockProducts
                  .map((product) => `<li>${product}</li>`)
                  .join("")}
              </ul>
            `,
            icon: "warning",
            confirmButtonText: "OK",
          });
          return;
        }

        const response = await fetch("/checkout/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!data.success) {
          Swal.fire({
            title: "Validation Failed",
            html: `
              <p>${data.message}</p>
              ${
                data.outOfStockItems.length > 0
                  ? `
                <p>Out of stock items:</p>
                <ul>
                  ${data.outOfStockItems
                    .map(
                      (item) => `
                    <li>
                      ${item.productName} (Size: ${
                        item.size || "N/A"
                      }, Color: ${item.color || "N/A"}) - ${item.message}
                    </li>
                  `
                    )
                    .join("")}
                </ul>
              `
                  : ""
              }
              ${
                data.blockedItems.length > 0
                  ? `
                <p>Blocked items:</p>
                <ul>
                  ${data.blockedItems
                    .map(
                      (item) => `
                    <li>
                      ${item.productName} - ${item.reason}
                    </li>
                  `
                    )
                    .join("")}
                </ul>
              `
                  : ""
              }
            `,
            icon: "error",
            confirmButtonText: "OK",
          }).then(() => {
            location.reload();
          });
        } else {
          window.location.href = "/checkout";
        }
      } catch (error) {
        console.error("Error during checkout validation:", error);
        Swal.fire({
          title: "Error",
          text: "An error occurred while validating your cart. Please try again.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const decreaseButtons = document.querySelectorAll(".decrease-qty");
  const increaseButtons = document.querySelectorAll(".increase-qty");

  decreaseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.getAttribute("data-product-id");
      const size = button.getAttribute("data-size");
      const color = button.getAttribute("data-color");
      const quantityInput = document.getElementById(
        `quantityInput_${productId}_${size}_${color}`
      );
      let currentQuantity = parseInt(quantityInput.value);

      if (currentQuantity > 1) {
        currentQuantity--;
        quantityInput.value = currentQuantity;
        updateCartQuantity(productId, size, color, currentQuantity);
        updateStockStatus(productId, size, color, currentQuantity);
      }
    });
  });
  increaseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.getAttribute("data-product-id");
      const size = button.getAttribute("data-size");
      const color = button.getAttribute("data-color");
      const quantityInput = document.getElementById(
        `quantityInput_${productId}_${size}_${color}`
      );
      let currentQuantity = parseInt(quantityInput.value);
      const maxStock = parseInt(quantityInput.getAttribute("data-max-stock"));

      if (currentQuantity < 6 && currentQuantity < maxStock) {
        currentQuantity++;
        quantityInput.value = currentQuantity;
        updateCartQuantity(productId, size, color, currentQuantity);
        updateStockStatus(productId, size, color, currentQuantity);
      } else if (currentQuantity >= maxStock) {
        Swal.fire({
          title: "Stock Limit Reached",
          text: `You cannot add more than ${maxStock} of this item.`,
          icon: "warning",
          confirmButtonText: "OK",
        });
      } else if (currentQuantity >= 6) {
        Swal.fire({
          title: "Quantity Limit Reached",
          text: "You cannot add more than 6 of this item at a time.",
          icon: "warning",
          confirmButtonText: "OK",
        });
      }
    });
  });

  function updateCartQuantity(productId, size, color, quantity) {
    fetch(`/cart/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, size, color, quantity }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          console.log("Cart updated successfully:", data);

          const itemRow = document.querySelector(
            `tr.cart-item td.product-total[data-product-id="${productId}"][data-size="${size}"][data-color="${color}"]`
          );
          if (itemRow) {
            itemRow.textContent = `₹${parseFloat(data.itemTotal).toFixed(2)}`;
          }

          updateCartSummary(data.cartSummary);
        } else {
          console.error("Error updating cart:", data.message);
        }
      })
      .catch((error) => console.error("Error:", error));
  }

  function updateCartSummary(summary) {
    const subtotalElement = document.querySelector(
      ".summary-row span:nth-child(2)"
    );
    if (subtotalElement) {
      subtotalElement.textContent = `₹${parseFloat(summary.subtotal).toFixed(
        2
      )}`;
    }

    const shippingElement = document.querySelector(
      ".summary-row:nth-child(2) span:nth-child(2)"
    );
    if (shippingElement) {
      shippingElement.textContent = `₹${parseFloat(
        summary.shippingCharge
      ).toFixed(2)}`;
    }

    const totalElement = document.querySelector(
      ".summary-row.total strong:nth-child(2)"
    );
    if (totalElement) {
      totalElement.textContent = `₹${parseFloat(summary.total).toFixed(2)}`;
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const removeButtons = document.querySelectorAll(".cart__close");

  removeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.getAttribute("data-product-id");
      const row = button.closest("tr.cart-item");
      const size = row.querySelector("td:nth-child(3) p").innerText;
      const color = row.querySelector(
        ".product-color:nth-child(4) p"
      ).innerText;

      Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, remove it!",
      }).then((result) => {
        if (result.isConfirmed) {
          removeCartItem(productId, size, color);
        }
      });
    });
  });

  function removeCartItem(productId, size, color) {
    fetch(`/cart/remove`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, size, color }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const row = document.querySelector(
            `tr.cart-item[data-product-id="${productId}"]`
          );
          if (row) {
            row.remove();
          }

          Swal.fire(
            "Removed!",
            "Your item has been removed from the cart.",
            "success"
          ).then(() => {
            location.reload();
          });
        } else {
          console.error("Error removing item:", data.message);
          Swal.fire(
            "Error!",
            "There was a problem removing the item.",
            "error"
          );
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        Swal.fire("Error!", "There was a problem removing the item.", "error");
      });
  }
});
