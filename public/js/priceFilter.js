function filterByPrice(min, max) {
  const filterForm = document.getElementById("filterForm");
  const priceInput = document.createElement("input");
  priceInput.type = "hidden";
  priceInput.name = "priceRange";
  priceInput.value = `${min}-${max}`;
  filterForm.appendChild(priceInput);
  filterForm.submit();
}
