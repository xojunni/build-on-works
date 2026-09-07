import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.me", () => {
  it("returns phone login metadata without exposing a password hash", async () => {
    const ctx = {
      user: {
        id: 7,
        openId: "phone:01012345678",
        name: "홍길동",
        email: null,
        phone: "01012345678",
        passwordHash: "private-password-hash",
        accountRole: "WORKER",
        loginMethod: "phone-password",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;
    const result = await appRouter.createCaller(ctx).auth.me();
    expect(result).toMatchObject({ phone: "01012345678", loginMethod: "phone-password" });
    expect(result).not.toHaveProperty("passwordHash");
  });
});
