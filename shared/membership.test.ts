import { describe, expect, it } from "vitest";
import { canApplyToAgency, membershipLabel } from "./membership";

describe("multiple agency membership rules", () => {
  it("allows job applications only for the agency that approved the worker", () => {
    expect(canApplyToAgency("ACTIVE")).toBe(true);
    expect(canApplyToAgency("PENDING")).toBe(false);
    expect(canApplyToAgency("REJECTED")).toBe(false);
    expect(canApplyToAgency(null)).toBe(false);
  });

  it("uses distinct Korean labels for each membership state", () => {
    expect(membershipLabel("PENDING")).toBe("승인 대기중");
    expect(membershipLabel("ACTIVE")).toBe("승인됨");
  });
});

