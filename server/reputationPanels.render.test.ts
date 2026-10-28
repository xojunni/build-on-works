import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgencyReputationContent, JobPeriodTabs, WorkerReputationBadges, WorkerReputationContent } from "../client/src/components/ReputationPanels";
import { remainingBanDays } from "../client/src/lib/trustDisplay";

const now = new Date("2026-11-05T00:00:00Z").getTime();
const normal = { reviewCount: 0, skillAverage: null, safetyPassCount: 0, lateCount: 0, noShowCount: 0, excellentStreak: 0, isExcellent: false, applicationBanUntil: null, isApplicationBanned: false, isBlacklisted: false, rehabilitationCompletedCount: 0 };
const html = (component: any, props: any) => renderToStaticMarkup(React.createElement(component, props));

describe("reputation profile and applicant indicators", () => {
  it("counts incomplete days up but ends exactly at the ban expiry", () => {
    expect(remainingBanDays("2026-11-05T01:00:00Z", now)).toBe(1);
    expect(remainingBanDays("2026-11-11T00:00:00Z", now)).toBe(6);
    expect(remainingBanDays("2026-11-05T00:00:00Z", now)).toBe(0);
    expect(remainingBanDays("invalid", now)).toBe(0);
    expect(remainingBanDays(null, now)).toBe(0);
  });
  it("shows blacklist and remaining APPLICATION-ban days directly on applicant badges", () => {
    const result = html(WorkerReputationBadges, { trust: { ...normal, noShowCount: 4, isBlacklisted: true, isApplicationBanned: true, applicationBanUntil: new Date("2026-11-11T00:00:00Z") }, now });
    expect(result).toContain("블랙리스트");
    expect(result).toContain("6일 남음");
    expect(result).toContain("노쇼 4회");
  });
  it("does not mistake application-ban expiration for automatic blacklist removal", () => {
    const result = html(WorkerReputationContent, { trust: { ...normal, noShowCount: 4, isBlacklisted: true, isApplicationBanned: false, applicationBanUntil: new Date("2026-11-04T00:00:00Z"), rehabilitationCompletedCount: 2 }, now });
    expect(result).toContain("블랙리스트");
    expect(result).toContain("제한 없음");
    expect(result).toContain("바로 해제되지 않습니다");
    expect(result).toContain("2 / 7회");
    expect(result).not.toContain("일 남음");
  });
  it("shows warning and excellent worker status separately, and never hides zero-state profile", () => {
    expect(html(WorkerReputationBadges, { trust: { ...normal, noShowCount: 2 }, now })).toContain("노쇼 경고 2회");
    expect(html(WorkerReputationContent, { trust: { ...normal, reviewCount: 5, safetyPassCount: 5, excellentStreak: 5, skillAverage: 5, isExcellent: true }, now })).toContain("우수 인부");
    const empty = html(WorkerReputationContent, { trust: normal, now });
    expect(empty).toContain("내 신뢰·평가 현황");
    expect(empty).toContain("해당 없음");
    expect(empty).toContain("평가 대기");
  });
  it("marks current/past buttons and distinguishes agency rating from worker penalties", () => {
    const tabs = html(JobPeriodTabs, { value: "PAST", onChange: () => {} });
    expect(tabs).toContain("현재 일감");
    expect(tabs).toContain("지난 일감");
    expect(tabs).toContain('aria-pressed="true"');
    const agency = html(AgencyReputationContent, { agencyName: "테스트인력", trust: { reviewCount: 0, safetyAverage: null, facilitiesAverage: null, normalPaymentCount: 0, facilitiesAtLeast3Count: 0, isExcellent: false } });
    expect(agency).toContain("내 인력소 평가");
    expect(agency).toContain("인력소장 개인 제재가 아닙니다");
  });
});
