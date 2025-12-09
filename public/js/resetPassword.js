const passid = document.getElementById("password");
const cpassid = document.getElementById("confirm-password");
const error4 = document.getElementById("error4");
const error5 = document.getElementById("error5");
const signupForm = document.getElementById("signform");
let passValid = false;

function passValidationChecking() {
  const passValue = passid.value.trim();
  const cpassValue = cpassid.value.trim();
  const passpattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  error4.style.display = "none";
  error5.style.display = "none";

  if (passValue === "") {
    error4.style.display = "block";
    error4.innerHTML = "Please enter a password";
    passValid = false;
  } else if (!passpattern.test(passValue)) {
    error4.style.display = "block";
    error4.innerHTML =
      "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character";
    passValid = false;
  } else if (cpassValue === "") {
    error5.style.display = "block";
    error5.innerHTML = "Please confirm your password";
    passValid = false;
  } else if (passValue !== cpassValue) {
    error5.style.display = "block";
    error5.innerHTML = "Passwords do not match";
    passValid = false;
  } else {
    passValid = true;
  }

  return passValid;
}

passid.addEventListener("input", passValidationChecking);
cpassid.addEventListener("input", passValidationChecking);

signupForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const isValid = passValidationChecking();

  if (isValid) {
    const formData = {
      password: passid.value.trim(),
      cPassword: cpassid.value.trim(),
    };

    try {
      const response = await fetch("/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid JSON response from server.");
      }

      if (!response.ok) {
        throw new Error(data.message || "An error occurred");
      }

      Swal.fire({
        icon: "success",
        title: "Password Changed",
        text: data.message,
        showConfirmButton: false,
        timer: 3000,
      }).then(() => {
        window.location.href = data.redirect;
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Server Error",
        text:
          error.message ||
          "Unable to connect to the server. Please try again later.",
        confirmButtonText: "Okay",
      });
    }
  }
});

document
  .getElementById("toggle-password")
  .addEventListener("click", function () {
    const passwordInput = document.getElementById("password");
    const eyeIcon = document.getElementById("password-eye-icon");

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      eyeIcon.classList.remove("fa-eye");
      eyeIcon.classList.add("fa-eye-slash");
    } else {
      passwordInput.type = "password";
      eyeIcon.classList.remove("fa-eye-slash");
      eyeIcon.classList.add("fa-eye");
    }
  });

document
  .getElementById("toggle-confirm-password")
  .addEventListener("click", function () {
    const confirmPasswordInput = document.getElementById("confirm-password");
    const confirmEyeIcon = document.getElementById("confirm-eye-icon");

    if (confirmPasswordInput.type === "password") {
      confirmPasswordInput.type = "text";
      confirmEyeIcon.classList.remove("fa-eye");
      confirmEyeIcon.classList.add("fa-eye-slash");
    } else {
      confirmPasswordInput.type = "password";
      confirmEyeIcon.classList.remove("fa-eye-slash");
      confirmEyeIcon.classList.add("fa-eye");
    }
  });
