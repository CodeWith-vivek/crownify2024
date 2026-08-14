const User = require("../user/userSchema");
const Address = require("../address/addressSchema");
const { loadStorefrontContext } = require("../../shared/utils/storefrontContext");
const { AppError, notFound, badRequest } = require("../../shared/errors/AppError");

// Saved shipping addresses, free of Express.

const MAX_ADDRESSES = 4;

const REQUIRED_FIELDS = [
  "addressType",
  "fullName",
  "country",
  "mobileNumber",
  "postalCode",
  "flatHouseCompany",
  "areaStreet",
  "city",
  "state",
];

/**
 * The forms post their own field names (name/phone/pincode/home/area/town);
 * the schema uses fullName/mobileNumber/postalCode/flatHouseCompany/
 * areaStreet/city. One translation point instead of two inline copies.
 */
function toAddressFields(body) {
  return {
    addressType: body.addressType,
    fullName: body.name,
    country: body.country,
    mobileNumber: body.phone,
    postalCode: body.pincode,
    flatHouseCompany: body.home,
    areaStreet: body.area,
    landmark: body.landmark,
    city: body.town,
    state: body.state,
  };
}

async function getAddAddressPageData(userId) {
  const { userData, cartCount, wishlistCount } = await loadStorefrontContext(userId);
  return { user: userData, cartCount, wishlistCount };
}

async function addAddress({ userId, body }) {
  const fields = toAddressFields(body);

  if (REQUIRED_FIELDS.some((field) => !fields[field])) {
    throw badRequest("All fields are required.");
  }

  const user = await User.findById(userId).populate("addresses");
  if (!user) throw notFound("User not found.");

  if (user.addresses.length >= MAX_ADDRESSES) {
    throw badRequest(`You cannot add more than ${MAX_ADDRESSES} addresses.`);
  }

  // The very first address is always primary — otherwise the account would
  // have addresses but no default to ship to.
  const setAsPrimary = body.isPrimary === "true" || user.addresses.length === 0;

  if (setAsPrimary) {
    await Address.updateMany({ userId }, { $set: { isPrimary: false } });
  }

  const address = await Address.create({ userId, ...fields, isPrimary: setAsPrimary });

  user.addresses.push(address._id);
  await user.save();

  return address;
}

async function setPrimaryAddress({ userId, addressId }) {
  await Address.updateMany({ userId }, { $set: { isPrimary: false } });

  // Scoped by userId as well as _id — without it, any signed-in user could
  // flip another account's address to primary by guessing an id.
  const updated = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    { $set: { isPrimary: true } },
    { new: true }
  );

  if (!updated) throw notFound("Address not found");

  return { message: "Primary address updated successfully" };
}

async function deleteAddress({ userId, addressId }) {
  const deleted = await Address.findOneAndDelete({ _id: addressId, userId });
  if (!deleted) throw notFound("Address not found");

  await User.updateOne({ _id: userId }, { $pull: { addresses: deleted._id } });

  // Deleting the primary leaves the account with no default — promote
  // whichever address remains so checkout always has one to preselect.
  if (deleted.isPrimary) {
    const survivor = await Address.findOne({ userId });
    if (survivor) {
      await Address.findByIdAndUpdate(survivor._id, { $set: { isPrimary: true } });
    }
  }

  return { message: "Address deleted successfully" };
}

async function getEditAddressData({ userId, addressId }) {
  const [context, address] = await Promise.all([
    loadStorefrontContext(userId),
    Address.findOne({ _id: addressId, userId }),
  ]);

  if (!context.userData) {
    throw new AppError("Please log in", { status: 401, details: { redirect: "/login" } });
  }

  if (!address) {
    throw new AppError("Address not found", { status: 404, details: { redirect: "/profile" } });
  }

  return {
    address,
    user: context.userData,
    pageTitle: "Edit Address",
    cartCount: context.cartCount,
    wishlistCount: context.wishlistCount,
  };
}

async function updateAddress({ userId, addressId, body }) {
  let updated;
  try {
    updated = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { $set: toAddressFields(body) },
      { new: true, runValidators: true }
    );
  } catch (error) {
    // Surface the schema's own validation message rather than a generic
    // 500 — these are user-correctable input errors.
    if (error.name === "ValidationError") {
      throw badRequest(Object.values(error.errors).map((err) => err.message)[0]);
    }
    throw error;
  }

  if (!updated) {
    throw notFound("Address not found or you do not have permission to edit this address");
  }

  return { message: "Address updated successfully", address: updated };
}

module.exports = {
  getAddAddressPageData,
  addAddress,
  setPrimaryAddress,
  deleteAddress,
  getEditAddressData,
  updateAddress,
  MAX_ADDRESSES,
};
