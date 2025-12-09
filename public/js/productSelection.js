let currentSize = null;
let currentColor = null;

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".color-label").forEach((label) => {
    label.style.display = "none";
  });

  updateAddToCartButton();
  setupStockCheck();
  setupCartNavigation();
});

document.querySelectorAll('input[name="size"]').forEach((sizeInput) => {
  sizeInput.addEventListener("change", function () {
    const selectedSize = this.value;
    currentSize = selectedSize;
    resetColorSelection();
    showRelevantColors(selectedSize);
    const stockDisplay = document.getElementById("stock-display");
    stockDisplay.textContent = "Please select both size and color to see stock";
    stockDisplay.style.color = "gray";
    const quantityInput = document.getElementById("quantityInput");
    quantityInput.value = 1;
    updateAddToCartButton();
    setTimeout(() => {
      updateStockDisplay();
    }, 10);
  });
});

document.querySelectorAll('input[name="color"]').forEach((colorInput) => {
  colorInput.addEventListener("change", function () {
    if (!currentSize) {
      this.checked = false;
      Swal.fire({
        icon: "info",
        title: "Incomplete Selection",
        text: "Please select a size first.",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: "btn btn-warning",
        },
      });
      return;
    }

    const selectedColor = this.value;
    currentColor = selectedColor;
    updateColorSwatchHighlight(this);
    updateStockDisplay();
    updateAddToCartButton();
  });
});

function resetColorSelection() {
  currentColor = null;
  document.querySelectorAll('input[name="color"]').forEach((input) => {
    input.checked = false;
  });
  removeColorHighlight();
  const stockDisplay = document.getElementById("stock-display");
  stockDisplay.textContent = "Please select a color for the chosen size";
  stockDisplay.style.color = "gray";
}

function showRelevantColors(selectedSize) {
  const productId =
    document.getElementById("product-details").dataset.productId;
  const stockDisplay = document.getElementById("stock-display");
  document.querySelectorAll(".color-label").forEach((label) => {
    const colorInput = label.querySelector('input[name="color"]');
    if (label.dataset.size === selectedSize) {
      label.style.display = "inline-block";
      const color = colorInput.value;
      fetch(
        `/product/${productId}/stock?size=${encodeURIComponent(
          selectedSize
        )}&color=${encodeURIComponent(color)}`
      )
        .then((response) => response.json())
        .catch((error) => {
          console.error("Error fetching stock for color:", error);
        });
    } else {
      label.style.display = "none";
    }
  });
  stockDisplay.textContent = "Please select a color to see stock";
  stockDisplay.style.color = "gray";
}

function updateColorSwatchHighlight(selectedInput) {
  removeColorHighlight();
  const swatch = selectedInput.parentElement.querySelector(".color-swatch");
  if (swatch) {
    swatch.classList.add("selected");
  }
}

function removeColorHighlight() {
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.classList.remove("selected");
  });
}

function updateStockDisplayWithQuantity(totalStock) {
  const stockDisplay = document.getElementById("stock-display");
  const remainingStock = totalStock;
  if (remainingStock === 0) {
    stockDisplay.textContent = "Out of stock";
    stockDisplay.style.color = "red";
  } else if (remainingStock <= 10) {
    stockDisplay.textContent = `Stock available: ${remainingStock}`;
    stockDisplay.style.color = "orange";
  } else {
    stockDisplay.textContent = "In Stock";
    stockDisplay.style.color = "green";
  }
}

function updateStockDisplay() {
  const stockDisplay = document.getElementById("stock-display");
  if (!currentSize) {
    stockDisplay.textContent = "Please select a size to see available colors";
    stockDisplay.style.color = "gray";
    return;
  }
  if (!currentColor) {
    stockDisplay.textContent = "Please select a color";
    stockDisplay.style.color = "gray";
    return;
  }
  const productId =
    document.getElementById("product-details").dataset.productId;
  fetch(
    `/product/${productId}/stock?size=${encodeURIComponent(
      currentSize
    )}&color=${encodeURIComponent(currentColor)}`
  )
    .then((response) => {
      if (!response.ok) throw new Error("Stock request failed");
      return response.json();
    })
    .then((data) => {
      if (data.stock !== undefined) {
        updateStockDisplayWithQuantity(data.stock);
      } else {
        stockDisplay.textContent = "Variant not found";
        stockDisplay.style.color = "red";
      }
    })
    .catch((error) => {
      console.error("Error fetching stock:", error);
      stockDisplay.textContent = "Error checking stock";
      stockDisplay.style.color = "red";
    });
}

function updateAddToCartButton() {
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (currentSize && currentColor) {
    const productId =
      document.getElementById("product-details").dataset.productId;
    fetch(
      `/product/${productId}/stock?size=${encodeURIComponent(
        currentSize
      )}&color=${encodeURIComponent(currentColor)}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.stock > 0) {
          addToCartBtn.classList.remove("disabled");
          addToCartBtn.removeAttribute("disabled");
        } else {
          addToCartBtn.classList.add("disabled");
          addToCartBtn.setAttribute("disabled", "true");
        }
      })
      .catch((error) => {
        console.error("Error fetching stock:", error);
        addToCartBtn.classList.add("disabled");
        addToCartBtn.setAttribute("disabled", "true");
      });
  } else {
    addToCartBtn.classList.add("disabled");
    addToCartBtn.setAttribute("disabled", "true");
  }
}

function setupStockCheck() {
  const quantity = 1;
  const stockDisplay = document.getElementById("stock-display");
  document.querySelectorAll(".qtybtn").forEach((button) => {
    button.addEventListener("click", async function () {
      const productId =
        document.getElementById("product-details").dataset.productId;
      const size = currentSize;
      const color = currentColor;
      if (size && color) {
        const response = await fetch(
          `/product/${productId}/stock?size=${encodeURIComponent(
            size
          )}&color=${encodeURIComponent(color)}`
        );
        const data = await response.json();
        if (data.stock !== undefined) {
          if (data.stock >= quantity) {
            stockDisplay.textContent = `In stock: ${data.stock}`;
            stockDisplay.style.color = "green";
          } else {
            stockDisplay.textContent = "Out of stock";
            stockDisplay.style.color = "red";
          }
        } else {
          stockDisplay.textContent = "Stock information unavailable";
          stockDisplay.style.color = "gray";
        }
      } else {
        Swal.fire({
          icon: "warning",
          title: "Incomplete Selection",
          text: "Please select both size and color.",
          confirmButtonText: "OK",
          customClass: {
            confirmButton: "btn btn-warning",
          },
        });
      }
    });
  });
}

document
  .getElementById("addToCartBtn")
  .addEventListener("click", async function (event) {
    event.preventDefault();
    if (!currentSize || !currentColor) {
      Swal.fire({
        icon: "warning",
        title: "Incomplete Selection",
        text: "Please select both size and color before adding to cart.",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: "btn btn-warning",
        },
      });
      return;
    }
    const productId =
      document.getElementById("product-details").dataset.productId;
    const quantity = document.getElementById("quantityInput").value;
    try {
      const response = await fetch("/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          size: currentSize,
          color: currentColor,
          quantity,
        }),
      });
      const data = await response.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Item added to cart successfully!",
        }).then((result) => {
          location.reload();
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed",
          text: data.message || "Failed to add product to cart.",
          confirmButtonText: "OK",
          customClass: {
            confirmButton: "btn btn-danger",
          },
        });
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "An error occurred while adding the product to the cart.",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: "btn btn-danger",
        },
      });
    }
  });

function handleAddToCart(productId) {
  fetch("/cart/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: productId,
      quantity: 1,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Product added to cart successfully!",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed",
          text: data.message || "Failed to add product to cart.",
          confirmButtonText: "OK",
          customClass: {
            confirmButton: "btn btn-danger",
          },
        });
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "An error occurred while adding the product to the cart.",
        confirmButtonText: "OK",
        customClass: {
          confirmButton: "btn btn-danger",
        },
      });
    })
    .then((result) => {
      if (result.isConfirmed) {
        window.location.href = data.redirectTo;
      }
    });
}

function initMagnifier() {
  const magnifierGlass = document.createElement("div");
  magnifierGlass.setAttribute("class", "img-magnifier-glass");
  document.querySelectorAll(".zoomable-image").forEach((img) => {
    img.parentElement.style.position = "relative";
    img.parentElement.appendChild(magnifierGlass.cloneNode(true));
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initMagnifier();
});

document.addEventListener("DOMContentLoaded", () => {
  const productItems = document.querySelectorAll(".product__item__pic");
  productItems.forEach((item) => {
    const defaultBg = item.getAttribute("data-setbg");
    const hoverBg = item.getAttribute("data-hoverbg");
    item.style.backgroundImage = `url(${defaultBg})`;
    item.addEventListener("mouseover", () => {
      item.style.backgroundImage = `url(${hoverBg})`;
    });
    item.addEventListener("mouseout", () => {
      item.style.backgroundImage = `url(${defaultBg})`;
    });
  });
});
