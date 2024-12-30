const Coupon=require("../models/couponSchema")

const rollbackCoupon = async (req, res, next) => {
  try {
    const { coupon } = req.session;
    if (coupon && coupon.temporary && !req.session.isCheckoutPage) {
      console.log("Rolling back coupon:", coupon.code);

      const couponRecord = await Coupon.findOne({ code: coupon.code });
      if (couponRecord) {

        const userIndex = couponRecord.users_applied.findIndex(
          (entry) => entry.user.toString() === coupon.userId.toString()
        );

        if (userIndex !== -1) {

          couponRecord.users_applied[userIndex].used_count -= 1;

          if (couponRecord.users_applied[userIndex].used_count <= 0) {
            couponRecord.users_applied.splice(userIndex, 1);
            console.log("User entry removed from users_applied.");
          }
        }

        couponRecord.usedCount = Math.max(0, couponRecord.usedCount - 1);

        await couponRecord.save();
        console.log("Coupon record updated:", couponRecord);
      }

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
