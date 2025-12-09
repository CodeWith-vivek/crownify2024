document.querySelectorAll(".view-order").forEach((button) => {
  button.addEventListener("click", function () {
    const orderItem = this.closest(".order-item");
    const orderNumber = orderItem.getAttribute("data-order-id");
    const customerName = orderItem.getAttribute("data-customer-name");
    const orderDate = orderItem.getAttribute("data-order-date");
    const items = JSON.parse(orderItem.getAttribute("data-items")) || [];

    const subtotal = orderItem.getAttribute("data-subtotal");
    const discount = orderItem.getAttribute("data-discount");
    const shipping = 40;
    const grandTotal = orderItem.getAttribute("data-grandtotal");
    const paymentStatus = orderItem.getAttribute("data-paymentStatus");

    document.getElementById("modalOrderId").textContent = orderNumber;
    document.getElementById("modalCustomer").textContent = customerName;
    document.getElementById("modalDate").textContent = new Date(
      orderDate
    ).toLocaleDateString();
    document.getElementById("modalSubtotal").textContent = subtotal;
    document.getElementById("modalDiscount").textContent = discount;
    document.getElementById("modalShipping").textContent = shipping;
    document.getElementById("modalGrandTotal").textContent = grandTotal;
    document.getElementById("modalPaymentStatus").textContent = paymentStatus;

    const modalItems = document.getElementById("modalItems");
    modalItems.innerHTML = "";

    items.forEach((item, index) => {
      const itemStatus = item.orderStatus || "Return Pending";
      const productId = item.productId || {};
      const productName = productId.productName || "Unknown Product";
      const productImage = item.productImage || "placeholder.jpg";
      const variant = item.variant || {};
      const itemPrice =
        (productId.salePrice || productId.regularPrice || 0) * item.quantity;

      // Badge class helper
      const getBadgeClass = (status) => {
        const badgeClasses = {
          Failed: "bg-danger",
          Delivered: "bg-success",
          Shipped: "bg-purple",
          "Return Pending": "bg-warning",
          "Return requested": "bg-orange",
          Returned: "bg-info",
          "Return Rejected": "bg-danger",
          Placed: "bg-warning",
          Confirmed: "bg-warning",
          Canceled: "bg-danger",
        };
        return badgeClasses[status] || "";
      };

      const getActionButton = (status) => {
        const commonAttributes = `
                                    data-order-id="${orderNumber}" 
                                    data-item-index="${index}" 
                                    data-product-name="${productName}" 
                                    data-product-image="${productImage}"
                                    data-product-color="${
                                      variant.color || "N/A"
                                    }"
                                    data-product-size="${variant.size || "N/A"}"
                                    data-product-price="${itemPrice}"
                                `;

        switch (status) {
          case "Delivered":
            return `<button class="btn btn-warning btn-sm return-item" ${commonAttributes}>Return</button>`;
          case "Return requested":
            return `<button class="btn btn-danger btn-sm cancel-return" ${commonAttributes}>Cancel Return</button>`;
          case "Placed":
          case "Confirmed":
          case "Failed":
            return `<button class="btn btn-danger btn-sm cancel-item" ${commonAttributes}>Cancel</button>`;
          default:
            return "";
        }
      };

      const row = `
                                <tr>
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <img src="/uploads/product-image/${productImage}" 
                                                 alt="${productName}" 
                                                 class="me-3 rounded" 
                                                 width="60" height="60">
                                            <div>
                                                <div class="fw-medium">${productName}</div>
                                                <div class="text-muted">Size: ${
                                                  variant.size || "N/A"
                                                }</div>
                                                <div class="text-muted">Color: ${
                                                  variant.color || "N/A"
                                                }</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>${item.quantity}</td>
                                    <td>₹${
                                      productId.salePrice ||
                                      productId.regularPrice ||
                                      0
                                    }</td>
                                    <td>₹${itemPrice}</td>
                                    <td>
                                        <span class="badge ${getBadgeClass(
                                          itemStatus
                                        )}">${itemStatus}</span>
                                    </td>
                                    <td>
                                        ${getActionButton(itemStatus)}
             </td>
                                </tr>
                            `;
      modalItems.innerHTML += row;
    });

    document.getElementById("orderModal").style.display = "block";

    setupActionButtons();
  });
});

function setupActionButtons() {
  document.querySelectorAll(".cancel-return").forEach((button) => {
    button.addEventListener("click", function () {
      console.log("Cancel return button clicked");
      const orderId = this.getAttribute("data-order-id");
      const itemIndex = this.getAttribute("data-item-index");
      const productName = this.getAttribute("data-product-name");
      const productImage = this.getAttribute("data-product-image");
      const productColor = this.getAttribute("data-product-color");
      const productSize = this.getAttribute("data-product-size");
      const productPrice = this.getAttribute("data-product-price");

      handleCancelReturnRequest(
        orderId,
        itemIndex,
        productName,
        productSize,
        productColor,
        productPrice
      );
    });
  });

  document.querySelectorAll(".cancel-item").forEach((button) => {
    button.addEventListener("click", function () {
      const orderNumber = this.getAttribute("data-order-id");
      const itemIndex = this.getAttribute("data-item-index");
      const productName = this.getAttribute("data-product-name");
      const productImage = this.getAttribute("data-product-image");
      const productColor = this.getAttribute("data-product-color");
      const productSize = this.getAttribute("data-product-size");
      const productPrice = this.getAttribute("data-product-price");

      document.getElementById("cancelOrderId").textContent = orderNumber;
      document.getElementById("cancelProductName").textContent = productName;
      document.getElementById(
        "cancelProductImage"
      ).src = `/uploads/product-image/${productImage || "placeholder.jpg"}`;
      document.getElementById("cancelProductColor").textContent =
        productColor || "N/A";
      document.getElementById("cancelProductSize").textContent =
        productSize || "N/A";
      document.getElementById("cancelProductPrice").textContent = productPrice;

      document.getElementById("cancelModal").style.display = "block";

      const submitCancellationButton =
        document.getElementById("submitCancellation");
      submitCancellationButton.onclick = function () {
        handleItemCancellation(
          orderNumber,
          itemIndex,
          productName,
          productSize,
          productColor,
          productPrice
        );
      };
    });
  });

  document.querySelectorAll(".return-item").forEach((button) => {
    button.addEventListener("click", function () {
      const orderNumber = this.getAttribute("data-order-id");
      const itemIndex = this.getAttribute("data-item-index");
      const productName = this.getAttribute("data-product-name");
      const productImage = this.getAttribute("data-product-image");
      const productColor = this.getAttribute("data-product-color");
      const productSize = this.getAttribute("data-product-size");
      const productPrice = this.getAttribute("data-product-price");

      document.getElementById("returnOrderId").textContent = orderNumber;
      document.getElementById("returnProductName").textContent = productName;
      document.getElementById(
        "returnProductImage"
      ).src = `/uploads/product-image/${productImage || "placeholder.jpg"}`;
      document.getElementById("returnProductColor").textContent =
        productColor || "N/A";
      document.getElementById("returnProductSize").textContent =
        productSize || "N/A";
      document.getElementById("returnProductPrice").textContent = productPrice;

      document.getElementById("returnComment").value = "";

      document.getElementById("returnModal").style.display = "block";

      const submitReturnButton = document.getElementById("submitReturn");
      submitReturnButton.onclick = function () {
        handleReturnSubmission(
          orderNumber,
          itemIndex,
          productName,
          productSize,
          productColor,
          productPrice
        );
      };
    });
  });
}

function handleCancelReturnRequest(
  orderNumber,
  itemIndex,
  productName,
  productSize,
  productColor,
  productPrice
) {
  console.log("Cancel return request initiated");
  Swal.fire({
    title: "Are you sure?",
    text: "Do you really want to cancel this return request?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, cancel it!",
    cancelButtonText: "No, keep it",
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Processing...",
        text: "Please wait while we cancel your return request.",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const data = {
        orderNumber,
        itemIndex,
        productName,
        productSize,
        productColor,
        productPrice,
      };

      fetch("/cancel-return-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log(data);
          if (data.success) {
            Swal.fire({
              icon: "success",
              title: "Return Request Canceled",
              text: "The return request has been successfully canceled.",
              confirmButtonText: "OK",
            }).then(() => {
              location.reload();
            });
          } else {
            Swal.fire({
              icon: "error",
              title: "Cancellation Failed",
              text:
                data.message ||
                "Failed to cancel the return request. Please try again later.",
              confirmButtonText: "OK",
            });
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "An error occurred while canceling the return request. Please try again later.",
            confirmButtonText: "OK",
          });
        });
    }
  });
}

function handleReturnSubmission(
  orderNumber,
  itemIndex,
  productName,
  productSize,
  productColor,
  productPrice
) {
  const comment = document.getElementById("returnComment").value.trim();
  if (!comment) {
    Swal.fire({
      icon: "warning",
      title: "Comment Required",
      text: "Please provide a reason for return before proceeding.",
      confirmButtonText: "OK",
    });
    return;
  }

  Swal.fire({
    title: "Are you sure?",
    text: "Do you really want to submit this return request?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, submit it!",
    cancelButtonText: "No, keep it",
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Processing...",
        text: "Please wait while we process your return request.",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const data = {
        orderNumber,
        productName,
        productSize,
        productColor,
        productPrice,
        returnComment: comment,
      };

      fetch("/return-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            Swal.fire({
              icon: "success",
              title: "Return Submitted",
              text: "Your return request has been submitted successfully.",
              confirmButtonText: "OK",
            }).then(() => {
              window.location.reload();
            });
          } else {
            Swal.fire({
              icon: "error",
              title: "Submission Failed",
              text:
                data.message ||
                "Failed to submit the return request. Please try again later.",
              confirmButtonText: "OK",
            });
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "An error occurred while submitting the return request. Please try again later.",
            confirmButtonText: "OK",
          });
        });
    }
  });
}

function handleItemCancellation(
  orderNumber,
  itemIndex,
  productName,
  productSize,
  productColor,
  productPrice
) {
  const cancelComment = document.getElementById("cancelComment").value.trim();

  if (!cancelComment) {
    Swal.fire({
      icon: "warning",
      title: "Comment Required",
      text: "Please provide a reason for cancellation before proceeding.",
      confirmButtonText: "OK",
    });
    return;
  }

  Swal.fire({
    title: "Are you sure?",
    text: "Do you really want to cancel this item?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, cancel it!",
    cancelButtonText: "No, keep it",
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Processing...",
        text: "Please wait while we cancel your item.",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const data = {
        orderNumber,
        productName,
        productSize,
        productColor,
        productPrice,
        cancelComment,
      };

      fetch("/cancel-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            Swal.fire({
              icon: "success",
              title: "Item Canceled",
              text: "The item has been successfully canceled.",
              confirmButtonText: "OK",
            }).then(() => {
              window.location.reload();
            });
          } else {
            Swal.fire({
              icon: "error",
              title: "Cancellation Failed",
              text:
                data.message ||
                "Failed to cancel the item. Please try again later.",
              confirmButtonText: "OK",
            });
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "An error occurred while canceling the item. Please try again later.",
            confirmButtonText: "OK",
          });
        });
    } else {
      Swal.fire({
        icon: "info",
        title: "Action Cancelled",
        text: "The item was not canceled.",
        toast: true,
        position: "top-end",
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    }
  });
}

function closeModal(modalId) {
  if (modalId) {
    document.getElementById(modalId).style.display = "none";
  } else {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.style.display = "none";
    });
  }

  if (modalId === "orderModal") {
    document.getElementById("modalItems").innerHTML = "";
  } else if (modalId === "cancelModal") {
    document.getElementById("cancelComment").value = "";
  } else if (modalId === "returnModal") {
    document.getElementById("returnComment").value = "";
  }
}

window.onclick = function (event) {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};
