import { describe, expect, it } from "vitest";
import { canAccessWorkspace } from "../shared/sessionAccess";

describe("workspace session access", () => {
  it("routes a phone-password WORKER account to the protected workspace flow", () => {
    expect(canAccessWorkspace({ loginMethod: "phone-password", accountRole: "WORKER" })).toBe(true);
  });

  it("rejects an OAuth account before it can query role-specific data", () => {
    expect(canAccessWorkspace({ loginMethod: "manus-oauth", accountRole: "WORKER" })).toBe(false);
  });
});
