import { describe, expect, it } from "vitest";
import { isActiveMembership, membershipLabel } from "../shared/membership";

describe("multiple agency membership rules", () => {
  it("identifies an approved agency membership without using it as a job application gate", () => {
    expect(isActiveMembership("ACTIVE")).toBe(true);
    expect(isActiveMembership("PENDING")).toBe(false);
    expect(isActiveMembership("REJECTED")).toBe(false);
    expect(isActiveMembership(null)).toBe(false);
  });

  it("uses distinct Korean labels for independent membership states", () => {
    expect(membershipLabel("PENDING")).toBe("승인 대기중");
    expect(membershipLabel("ACTIVE")).toBe("승인됨");
    expect(membershipLabel("REJECTED")).toBe("가입 요청 거절");
  });
});
