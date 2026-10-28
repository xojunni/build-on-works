import { describe, expect, it } from "vitest";
import { cleanGeneratedJobDescription } from "./demoDataFormat";
import { hashPassword, normalizePhone, verifyPassword } from "./routers/phoneAuth";

describe("generated data refinement", () => {
  it("preserves natural site instructions and removes only marker and scenario trailer", () => {
    const content = "금강인력 관할 서울시 송파구 현장입니다. 비계 자재 분류와 현장 안전 통로 정리를 보조합니다. 근무 전 안전교육 후 담당 반장 지시에 따라 작업합니다.";
    expect(cleanGeneratedJobDescription(`[졸업 시연용 가상 일감 · 2026-11]\n${content}\n시나리오: graduation-open-2026-11-14-1`)).toBe(content);
    expect(cleanGeneratedJobDescription(`[졸업 시연용 가상 일감 · 2026-11] ${content} 시나리오: graduation-open-2026-11-14-1`)).toBe(content);
  });
  it("handles historical descriptions and is safe to repeat", () => {
    const content = "대일인력 현장의 완료·정산 이력입니다. 자재 정리를 보조했습니다.";
    const cleaned = cleanGeneratedJobDescription(`[졸업 시연용 가상 이력 · 2026-10]\n${content}\n시나리오: graduation-excellent-2026-10-22-5`);
    expect(cleaned).toBe(content);
    expect(cleanGeneratedJobDescription(cleaned)).toBe(content);
    expect(cleanGeneratedJobDescription(null)).toBeNull();
  });
  it("does not strip unrelated narrative or meaningful scenario wording", () => {
    expect(cleanGeneratedJobDescription("현장 작업 시나리오: 안전 동선 확인")).toBe("현장 작업 시나리오: 안전 동선 확인");
  });
  it("uses supported fictitious login identifiers and salted password verification", () => {
    for (const suffix of ["7101", "7102", "7103", "7104"]) expect(normalizePhone(`010-0000-${suffix}`)).toBe(`0100000${suffix}`);
    const password = "Bow!Fixture2026";
    const hash = hashPassword(password);
    expect(hash).not.toContain(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });
});
