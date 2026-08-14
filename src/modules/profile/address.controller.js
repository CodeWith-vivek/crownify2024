const User = require("../user/userSchema");
const Address = require("../address/addressSchema");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");

// Saved shipping addresses: list, add, edit, delete, set primary.

const MAX_ADDRESSES = 4;

const loadAddAddressPage = async (req, res) => {
  try {
    const { userData, cartCount, wishlistCount } = await loadStorefrontContext(req.session.user);
    res.json({ success: true, user: userData, cartCount, wishlistCount });
  } catch (error) {
    console.error("Error loading add address page:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const addAddress = async (req, res) => {
  const userId = req.session.user;
  const {
    addressType,
    name: fullName,
    country,
    phone: mobileNumber,
    pincode: postalCode,
    home: flatHouseCompany,
    area: areaStreet,
    landmark,
    town: city,
    state,
    isPrimary,
  } = req.body;

  if (
    !addressType ||
    !fullName ||
    !country ||
    !mobileNumber ||
    !postalCode ||
    !flatHouseCompany ||
    !areaStreet ||
    !city ||
    !state
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const user = await User.findById(userId).populate("addresses");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.addresses.length >= MAX_ADDRESSES) {
      return res.status(400).json({
        message: `You cannot add more than ${MAX_ADDRESSES} addresses.`,
      });
    }

    // The very first address is always primary — otherwise the account
    // would have addresses but no default to ship to.
    const setAsPrimary = isPrimary === "true" || user.addresses.length === 0;

    if (setAsPrimary) {
      await Address.updateMany({ userId }, { $set: { isPrimary: false } });
    }

    const newAddress = await Address.create({
      userId,
      addressType,
      fullName,
      country,
      mobileNumber,
      postalCode,
      flatHouseCompany,
      areaStreet,
      landmark,
      city,
      state,
      isPrimary: setAsPrimary,
    });

    user.addresses.push(newAddress._id);
    await user.save();

    res.status(201).json({
      message: "Address added successfully!",
      data: newAddress,
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({
      message: "Error adding address. Please try again.",
      error: error.message,
    });
  }
};

const setPrimaryAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    await Address.updateMany({ userId: userId }, { $set: { isPrimary: false } });

    // Scoped by userId as well as _id — without it, any signed-in user
    // could flip another account's address to primary by guessing an id.
    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId: userId },
      { $set: { isPrimary: true } },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.json({
      success: true,
      message: "Primary address updated successfully",
    });
  } catch (error) {
    console.error("Error setting primary address:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating primary address",
    });
  }
};

const deleteUserAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;

    const address = await Address.findOne({ _id: addressId, userId: userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const deletedAddress = await Address.findOneAndDelete({
      _id: addressId,
      userId: userId,
    });

    // Deleting the primary leaves the account with no default — promote
    // whichever address remains so checkout always has one to preselect.
    if (deletedAddress.isPrimary) {
      const firstAddress = await Address.findOne({ userId: userId });
      if (firstAddress) {
        await Address.findByIdAndUpdate(firstAddress._id, {
          $set: { isPrimary: true },
        });
      }
    }

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting address",
    });
  }
};

const editUserAddress = async (req, res) => {
  try {
    const userId = req.session.user;

    const [context, address] = await Promise.all([
      loadStorefrontContext(userId),
      Address.findOne({ _id: req.params.id, userId: userId }),
    ]);

    if (!context.userData) {
      return res.status(401).json({ success: false, message: "Please log in", redirect: "/login" });
    }

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found", redirect: "/profile" });
    }

    res.json({
      success: true,
      address,
      user: context.userData,
      pageTitle: "Edit Address",
      cartCount: context.cartCount,
      wishlistCount: context.wishlistCount,
    });
  } catch (error) {
    console.error("Edit Address Error:", error);
    res.status(500).json({ success: false, message: "Error loading address" });
  }
};

const updateUserAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;

    const {
      addressType,
      name,
      country,
      phone,
      pincode,
      home,
      area,
      landmark,
      town,
      state,
    } = req.body;

    const updatedAddress = await Address.findOneAndUpdate(
      {
        _id: addressId,
        userId: userId,
      },
      {
        $set: {
          addressType,
          fullName: name,
          country,
          mobileNumber: phone,
          postalCode: pincode,
          flatHouseCompany: home,
          areaStreet: area,
          landmark,
          city: town,
          state,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message:
          "Address not found or you do not have permission to edit this address",
      });
    }

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address: updatedAddress,
    });
  } catch (error) {
    console.error("Update Address Error:", error);

    // Surface the schema's own validation message rather than a generic
    // 500 — these are user-correctable input errors.
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((err) => err.message)[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "An error occurred while updating the address",
    });
  }
};

module.exports = {
  loadAddAddressPage,
  addAddress,
  setPrimaryAddress,
  deleteUserAddress,
  editUserAddress,
  updateUserAddress,
};
