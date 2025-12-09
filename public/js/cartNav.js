document.addEventListener("DOMContentLoaded", () => {
  const cartLinks = document.querySelectorAll(".site-header__cart");

  cartLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.stopPropagation();

      window.location.href = "/cart";

      e.preventDefault();
    });
  });
});
