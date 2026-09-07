import { describe, expect, it } from "vitest";
import { assignmentStatuses, paymentStatuses, workerStatuses } from "../../drizzle/schema";

describe("Build On Works workflow invariants", () => {
  it("includes the statuses required to block duplicate state transitions", () => {
    expect(workerStatuses).toContain("ACTIVE");
    expect(assignmentStatuses).toEqual(expect.arrayContaining(["PENDING", "ASSIGNED", "COMPLETED"]));
    expect(paymentStatuses).toEqual(expect.arrayContaining(["PENDING", "PAID"]));
  });
});
