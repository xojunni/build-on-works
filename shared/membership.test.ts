import { describe, expect, it } from "vitest";
import { isActiveMembership, membershipLabel } from "./membership";

describe("multiple agency membership rules", () => {
  it("tracks approval separately from direct job application rights", () => {
    expect(isActiveMembership("ACTIVE")).toBe(true);
    expect(isActiveMembership("PENDING")).toBe(false);
    expect(isActiveMembership("REJECTED")).toBe(false);
    expect(isActiveMembership(null)).toBe(false);
  });

  it("uses distinct Korean labels for each membership state", () => {
    expect(membershipLabel("PENDING")).toBe("승인 대기중");
    expect(membershipLabel("ACTIVE")).toBe("승인됨");
  });
});
