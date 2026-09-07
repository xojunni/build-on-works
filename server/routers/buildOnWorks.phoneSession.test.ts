import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));

import { buildOnWorksRouter } from "./buildOnWorks";

const phoneAccount = {
  id: 12,
  openId: "phone:01012345678",
  name: "홍길동",
  email: null,
  phone: "01012345678",
  passwordHash: "hash-present",
  accountRole: "MANAGER" as const,
  loginMethod: "phone-password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function chain(rows: unknown[]) {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) };
}

describe("Build On Works phone session access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows a signed phone-password account to read the role viewer", async () => {
    mocks.getDb.mockResolvedValue({ select: vi.fn().mockImplementationOnce(() => chain([phoneAccount])).mockImplementationOnce(() => chain([])).mockImplementationOnce(() => chain([])) });
    const result = await buildOnWorksRouter.createCaller({ user: phoneAccount, req: {} as any, res: {} as any }).account.viewer();
    expect(result.account).toMatchObject({ id: 12, phone: "01012345678", accountRole: "MANAGER", loginMethod: "phone-password" });
    expect(result.account).not.toHaveProperty("passwordHash");
  });

  it("rejects a non-phone session before any role data is returned", async () => {
    const oauthAccount = { ...phoneAccount, loginMethod: "manus-oauth", passwordHash: null };
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => chain([oauthAccount])) });
    await expect(buildOnWorksRouter.createCaller({ user: oauthAccount, req: {} as any, res: {} as any }).account.viewer()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
