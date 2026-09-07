import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users, workerProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { TRPCError } from "@trpc/server";

const passwordInput = z.string().min(4, "비밀번호는 4자리 이상 입력해 주세요.").max(72, "비밀번호가 너무 깁니다.");

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
  if (!/^01\d{8,9}$/.test(normalized)) throw new TRPCError({ code: "BAD_REQUEST", message: "올바른 휴대폰 번호를 입력해 주세요." });
  return normalized;
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value);
  return digits.length === 11 ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}` : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

async function issueSession(res: any, req: any, openId: string, name: string) {
  const sessionToken = await sdk.createSessionToken(openId, { name });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

export const phoneAuthRouter = router({
  register: publicProcedure.input(z.object({
    name: z.string().trim().min(2, "이름을 2자 이상 입력해 주세요.").max(100),
    phone: z.string().min(8),
    password: passwordInput,
    accountRole: z.enum(["MANAGER", "WORKER"]),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    certificate: z.string().trim().max(200).optional(),
    bankName: z.string().trim().max(50).optional(),
    bankAccount: z.string().trim().max(100).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "데이터베이스 연결을 준비할 수 없습니다." });
    const phone = normalizePhone(input.phone);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "이미 가입된 전화번호입니다. 로그인해 주세요." });
    const result = await db.insert(users).values({
      openId: `phone:${phone}`,
      name: input.name,
      phone,
      passwordHash: hashPassword(input.password),
      accountRole: input.accountRole,
      loginMethod: "phone-password",
      lastSignedIn: new Date(),
    });
    const userId = Number(result[0].insertId);
    if (input.accountRole === "WORKER") {
      await db.insert(workerProfiles).values({
        userId,
        birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : undefined,
        certificate: input.certificate,
        phone,
        bankName: input.bankName,
        bankAccount: input.bankAccount,
        status: "UNAFFILIATED",
      });
    }
    await issueSession(ctx.res, ctx.req, `phone:${phone}`, input.name);
    return { success: true, accountRole: input.accountRole };
  }),
  login: publicProcedure.input(z.object({ phone: z.string().min(8), password: passwordInput })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "데이터베이스 연결을 준비할 수 없습니다." });
    const phone = normalizePhone(input.phone);
    const [account] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!account || !verifyPassword(input.password, account.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "전화번호 또는 비밀번호가 올바르지 않습니다." });
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, account.id));
    await issueSession(ctx.res, ctx.req, account.openId, account.name ?? "현장 사용자");
    return { success: true, accountRole: account.accountRole };
  }),
});
