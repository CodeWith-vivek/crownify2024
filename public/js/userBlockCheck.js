async function checkUserBlockStatus() {
  try {
    const response = await fetch("/check-block-status", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    if (data.blocked) {
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Error checking block status:", error);
  }
}

setInterval(checkUserBlockStatus, 2000);
