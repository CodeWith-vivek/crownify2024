const emailid = document.getElementById("email");
const passid = document.getElementById("password");
const error1 = document.getElementById("error1");
const error2 = document.getElementById("error2");
let emailValid = false;
let passValid = false;

function emailValidateChecking() {
  const emailValue = emailid.value.toLowerCase().trim();
  const emailpattern =
    /^[a-zA-Z0-9._-]+@(gmail\.com|yahoo\.com|icloud\.com|outlook\.com)$/;
  if (!emailpattern.test(emailValue)) {
    error1.style.display = "block";
    error1.innerHTML = "Not a valid email id";
    emailValid = false;
  } else {
    error1.style.display = "block";
    error1.innerHTML = "";
    emailValid = true;
  }
}

function passValidationChecking() {
  const passValue = passid.value.trim();
  const passpattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (!passpattern.test(passValue)) {
    error2.style.display = "block";
    error2.innerHTML =
      "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character";
    passValid = false;
  } else {
    error2.style.display = "block";
    error2.innerHTML = "";
    passValid = true;
  }
}

passid.addEventListener("input", passValidationChecking);
emailid.addEventListener("input", emailValidateChecking);

document
  .getElementById("signform")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    emailValidateChecking();
    passValidationChecking();

    if (emailValid && passValid) {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            Swal.fire({
              icon: "success",
              title: "Login Successful",
              text: "You have successfully logged in.",
              showConfirmButton: false,
              timer: 1000,
            }).then(() => {
              window.location.href = data.redirectUrl;
            });
          } else {
            Swal.fire({
              icon: "info",
              title: "Login failed",
              text: data.message,
              confirmButtonText: "Try Again",
            });
          }
        })
        .catch((error) => {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "Something went wrong. Please try again later.",
            confirmButtonText: "Okay",
          });
        });
    } else {
      Swal.fire({
        icon: "warning",
        title: "Blank Input",
        text: "Do not leave any field blank.",
        confirmButtonText: "Try Again",
      });
    }
  });
