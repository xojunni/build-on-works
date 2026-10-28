import { and, eq, isNotNull, isNull, like } from "drizzle-orm";
import { getDb } from "../server/db";
import { agencies, jobs, users, workerProfiles } from "../drizzle/schema";
import { buildOnWorksRouter } from "../server/routers/buildOnWorks";
import { jobLifecycle } from "../server/jobLifecycle";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  const db = await getDb();
  assert(db, "Database unavailable");
  const openJobs = await db.select().from(jobs).where(like(jobs.description, "[졸업 시연용 가상 일감 · 2026-11]%"));
  assert(openJobs.length === 24, "Expected 24 presentation jobs");
  const dateCounts: Record<string, number> = {};
  for (const job of openJobs) {
    const day = job.jobDate.toISOString().slice(0, 10);
    dateCounts[day] = (dateCounts[day] ?? 0) + 1;
  }
  assert(Object.keys(dateCounts).length === 12 && Object.values(dateCounts).every(n => n === 2), "Expected two jobs per day, November 3–14");
  assert(dateCounts["2026-11-03"] === 2 && dateCounts["2026-11-14"] === 2, "Invalid demonstration date range");

  const [managerRow] = await db.select({ agency: agencies }).from(agencies).innerJoin(users, eq(agencies.managerId, users.id)).where(and(isNull(agencies.deletedAt), eq(users.loginMethod, "phone-password"), isNotNull(users.passwordHash))).limit(1);
  const managerAgency = managerRow?.agency;
  assert(managerAgency, "No manager agency available");
  const caller = buildOnWorksRouter.createCaller({ user: { id: managerAgency.managerId } } as any);
  const blacklisted = await caller.trust.blacklistedWorkers();
  const demoBlacklist = blacklisted.filter(row => row.user.name?.startsWith("[시연]"));
  assert(demoBlacklist.length === 2, "Expected two demo blacklisted workers");
  assert(demoBlacklist.map(row => row.trust.noShowCount).sort().join(",") === "4,5", "Expected 4 / 5 no-show counts");
  assert(demoBlacklist.every(row => row.trust.reports.length === row.trust.noShowCount), "Archived no-show reports must remain readable");

  const [excellentUser] = await db.select().from(users).where(eq(users.openId, "demo:graduation-2026:excellent-five"));
  assert(excellentUser && excellentUser.phone === null && excellentUser.passwordHash === null, "Demo identity must not have real credentials");
  const [excellentProfile] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, excellentUser.id));
  assert(excellentProfile, "Missing excellent demo profile");
  const excellent = await caller.trust.workerSummary({ workerId: excellentProfile.id });
  const history = await caller.workHistory.managerWorker({ workerId: excellentProfile.id });
  assert(excellent.isExcellent && excellent.excellentStreak === 5, "Expected five consecutive excellent reviews");
  assert(history.totalCompleted === 5, "All five old completed jobs must remain in permanent work history");

  const [realWorker] = await db.select().from(users).where(and(eq(users.accountRole, "WORKER"), eq(users.loginMethod, "phone-password"))).limit(1);
  assert(realWorker, "No original worker available for read-only checks");
  const workerCaller = buildOnWorksRouter.createCaller({ user: { id: realWorker.id } } as any);
  const discovery = await workerCaller.jobs.discover();
  assert(discovery.filter(row => row.job.description?.startsWith("[졸업 시연용 가상 일감 · 2026-11]")).length === 24, "Worker discovery must display all presentation jobs today");
  const pastJob = (await db.select().from(jobs).where(eq(jobs.status, "RECRUITING"))).find(job => jobLifecycle(job.jobDate).isPast);
  if (pastJob) {
    let blocked = false;
    try { await workerCaller.jobs.submitApplication({ jobId: pastJob.id }); }
    catch (error) { blocked = error instanceof Error && error.message === "날짜가 지난 일감은 신청할 수 없습니다."; }
    assert(blocked, "Real API must block past jobs without inserting an application");
  }

  console.log(JSON.stringify({ dateCounts, demoBlacklist: demoBlacklist.map(row => ({ name: row.user.name, noShows: row.trust.noShowCount, isBlacklisted: row.trust.isBlacklisted, banUntil: row.trust.applicationBanUntil, reportsPreserved: row.trust.reports.length })), excellentDemo: { name: excellentUser.name, streak: excellent.excellentStreak, completedHistory: history.totalCompleted, agencies: history.agencies.length }, presentationDateChecks: ["2026-11-05", "2026-11-12"].map(day => ({ day, applyEligibleJobsByDate: openJobs.filter(job => !jobLifecycle(job.jobDate, new Date(`${day}T03:00:00Z`)).isPast).length, retainedListings: openJobs.filter(job => !jobLifecycle(job.jobDate, new Date(`${day}T03:00:00Z`)).hideFromListings).length })), actualWorkerPastApplicationBlocked: !!pastJob }, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error instanceof Error ? error.message : "Demo verification failed"); process.exit(1); });
