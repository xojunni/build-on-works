import { describe, expect, it } from "vitest";
import { canTransitionAssignment, canTransitionPayment, duplicateMessage } from "./workflow";

describe("Build On Works workflow guards", () => {
  it("allows only the recorded assignment lifecycle", () => {
    expect(canTransitionAssignment("PENDING", "ASSIGNED")).toBe(true);
    expect(canTransitionAssignment("ASSIGNED", "COMPLETED")).toBe(true);
    expect(canTransitionAssignment("COMPLETED", "ASSIGNED")).toBe(false);
    expect(canTransitionAssignment("REJECTED", "ASSIGNED")).toBe(false);
  });

  it("does not allow a paid settlement to be paid twice", () => {
    expect(canTransitionPayment("PENDING", "PAID")).toBe(true);
    expect(canTransitionPayment("PAID", "PAID")).toBe(false);
    expect(duplicateMessage("payment")).toContain("이미 생성");
  });
});
