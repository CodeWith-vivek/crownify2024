

document
  .getElementById("add-money-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = document.getElementById("amount").value;

    if (amount <= 0) {
      Swal.fire("Error", "Please enter a valid amount.", "error");
      return;
    }

    try {
      const response = await fetch("/wallet/add-money", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();

      if (data.success) {
        const options = {
          key: RAZORPAY_KEY_ID,
          amount: data.amount * 100,
          currency: "INR",
          name: "Your Company Name",
          description: "Add to Wallet",
          order_id: data.orderId,
          handler: async function (response) {
            try {
              const confirmResponse = await fetch("/confirm-payment", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: "<%= user._id %>",
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  amount: amount,
                }),
              });

              const confirmData = await confirmResponse.json();

              if (confirmData.success) {
                Swal.fire({
                  title: "Success",
                  text: confirmData.message,
                  icon: "success",
                }).then(() => {
                  location.reload();
                });
              } else {
                Swal.fire({
                  title: "Error",
                  text: confirmData.message,
                  icon: "error",
                });
              }
            } catch (error) {
              console.error("Error during payment confirmation:", error);
              Swal.fire({
                title: "Payment Confirmation Error",
                text: "An error occurred while confirming the payment. Please try again.",
                icon: "error",
              });
            }
          },
          modal: {
            ondismiss: async function () {
              console.log("DEBUG: Razorpay modal dismissed.");
            },
          },
          // Add a failure handler for payment
          "payment.failed": async function (response) {
            console.error("Payment failed:", response.error);
            Swal.fire({
              title: "Payment Failed",
              text:
                response.error.description ||
                "An unknown error occurred. Please try again.",
              icon: "error",
            });
          },
          prefill: {
            name: "Customer Name",
            email: "customer@example.com",
            contact: "9999999999",
          },
          theme: {
            color: "#F37254",
          },
        };

        const rzp = new Razorpay(options);
        rzp.open();
      } else {
        Swal.fire("Error", data.message, "error");
      }
    } catch (error) {
      console.error("Error during payment process:", error);
      Swal.fire("Error", "Something went wrong. Please try again.", "error");
    }
  });

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/wallet/balance");
    const data = await response.json();

    if (data.success) {
      document.querySelector(".balance").textContent = `₹${data.balance.toFixed(
        2
      )}`;
    } else {
      Swal.fire("Error", data.message, "error");
    }
  } catch (error) {
    console.error("Error fetching balance:", error);
    Swal.fire(
      "Error",
      "An error occurred while fetching the balance.",
      "error"
    );
  }
});

function quickAdd(amount) {
  const amountInput = document.getElementById("amount");
  amountInput.value = amount;
  document
    .getElementById("add-money-form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}
