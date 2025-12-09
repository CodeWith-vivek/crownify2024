const nameid = document.getElementById("name");
const emailid = document.getElementById("email");
const messageid = document.getElementById("message");
const phoneid = document.getElementById("phone");

const errorName = document.getElementById("errorName");
const errorEmail = document.getElementById("errorEmail");
const errorPhone = document.getElementById("errorPhone");
const errorMessage = document.getElementById("errorMessage");

let nameValid = false;
let emailValid = false;
let messageValid = false;
let phoneValid = false;

// Name validation
nameid.addEventListener("input", () => {
  const nameValue = nameid.value.trim();
  const namePattern = /^[A-Za-z]+(?: [A-Za-z]+){1,2}$/;

  if (nameValue === "") {
    errorName.textContent = "Name cannot be empty.";
    nameValid = false;
  } else if (!namePattern.test(nameValue)) {
    errorName.textContent = "Enter a valid full name.";
    nameValid = false;
  } else {
    errorName.textContent = "";
    nameValid = true;
  }
});

// Email validation
emailid.addEventListener("input", () => {
  const emailValue = emailid.value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (emailValue === "") {
    errorEmail.textContent = "Email cannot be empty.";
    emailValid = false;
  } else if (!emailPattern.test(emailValue)) {
    errorEmail.textContent = "Enter a valid email address.";
    emailValid = false;
  } else {
    errorEmail.textContent = "";
    emailValid = true;
  }
});

// Phone validation
phoneid.addEventListener("input", () => {
  const phoneValue = phoneid.value.trim();
  const phonePattern = /^\d{10}$/;

  if (phoneValue === "") {
    errorPhone.textContent = "Phone number cannot be empty.";
    phoneValid = false;
  } else if (!phonePattern.test(phoneValue)) {
    errorPhone.textContent = "Phone number must be 10 digits.";
    phoneValid = false;
  } else {
    errorPhone.textContent = "";
    phoneValid = true;
  }
});

// Message validation
messageid.addEventListener("input", () => {
  const messageValue = messageid.value.trim();

  if (messageValue === "") {
    errorMessage.textContent = "Message cannot be empty.";
    messageValid = false;
  } else if (messageValue.length < 10) {
    errorMessage.textContent = "Message must be at least 10 characters.";
    messageValid = false;
  } else {
    errorMessage.textContent = "";
    messageValid = true;
  }
});

// Form submission
document
  .getElementById("contactForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    if (nameValid && emailValid && phoneValid && messageValid) {
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch("/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
          Swal.fire("Success", result.message, "success").then(() => {
            event.target.reset();
          });
        } else {
          Swal.fire("Error", result.message, "error");
        }
      } catch (error) {
        console.error("Error:", error);
        Swal.fire("Error", "There was an error submitting your form.", "error");
      }
    } else {
      Swal.fire(
        "Validation Error",
        "Please correct the errors in the form.",
        "error"
      );
    }
  });
