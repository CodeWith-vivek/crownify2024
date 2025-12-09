document
  .getElementById("googleSignInButton")
  .addEventListener("click", function (event) {
    event.preventDefault();

    window.location.href = "/auth/google?from=login";
  });

window.onload = async function () {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.has("error")) {
    const errorMessage = urlParams.get("error");
    Swal.fire({
      title: "Error",
      text: errorMessage,
      icon: "error",
      confirmButtonText: "Ok",
      customClass: {
        title: "swal-title",
        content: "swal-content",
        confirmButton: "swal-button",
      },
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
    }).then(() => {
      window.location.href = "/login";
    });
  }

  if (urlParams.has("success")) {
    const successMessage = urlParams.get("success");
    Swal.fire({
      title: "Success",
      text: successMessage || "Sign up successful!",
      icon: "success",
      confirmButtonText: "Okay",
    }).then(() => {
      window.location.href = "/";
    });
  }
};
