import { describe, expect, it } from "vitest";
import { checkOptionalPassword, generatePassword, isValidUsername } from "./password";

describe("generatePassword", () => {
  it("builds 12 unambiguous characters", () => {
    for (let i = 0; i < 50; i += 1) {
      const value = generatePassword();
      expect(value).toMatch(/^[a-hj-km-np-zA-HJ-NP-Z2-9]{12}$/);
    }
  });
});

describe("checkOptionalPassword", () => {
  it("accepts empty, rejects short, long and control characters", () => {
    expect(checkOptionalPassword("")).toBe("empty");
    expect(checkOptionalPassword("ab")).toBe("tooShort");
    expect(checkOptionalPassword("a".repeat(129))).toBe("tooLong");
    expect(checkOptionalPassword("abcd\u0000efgh")).toBe("invalid");
    expect(checkOptionalPassword("abc")).toBe("ok");
  });
});

describe("isValidUsername", () => {
  it("allows 3-32 lowercase letters, digits, dot, underscore and hyphen", () => {
    expect(isValidUsername("admin")).toBe(true);
    expect(isValidUsername("a.b_c-1")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a".repeat(33))).toBe(false);
    expect(isValidUsername("a b")).toBe(false);
    expect(isValidUsername("Admin")).toBe(false);
  });
});
