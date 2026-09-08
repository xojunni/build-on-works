import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), makeRequest: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../_core/map", () => ({ makeRequest: mocks.makeRequest }));

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

describe("location-based job and attendance routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a verified Korean geocoding result for an address", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }]));
    mocks.getDb.mockResolvedValue({ select });
    mocks.makeRequest.mockResolvedValue({ status: "OK", results: [{ formatted_address: "서울특별시 중구 세종대로 110", geometry: { location: { lat: 37.5663, lng: 126.9779 } } }] });
    await expect(buildOnWorksRouter.createCaller(managerContext).jobs.geocodeAddress({ address: "서울특별시 중구 세종대로 110" })).resolves.toEqual({ address: "서울특별시 중구 세종대로 110", latitude: 37.5663, longitude: 126.9779 });
  });

  it("stores selected coordinates and the configured GPS radius when a manager creates a job", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values })) });
    await buildOnWorksRouter.createCaller(managerContext).jobs.create({ title: "철거 보조", region: "서울시", address: "서울특별시 중구 세종대로 110", siteLatitude: 37.5663, siteLongitude: 126.9779, geofenceRadiusMeters: 100, jobDate: "2026-09-08", dailyWage: 160000, requiredWorkers: 2 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ siteLatitude: 37.5663, siteLongitude: 126.9779, geofenceRadiusMeters: 100 }));
  });

  it("rejects GPS check-in outside the worksite radius before creating an attendance record", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([{ id: 20, userId: 2 }])).mockReturnValueOnce(chain([{ assignment: { id: 30 }, job: { id: 40, siteLatitude: 37.5665, siteLongitude: 126.978, geofenceRadiusMeters: 100 } }]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn() });
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkIn({ jobId: 40, latitude: 37.57, longitude: 126.978, accuracyMeters: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("반경 100m 밖") });
    expect(select).toHaveBeenCalledTimes(3);
  });

  it("accepts GPS check-in inside the worksite radius and persists rounded location metadata", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([{ id: 20, userId: 2 }])).mockReturnValueOnce(chain([{ assignment: { id: 30 }, job: { id: 40, siteLatitude: 37.5665, siteLongitude: 126.978, geofenceRadiusMeters: 100 } }])).mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values })) });
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkIn({ jobId: 40, latitude: 37.5665, longitude: 126.978, accuracyMeters: 9.6 })).resolves.toMatchObject({ success: true, locationVerified: true, distanceMeters: 0 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ checkInLatitude: 37.5665, checkInLongitude: 126.978, checkInAccuracyMeters: 10, checkInDistanceMeters: 0 }));
  });

  it("allows a legacy job without saved coordinates and rejects a partial GPS payload", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([{ id: 20, userId: 2 }])).mockReturnValueOnce(chain([{ assignment: { id: 30 }, job: { id: 40, siteLatitude: null, siteLongitude: null, geofenceRadiusMeters: 150 } }])).mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values })) });
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkIn({ jobId: 40 })).resolves.toMatchObject({ success: true, locationVerified: false });
    expect(values).toHaveBeenCalled();
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkIn({ jobId: 40, longitude: 126.978 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects out-of-range checkout and completes an in-range legacy checkout in one transaction", async () => {
    const farSelect = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([{ id: 20, userId: 2 }])).mockReturnValueOnce(chain([{ id: 50, checkIn: new Date() }])).mockReturnValueOnce(chain([{ id: 40, siteLatitude: 37.5665, siteLongitude: 126.978, geofenceRadiusMeters: 100 }]));
    mocks.getDb.mockResolvedValue({ select: farSelect });
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkOut({ jobId: 40, latitude: 37.57, longitude: 126.978 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("반경 100m 밖") });

    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const update = vi.fn(() => ({ set }));
    const legacySelect = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([{ id: 20, userId: 2 }])).mockReturnValueOnce(chain([{ id: 50, checkIn: new Date() }])).mockReturnValueOnce(chain([{ id: 40, siteLatitude: null, siteLongitude: null, geofenceRadiusMeters: 150 }]));
    mocks.getDb.mockResolvedValue({ select: legacySelect, transaction: async (fn: any) => fn({ update }) });
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkOut({ jobId: 40 })).resolves.toMatchObject({ success: true, locationVerified: false });
    expect(update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "COMPLETED" }));
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkOut({ jobId: 40, latitude: 37.5665 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("persists in-range GPS checkout metadata and completes the assigned job", async () => {
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const update = vi.fn(() => ({ set }));
    const select = vi.fn().mockReturnValueOnce(chain([worker])).mockReturnValueOnce(chain([{ id: 20, userId: 2 }])).mockReturnValueOnce(chain([{ id: 50, checkIn: new Date() }])).mockReturnValueOnce(chain([{ id: 40, siteLatitude: 37.5665, siteLongitude: 126.978, geofenceRadiusMeters: 100 }]));
    mocks.getDb.mockResolvedValue({ select, transaction: async (fn: any) => fn({ update }) });
    await expect(buildOnWorksRouter.createCaller(workerContext).attendance.checkOut({ jobId: 40, latitude: 37.5665, longitude: 126.978, accuracyMeters: 4.4 })).resolves.toMatchObject({ success: true, locationVerified: true, distanceMeters: 0 });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ checkOutLatitude: 37.5665, checkOutLongitude: 126.978, checkOutAccuracyMeters: 4, checkOutDistanceMeters: 0 }));
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "COMPLETED" }));
  });

  it("keeps existing application approval and recruitment-closing rules after adding locations", async () => {
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const update = vi.fn(() => ({ set }));
    const select = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }])).mockReturnValueOnce(chain([{ assignment: { id: 30, status: "PENDING" }, job: { id: 40, agencyId: 10, requiredWorkers: 1 } }])).mockReturnValueOnce(chain([{ value: 0 }])).mockReturnValueOnce(chain([{ value: 1 }]));
    mocks.getDb.mockResolvedValue({ select, update });
    await expect(buildOnWorksRouter.createCaller(managerContext).jobs.decideApplication({ assignmentId: 30, approved: true })).resolves.toEqual({ success: true });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "ASSIGNED" }));
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "CLOSED" }));
  });

  it("keeps completed-job-only payroll creation, duplicate prevention, and payment completion rules", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const createSelect = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }])).mockReturnValueOnce(chain([{ assignment: { id: 30, status: "COMPLETED" }, job: { id: 40, agencyId: 10 } }])).mockReturnValueOnce(chain([]));
    mocks.getDb.mockResolvedValue({ select: createSelect, insert: vi.fn(() => ({ values })) });
    await expect(buildOnWorksRouter.createCaller(managerContext).payroll.create({ workerId: 20, jobId: 40, amount: 160000 })).resolves.toEqual({ success: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ workerId: 20, jobId: 40, agencyId: 10, status: "PENDING" }));

    const duplicateSelect = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }])).mockReturnValueOnce(chain([{ assignment: { id: 30, status: "COMPLETED" }, job: { id: 40, agencyId: 10 } }])).mockReturnValueOnce(chain([{ id: 99 }]));
    mocks.getDb.mockResolvedValue({ select: duplicateSelect });
    await expect(buildOnWorksRouter.createCaller(managerContext).payroll.create({ workerId: 20, jobId: 40, amount: 160000 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("이미 생성") });

    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const paidSelect = vi.fn().mockReturnValueOnce(chain([manager])).mockReturnValueOnce(chain([{ id: 10, managerId: 1, deletedAt: null }])).mockReturnValueOnce(chain([{ id: 99, agencyId: 10, status: "PENDING" }]));
    mocks.getDb.mockResolvedValue({ select: paidSelect, update: vi.fn(() => ({ set })) });
    await expect(buildOnWorksRouter.createCaller(managerContext).payroll.markPaid({ paymentId: 99 })).resolves.toEqual({ success: true });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ paidAt: expect.any(Date), status: "PAID" }));
  });
});
