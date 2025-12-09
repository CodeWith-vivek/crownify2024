const discountAmountElement = document.querySelector(
  ".checkout__total__all li:nth-child(2) span"
);
const totalElement = document.querySelector(
  ".checkout__total__all li:nth-child(4) span"
);

document.addEventListener("DOMContentLoaded", () => {
  const couponForm = document.getElementById("couponForm");
  const applyCouponButton = document.getElementById("applyCouponButton");
  const removeCouponButton = document.getElementById("removeCouponButton");

  if (couponForm) {
    couponForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const couponCode = document.getElementById("couponCodeInput").value;
      applyCoupon(couponCode);
    });
  }

  if (applyCouponButton) {
    applyCouponButton.addEventListener("click", () => {
      const couponCode = document.getElementById("couponCodeInput").value;
      applyCoupon(couponCode);
    });
  }

  if (removeCouponButton) {
    removeCouponButton.addEventListener("click", () => {
      removeCoupon();
    });
  }
});
function applyCoupon(couponCode) {
  if (!couponCode) {
    Swal.fire("Error", "Please enter a coupon code.", "error");
    return;
  }

  const subtotalElement = document.querySelector(
    ".checkout__total__all li:nth-child(1) span"
  );
  const subtotal = parseFloat(
    subtotalElement.textContent.replace("₹", "").replace(",", "")
  );

  const shippingElement = document.querySelector(
    ".checkout__total__all li:nth-child(3) span"
  );
  const shipping = parseFloat(
    shippingElement.textContent.replace("₹", "").replace(",", "")
  );

  const cartTotal = subtotal + shipping;

  fetch("/apply-coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ couponCode, cartTotal }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const discount = parseFloat(data.discount.applied);
        const discountElement = document.querySelector(
          ".checkout__total__all li:nth-child(2) span"
        );
        discountElement.innerHTML = "₹" + discount.toFixed(2);

        const total = cartTotal - discount;
        const totalElement = document.querySelector(
          ".checkout__total__all li:nth-child(4) span"
        );
        totalElement.innerHTML = "₹" + total.toFixed(2);

        document.querySelector('input[name="subtotal"]').value = subtotal;
        document.querySelector('input[name="shipping"]').value = shipping;
        document.querySelector('input[name="total"]').value = total;

        sessionStorage.setItem("appliedCoupon", couponCode);
        Swal.fire("Success", "Coupon applied successfully!", "success");
      } else {
        Swal.fire("Error", data.message || "Failed to apply coupon.", "error");
      }
    })
    .catch((error) => {
      console.error("Fetch Error:", error);
      Swal.fire("Error", "An error occurred. Try again.", "error");
    });
}
function removeCoupon() {
  const totalElement = document.querySelector(
    ".checkout__total__all li:nth-child(4) span"
  );
  const originalTotal = parseFloat(
    totalElement.textContent.replace("₹", "").replace(",", "")
  );

  fetch("/remove-coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cartTotal: originalTotal }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Remove coupon response:", data);
      handleRemoveCouponResponse(data);
    })
    .catch((error) => {
      console.error("Fetch Error:", error);
      Swal.fire("Error", "An error occurred. Try again.", "error");
    });
}

function handleRemoveCouponResponse(data) {
  if (data.success) {
    discountAmountElement.innerHTML = "₹0";

    if (data.finalTotal !== undefined) {
      totalElement.innerHTML = "₹" + data.finalTotal.toFixed(2);
    } else {
      console.error("finalTotal is undefined");
      totalElement.innerHTML = "₹0";
      Swal.fire(
        "Error",
        "Final total is not available after coupon removal.",
        "error"
      );
      return;
    }

    sessionStorage.removeItem("appliedCoupon");
    Swal.fire("Success", "Coupon removed successfully.", "success").then(() => {
      window.location.reload();
    });
  } else {
    Swal.fire("Error", data.message || "Failed to remove coupon.", "error");
  }
}
 function copyToClipboard(code) {
   navigator.clipboard
     .writeText(code)
     .then(() => {
       Swal.fire({
         icon: "success",
         title: "Copied!",
         text: "Coupon code copied to clipboard: " + code,
         timer: 2000,
         showConfirmButton: false,
       });
     })
     .catch((err) => {
       Swal.fire({
         icon: "error",
         title: "Oops...",
         text: "Could not copy text. Please try again!",
       });
       console.error("Could not copy text: ", err);
     });
 }
    document.addEventListener("DOMContentLoaded", () => {
      const couponCodeInput = document.getElementById("couponCodeInput");
      const applyCouponButton = document.getElementById("applyCouponButton");
      const removeCouponButton = document.getElementById("removeCouponButton");

      removeCouponButton.disabled = true;

      applyCouponButton.addEventListener("click", () => {
        if (couponCodeInput.value.trim() !== "") {
          removeCouponButton.disabled = false;
        } else {
        }
      });

      removeCouponButton.addEventListener("click", () => {
        couponCodeInput.value = "";
        removeCouponButton.disabled = true;
      });

      couponCodeInput.addEventListener("input", () => {
        if (couponCodeInput.value.trim() === "") {
          removeCouponButton.disabled = true;
        }
      });
    });

     function removeCouponFromSession() {
       console.log("Removing coupon...");

       const totalElement = document.querySelector(
         ".checkout__total__all li:nth-child(4) span"
       );
       const originalTotal = parseFloat(
         totalElement.textContent.replace("₹", "").replace(",", "")
       );

       fetch("/remove-coupon", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ cartTotal: originalTotal }),
       })
         .then((response) => {
           if (!response.ok) {
             console.error("Error removing coupon:", response.statusText);
           }
         })
         .catch((error) => {
           console.error("Fetch Error:", error);
         });
     }


     window.addEventListener("beforeunload", (event) => {
       if (window.location.pathname === "/checkout") {
         removeCouponFromSession();
       }
     });