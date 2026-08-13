// Ported 1:1 from the original jQuery scripts (public/js/signUpValid.js,
// loginValid.js, emailValid.js, resetPassword.js, editUserDetails.js,
// checkoutAddAddress.js) so live-input validation matches what the EJS app
// enforced — same regexes, same messages, same blank-field wording.

export const PATTERNS = {
  fullName: /^[A-Za-z]+(?: [A-Za-z]+){1,2}$/,
  emailStrict: /^[a-zA-Z0-9._-]+@(gmail\.com|yahoo\.com|icloud\.com|outlook\.com)$/,
  emailLoose: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone10: /^\d{10}$/,
  pincode6: /^\d{6}$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  lettersOnly: /^[A-Za-z]+$/,
  lettersSpaces: /^[A-Za-z\s]+$/,
  alnumNoSpace: /^[A-Za-z0-9]+$/,
};

export const PASSWORD_HINT =
  "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character";

export function validateFullName(value) {
  const v = (value || "").trim();
  if (v === "") return "Please enter a valid name";
  if (!PATTERNS.fullName.test(v)) return "Full name required";
  return "";
}

export function validateEmailStrict(value) {
  const v = (value || "").toLowerCase().trim();
  return PATTERNS.emailStrict.test(v) ? "" : "Not a valid email id";
}

export function validateEmailLoose(value) {
  const v = (value || "").toLowerCase().trim();
  return PATTERNS.emailLoose.test(v) ? "" : "Not a valid email id";
}

export function validatePhone10(value) {
  const v = (value || "").trim();
  if (v === "") return "Please enter a valid phone number";
  if (!PATTERNS.phone10.test(v)) return "Phone should be exactly 10 digits";
  return "";
}

export function validatePhoneBlank(value, label = "Phone number") {
  const v = (value || "").trim();
  if (v === "") return `${label} cannot be blank`;
  if (!PATTERNS.phone10.test(v)) return `${label} must be 10 digits`;
  return "";
}

export function validatePincode(value) {
  const v = (value || "").trim();
  if (v === "") return "Pincode cannot be blank";
  if (!PATTERNS.pincode6.test(v)) return "Pincode must be 6 digits";
  return "";
}

export function validateLettersOnly(value, label) {
  const v = (value || "").trim();
  if (v === "") return `${label} cannot be blank`;
  if (!PATTERNS.lettersOnly.test(v)) return `${label} must only contain letters`;
  return "";
}

export function validateHomeAddress(value) {
  const v = (value || "").trim();
  if (v === "" || v.split(" ").length < 2) return "Home address cannot be blank or just a single space";
  return "";
}

export function validateAlnumNoSpace(value, label) {
  const v = (value || "").trim();
  if (v === "") return `${label} cannot be blank`;
  if (!PATTERNS.alnumNoSpace.test(v)) return `${label} must only contain letters and numbers, no spaces`;
  return "";
}

export function validateStrongPassword(value) {
  const v = (value || "").trim();
  if (v === "") return "Please enter a password";
  if (!PATTERNS.strongPassword.test(v)) return PASSWORD_HINT;
  return "";
}

export function validateConfirmPassword(password, confirmPassword) {
  const p = (password || "").trim();
  const cp = (confirmPassword || "").trim();
  if (cp === "") return "Please confirm your password";
  if (p !== cp) return "Passwords do not match";
  return "";
}

// Combined password + confirm-password check, matching signUpValid.js /
// resetPassword.js: blank-both takes priority, then strength, then match.
export function validatePasswordPair(password, confirmPassword) {
  const p = (password || "").trim();
  const cp = (confirmPassword || "").trim();
  if (p === "" || cp === "") {
    return { password: p === "" ? "Please enter a password" : "", confirm: cp === "" ? "Please confirm your password" : "" };
  }
  if (!PATTERNS.strongPassword.test(p)) {
    return { password: PASSWORD_HINT, confirm: "" };
  }
  if (p !== cp) {
    return { password: "", confirm: "Passwords do not match" };
  }
  return { password: "", confirm: "" };
}

export function validateNameMinLen(value) {
  const v = (value || "").trim();
  if (v === "") return "Name cannot be blank";
  if (v.length < 3) return "Name must be at least 3 characters long";
  if (!PATTERNS.lettersSpaces.test(v)) return "Name must only contain letters and spaces";
  return "";
}

export function validatePhoneSimple(value) {
  return PATTERNS.phone10.test((value || "").trim()) ? "" : "Please enter a valid 10-digit phone number";
}

// Shared by AddressPage.jsx and CheckoutPage.jsx's address forms — both use
// the same field set, ported from checkoutAddAddress.js / checkoutUpdateAddress.js.
export const ADDRESS_FIELDS = ["name", "country", "phone", "pincode", "home", "area", "landmark", "town", "state"];

export function validateAddressField(field, value) {
  switch (field) {
    case "name":
      return validateFullName(value);
    case "country":
      return validateLettersOnly(value, "Country");
    case "phone":
      return validatePhoneBlank(value, "Phone number");
    case "pincode":
      return validatePincode(value);
    case "home":
      return validateHomeAddress(value);
    case "area":
      return validateAlnumNoSpace(value, "Area");
    case "landmark":
      return validateAlnumNoSpace(value, "Landmark");
    case "town":
      return validateLettersOnly(value, "Town");
    case "state":
      return validateLettersOnly(value, "State");
    default:
      return "";
  }
}
