import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  agencies,
  attendanceRecords,
  jobAssignments,
  jobs,
  paymentRecords,
  users,
  workerProfiles,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");

function forbidden(message = "이 작업을 수행할 권한이 없습니다.") {
  return new TRPCError({ code: "FORBIDDEN", message });
}

function invalid(message: string) {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

function missing(message: string) {
  return new TRPCError({ code: "NOT_FOUND", message });
}

async function getAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "데이터베이스 연결을 준비할 수 없습니다." });
  const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!account) throw missing("사용자 계정을 찾을 수 없습니다.");
  return { db, account };
}

async function managerContext(userId: number) {
  const { db, account } = await getAccount(userId);
  if (account.accountRole !== "MANAGER") throw forbidden("인력소장 계정만 사용할 수 있습니다.");
  const [agency] = await db.select().from(agencies).where(and(eq(agencies.managerId, userId), isNull(agencies.deletedAt))).limit(1);
  return { db, account, agency: agency ?? null };
}

async function workerContext(userId: number) {
  const { db, account } = await getAccount(userId);
  if (account.accountRole !== "WORKER") throw forbidden("인부 계정만 사용할 수 있습니다.");
  const [profile] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, userId)).limit(1);
  if (!profile) throw missing("인부 프로필을 찾을 수 없습니다.");
  return { db, account, profile };
}

function numberFrom(value: unknown) {
  return Number(value ?? 0);
}

async function assignmentCapacity(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, jobId: number) {
  const [row] = await db
    .select({ value: count() })
    .from(jobAssignments)
    .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.status, "ASSIGNED")));
  return numberFrom(row?.value);
}

export const buildOnWorksRouter = router({
  account: router({
    viewer: protectedProcedure.query(async ({ ctx }) => {
      const { db, account } = await getAccount(ctx.user.id);
      const [profile] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, ctx.user.id)).limit(1);
      const [agency] = await db.select().from(agencies).where(and(eq(agencies.managerId, ctx.user.id), isNull(agencies.deletedAt))).limit(1);
      return { account, profile: profile ?? null, managedAgency: agency ?? null };
    }),
    setup: protectedProcedure
      .input(z.object({
        accountRole: z.enum(["MANAGER", "WORKER"]),
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().min(8).max(20),
        birthDate: dateInput.optional(),
        certificate: z.string().trim().max(200).optional(),
        bankName: z.string().trim().max(50).optional(),
        bankAccount: z.string().trim().max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { db } = await getAccount(ctx.user.id);
        await db.update(users).set({ name: input.name, phone: input.phone, accountRole: input.accountRole }).where(eq(users.id, ctx.user.id));
        if (input.accountRole === "WORKER") {
          const { birthDate, accountRole: _accountRole, name: _name, ...profileInput } = input;
          const normalizedBirthDate = birthDate ? new Date(`${birthDate}T00:00:00.000Z`) : undefined;
          await db
            .insert(workerProfiles)
            .values({
              userId: ctx.user.id,
              birthDate: normalizedBirthDate,
              certificate: profileInput.certificate,
              phone: profileInput.phone,
              bankName: profileInput.bankName,
              bankAccount: profileInput.bankAccount,
              status: "UNAFFILIATED",
            })
            .onDuplicateKeyUpdate({
              set: {
                birthDate: normalizedBirthDate,
                certificate: profileInput.certificate,
                phone: profileInput.phone,
                bankName: profileInput.bankName,
                bankAccount: profileInput.bankAccount,
              },
            });
        }
        return { success: true };
      }),
  }),

  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const { db, account } = await getAccount(ctx.user.id);
      if (!account.accountRole) return { role: null, needsOnboarding: true };
      if (account.accountRole === "MANAGER") {
        const [, , agency] = [null, null, (await managerContext(ctx.user.id)).agency];
        if (!agency) return { role: "MANAGER" as const, needsAgency: true, agency: null, metrics: null };
        const [activeWorkers] = await db.select({ value: count() }).from(workerProfiles).where(and(eq(workerProfiles.agencyId, agency.id), eq(workerProfiles.status, "ACTIVE")));
        const [pendingMembers] = await db.select({ value: count() }).from(workerProfiles).where(and(eq(workerProfiles.agencyId, agency.id), eq(workerProfiles.status, "PENDING")));
        const [activeJobs] = await db.select({ value: count() }).from(jobs).where(and(eq(jobs.agencyId, agency.id), eq(jobs.status, "RECRUITING")));
        const [paidThisMonth] = await db.select({ value: sql<number>`coalesce(sum(${paymentRecords.amount}), 0)` }).from(paymentRecords).where(and(eq(paymentRecords.agencyId, agency.id), eq(paymentRecords.status, "PAID")));
        return {
          role: "MANAGER" as const,
          needsAgency: false,
          agency,
          metrics: { activeWorkers: numberFrom(activeWorkers?.value), pendingMembers: numberFrom(pendingMembers?.value), activeJobs: numberFrom(activeJobs?.value), paidTotal: numberFrom(paidThisMonth?.value) },
        };
      }
      const { profile } = await workerContext(ctx.user.id);
      const [pendingAssignments] = await db.select({ value: count() }).from(jobAssignments).where(and(eq(jobAssignments.workerId, profile.id), eq(jobAssignments.status, "PENDING")));
      const [activeAssignments] = await db.select({ value: count() }).from(jobAssignments).where(and(eq(jobAssignments.workerId, profile.id), eq(jobAssignments.status, "ASSIGNED")));
      const [totalWages] = await db.select({ value: sql<number>`coalesce(sum(${paymentRecords.amount}), 0)` }).from(paymentRecords).where(and(eq(paymentRecords.workerId, profile.id), sql`${paymentRecords.status} in ('PENDING', 'PAID')`));
      const [agency] = profile.agencyId ? await db.select().from(agencies).where(eq(agencies.id, profile.agencyId)).limit(1) : [];
      return {
        role: "WORKER" as const,
        needsAgency: profile.status !== "ACTIVE",
        profile,
        agency: agency ?? null,
        metrics: { pendingAssignments: numberFrom(pendingAssignments?.value), activeAssignments: numberFrom(activeAssignments?.value), totalWages: numberFrom(totalWages?.value) },
      };
    }),
  }),

  agency: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(agencies).where(isNull(agencies.deletedAt)).orderBy(agencies.region, agencies.name);
    }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(100), region: z.string().trim().min(2).max(100), address: z.string().trim().max(500).optional(), phone: z.string().trim().max(20).optional(), description: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (agency) throw invalid("이미 등록된 인력소가 있습니다.");
      await db.insert(agencies).values({ managerId: ctx.user.id, ...input });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(100), region: z.string().trim().min(2).max(100), address: z.string().trim().max(500).nullable(), phone: z.string().trim().max(20).nullable(), description: z.string().trim().max(1000).nullable() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("먼저 인력소를 등록해 주세요.");
      await db.update(agencies).set(input).where(eq(agencies.id, agency.id));
      return { success: true };
    }),
    deactivate: protectedProcedure.mutation(async ({ ctx }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("운영 중인 인력소를 찾을 수 없습니다.");
      const [activeWorker] = await db.select({ value: count() }).from(workerProfiles).where(and(eq(workerProfiles.agencyId, agency.id), sql`${workerProfiles.status} in ('PENDING', 'ACTIVE')`));
      const [activeJob] = await db.select({ value: count() }).from(jobs).where(and(eq(jobs.agencyId, agency.id), sql`${jobs.status} in ('RECRUITING', 'CLOSED')`));
      if (numberFrom(activeWorker?.value) > 0 || numberFrom(activeJob?.value) > 0) throw invalid("소속 인부와 진행·마감 일감이 없는 경우에만 인력소 운영을 중지할 수 있습니다.");
      await db.update(agencies).set({ deletedAt: new Date() }).where(eq(agencies.id, agency.id));
      return { success: true };
    }),
    requestMembership: protectedProcedure.input(z.object({ agencyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      if (profile.status === "ACTIVE") throw invalid("이미 소속 인력소가 있습니다.");
      const [agency] = await db.select().from(agencies).where(and(eq(agencies.id, input.agencyId), isNull(agencies.deletedAt))).limit(1);
      if (!agency) throw missing("선택한 인력소를 찾을 수 없습니다.");
      await db.update(workerProfiles).set({ agencyId: input.agencyId, status: "PENDING" }).where(eq(workerProfiles.id, profile.id));
      return { success: true };
    }),
    members: protectedProcedure.query(async ({ ctx }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) return [];
      return db.select({ profile: workerProfiles, user: users }).from(workerProfiles).innerJoin(users, eq(workerProfiles.userId, users.id)).where(eq(workerProfiles.agencyId, agency.id)).orderBy(desc(workerProfiles.updatedAt));
    }),
    decideMembership: protectedProcedure.input(z.object({ profileId: z.number().int().positive(), approved: z.boolean() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("먼저 인력소를 등록해 주세요.");
      const [profile] = await db.select().from(workerProfiles).where(and(eq(workerProfiles.id, input.profileId), eq(workerProfiles.agencyId, agency.id), eq(workerProfiles.status, "PENDING"))).limit(1);
      if (!profile) throw missing("승인 대기 중인 인부를 찾을 수 없습니다.");
      await db.update(workerProfiles).set(input.approved ? { status: "ACTIVE" } : { status: "REJECTED", agencyId: null }).where(eq(workerProfiles.id, profile.id));
      return { success: true };
    }),
  }),

  jobs: router({
    managerList: protectedProcedure.query(async ({ ctx }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) return [];
      const rows = await db.select().from(jobs).where(eq(jobs.agencyId, agency.id)).orderBy(desc(jobs.jobDate));
      return Promise.all(rows.map(async job => ({ ...job, assignedCount: await assignmentCapacity(db, job.id) })));
    }),
    discover: protectedProcedure.input(z.object({ region: z.string().trim().optional(), agencyId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      const filters = [eq(jobs.status, "RECRUITING")];
      if (input?.region) filters.push(eq(jobs.region, input.region));
      if (input?.agencyId) filters.push(eq(jobs.agencyId, input.agencyId));
      const rows = await db.select({ job: jobs, agency: agencies }).from(jobs).innerJoin(agencies, eq(jobs.agencyId, agencies.id)).where(and(...filters)).orderBy(jobs.jobDate);
      const assignments = await db.select().from(jobAssignments).where(eq(jobAssignments.workerId, profile.id));
      return Promise.all(rows.map(async row => ({ ...row, assignment: assignments.find(item => item.jobId === row.job.id) ?? null, assignedCount: await assignmentCapacity(db, row.job.id) })));
    }),
    workerAssignments: protectedProcedure.query(async ({ ctx }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      return db.select({ assignment: jobAssignments, job: jobs, agency: agencies }).from(jobAssignments).innerJoin(jobs, eq(jobAssignments.jobId, jobs.id)).innerJoin(agencies, eq(jobs.agencyId, agencies.id)).where(eq(jobAssignments.workerId, profile.id)).orderBy(desc(jobAssignments.requestedAt));
    }),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(200), region: z.string().trim().min(2).max(100), address: z.string().trim().max(500).optional(), jobDate: dateInput, startTime: z.string().trim().max(10).optional(), endTime: z.string().trim().max(10).optional(), requiredWorkers: z.number().int().min(1).max(100), dailyWage: z.number().int().min(0), description: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("먼저 인력소를 등록해 주세요.");
      const { jobDate, ...jobValues } = input;
      await db.insert(jobs).values({ agencyId: agency.id, ...jobValues, jobDate: new Date(`${jobDate}T00:00:00.000Z`) });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(2).max(200), region: z.string().trim().min(2).max(100), address: z.string().trim().max(500).nullable(), jobDate: dateInput, startTime: z.string().trim().max(10).nullable(), endTime: z.string().trim().max(10).nullable(), requiredWorkers: z.number().int().min(1).max(100), dailyWage: z.number().int().min(0), description: z.string().trim().max(2000).nullable() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("인력소를 찾을 수 없습니다.");
      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, input.id), eq(jobs.agencyId, agency.id))).limit(1);
      if (!job) throw missing("일감을 찾을 수 없습니다.");
      const { id, jobDate, ...changes } = input;
      await db.update(jobs).set({ ...changes, jobDate: new Date(`${jobDate}T00:00:00.000Z`) }).where(eq(jobs.id, id));
      return { success: true };
    }),
    cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("인력소를 찾을 수 없습니다.");
      await db.update(jobs).set({ status: "CANCELED" }).where(and(eq(jobs.id, input.id), eq(jobs.agencyId, agency.id)));
      return { success: true };
    }),
    submitApplication: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      if (profile.status !== "ACTIVE" || !profile.agencyId) throw forbidden("인력소 승인이 완료된 뒤 일감을 신청할 수 있습니다.");
      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.status, "RECRUITING"))).limit(1);
      if (!job) throw missing("모집 중인 일감을 찾을 수 없습니다.");
      if (job.agencyId !== profile.agencyId) throw forbidden("소속 인력소의 일감만 신청할 수 있습니다.");
      if ((await assignmentCapacity(db, job.id)) >= job.requiredWorkers) throw invalid("모집 인원이 모두 찼습니다.");
      const [existing] = await db.select().from(jobAssignments).where(and(eq(jobAssignments.jobId, job.id), eq(jobAssignments.workerId, profile.id))).limit(1);
      if (existing) throw invalid("이미 신청했거나 처리된 일감입니다.");
      await db.insert(jobAssignments).values({ jobId: job.id, workerId: profile.id, status: "PENDING" });
      return { success: true };
    }),
    cancelApplication: protectedProcedure.input(z.object({ assignmentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      await db.update(jobAssignments).set({ status: "CANCELED", canceledAt: new Date() }).where(and(eq(jobAssignments.id, input.assignmentId), eq(jobAssignments.workerId, profile.id), eq(jobAssignments.status, "PENDING")));
      return { success: true };
    }),
    applicants: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) return [];
      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.agencyId, agency.id))).limit(1);
      if (!job) throw missing("일감을 찾을 수 없습니다.");
      return db.select({ assignment: jobAssignments, profile: workerProfiles, user: users }).from(jobAssignments).innerJoin(workerProfiles, eq(jobAssignments.workerId, workerProfiles.id)).innerJoin(users, eq(workerProfiles.userId, users.id)).where(eq(jobAssignments.jobId, job.id)).orderBy(desc(jobAssignments.requestedAt));
    }),
    decideApplication: protectedProcedure.input(z.object({ assignmentId: z.number().int().positive(), approved: z.boolean() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("인력소를 찾을 수 없습니다.");
      const [row] = await db.select({ assignment: jobAssignments, job: jobs }).from(jobAssignments).innerJoin(jobs, eq(jobAssignments.jobId, jobs.id)).where(eq(jobAssignments.id, input.assignmentId)).limit(1);
      if (!row || row.job.agencyId !== agency.id || row.assignment.status !== "PENDING") throw missing("승인 대기 중인 신청을 찾을 수 없습니다.");
      if (input.approved && (await assignmentCapacity(db, row.job.id)) >= row.job.requiredWorkers) throw invalid("모집 인원이 모두 찼습니다.");
      await db.update(jobAssignments).set({ status: input.approved ? "ASSIGNED" : "REJECTED", respondedAt: new Date() }).where(eq(jobAssignments.id, row.assignment.id));
      if (input.approved && (await assignmentCapacity(db, row.job.id)) >= row.job.requiredWorkers) await db.update(jobs).set({ status: "CLOSED" }).where(eq(jobs.id, row.job.id));
      return { success: true };
    }),
  }),

  attendance: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      return db.select({ assignment: jobAssignments, job: jobs, attendance: attendanceRecords }).from(jobAssignments).innerJoin(jobs, eq(jobAssignments.jobId, jobs.id)).leftJoin(attendanceRecords, and(eq(attendanceRecords.jobId, jobs.id), eq(attendanceRecords.workerId, profile.id))).where(and(eq(jobAssignments.workerId, profile.id), eq(jobAssignments.status, "ASSIGNED"))).orderBy(jobs.jobDate);
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      return db.select({ attendance: attendanceRecords, job: jobs }).from(attendanceRecords).innerJoin(jobs, eq(attendanceRecords.jobId, jobs.id)).where(eq(attendanceRecords.workerId, profile.id)).orderBy(desc(attendanceRecords.workDate));
    }),
    checkIn: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      const [assignment] = await db.select().from(jobAssignments).where(and(eq(jobAssignments.jobId, input.jobId), eq(jobAssignments.workerId, profile.id), eq(jobAssignments.status, "ASSIGNED"))).limit(1);
      if (!assignment) throw forbidden("배정된 진행 중 일감만 출근할 수 있습니다.");
      const workDate = new Date();
      const [record] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.workerId, profile.id), eq(attendanceRecords.jobId, input.jobId), eq(attendanceRecords.workDate, workDate))).limit(1);
      if (record?.checkIn) throw invalid("이미 출근이 기록되어 있습니다.");
      if (record) await db.update(attendanceRecords).set({ checkIn: new Date() }).where(eq(attendanceRecords.id, record.id));
      else await db.insert(attendanceRecords).values({ workerId: profile.id, jobId: input.jobId, workDate, checkIn: new Date() });
      return { success: true };
    }),
    checkOut: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      const [record] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.workerId, profile.id), eq(attendanceRecords.jobId, input.jobId), sql`${attendanceRecords.checkIn} is not null`, isNull(attendanceRecords.checkOut))).orderBy(desc(attendanceRecords.createdAt)).limit(1);
      if (!record) throw invalid("출근 기록을 먼저 남겨 주세요.");
      await db.transaction(async tx => {
        await tx.update(attendanceRecords).set({ checkOut: new Date() }).where(eq(attendanceRecords.id, record.id));
        await tx.update(jobAssignments).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(jobAssignments.jobId, input.jobId), eq(jobAssignments.workerId, profile.id), eq(jobAssignments.status, "ASSIGNED")));
      });
      return { success: true };
    }),
  }),

  payroll: router({
    managerList: protectedProcedure.query(async ({ ctx }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) return [];
      return db.select({ payment: paymentRecords, job: jobs, profile: workerProfiles, user: users }).from(paymentRecords).innerJoin(jobs, eq(paymentRecords.jobId, jobs.id)).innerJoin(workerProfiles, eq(paymentRecords.workerId, workerProfiles.id)).innerJoin(users, eq(workerProfiles.userId, users.id)).where(eq(paymentRecords.agencyId, agency.id)).orderBy(desc(paymentRecords.createdAt));
    }),
    workerList: protectedProcedure.query(async ({ ctx }) => {
      const { db, profile } = await workerContext(ctx.user.id);
      return db.select({ payment: paymentRecords, job: jobs }).from(paymentRecords).innerJoin(jobs, eq(paymentRecords.jobId, jobs.id)).where(eq(paymentRecords.workerId, profile.id)).orderBy(desc(paymentRecords.createdAt));
    }),
    eligibleAssignments: protectedProcedure.query(async ({ ctx }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) return [];
      return db.select({ assignment: jobAssignments, job: jobs, profile: workerProfiles, user: users }).from(jobAssignments).innerJoin(jobs, eq(jobAssignments.jobId, jobs.id)).innerJoin(workerProfiles, eq(jobAssignments.workerId, workerProfiles.id)).innerJoin(users, eq(workerProfiles.userId, users.id)).leftJoin(paymentRecords, and(eq(paymentRecords.jobId, jobs.id), eq(paymentRecords.workerId, workerProfiles.id))).where(and(eq(jobs.agencyId, agency.id), eq(jobAssignments.status, "COMPLETED"), isNull(paymentRecords.id)));
    }),
    create: protectedProcedure.input(z.object({ workerId: z.number().int().positive(), jobId: z.number().int().positive(), amount: z.number().int().min(0), description: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("인력소를 찾을 수 없습니다.");
      const [row] = await db.select({ assignment: jobAssignments, job: jobs }).from(jobAssignments).innerJoin(jobs, eq(jobAssignments.jobId, jobs.id)).where(and(eq(jobAssignments.jobId, input.jobId), eq(jobAssignments.workerId, input.workerId), eq(jobAssignments.status, "COMPLETED"))).limit(1);
      if (!row || row.job.agencyId !== agency.id) throw invalid("완료된 일감만 정산할 수 있습니다.");
      const [existing] = await db.select().from(paymentRecords).where(and(eq(paymentRecords.workerId, input.workerId), eq(paymentRecords.jobId, input.jobId))).limit(1);
      if (existing) throw invalid("해당 일감의 급여 정산이 이미 생성되었습니다.");
      await db.insert(paymentRecords).values({ workerId: input.workerId, jobId: input.jobId, agencyId: agency.id, amount: input.amount, description: input.description, status: "PENDING" });
      return { success: true };
    }),
    markPaid: protectedProcedure.input(z.object({ paymentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, agency } = await managerContext(ctx.user.id);
      if (!agency) throw missing("인력소를 찾을 수 없습니다.");
      const [payment] = await db.select().from(paymentRecords).where(and(eq(paymentRecords.id, input.paymentId), eq(paymentRecords.agencyId, agency.id), eq(paymentRecords.status, "PENDING"))).limit(1);
      if (!payment) throw missing("지급 대기 중인 급여 기록을 찾을 수 없습니다.");
      await db.update(paymentRecords).set({ status: "PAID", paidAt: new Date() }).where(eq(paymentRecords.id, payment.id));
      return { success: true };
    }),
  }),
});
