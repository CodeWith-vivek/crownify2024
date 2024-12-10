const Coupon=require("../models/couponSchema")

const rollbackCoupon = async (req, res, next) => {
  try {
    const { coupon } = req.session;

    // Proceed only if a coupon is in the session, it's temporary, and the user is NOT on the checkout page
    if (coupon && coupon.temporary && !req.session.isCheckoutPage) {
      console.log("Rolling back coupon:", coupon.code);

      // Find the coupon in the database
      const couponRecord = await Coupon.findOne({ code: coupon.code });
      if (couponRecord) {
        // Locate the user entry in the `users_applied` array
        const userIndex = couponRecord.users_applied.findIndex(
          (entry) => entry.user.toString() === coupon.userId.toString()
        );

        if (userIndex !== -1) {
          // Decrement the user's usage count
          couponRecord.users_applied[userIndex].used_count -= 1;

          // Remove the user entry if the count is 0 or less
          if (couponRecord.users_applied[userIndex].used_count <= 0) {
            couponRecord.users_applied.splice(userIndex, 1);
            console.log("User entry removed from users_applied.");
          }
        }

        // Rollback global usage count
        couponRecord.usedCount = Math.max(0, couponRecord.usedCount - 1);

        // Save changes to the database
        await couponRecord.save();
        console.log("Coupon record updated:", couponRecord);
      }

      // Clear the coupon session
      req.session.coupon = null;
      console.log("Coupon rolled back and removed from session.");
    }

    next();
  } catch (err) {
    console.error("Error in rollbackCoupon middleware:", err);
    next();
  }
};

module.exports = rollbackCoupon;
