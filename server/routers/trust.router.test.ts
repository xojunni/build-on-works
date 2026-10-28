import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));

import { buildOnWorksRouter } from "./buildOnWorks";

function chain(rows: unknown[]) {
  const value: Record<string, unknown> = {};
  for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) value[method] = () => value;
  const promise = Promise.resolve(rows);
  value.then = promise.then.bind(promise); value.catch = promise.catch.bind(promise); value.finally = promise.finally.bind(promise);
  return value;
}

const manager = { id: 1, loginMethod: "phone-password", passwordHash: "hash", accountRole: "MANAGER" };
const worker = { id: 2, loginMethod: "phone-password", passwordHash: "hash", accountRole: "WORKER" };
const managerContext = { user: { id: 1 } } as any;
const workerContext = { user: { id: 2 } } as any;
const completedRow = { assignment: { id: 30, workerId: 20, status: "COMPLETED" }, job: { id: 40, agencyId: 10 } };

describe("trust review routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets only the owning manager submit one completed-job worker review", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn()
      .mockReturnValueOnce(chain([manager]))
      .mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }]))
      .mockReturnValueOnce(chain([completedRow]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values })) });

    await expect(buildOnWorksRouter.createCaller(managerContext).trust.submitManagerReview({ assignmentId: 30, attendanceStatus: "NORMAL", skillScore: 5, safetyStatus: "PASS" })).resolves.toMatchObject({ success: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: 30, workerId: 20, agencyId: 10, managerUserId: 1, skillScore: 5 }));
  });

  it("rejects manager review attempts for an unfinished or other-agency assignment", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(chain([manager]))
      .mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }]))
      .mockReturnValueOnce(chain([{ assignment: { id: 30, workerId: 20, status: "ASSIGNED" }, job: { id: 40, agencyId: 10 } }]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn() });
    await expect(buildOnWorksRouter.createCaller(managerContext).trust.submitManagerReview({ assignmentId: 30, attendanceStatus: "LATE", skillScore: 3, safetyStatus: "PASS" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("완료된") });
  });

  it("converts duplicate manager review database errors into a clear client message", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(chain([manager]))
      .mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }]))
      .mockReturnValueOnce(chain([completedRow]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values: vi.fn().mockRejectedValue({ code: "ER_DUP_ENTRY" }) })) });
    await expect(buildOnWorksRouter.createCaller(managerContext).trust.submitManagerReview({ assignmentId: 30, attendanceStatus: "NORMAL", skillScore: 4, safetyStatus: "PASS" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("이미") });
  });

  it("lets a worker review only their own completed assignment", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn()
      .mockReturnValueOnce(chain([worker]))
      .mockReturnValueOnce(chain([{ id: 20, userId: 2 }]))
      .mockReturnValueOnce(chain([completedRow]))
      .mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values })) });
    await expect(buildOnWorksRouter.createCaller(workerContext).trust.submitWorkerAgencyReview({ assignmentId: 30, wageStatus: "NORMAL", siteSafetyScore: 4, facilitiesScore: 5 })).resolves.toMatchObject({ success: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: 30, workerId: 20, agencyId: 10, workerUserId: 2 }));
  });

  it("blocks new applications while a current no-show ban is active", async () => {
    const now = new Date();
    const noShows = [1, 2, 3].map(id => ({ id, reportedAt: now }));
    const select = vi.fn()
      .mockReturnValueOnce(chain([worker]))
      .mockReturnValueOnce(chain([{ id: 20, userId: 2 }]))
      .mockReturnValueOnce(chain([{ id: 40, status: "RECRUITING", requiredWorkers: 2 }]))
      .mockReturnValueOnce(chain([{ value: 0 }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain(noShows))
      .mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select });
    await expect(buildOnWorksRouter.createCaller(workerContext).jobs.submitApplication({ jobId: 40 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("신청이 제한") });
  });
});
