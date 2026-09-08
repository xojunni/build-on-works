import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));

import { buildOnWorksRouter } from "./buildOnWorks";

function selectResult(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) chain[method] = () => chain;
  const promise = Promise.resolve(rows);
  chain.then = promise.then.bind(promise);
  chain.catch = promise.catch.bind(promise);
  chain.finally = promise.finally.bind(promise);
  return chain;
}

const manager = { id: 7, loginMethod: "phone-password", passwordHash: "hash", accountRole: "MANAGER" };
const agency = { id: 12, managerId: 7, name: "서원 인력소", region: "청주시", deletedAt: null };

describe("manager worker work history access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only completed jobs and the current agency completion count for an authorized applicant", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(selectResult([manager]))
      .mockReturnValueOnce(selectResult([agency]))
      .mockReturnValueOnce(selectResult([]))
      .mockReturnValueOnce(selectResult([{ id: 99 }]))
      .mockReturnValueOnce(selectResult([{ assignment: { id: 31, status: "COMPLETED", completedAt: new Date("2026-06-21") }, job: { id: 41, title: "철거 보조", jobDate: new Date("2026-06-20"), agencyId: 12 }, agency: { id: 12, name: "서원 인력소", region: "청주시" } }]));
    mocks.getDb.mockResolvedValue({ select });

    const result = await buildOnWorksRouter.createCaller({ user: { id: 7 } } as any).workHistory.managerWorker({ workerId: 21 });
    expect(result).toMatchObject({ totalCompleted: 1, currentAgencyCompleted: 1, agencies: [{ completedCount: 1 }] });
    expect(result.recentJobs[0]).toMatchObject({ title: "철거 보조", agency: { name: "서원 인력소" } });
  });

  it("rejects a manager with no membership or application relationship to the worker", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(selectResult([manager]))
      .mockReturnValueOnce(selectResult([agency]))
      .mockReturnValueOnce(selectResult([]))
      .mockReturnValueOnce(selectResult([]));
    mocks.getDb.mockResolvedValue({ select });

    await expect(buildOnWorksRouter.createCaller({ user: { id: 7 } } as any).workHistory.managerWorker({ workerId: 21 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
