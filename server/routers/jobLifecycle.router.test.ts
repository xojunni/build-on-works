import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
import { buildOnWorksRouter } from "./buildOnWorks";

function chain(rows: unknown[]) {
  const result: Record<string, unknown> = {};
  for (const key of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) result[key] = () => result;
  const promise = Promise.resolve(rows);
  result.then = promise.then.bind(promise);
  return result;
}
const worker = { id: 2, accountRole: "WORKER", loginMethod: "phone-password", passwordHash: "hash" };
const manager = { id: 1, accountRole: "MANAGER", loginMethod: "phone-password", passwordHash: "hash" };
const profile = { id: 20, userId: 2 };
const agency = { id: 10, managerId: 1, name: "인력소" };
const workerCtx = { user: { id: 2 } } as any;
const managerCtx = { user: { id: 1 } } as any;
const job = (id: number, date: string) => ({ id, agencyId: 10, title: "현장 정리", status: "RECRUITING", requiredWorkers: 3, jobDate: new Date(`${date}T00:00:00Z`) });

describe("job date and permanent history routes", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-05T03:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("blocks yesterday's job before any capacity check or insertion", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([profile])).mockReturnValueOnce(chain([job(30, "2026-11-04")]));
    const insert = vi.fn();
    mocks.getDb.mockResolvedValue({ select, insert });
    await expect(buildOnWorksRouter.createCaller(workerCtx).jobs.submitApplication({ jobId: 30 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "날짜가 지난 일감은 신청할 수 없습니다." });
    expect(insert).not.toHaveBeenCalled();
    expect(select).toHaveBeenCalledTimes(3);
  });

  it("marks yesterday as not applicable and excludes the 14-day-old listing", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([profile]))
      .mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([job(30, "2026-11-04"), job(31, "2026-10-22"), job(32, "2026-11-05")].map(job => ({ job, agency }))))
      .mockReturnValueOnce(chain([])).mockReturnValue(chain([{ value: 0 }]));
    mocks.getDb.mockResolvedValue({ select });
    const rows = await buildOnWorksRouter.createCaller(workerCtx).jobs.discover();
    expect(rows.map(row => row.job.id)).toEqual([30, 32]);
    expect(rows[0]).toMatchObject({ isPast: true, canApply: false });
    expect(rows[1]).toMatchObject({ isPast: false, canApply: true });
  });

  it("marks manager jobs as past and excludes archived listings without database deletion", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([agency]))
      .mockReturnValueOnce(chain([job(30, "2026-11-04"), job(31, "2026-10-22")])).mockReturnValue(chain([{ value: 0 }]));
    const remove = vi.fn();
    mocks.getDb.mockResolvedValue({ select, delete: remove });
    const rows = await buildOnWorksRouter.createCaller(managerCtx).jobs.managerList();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 30, isPast: true });
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps a manager's cancellation action available regardless of job age", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    mocks.getDb.mockResolvedValue({ select: vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([agency])), update: vi.fn(() => ({ set })) });
    await expect(buildOnWorksRouter.createCaller(managerCtx).jobs.cancel({ id: 30 })).resolves.toEqual({ success: true });
    expect(set).toHaveBeenCalledWith({ status: "CANCELED" });
  });

  it("retains completed assignments permanently, even with archived job dates", async () => {
    const historical = { assignment: { id: 99, status: "COMPLETED" }, job: job(30, "2026-09-08"), agency, workerAgencyReview: null };
    mocks.getDb.mockResolvedValue({ select: vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([profile])).mockReturnValueOnce(chain([historical])) });
    const rows = await buildOnWorksRouter.createCaller(workerCtx).jobs.workerAssignments();
    expect(rows).toEqual([historical]);
  });

  it("denies blacklist list access to a worker", async () => {
    mocks.getDb.mockResolvedValue({ select: vi.fn().mockReturnValueOnce(chain([worker])) });
    await expect(buildOnWorksRouter.createCaller(workerCtx).trust.blacklistedWorkers()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not expose any unrelated worker when the manager has no candidates or members", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([agency])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select });
    await expect(buildOnWorksRouter.createCaller(managerCtx).trust.blacklistedWorkers()).resolves.toEqual([]);
    expect(select).toHaveBeenCalledTimes(4);
  });
});

describe("current/past tabs and reputation profile ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-05T03:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it.each(["CURRENT", "PAST"] as const)("manager %s list contains only that period within retention", async period => {
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([agency]))
      .mockReturnValueOnce(chain([job(30, "2026-11-04"), job(31, "2026-10-22"), job(32, "2026-11-05"), job(33, "2026-11-12")])).mockReturnValue(chain([{ value: 0 }]));
    const remove = vi.fn();
    mocks.getDb.mockResolvedValue({ select, delete: remove });
    const rows = await buildOnWorksRouter.createCaller(managerCtx).jobs.managerList({ period });
    expect(rows.map(row => row.id)).toEqual(period === "CURRENT" ? [32, 33] : [30]);
    expect(rows.every(row => row.isPast === (period === "PAST"))).toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(["CURRENT", "PAST"] as const)("worker %s discovery separates dates and never enables past application", async period => {
    const select = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([profile]))
      .mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([job(30, "2026-11-04"), job(31, "2026-10-22"), job(32, "2026-11-05")].map(job => ({ job, agency }))))
      .mockReturnValueOnce(chain([])).mockReturnValue(chain([{ value: 0 }]));
    mocks.getDb.mockResolvedValue({ select });
    const rows = await buildOnWorksRouter.createCaller(workerCtx).jobs.discover({ period });
    expect(rows.map(row => row.job.id)).toEqual(period === "CURRENT" ? [32] : [30]);
    expect(rows.every(row => row.canApply === (period === "CURRENT"))).toBe(true);
  });

  it("allows the worker to see their own blacklist with ban expiry", async () => {
    const reports = [1, 2, 3, 4].map(id => ({ id, reportedAt: new Date(`2026-11-0${id}T00:00:00Z`) }));
    mocks.getDb.mockResolvedValue({ select: vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([profile])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain(reports)).mockReturnValueOnce(chain([])) });
    const trust = await buildOnWorksRouter.createCaller(workerCtx).trust.mine();
    expect(trust).toMatchObject({ isBlacklisted: true, isApplicationBanned: true, noShowCount: 4, applicationBanUntil: new Date("2026-11-18T00:00:00Z") });
  });

  it("manager profile without related workers never selects unrelated user data", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([agency])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select });
    const summary = await buildOnWorksRouter.createCaller(managerCtx).trust.managerOverview();
    expect(summary).toMatchObject({ agency: { id: 10 }, workers: [], trust: { reviewCount: 0 } });
    expect(select).toHaveBeenCalledTimes(5);
  });

  it("worker cannot read a manager's private reputation overview", async () => {
    mocks.getDb.mockResolvedValue({ select: vi.fn().mockReturnValueOnce(chain([worker])) });
    await expect(buildOnWorksRouter.createCaller(workerCtx).trust.managerOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("manager cannot query the reputation of an unrelated applicant", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([agency])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select });
    await expect(buildOnWorksRouter.createCaller(managerCtx).trust.workerSummary({ workerId: 999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(select).toHaveBeenCalledTimes(4);
  });
});
