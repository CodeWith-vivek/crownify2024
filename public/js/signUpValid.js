const nameid = document.getElementById("name");
const emailid = document.getElementById("email");
const phoneid = document.getElementById("phone");
const passid = document.getElementById("password");
const cpassid = document.getElementById("confirm-password");
const error1 = document.getElementById("error1");
const error2 = document.getElementById("error2");
const error3 = document.getElementById("error3");
const error4 = document.getElementById("error4");
const error5 = document.getElementById("error5");
const signform = document.getElementById("signform");

let nameValid = false;
let emailValid = false;
let phoneValid = false;
let passValid = false;

function nameValidatedChecking() {
  const nameValue = nameid.value.trim();
  const namepattern = /^[A-Za-z]+(?: [A-Za-z]+){1,2}$/;
  if (nameValue === "") {
    error1.style.display = "block";
    error1.innerHTML = "Please enter a valid name";
    nameValid = false;
  } else if (!namepattern.test(nameValue)) {
    error1.style.display = "block";
    error1.innerHTML = "Full name required";
    nameValid = false;
  } else {
    error1.style.display = "none";
    error1.innerHTML = "";
    nameValid = true;
  }
  passValidationChecking();
}

function emailValidateChecking() {
  const emailValue = emailid.value.toLowerCase().trim();
  const emailpattern =
    /^[a-zA-Z0-9._-]+@(gmail\.com|yahoo\.com|icloud\.com|outlook\.com)$/;
  if (!emailpattern.test(emailValue)) {
    error2.style.display = "block";
    error2.innerHTML = "Not a valid email id";
    emailValid = false;
  } else {
    error2.style.display = "none";
    error2.innerHTML = "";
    emailValid = true;
  }
}

function phoneValidateChecking() {
  const phoneValue = phoneid.value.trim();
  const phonepattern = /^\d{10}$/;
  if (phoneValue === "") {
    error3.style.display = "block";
    error3.innerHTML = "Please enter a valid phone number";
    phoneValid = false;
  } else if (!phonepattern.test(phoneValue)) {
    error3.style.display = "block";
    error3.innerHTML = "Phone should be exactly 10 digits";
    phoneValid = false;
  } else {
    error3.style.display = "none";
    error3.innerHTML = "";
    phoneValid = true;
  }
}

function passValidationChecking() {
  const passValue = passid.value.trim();
  const cpassValue = cpassid.value.trim();
  const passpattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (passValue === "" || cpassValue === "") {
    error4.style.display = "block";
    error4.innerHTML = "Please enter a password";
    error5.style.display = "block";
    error5.innerHTML = "Please confirm your password";
    passValid = false;
  } else if (!passpattern.test(passValue)) {
    error4.style.display = "block";
    error4.innerHTML =
      "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character";
    passValid = false;
  } else if (passValue !== cpassValue) {
    error5.style.display = "block";
    error5.innerHTML = "Passwords do not match";
    passValid = false;
  } else {
    error4.style.display = "none";
    error4.innerHTML = "";
    error5.style.display = "none";
    error5.innerHTML = "";
    passValid = true;
  }
}

nameid.addEventListener("input", nameValidatedChecking);
emailid.addEventListener("input", emailValidateChecking);
phoneid.addEventListener("input", phoneValidateChecking);
passid.addEventListener("input", passValidationChecking);
cpassid.addEventListener("input", passValidationChecking);

signform.addEventListener("submit", async function (event) {
  event.preventDefault();

  nameValidatedChecking();
  emailValidateChecking();
  phoneValidateChecking();
  passValidationChecking();

  if (nameValid && emailValid && phoneValid && passValid) {
    const formData = {
      name: nameid.value.trim(),
      email: emailid.value.trim(),
      phone: phoneid.value.trim(),
      password: passid.value.trim(),
      cPassword: cpassid.value.trim(),
    };
    try {
      const response = await fetch("/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "OTP Sent",
          text: data.message,
          showConfirmButton: false,
          timer: 3000,
        }).then(() => {
          localStorage.setItem("countdownTime", "120");
          window.location.href = data.redirect;
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Registration Failed",
          text: data.message,
          showConfirmButton: false,
          timer: 5000,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Server Error",
        text: "Unable to connect to the server. Please try again later.",
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
