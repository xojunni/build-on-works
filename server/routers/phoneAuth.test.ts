import { describe, expect, it } from "vitest";
import { formatPhone, hashPassword, normalizePhone, verifyPassword } from "./phoneAuth";

describe("phone-password authentication helpers", () => {
  it("normalizes Korean mobile phone input consistently", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
  });

  it("stores a non-reversible password hash and verifies it", () => {
    const stored = hashPassword("1234", "fixed-test-salt");
    expect(stored).not.toContain("1234");
    expect(verifyPassword("1234", stored)).toBe(true);
    expect(verifyPassword("4321", stored)).toBe(false);
  });
});
