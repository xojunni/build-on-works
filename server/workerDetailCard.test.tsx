import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkerDetailContent } from "../client/src/components/WorkerDetailCard";

describe("WorkerDetailCard", () => {
  it("renders manager-facing worker details while keeping the account number masked", () => {
    const html = renderToStaticMarkup(
      <WorkerDetailContent row={{
        user: { name: "김인부", phone: "01012345678" },
        profile: { id: 21, phone: "01012345678", certificate: "C-1234", bankName: "국민은행", bankAccount: "•••• 9012" },
        age: 29,
      }} history={{ totalCompleted: 0, currentAgencyCompleted: 0, agencies: [], recentJobs: [] }} />
    );
    expect(html).toContain("김인부");
    expect(html).toContain("만 29세");
    expect(html).toContain("C-1234");
    expect(html).toContain("국민은행");
    expect(html).toContain("•••• 9012");
    expect(html).not.toContain("123-456-789012");
  });
});
