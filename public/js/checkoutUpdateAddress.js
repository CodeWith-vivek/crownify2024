document.addEventListener("DOMContentLoaded", function () {
  const editAddressModal = document.getElementById("editAddressModal");

  editAddressModal.addEventListener("show.bs.modal", function (event) {
    const button = event.relatedTarget;
    console.log("Button clicked to open modal:", button);

    const id = button.getAttribute("data-id");
    const fullName = button.getAttribute("data-fullname");
    const country = button.getAttribute("data-country");
    const phone = button.getAttribute("data-phone");
    const pincode = button.getAttribute("data-pincode");
    const home = button.getAttribute("data-home");
    const area = button.getAttribute("data-area");
    const landmark = button.getAttribute("data-landmark");
    const town = button.getAttribute("data-town");
    const state = button.getAttribute("data-state");
    const addressType = button.getAttribute("data-addresstype");

    console.log("Data retrieved from button:", {
      id,
      fullName,
      country,
      phone,
      pincode,
      home,
      area,
      landmark,
      town,
      state,
      addressType,
    });

    console.log("Address Type before setting:", addressType);
    // Update the modal's content.
    const modalIdInput = editAddressModal.querySelector("#editAddressId1");
    const modalNameInput = editAddressModal.querySelector("#modalName1");
    const modalCountryInput = editAddressModal.querySelector("#modalCountry1");
    const modalPhoneInput = editAddressModal.querySelector("#modalPhone1");
    const modalPincodeInput = editAddressModal.querySelector("#modalPincode1");
    const modalHomeInput = editAddressModal.querySelector("#modalHome1");
    const modalAreaInput = editAddressModal.querySelector("#modalArea1");
    const modalLandmarkInput =
      editAddressModal.querySelector("#modalLandmark1");
    const modalTownInput = editAddressModal.querySelector("#modalTown1");
    const modalStateInput = editAddressModal.querySelector("#modalState1");
    const modalAddressTypeSelect =
      editAddressModal.querySelector("#addressType");

    modalIdInput.value = id;
    modalNameInput.value = fullName;
    modalCountryInput.value = country;
    modalPhoneInput.value = phone;
    modalPincodeInput.value = pincode;
    modalHomeInput.value = home;
    modalAreaInput.value = area;
    modalLandmarkInput.value = landmark;
    modalTownInput.value = town;
    modalStateInput.value = state;
    modalAddressTypeSelect.value = addressType;
    console.log("Address Type after setting:", modalAddressTypeSelect.value);
    console.log("Modal fields populated with data.");
  });

  // Validation logic
  const fields = {
    name: {
      id: "modalName1",
      error: "error11",
      pattern: /^[A-Za-z]+(?: [A-Za-z]+){1,2}$/,
      message: "Full name required",
    },
    country: {
      id: "modalCountry1",
      error: "error22",
      pattern: /^[A-Za-z]+$/,
      message: "Country must only contain letters",
    },
    phone: {
      id: "modalPhone1",
      error: "error33",
      pattern: /^\d{10}$/,
      message: "Phone number must be 10 digits",
    },
    pincode: {
      id: "modalPincode1",
      error: "error44",
      pattern: /^\d{6}$/,
      message: "Pincode must be 6 digits",
    },
    home: {
      id: "modalHome1",
      error: "error55",
      custom: (value) => value.split(" ").length >= 2,
      message: "Home address must be detailed",
    },
    area: {
      id: "modalArea1",
      error: "error66",
      pattern: /^[A-Za-z0-9]+$/,
      message: "Area must only contain letters and numbers",
    },
    landmark: {
      id: "modalLandmark1",
      error: "error77",
      pattern: /^[A-Za-z0-9]+$/,
      message: "Landmark must only contain letters and numbers",
    },
    town: {
      id: "modalTown1",
      error: "error88",
      pattern: /^[A-Za-z]+$/,
      message: "Town must only contain letters",
    },
    state: {
      id: "modalState1",
      error: "error99",
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
    element.addEventListener("input", () => {
      console.log(`Input event on ${field}`);
      validateField(field);
    });
    element.addEventListener("blur", () => {
      validateField(field, true);
    });
  }

  document
    .getElementById("editAddressForm")
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

        try {
          const response = await fetch(`/update-address/${data.id}`, {
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
            }).then(() => (window.location.href = "/checkout"));
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
          console.error("Error during fetch:", error);
          Swal.fire({
            title: "Error",
            text: "There was an error updating your address.",
            icon: "error",
            confirmButtonText: "OK",
          });
        }
      } else {
        console.log("Validation failed, form not submitted");
        Swal.fire({
          title: "Validation Error",
          text: "Please correct the errors in the form.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    });
});
