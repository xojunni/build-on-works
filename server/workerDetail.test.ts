import { describe, expect, it } from "vitest";
import { ageFromBirthDate, maskBankAccount, toManagerWorkerDetail } from "./workerDetail";

describe("manager worker detail", () => {
  it("calculates Korean-facing age from a stored birth date", () => {
    expect(ageFromBirthDate(new Date("2000-09-08T00:00:00.000Z"), new Date("2026-09-07T00:00:00.000Z"))).toBe(25);
    expect(ageFromBirthDate(new Date("2000-09-07T00:00:00.000Z"), new Date("2026-09-07T00:00:00.000Z"))).toBe(26);
  });

  it("masks bank accounts and omits sensitive user fields from detail responses", () => {
    const detail = toManagerWorkerDetail({ profile: { id: 3, birthDate: new Date("1995-01-01T00:00:00.000Z"), certificate: "C-1234", phone: "01012345678", bankName: "국민은행", bankAccount: "123-456-789012", status: "PENDING" }, user: { id: 9, name: "김인부", phone: "01012345678" } });
    expect(maskBankAccount("123-456-789012")).toBe("•••• 9012");
    expect(detail.profile.bankAccount).toBe("•••• 9012");
    expect(detail).not.toHaveProperty("passwordHash");
  });
});
