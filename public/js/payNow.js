document.querySelectorAll(".pay-now-btn").forEach((button) => {
  button.addEventListener("click", function () {
    const orderId = this.getAttribute("data-order-id");

    fetch(`/get-order-details/${orderId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch order details");
        }
        return response.json();
      })
      .then((orderData) => {
        const items = orderData.order.items;

        fetch("/retry-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                `Retry Payment API failed: ${response.statusText}`
              );
            }
            return response.json();
          })
          .then((data) => {
            if (data.success && data.orderId) {
              const options = {
                key: data.key,
                amount: data.amount,
                currency: "INR",
                name: "CROWNIFY",
                description: "Retry Payment",
                order_id: data.orderId,
                handler: function (response) {
                  fetch("/update-order-status", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      orderNumber: data.orderNumber,
                      paymentId: response.razorpay_payment_id,
                      items: items,
                    }),
                  })
                    .then((updateResponse) => {
                      if (!updateResponse.ok) {
                        throw new Error(
                          `Failed to update order status: ${updateResponse.statusText}`
                        );
                      }
                      return updateResponse.json();
                    })
                    .then((updateData) => {
                      Swal.fire({
                        icon: "success",
                        title: "Payment Successful",
                        text: "Your payment has been processed successfully.",
                        confirmButtonText: "OK",
                      }).then(() => {
                        location.reload();
                      });
                    })
                    .catch((error) => {
                      Swal.fire({
                        icon: "error",
                        title: "Error",
                        text: "There was an issue updating your order status. Please try again later.",
                        confirmButtonText: "OK",
                      });
                    });
                },
                prefill: {
                  name: "Customer Name",
                  email: "customer@example.com",
                  contact: "1234567890",
                },
                theme: {
                  color: "#F37254",
                },
              };

              const rzp1 = new Razorpay(options);
              rzp1.open();
            } else {
              Swal.fire({
                icon: "error",
                title: "Payment Failed",
                text: "Unable to initiate payment. Please try again later.",
                confirmButtonText: "OK",
              });
            }
          })
          .catch((error) => {
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "There was an issue processing your payment. Please try again later.",
              confirmButtonText: "OK",
            });
          });
      })
      .catch((error) => {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Unable to fetch order details. Please try again later.",
          confirmButtonText: "OK",
        });
      });
  });
});
