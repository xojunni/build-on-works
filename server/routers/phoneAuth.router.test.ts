import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), createSessionToken: vi.fn() }));

vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../_core/sdk", () => ({ sdk: { createSessionToken: mocks.createSessionToken } }));

import { hashPassword, phoneAuthRouter } from "./phoneAuth";

function context() {
  const cookie = vi.fn();
  return {
    ctx: { req: { protocol: "https", headers: {} }, res: { cookie } } as any,
    cookie,
  };
}

function emptySelect() {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) };
}

describe("phoneAuth router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSessionToken.mockResolvedValue("signed-phone-session");
  });

  it("creates a manager account with a password hash and signed cookie", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 7 }]);
    mocks.getDb.mockResolvedValue({ select: vi.fn(emptySelect), insert: vi.fn(() => ({ values })) });
    const { ctx, cookie } = context();
    const result = await phoneAuthRouter.createCaller(ctx).register({ name: "홍길동", phone: "010-1234-5678", password: "1234", accountRole: "MANAGER" });
    expect(result).toEqual({ success: true, accountRole: "MANAGER" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ phone: "01012345678", openId: "phone:01012345678", passwordHash: expect.not.stringContaining("1234") }));
    expect(mocks.createSessionToken).toHaveBeenCalledWith("phone:01012345678", { name: "홍길동" });
    expect(cookie).toHaveBeenCalledWith(expect.any(String), "signed-phone-session", expect.objectContaining({ httpOnly: true }));
  });

  it("rejects login when a stored hash does not match the supplied password", async () => {
    const account = { id: 7, phone: "01012345678", passwordHash: "fixed:00", openId: "phone:01012345678", name: "홍길동", accountRole: "MANAGER" };
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([account]) }) }) })) });
    const { ctx } = context();
    await expect(phoneAuthRouter.createCaller(ctx).login({ phone: "01012345678", password: "1234" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("issues a signed cookie after a successful phone-password login", async () => {
    const account = { id: 7, phone: "01012345678", passwordHash: hashPassword("1234", "valid-salt"), openId: "phone:01012345678", name: "홍길동", accountRole: "MANAGER" };
    const where = vi.fn().mockResolvedValue(undefined);
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([account]) }) }) })),
      update: vi.fn(() => ({ set: () => ({ where }) })),
    });
    const { ctx, cookie } = context();
    const result = await phoneAuthRouter.createCaller(ctx).login({ phone: "010-1234-5678", password: "1234" });
    expect(result).toEqual({ success: true, accountRole: "MANAGER" });
    expect(cookie).toHaveBeenCalledWith(expect.any(String), "signed-phone-session", expect.objectContaining({ httpOnly: true }));
  });
});
