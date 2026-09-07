import { describe, expect, it } from "vitest";
import { canApplyToAgency, membershipLabel } from "../shared/membership";

describe("multiple agency membership rules", () => {
  it("allows an application only for the agency that approved the worker", () => {
    expect(canApplyToAgency("ACTIVE")).toBe(true);
    expect(canApplyToAgency("PENDING")).toBe(false);
    expect(canApplyToAgency("REJECTED")).toBe(false);
    expect(canApplyToAgency(null)).toBe(false);
  });

  it("uses distinct Korean labels for independent membership states", () => {
    expect(membershipLabel("PENDING")).toBe("승인 대기중");
    expect(membershipLabel("ACTIVE")).toBe("승인됨");
    expect(membershipLabel("REJECTED")).toBe("가입 요청 거절");
  });
});
