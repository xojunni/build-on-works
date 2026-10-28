import { describe, expect, it } from "vitest";
import { jobLifecycle, jobListCutoff } from "./jobLifecycle";

const now = new Date("2026-11-05T03:00:00.000Z");

describe("Korean job listing lifecycle", () => {
  it("permits today and future dates but marks yesterday as past", () => {
    expect(jobLifecycle("2026-11-05", now).isPast).toBe(false);
    expect(jobLifecycle("2026-11-12", now).isPast).toBe(false);
    expect(jobLifecycle("2026-11-04", now)).toMatchObject({ isPast: true, hideFromListings: false });
  });
  it("retains day 13 and hides at exactly day 14 across a month boundary", () => {
    expect(jobLifecycle("2026-10-23", now)).toMatchObject({ daysPast: 13, hideFromListings: false });
    expect(jobLifecycle("2026-10-22", now)).toMatchObject({ daysPast: 14, hideFromListings: true });
    expect(jobListCutoff(now).toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });
  it("changes to past at Korea midnight, not server or browser midnight", () => {
    expect(jobLifecycle("2026-11-05", new Date("2026-11-05T14:59:59Z")).isPast).toBe(false);
    expect(jobLifecycle("2026-11-05", new Date("2026-11-05T15:00:00Z")).isPast).toBe(true);
  });
  it("treats MySQL DATE string and UTC Date consistently", () => {
    expect(jobLifecycle(new Date("2026-11-03T00:00:00Z"), now)).toEqual(jobLifecycle("2026-11-03", now));
  });
});
