document.addEventListener("DOMContentLoaded", () => {
  const invoiceButtons = document.querySelectorAll(".invoice-btn");

  invoiceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const orderId = button.getAttribute("data-order-id");
      if (orderId) {
        window.location.href = `/invoice/${orderId}`;
      } else {
        alert("Order ID is missing!");
      }
    });
  });
});
