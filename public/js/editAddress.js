document.addEventListener("DOMContentLoaded", () => {
  const fields = {
    name: {
      id: "name",
      error: "error1",
      pattern: /^[A-Za-z]+(?: [A-Za-z]+){1,2}$/,
      message: "Full name required",
    },
    country: {
      id: "country",
      error: "error2",
      pattern: /^[A-Za-z]+$/,
      message: "Country must only contain letters",
    },
    phone: {
      id: "phone",
      error: "error3",
      pattern: /^\d{10}$/,
      message: "Phone number must be 10 digits",
    },
    pincode: {
      id: "pincode",
      error: "error4",
      pattern: /^\d{6}$/,
      message: "Pincode must be 6 digits",
    },
    home: {
      id: "home",
      error: "error5",
      custom: (value) => value.split(" ").length >= 2,
      message: "Home address must be detailed",
    },
    area: {
      id: "area",
      error: "error6",
      pattern: /^[A-Za-z0-9]+$/,
      message: "Area must only contain letters and numbers",
    },
    landmark: {
      id: "landmark",
      error: "error7",
      pattern: /^[A-Za-z0-9]+$/,
      message: "Landmark must only contain letters and numbers",
    },
    town: {
      id: "town",
      error: "error8",
      pattern: /^[A-Za-z]+$/,
      message: "Town must only contain letters",
    },
    state: {
      id: "state",
      error: "error9",
      pattern: /^[A-Za-z]+$/,
      message: "State must only contain letters",
    },
  };

  const validateField = (field, isBlur = false) => {
    const element = document.getElementById(fields[field].id);
    const errorElement = document.getElementById(fields[field].error);
    const value = element.value.trim();

    let isValid = false;
    if (value === "") {
      errorElement.style.display = "block";
      errorElement.innerHTML = `Please enter ${field}`;
    } else if (fields[field].pattern && !fields[field].pattern.test(value)) {
      errorElement.style.display = "block";
      errorElement.innerHTML = fields[field].message;
    } else if (fields[field].custom && !fields[field].custom(value)) {
      errorElement.style.display = "block";
      errorElement.innerHTML = fields[field].message;
    } else {
      errorElement.style.display = "none";
      isValid = true;
    }

    return isValid;
  };

  for (const field in fields) {
    const element = document.getElementById(fields[field].id);
    element.addEventListener("input", () => validateField(field));
    element.addEventListener("blur", () => validateField(field, true));
  }

  document
    .getElementById("signform")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      let allValid = true;

      for (const field in fields) {
        const isFieldValid = validateField(field);
        if (!isFieldValid) allValid = false;
      }

      if (allValid) {
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());

        const addressId = window.location.pathname.split("/").pop();

        try {
          const response = await fetch(`/update-address/${addressId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            const result = await response.json();
            Swal.fire({
              title: "Success",
              text: result.message || "Address updated successfully",
              icon: "success",
              confirmButtonText: "OK",
            }).then(() => (window.location.href = "/Address"));
          } else {
            const error = await response.json();
            Swal.fire({
              title: "Error",
              text: error.message || "Failed to update address",
              icon: "error",
              confirmButtonText: "OK",
            });
          }
        } catch (error) {
          console.error("Error:", error);
          Swal.fire({
            title: "Error",
            text: "There was an error updating your address.",
            icon: "error",
            confirmButtonText: "OK",
          });
        }
      } else {
        Swal.fire({
          title: "Validation Error",
          text: "Please correct the errors in the form.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    });
});
