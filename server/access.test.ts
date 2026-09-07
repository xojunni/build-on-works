import { describe, expect, it } from "vitest";
import { ASSIGNMENT_STATUS_LABELS, formatKoreanDate, formatKrw, PAYMENT_STATUS_LABELS, WORKER_STATUS_LABELS } from "../shared/domain";

describe("Build On Works domain helpers", () => {
  it("formats amounts in Korean won without decimal fractions", () => {
    expect(formatKrw(160000)).toBe("₩160,000");
  });

  it("provides Korean labels for role-bound workflow statuses", () => {
    expect(WORKER_STATUS_LABELS.PENDING).toBe("승인 대기중");
    expect(ASSIGNMENT_STATUS_LABELS.ASSIGNED).toBe("진행 중");
    expect(PAYMENT_STATUS_LABELS.PAID).toBe("지급완료");
  });

  it("formats a Korean date for mobile display", () => {
    expect(formatKoreanDate("2026-06-12T00:00:00.000Z")).toContain("2026.");
  });
});
