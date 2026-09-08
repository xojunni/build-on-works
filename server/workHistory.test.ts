import { describe, expect, it } from "vitest";
import { summarizeWorkHistory } from "./workHistory";

const agencyA = { id: 1, name: "서원 인력소", region: "청주시" };
const agencyB = { id: 2, name: "중앙 인력소", region: "세종시" };

describe("completed work history summaries", () => {
  it("shows only completed jobs and aggregates visits by the agencies where work was actually done", () => {
    const history = summarizeWorkHistory([
      { assignmentId: 1, status: "COMPLETED", completedAt: new Date("2026-06-21"), job: { id: 10, title: "철거 보조", jobDate: new Date("2026-06-20"), agencyId: 1 }, agency: agencyA },
      { assignmentId: 2, status: "PENDING", completedAt: null, job: { id: 11, title: "비계 설치", jobDate: new Date("2026-06-23"), agencyId: 2 }, agency: agencyB },
      { assignmentId: 3, status: "COMPLETED", completedAt: new Date("2026-06-25"), job: { id: 12, title: "자재 정리", jobDate: new Date("2026-06-24"), agencyId: 1 }, agency: agencyA },
      { assignmentId: 4, status: "COMPLETED", completedAt: new Date("2026-06-26"), job: { id: 13, title: "안전 보조", jobDate: new Date("2026-06-26"), agencyId: 2 }, agency: agencyB },
    ], 1);

    expect(history.totalCompleted).toBe(3);
    expect(history.currentAgencyCompleted).toBe(2);
    expect(history.agencies).toEqual([{ agency: agencyA, completedCount: 2 }, { agency: agencyB, completedCount: 1 }]);
    expect(history.recentJobs.map(job => job.title)).toEqual(["안전 보조", "자재 정리", "철거 보조"]);
  });
});
