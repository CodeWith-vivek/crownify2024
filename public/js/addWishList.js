async function addToWishlist(productId) {
  try {
    const response = await fetch("/wishlist/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId }),
    });

  
    console.log("Response Status:", response.status);
    const responseText = await response.text(); 
    console.log("Response Body:", responseText);

    let result;
    try {
      result = JSON.parse(responseText); 
    } catch (error) {
      console.error("Failed to parse response as JSON:", error);
      throw new Error("Invalid server response.");
    }

    if (!response.ok) {
      if (response.status === 401) {
        Swal.fire({
          icon: "error",
          title: "Login Required",
          text:
            result.message ||
            "You must be logged in to add items to the wishlist.",
        });
      } else if (response.status === 404) {
        Swal.fire({
          icon: "error",
          title: "Product Not Found",
          text: result.message || "The product could not be found.",
        });
      } else if (response.status === 400) {
        Swal.fire({
          icon: "error",
          title: "Already in Wishlist",
          text: result.message || "This product is already in your wishlist.",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed to Add to Wishlist",
          text: result.message || "An error occurred. Please try again.",
        });
      }
      return;
    }

    
    if (result.success) {
      Swal.fire({
        icon: "success",
        title: "Added to Wishlist!",
        text: result.message,
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        window.location.reload();
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Failed to Add to Wishlist",
        text: result.message,
      }).then(() => {
        window.location.reload();
      });
    }
  } catch (error) {
    console.error("Add to Wishlist Error:", error);
    Swal.fire({
      icon: "error",
      title: "An Error Occurred",
      text: "Unable to add to wishlist. Please try again.",
    });
  }
}
