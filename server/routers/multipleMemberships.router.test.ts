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

function account() {
  return { id: 11, loginMethod: "phone-password", passwordHash: "hash", accountRole: "WORKER" };
}

function workerProfile() {
  return { id: 21, userId: 11, agencyId: 9, status: "ACTIVE" };
}

function context() {
  return { user: { id: 11 } } as any;
}

describe("multiple agency memberships", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows recruiting jobs from every agency and marks them directly applicable", async () => {
    const job = { id: 31, agencyId: 71, title: "철거 보조", status: "RECRUITING" };
    const agency = { id: 71, name: "새 인력소", region: "청주시" };
    const select = vi.fn()
      .mockReturnValueOnce(selectResult([account()]))
      .mockReturnValueOnce(selectResult([workerProfile()]))
      .mockReturnValueOnce(selectResult([{ job, agency }]))
      .mockReturnValueOnce(selectResult([]))
      .mockReturnValueOnce(selectResult([{ value: 0 }]));
    mocks.getDb.mockResolvedValue({ select });

    const result = await buildOnWorksRouter.createCaller(context()).jobs.discover();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ job, agency, canApply: true, assignedCount: 0 });
  });

  it("allows a direct job application without querying an agency membership", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn()
      .mockReturnValueOnce(selectResult([account()]))
      .mockReturnValueOnce(selectResult([workerProfile()]))
      .mockReturnValueOnce(selectResult([{ id: 31, agencyId: 71, status: "RECRUITING" }]))
      .mockReturnValueOnce(selectResult([{ value: 0 }]))
      .mockReturnValueOnce(selectResult([]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values })) });

    await expect(buildOnWorksRouter.createCaller(context()).jobs.submitApplication({ jobId: 31 })).resolves.toEqual({ success: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ jobId: 31, workerId: 21, status: "PENDING" }));
    expect(select).toHaveBeenCalledTimes(5);
  });

  it("blocks a duplicate direct application for the same job", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(selectResult([account()]))
      .mockReturnValueOnce(selectResult([workerProfile()]))
      .mockReturnValueOnce(selectResult([{ id: 31, agencyId: 71, status: "RECRUITING" }]))
      .mockReturnValueOnce(selectResult([{ value: 0 }]))
      .mockReturnValueOnce(selectResult([{ id: 90, jobId: 31, workerId: 21, status: "PENDING" }]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn() });

    await expect(buildOnWorksRouter.createCaller(context()).jobs.submitApplication({ jobId: 31 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "이미 신청했거나 처리된 일감입니다." });
  });

  it("creates a separate membership request for another agency without altering the legacy profile", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn()
      .mockReturnValueOnce(selectResult([account()]))
      .mockReturnValueOnce(selectResult([workerProfile()]))
      .mockReturnValueOnce(selectResult([{ id: 72, deletedAt: null }]))
      .mockReturnValueOnce(selectResult([]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values })) });

    await expect(buildOnWorksRouter.createCaller(context()).agency.requestMembership({ agencyId: 72 })).resolves.toEqual({ success: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ workerId: 21, agencyId: 72, status: "PENDING" }));
  });
});
