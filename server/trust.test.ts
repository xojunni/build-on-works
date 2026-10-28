import { describe, expect, it } from "vitest";
import { summarizeAgencyTrust, summarizeWorkerTrust } from "./trust";

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`);

function review(id: number, day: number, skillScore = 4, safetyStatus: "PASS" | "FAIL" = "PASS", attendanceStatus: "NORMAL" | "LATE" = "NORMAL") {
  return { id, at: at(day), skillScore, safetyStatus, attendanceStatus };
}

describe("worker trust rules", () => {
  it("grants excellence after five consecutive skill-4-or-higher and safety PASS reviews", () => {
    const trust = summarizeWorkerTrust([1, 2, 3, 4, 5].map(day => review(day, day)), [], []);
    expect(trust.isExcellent).toBe(true);
    expect(trust.excellentStreak).toBe(5);
    expect(trust.skillAverage).toBe(4);
  });

  it("resets the excellence streak when safety fails, a low skill review arrives, or a no-show is recorded", () => {
    expect(summarizeWorkerTrust([... [1, 2, 3, 4].map(day => review(day, day)), review(5, 5, 5, "FAIL")], [], []).isExcellent).toBe(false);
    expect(summarizeWorkerTrust([... [1, 2, 3, 4].map(day => review(day, day)), review(5, 5, 3)], [], []).excellentStreak).toBe(0);
    expect(summarizeWorkerTrust([1, 2, 3, 4, 5].map(day => review(day, day)), [{ id: 10, at: at(6) }], []).excellentStreak).toBe(0);
  });

  it("applies warning, seven-day and fourteen-day application restrictions at the required no-show counts", () => {
    const one = summarizeWorkerTrust([], [{ id: 1, at: at(1) }], [], at(2));
    const three = summarizeWorkerTrust([], [1, 2, 3].map(day => ({ id: day, at: at(day) })), [], at(3));
    const four = summarizeWorkerTrust([], [1, 2, 3, 4].map(day => ({ id: day, at: at(day) })), [], at(4));
    expect(one.status).toBe("CAUTION");
    expect(one.applicationBanUntil).toBeNull();
    expect(three.applicationBanUntil?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(three.isApplicationBanned).toBe(true);
    expect(four.applicationBanUntil?.toISOString()).toBe("2026-10-18T00:00:00.000Z");
    expect(four.isBlacklisted).toBe(true);
  });

  it("keeps a blacklist history but releases blacklist status after the ban and seven normal completed attendances", () => {
    const noShows = [1, 2, 3, 4].map(day => ({ id: day, at: at(day) }));
    const completions = [18, 19, 20, 21, 22, 23, 24].map((day, index) => ({ id: index + 1, at: at(day) }));
    const trust = summarizeWorkerTrust([], noShows, completions, at(25));
    expect(trust.isApplicationBanned).toBe(false);
    expect(trust.rehabilitationCompletedCount).toBe(7);
    expect(trust.isBlacklisted).toBe(false);
    expect(trust.noShowCount).toBe(4);
  });
});

describe("agency trust rules", () => {
  const agencyReview = (id: number, day: number, wageStatus: "NORMAL" | "LATE" | "UNPAID" = "NORMAL", siteSafetyScore = 3, facilitiesScore = 3) => ({ id, at: at(day), wageStatus, siteSafetyScore, facilitiesScore });

  it("requires both normal-payment and facilities thresholds before granting excellence", () => {
    const reviews = Array.from({ length: 30 }, (_, index) => agencyReview(index + 1, index + 1));
    const trust = summarizeAgencyTrust(reviews);
    expect(trust.normalPaymentCount).toBe(30);
    expect(trust.facilitiesAtLeast3Count).toBe(30);
    expect(trust.isExcellent).toBe(true);
  });

  it("resets agency excellence counters on unpaid wages or a safety score of one", () => {
    const beforeReset = Array.from({ length: 30 }, (_, index) => agencyReview(index + 1, index + 1));
    const unpaid = summarizeAgencyTrust([...beforeReset, agencyReview(31, 31, "UNPAID", 3, 4)]);
    const unsafe = summarizeAgencyTrust([...beforeReset, agencyReview(31, 31, "NORMAL", 1, 4)]);
    expect(unpaid.isExcellent).toBe(false);
    expect(unpaid.normalPaymentCount).toBe(0);
    expect(unsafe.isExcellent).toBe(false);
    expect(unsafe.facilitiesAtLeast3Count).toBe(0);
  });
});
