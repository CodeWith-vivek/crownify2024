
 async function addToWishlist(productId) {
   try {
     const response = await fetch("/wishlist/add", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({ productId }),
     });

     const result = await response.json();
      if (response.status === 401) {
        Swal.fire({
          icon: "error",
          title: "Login Required",
          text:
            result.message ||
            "You must be logged in to add items to the wishlist.",
        });
        return;
      }

     if (result.success) {
       Swal.fire({
         icon: "success",
         title: "Added to Wishlist!",
         text: result.message,
       });
     } else {
       Swal.fire({
         icon: "error",
         title: "Failed to Add to Wishlist",
         text: result.message,
       });
     }
   } catch (error) {
     Swal.fire({
       icon: "error",
       title: "An Error Occurred",
       text: "Unable to add to wishlist. Please try again.",
     });
     console.error("Add to Wishlist Error:", error);
   }
 }