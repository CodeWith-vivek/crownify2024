const emailInput = document.getElementById("email");
const emailError = document.getElementById("error2");
const signupForm = document.getElementById("signform");

function validateLoginForm() {
  const emailValue = emailInput.value.toLowerCase().trim();
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailPattern.test(emailValue)) {
    emailError.style.display = "block";
    emailError.innerHTML = "Not a valid email id";
    return false;
  } else {
    emailError.style.display = "none";
    emailError.innerHTML = "";
    return true;
  }
}

signupForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const isValid = validateLoginForm();

  if (isValid) {
    const formData = {
      email: emailInput.value.trim(),
    };

    try {
      const response = await fetch("/forget-email-valid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "An error occurred");
      }

      const data = await response.json();
      if (data.success) {
        localStorage.removeItem("countdownTime");
        localStorage.removeItem("currentEmail");

        if (typeof intervalId !== "undefined") {
          clearInterval(intervalId);
        }
        Swal.fire({
          icon: "success",
          title: "OTP Sent",
          text: data.message,
          showConfirmButton: false,
          timer: 3000,
        }).then(() => {
          window.location.href = data.redirect;
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed",
          text: data.message,
          showConfirmButton: false,
          timer: 5000,
        });
      }
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

emailInput.addEventListener("input", validateLoginForm);
