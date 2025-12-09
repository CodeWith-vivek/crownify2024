document
  .getElementById("toggleCurrentPassword")
  .addEventListener("click", function () {
    const currentPasswordInput = document.getElementById("password");
    const currentPasswordEye = document.getElementById("currentPasswordEye");
    if (currentPasswordInput.type === "password") {
      currentPasswordInput.type = "text";
      currentPasswordEye.classList.remove("fa-eye");
      currentPasswordEye.classList.add("fa-eye-slash");
    } else {
      currentPasswordInput.type = "password";
      currentPasswordEye.classList.remove("fa-eye-slash");
      currentPasswordEye.classList.add("fa-eye");
    }
  });
document
  .getElementById("toggleNewPassword")
  .addEventListener("click", function () {
    const passwordInput = document.getElementById("npassword");
    const passwordEye = document.getElementById("newPasswordEye");
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      passwordEye.classList.remove("fa-eye");
      passwordEye.classList.add("fa-eye-slash");
    } else {
      passwordInput.type = "password";
      passwordEye.classList.remove("fa-eye-slash");
      passwordEye.classList.add("fa-eye");
    }
  });

document
  .getElementById("toggleConfirmPassword")
  .addEventListener("click", function () {
    const confirmPasswordInput = document.getElementById("cpassword");
    const confirmPasswordEye = document.getElementById("confirmPasswordEye");
    if (confirmPasswordInput.type === "password") {
      confirmPasswordInput.type = "text";
      confirmPasswordEye.classList.remove("fa-eye");
      confirmPasswordEye.classList.add("fa-eye-slash");
    } else {
      confirmPasswordInput.type = "password";
      confirmPasswordEye.classList.remove("fa-eye-slash");
      confirmPasswordEye.classList.add("fa-eye");
    }
  });
