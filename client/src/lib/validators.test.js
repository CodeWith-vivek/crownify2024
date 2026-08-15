import { describe, it, expect } from "vitest";
import {
  validateFullName,
  validateEmailStrict,
  validateEmailLoose,
  validatePhone10,
  validatePincode,
  validateStrongPassword,
  validateConfirmPassword,
  validatePasswordPair,
  validateNameMinLen,
  validateHomeAddress,
  validateAddressField,
  PASSWORD_HINT,
} from "./validators";

// These gate every form in the app (signup, login, checkout address,
// profile edit). Pure functions, no DOM, no network — cheap to test,
// and a regression here silently blocks real users from submitting.

describe("validateFullName", () => {
  it("accepts two or three space-separated words", () => {
    expect(validateFullName("Jane Doe")).toBe("");
    expect(validateFullName("Jane Q Doe")).toBe("");
  });

  it("rejects a single word, blank, and digits", () => {
    expect(validateFullName("")).toBe("Please enter a valid name");
    expect(validateFullName("Jane")).not.toBe("");
    expect(validateFullName("Jane2 Doe")).not.toBe("");
  });
});

describe("validateEmailStrict", () => {
  it("accepts the whitelisted providers only", () => {
    expect(validateEmailStrict("a@gmail.com")).toBe("");
    expect(validateEmailStrict("a@yahoo.com")).toBe("");
    expect(validateEmailStrict("a@icloud.com")).toBe("");
    expect(validateEmailStrict("a@outlook.com")).toBe("");
  });

  it("rejects any other domain, even a well-formed one", () => {
    // The exact bug that blocked the e2e test's seeded account until the
    // fixture was changed to a whitelisted domain.
    expect(validateEmailStrict("a@crownify.test")).not.toBe("");
    expect(validateEmailStrict("a@company.com")).not.toBe("");
  });

  it("is case-insensitive on the domain", () => {
    expect(validateEmailStrict("A@GMAIL.COM")).toBe("");
  });
});

describe("validateEmailLoose", () => {
  it("accepts any well-formed address", () => {
    expect(validateEmailLoose("someone@company.io")).toBe("");
  });

  it("rejects a missing @ or TLD", () => {
    expect(validateEmailLoose("not-an-email")).not.toBe("");
    expect(validateEmailLoose("a@b")).not.toBe("");
  });
});

describe("validatePhone10", () => {
  it("requires exactly 10 digits", () => {
    expect(validatePhone10("9876543210")).toBe("");
    expect(validatePhone10("98765")).toBe("Phone should be exactly 10 digits");
    expect(validatePhone10("987654321099")).not.toBe("");
  });

  it("rejects blank with its own message, not the digit-count one", () => {
    expect(validatePhone10("")).toBe("Please enter a valid phone number");
  });
});

describe("validatePincode", () => {
  it("requires exactly 6 digits", () => {
    expect(validatePincode("600001")).toBe("");
    expect(validatePincode("6000")).toBe("Pincode must be 6 digits");
  });
});

describe("validateStrongPassword", () => {
  it("requires upper, lower, digit, special, and 8+ length", () => {
    expect(validateStrongPassword("Secret@123")).toBe("");
  });

  it.each([
    ["short1@A", false], // 8 chars exactly, should pass
    ["alllower1@", true], // no uppercase
    ["ALLUPPER1@", true], // no lowercase
    ["NoDigits@@", true], // no digit
    ["NoSpecial123", true], // no special char
    ["Sh0rt@", true], // under 8 chars
  ])("%s -> rejected: %s", (value, shouldReject) => {
    const result = validateStrongPassword(value);
    expect(result !== "").toBe(shouldReject);
  });

  it("returns the shared PASSWORD_HINT message on failure", () => {
    expect(validateStrongPassword("weak")).toBe(PASSWORD_HINT);
  });
});

describe("validateConfirmPassword", () => {
  it("matches", () => {
    expect(validateConfirmPassword("Secret@123", "Secret@123")).toBe("");
  });

  it("catches a mismatch and a blank confirmation separately", () => {
    expect(validateConfirmPassword("Secret@123", "Other@123")).toBe("Passwords do not match");
    expect(validateConfirmPassword("Secret@123", "")).toBe("Please confirm your password");
  });
});

describe("validatePasswordPair", () => {
  it("blank-both takes priority over strength/match", () => {
    expect(validatePasswordPair("", "")).toEqual({
      password: "Please enter a password",
      confirm: "Please confirm your password",
    });
  });

  it("weak password is flagged even when it matches its confirmation", () => {
    const result = validatePasswordPair("weak", "weak");
    expect(result.password).toBe(PASSWORD_HINT);
    expect(result.confirm).toBe("");
  });

  it("a strong but mismatched pair only flags confirm", () => {
    expect(validatePasswordPair("Secret@123", "Other@123")).toEqual({
      password: "",
      confirm: "Passwords do not match",
    });
  });

  it("a strong matching pair passes clean", () => {
    expect(validatePasswordPair("Secret@123", "Secret@123")).toEqual({ password: "", confirm: "" });
  });
});

describe("validateNameMinLen", () => {
  it("requires 3+ letters/spaces", () => {
    expect(validateNameMinLen("Jo")).toBe("Name must be at least 3 characters long");
    expect(validateNameMinLen("Joe Bloggs")).toBe("");
    expect(validateNameMinLen("Joe2")).toBe("Name must only contain letters and spaces");
  });
});

describe("validateHomeAddress", () => {
  it("rejects blank and a single token", () => {
    expect(validateHomeAddress("")).not.toBe("");
    expect(validateHomeAddress("Flat1")).not.toBe("");
  });

  it("accepts two or more tokens", () => {
    expect(validateHomeAddress("Flat 1B")).toBe("");
  });
});

describe("validateAddressField", () => {
  it("dispatches to the right validator per field name", () => {
    expect(validateAddressField("phone", "9876543210")).toBe("");
    expect(validateAddressField("pincode", "600001")).toBe("");
    expect(validateAddressField("country", "India")).toBe("");
    expect(validateAddressField("country", "In d1a")).not.toBe("");
  });

  it("an unknown field name is a silent no-op, not a crash", () => {
    expect(validateAddressField("nonexistent", "anything")).toBe("");
  });
});
