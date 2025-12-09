function confirmDeleteAddress(event, addressId) {
  event.preventDefault();

  Swal.fire({
    title: "Delete Address?",
    text: "Are you sure you want to delete this address?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, delete it!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`/delete-address/${addressId}`, {
        method: "POST",
        headers: {},
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          if (data.success) {
            Swal.fire({
              title: "Deleted!",
              text: "Address deleted successfully.",
              icon: "success",
              confirmButtonText: "OK",
            }).then(() => {
              window.location.reload();
            });
          } else {
            Swal.fire({
              title: "Failed!",
              text: data.message || "Failed to delete address.",
              icon: "error",
              confirmButtonText: "OK",
            });
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            title: "Error!",
            text: "An error occurred while deleting the address. Please try again.",
            icon: "error",
            confirmButtonText: "OK",
          });
        });
    }
  });
}
