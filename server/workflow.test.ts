import { describe, expect, it } from "vitest";
import { canTransitionAssignment, canTransitionPayment, duplicateMessage } from "../shared/workflow";

describe("Build On Works server workflow guards", () => {
  it("permits a worker application only through pending, assigned, and completed states", () => {
    expect(canTransitionAssignment("PENDING", "ASSIGNED")).toBe(true);
    expect(canTransitionAssignment("ASSIGNED", "COMPLETED")).toBe(true);
    expect(canTransitionAssignment("COMPLETED", "ASSIGNED")).toBe(false);
    expect(canTransitionAssignment("CANCELED", "ASSIGNED")).toBe(false);
  });

  it("permits payment processing only once", () => {
    expect(canTransitionPayment("PENDING", "PAID")).toBe(true);
    expect(canTransitionPayment("PAID", "PAID")).toBe(false);
    expect(duplicateMessage("assignment")).toContain("이미 신청");
    expect(duplicateMessage("payment")).toContain("이미 생성");
  });
});
