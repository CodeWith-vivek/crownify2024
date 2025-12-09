document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("checkoutForm")
    .addEventListener("submit", async function (event) {
      event.preventDefault();

      const paymentChecked = document.querySelector(
        'input[name="paymentMethod"]:checked'
      );
      const primaryAddress = document.querySelector(
        'input[name="primaryAddressId"]'
      );
      const totalAmount = parseFloat(
        document.querySelector('input[name="total"]').value
      );

      if (!paymentChecked) {
        Swal.fire({
          title: "Payment Method Required",
          text: "Please select a payment method (Wallet, Cash on Delivery, or Razor Pay).",
          icon: "warning",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!primaryAddress) {
        Swal.fire({
          title: "Primary Address Required",
          text: "Please add and select a primary shipping address.",
          icon: "warning",
          confirmButtonText: "ok",
          showCancelButton: true,
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = "/checkout";
          }
        });
        return;
      }

      // Restrict COD for orders above ₹1000
      if (paymentChecked.value === "COD" && totalAmount > 1000) {
        Swal.fire({
          title: "COD Not Allowed",
          text: "Cash on Delivery is not available for orders above ₹1000. Please choose another payment method.",
          icon: "warning",
          confirmButtonText: "OK",
        });
        return;
      }

      // Confirm order
      Swal.fire({
        title: "Confirm Order",
        html: `
                <p>Are you sure you want to place this order?</p>
                <strong>Payment Method:</strong> ${paymentChecked.value}<br>
                <strong>Total Amount:</strong> ₹${totalAmount}
            `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Place Order",
        cancelButtonText: "Cancel",
        reverseButtons: true,
      }).then(async (result) => {
        if (result.isConfirmed) {
          const submitButton = event.target.querySelector(
            'button[type="submit"]'
          );
          submitButton.disabled = true;
          submitButton.innerHTML = "Processing...";

          try {
            // Collect form data
            const formData = {
              primaryAddressId: primaryAddress.value,
              products: Array.from(
                document.querySelectorAll('input[name="products[]"]')
              ).map((input) => input.value),
              quantities: Array.from(
                document.querySelectorAll('input[name="quantities[]"]')
              ).map((input) => input.value),
              sizes: Array.from(
                document.querySelectorAll('input[name="sizes[]"]')
              ).map((input) => input.value),
              colors: Array.from(
                document.querySelectorAll('input[name="colors[]"]')
              ).map((input) => input.value),
              subtotal: document.querySelector('input[name="subtotal"]').value,
              shipping: document.querySelector('input[name="shipping"]').value,
              total: totalAmount,
              paymentMethod: paymentChecked.value,
            };

            // Handle payment methods
            if (paymentChecked.value === "Wallet") {
              await handleWalletPayment(formData);
            } else if (paymentChecked.value === "RazorPay") {
              handleRazorpayPayment(formData);
            } else if (paymentChecked.value === "COD") {
              await handleCODPayment(formData);
            }
          } catch (error) {
            console.error("Checkout Error:", error);
            Swal.fire({
              icon: "error",
              title: "Checkout Failed",
              text:
                error.message ||
                "Unable to process your order. Please try again.",
              confirmButtonText: "ok",
            });
            window.location.reload();
          } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = "Proceed to Checkout";
          }
        }
      });
    });
});
// Handle Razorpay Payment

async function handleRazorpayPayment(formData) {
  try {
    const response = await fetch("/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (
      data.message ===
      "The applied coupon is no longer valid. Please refresh and try again."
    ) {
      Swal.fire({
        title: "Coupon Invalid",
        text: data.message,
        icon: "error",
        confirmButtonText: "OK",
      }).then((result) => {
        if (result.isConfirmed) {
          fetch("/remove-coupon", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          window.location.reload();
        }
      });

      return;
    }
    if (data.success && data.razorpayOrderId) {
      const options = {
        key: data.key,
        amount: data.amount,
        currency: "INR",
        name: "CROWNIFY",
        description: "Order Payment",
        order_id: data.razorpayOrderId,
        handler: async function (response) {
          try {
            const verifyResponse = await fetch("/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...response,
                orderId: data.orderId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(
                `Payment Verification Failed: ${verifyResponse.statusText}`
              );
            }

            if (verifyData.success) {
              window.location.href = `/payment-success?orderId=${data.orderId}`;
            } else {
              await handlePaymentFailure(data.orderId, data.amount);
            }
          } catch (error) {
            await Swal.fire({
              icon: "error",
              title: "Payment Verification Error",
              text:
                error.message ||
                "An error occurred during payment verification.",
            });
          }
        },
        prefill: {
          name: "Customer Name",
          email: "customer@example.com",
          contact: "Customer Phone Number",
        },
        theme: {
          color: "#3399cc",
        },
        modal: {
          ondismiss: async function () {
            try {
              const response = await fetch("/delete-preliminary-order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ orderId: data.orderId }),
              });

              const deleteData = await response.json();

              if (!response.ok) {
                throw new Error(
                  `Failed to delete preliminary order: ${response.statusText}`
                );
              }

              if (deleteData.success) {
                console.log("Preliminary order deleted successfully.");
              } else {
                console.warn(
                  " Preliminary order deletion failed:",
                  deleteData.message
                );
              }
            } catch (error) {
              console.error("Error deleting preliminary order:", error.message);
            } finally {
              window.location.reload();
            }
          },
        },
      };

      const razorpayInstance = new Razorpay(options);

      razorpayInstance.open();

      razorpayInstance.on("payment.failed", async function (response) {
        try {
          const failureResponse = await fetch("/payment-failure", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId: data.orderId,
              paymentId: response.error.metadata.payment_id || null,
              razorpayOrderId: response.error.metadata.order_id || null,
              reason: response.error.reason || "Unknown reason",
              description:
                response.error.description || "No description available",
            }),
          });

          const failureData = await failureResponse.json();

          if (!failureResponse.ok) {
            throw new Error(
              `Failed to save payment failure: ${failureResponse.statusText}`
            );
          }

          window.location.href = `/payment-Failure?orderId=${data.orderId}`;
        } catch (error) {
          await Swal.fire({
            icon: "error",
            title: "Payment Failure Error",
            text:
              error.message ||
              "Unable to save payment failure details. Please contact support.",
          });
          window.location.href = "/error-page";
        }
      });
    } else {
      throw new Error(data.message || "Failed to create Razorpay order");
    }
  } catch (error) {
    await Swal.fire({
      icon: "error",
      title: "Payment Failed",
      text: error.message || "Unable to process payment. Please try again.",
      confirmButtonText: "ok",
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload();
      }
    });
  }
}

async function handleWalletPayment(formData) {
  try {
    const response = await fetch("/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (
      data.message ===
      "The applied coupon is no longer valid. Please refresh and try again."
    ) {
      Swal.fire({
        title: "Coupon Invalid",
        text: data.message,
        icon: "error",
        confirmButtonText: "OK",
      }).then((result) => {
        if (result.isConfirmed) {
          fetch("/remove-coupon", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          window.location.reload();
        }
      });

      return;
    }

    if (data.success) {
      window.location.href = `/payment-success?orderId=${data.orderId}`;
    } else {
      throw new Error(data.message || "Unable to process wallet payment");
    }
  } catch (error) {
    console.error("Wallet Checkout Error:", error);
    Swal.fire({
      icon: "error",
      title: "Payment Failed",
      text:
        error.message || "Unable to process wallet payment. Please try again.",
      confirmButtonText: "ok",
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload();
      }
    });
  }
}

// Handle COD Payment
async function handleCODPayment(formData) {
  try {
    const response = await fetch("/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (data.success) {
      window.location.href = `/payment-success?orderId=${data.orderId}`;
    } else {
      throw new Error(data.message || "Unable to place order");
    }
  } catch (error) {
    console.error("COD Checkout Error:", error);
    Swal.fire({
      icon: "error",
      title: "Order Failed",
      text: error.message || "Unable to process your order. Please try again.",
      confirmButtonText: "ok",
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload();
      }
    });
  }
}

function confirmPrimaryAddress(event, addressId) {
  event.preventDefault();

  Swal.fire({
    title: "Set as Primary Address?",
    text: "Do you want to set this as your primary address?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, set it!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`/set-primary-address/${addressId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      })
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text();
            console.log("Error response body:", text);
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.success) {
            Swal.fire({
              title: "Success!",
              text: "Primary address updated successfully.",
              icon: "success",
              confirmButtonText: "OK",
            }).then(() => {
              window.location.reload();
            });
          } else {
            Swal.fire({
              title: "Failed!",
              text: data.message || "Failed to update primary address.",
              icon: "error",
              confirmButtonText: "OK",
            });
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            title: "Error!",
            text: "An error occurred while updating primary address. Please try again.",
            icon: "error",
            confirmButtonText: "OK",
          });
        });
    }
  });
}
