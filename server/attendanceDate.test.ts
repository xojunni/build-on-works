import { describe, expect, it } from "vitest";
import { koreanWorkDate } from "./attendanceDate";

describe("attendance work date", () => {
  it("normalizes the attendance date to the Korean calendar day at UTC midnight", () => {
    expect(koreanWorkDate(new Date("2026-09-08T14:30:00.000Z")).toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(koreanWorkDate(new Date("2026-09-08T15:30:00.000Z")).toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });
});
