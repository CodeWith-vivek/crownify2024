const nameid = document.getElementById("name");
const countryid = document.getElementById("country");
const phoneid = document.getElementById("phone");
const pincode = document.getElementById("pincode");
const homeid = document.getElementById("home");
const areaid = document.getElementById("area");
const landmarkid = document.getElementById("landmark");
const townid = document.getElementById("town");
const stateid = document.getElementById("state");
const addressTypeSelect = document.getElementById("addressType");
let nameValid = false;
let countryValid = false;
let phoneValid = false;
let pincodeValid = false;
let homeValid = false;
let areaValid = false;
let landmarkValid = false;
let townValid = false;
let stateValid = false;
let addressTypeValid = false;

addressTypeSelect.addEventListener("change", () => {
  if (addressTypeSelect.value === "") {
    addressTypeValid = false;
  } else {
    addressTypeValid = true;
  }
});

nameid.addEventListener("input", () => {
  const nameValue = nameid.value.trim();
  const namePattern = /^[A-Za-z]+(?: [A-Za-z]+){1,2}$/;
  if (nameValue === "") {
    error1.style.display = "block";
    error1.innerHTML = "Please enter a valid name";
    nameValid = false;
  } else if (!namePattern.test(nameValue)) {
    error1.style.display = "block";
    error1.innerHTML = "Full name required";
    nameValid = false;
  } else {
    error1.style.display = "none";
    error1.innerHTML = "";
    nameValid = true;
  }
});

countryid.addEventListener("input", () => {
  const countryValue = countryid.value.trim();
  const countryPattern = /^[A-Za-z]+$/;
  if (countryValue === "") {
    error2.style.display = "block";
    error2.innerHTML = "Country cannot be blank";
    countryValid = false;
  } else if (!countryPattern.test(countryValue)) {
    error2.style.display = "block";
    error2.innerHTML = "Country must only contain letters";
    countryValid = false;
  } else {
    error2.style.display = "none";
    countryValid = true;
  }
});

phoneid.addEventListener("input", () => {
  const phoneValue = phoneid.value.trim();
  const phonePattern = /^\d{10}$/;
  if (phoneValue === "") {
    error3.style.display = "block";
    error3.innerHTML = "Phone number cannot be blank";
    phoneValid = false;
  } else if (!phonePattern.test(phoneValue)) {
    error3.style.display = "block";
    error3.innerHTML = "Phone number must be 10 digits";
    phoneValid = false;
  } else {
    error3.style.display = "none";
    phoneValid = true;
  }
});

pincode.addEventListener("input", () => {
  const pincodeValue = pincode.value.trim();
  const pincodePattern = /^\d{6}$/;
  if (pincodeValue === "") {
    error4.style.display = "block";
    error4.innerHTML = "Pincode cannot be blank";
    pincodeValid = false;
  } else if (!pincodePattern.test(pincodeValue)) {
    error4.style.display = "block";
    error4.innerHTML = "Pincode must be 6 digits";
    pincodeValid = false;
  } else {
    error4.style.display = "none";
    pincodeValid = true;
  }
});

homeid.addEventListener("input", () => {
  const homeValue = homeid.value.trim();
  if (homeValue === "" || homeValue.split(" ").length < 2) {
    error5.style.display = "block";
    error5.innerHTML = "Home address cannot be blank or just a single space";
    homeValid = false;
  } else {
    error5.style.display = "none";
    homeValid = true;
  }
});

areaid.addEventListener("input", () => {
  const areaValue = areaid.value.trim();
  const areaPattern = /^[A-Za-z0-9]+$/;
  if (areaValue === "") {
    error6.style.display = "block";
    error6.innerHTML = "Area cannot be blank";
    areaValid = false;
  } else if (!areaPattern.test(areaValue)) {
    error6.style.display = "block";
    error6.innerHTML = "Area must only contain letters and numbers, no spaces";
    areaValid = false;
  } else {
    error6.style.display = "none";
    areaValid = true;
  }
});

landmarkid.addEventListener("input", () => {
  const landmarkValue = landmarkid.value.trim();
  const landmarkPattern = /^[A-Za-z0-9]+$/;
  if (landmarkValue === "") {
    error7.style.display = "block";
    error7.innerHTML = "Landmark cannot be blank";
    landmarkValid = false;
  } else if (!landmarkPattern.test(landmarkValue)) {
    error7.style.display = "block";
    error7.innerHTML =
      "Landmark must only contain letters and numbers, no spaces";
    landmarkValid = false;
  } else {
    error7.style.display = "none";
    landmarkValid = true;
  }
});

townid.addEventListener("input", () => {
  const townValue = townid.value.trim();
  const townPattern = /^[A-Za-z]+$/;
  if (townValue === "") {
    error8.style.display = "block";
    error8.innerHTML = "Town cannot be blank";
    townValid = false;
  } else if (!townPattern.test(townValue)) {
    error8.style.display = "block";
    error8.innerHTML = "Town must only contain letters";
    townValid = false;
  } else {
    error8.style.display = "none";
    townValid = true;
  }
});

stateid.addEventListener("input", () => {
  const stateValue = stateid.value.trim();
  const statePattern = /^[A-Za-z]+$/;
  if (stateValue === "") {
    error9.style.display = "block";
    error9.innerHTML = "State cannot be blank";
    stateValid = false;
  } else if (!statePattern.test(stateValue)) {
    error9.style.display = "block";
    error9.innerHTML = "State must only contain letters";
    stateValid = false;
  } else {
    error9.style.display = "none";
    stateValid = true;
  }
});
document
  .getElementById("signform")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    if (
      nameValid &&
      countryValid &&
      phoneValid &&
      pincodeValid &&
      homeValid &&
      areaValid &&
      landmarkValid &&
      townValid &&
      stateValid &&
      addressTypeValid
    ) {
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch("/addAddress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const result = await response.json();
          Swal.fire("Success", result.message, "success").then(() => {
            window.location.href = "/Address";
          });
        } else {
          const error = await response.json();
          Swal.fire("Error", error.message, "error");
        }
      } catch (error) {
        console.error("Error:", error);
        Swal.fire(
          "Error",
          "There was an error submitting your address.",
          "error"
        );
      }
    } else {
      Swal.fire(
        "Validation Error",
        "Please correct the errors in the form.",
        "error"
      );
    }
  });
