import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkerWorkHistory } from "../client/src/pages/WorkerWorkspace";

describe("WorkerWorkHistory", () => {
  it("renders only agencies and jobs returned from completed work history", () => {
    const html = renderToStaticMarkup(createElement(WorkerWorkHistory, {
      loading: false,
      history: {
        totalCompleted: 2,
        agencies: [{ agency: { id: 1, name: "서원 인력소", region: "청주시" }, completedCount: 2 }],
        recentJobs: [{ assignmentId: 11, title: "철거 보조", jobDate: new Date("2026-06-20"), agency: { id: 1, name: "서원 인력소", region: "청주시" } }],
      },
    }));
    expect(html).toContain("실제 근무 이력");
    expect(html).toContain("서원 인력소");
    expect(html).toContain("2회");
    expect(html).toContain("철거 보조");
    expect(html).not.toContain("가입 요청");
  });
});
