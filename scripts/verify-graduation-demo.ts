import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../server/db";
import * as schema from "../drizzle/schema";
import { buildOnWorksRouter } from "../server/routers/buildOnWorks";
import { phoneAuthRouter, verifyPassword } from "../server/routers/phoneAuth";
import { sdk } from "../server/_core/sdk";
import { jobLifecycle } from "../server/jobLifecycle";
import { ageFromBirthDate, maskBankAccount } from "../server/workerDetail";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const manifest = JSON.parse(readFileSync("/home/ubuntu/.demo-manifest-2026.json", "utf8"));
const { agencies, jobs, users, workerProfiles } = schema;

type Credential = { userId: number; workerId: number; slug: string; name: string; phone: string; password: string };
async function main() {
  const db = await getDb();
  assert(db, "Database unavailable");
  const openJobs = await db.select().from(jobs).where(inArray(jobs.id, manifest.ids.openJobs));
  const historyJobs = await db.select().from(jobs).where(inArray(jobs.id, manifest.ids.historyJobs));
  assert(openJobs.length === 24 && historyJobs.length === 16, "Generated jobs must remain intact");
  assert([...openJobs, ...historyJobs].every(job => !/시연|시나리오|graduation-/.test(job.description ?? "")), "Visible generated labels remain");
  const dateCounts: Record<string, number> = {};
  for (const job of openJobs) { const day = job.jobDate.toISOString().slice(0, 10); dateCounts[day] = (dateCounts[day] ?? 0) + 1; }
  assert(Object.keys(dateCounts).length === 12 && Object.values(dateCounts).every(n => n === 2) && dateCounts["2026-11-03"] === 2 && dateCounts["2026-11-14"] === 2, "Expected two jobs daily on November 3–14");

  const before = JSON.parse(readFileSync("/home/ubuntu/.bow-reputation-before-refinement.json", "utf8"));
  const configurations = [
    ["memberships", schema.workerAgencyMemberships, manifest.ids.memberships],
    ["assignments", schema.jobAssignments, [...manifest.ids.noShowAssignments, ...manifest.ids.completedAssignments]],
    ["attendance", schema.attendanceRecords, manifest.ids.attendanceRecords],
    ["managerReviews", schema.managerWorkerReviews, manifest.ids.managerWorkerReviews],
    ["agencyReviews", schema.workerAgencyReviews, manifest.ids.workerAgencyReviews],
    ["noShows", schema.noShowReports, manifest.ids.noShowReports],
  ] as const;
  for (const [name, table, ids] of configurations) {
    const rows = await db.select().from(table as any).where(inArray((table as any).id, ids)).orderBy((table as any).id);
    const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    assert(rows.length === before[name].count && hash === before[name].hash, `Existing generated ${name} changed unexpectedly`);
  }

  const [managerRow] = await db.select({ agency: agencies }).from(agencies).innerJoin(users, eq(agencies.managerId, users.id)).where(and(isNull(agencies.deletedAt), eq(users.loginMethod, "phone-password"), isNotNull(users.passwordHash))).limit(1);
  assert(managerRow, "Manager unavailable");
  const managerCaller = buildOnWorksRouter.createCaller({ user: { id: managerRow.agency.managerId } } as any);
  const credentials = JSON.parse(readFileSync("/home/ubuntu/.bow-demo-credentials.json", "utf8")).accounts as Credential[];
  assert(credentials.length === 4, "Expected four login accounts");
  const results = [];
  for (const credential of credentials) {
    const [user] = await db.select().from(users).where(eq(users.id, credential.userId));
    const [profile] = await db.select().from(workerProfiles).where(eq(workerProfiles.id, credential.workerId));
    assert(user && profile && profile.userId === user.id, "Account/profile IDs changed");
    assert(user.name === credential.name && !user.name?.includes("시연") && user.phone === credential.phone && user.openId === `phone:${credential.phone}` && user.loginMethod === "phone-password", "Phone identity conversion failed");
    assert(verifyPassword(credential.password, user.passwordHash), "Generated password verification failed");
    assert(profile.birthDate && profile.phone && profile.certificate && profile.bankName && profile.bankAccount, "Required profile fields missing");
    const cookies: Array<{ name: string; value: string }> = [];
    const auth = phoneAuthRouter.createCaller({ user: null, req: { hostname: "preview.manus.computer", protocol: "https", headers: {} }, res: { cookie: (name: string, value: string) => cookies.push({ name, value }) } } as any);
    const login = await auth.login({ phone: credential.phone, password: credential.password });
    assert(login.success && login.accountRole === "WORKER" && cookies.length > 0 && login.sessionToken, "Actual phone login failed");
    const session = await sdk.verifySession(login.sessionToken);
    assert(session?.openId === user.openId, "Login session belongs to wrong account");
    const workerCaller = buildOnWorksRouter.createCaller({ user: { id: user.id } } as any);
    const [trust, history] = await Promise.all([workerCaller.trust.mine(), workerCaller.workHistory.mine()]);
    const expectedNoShows: Record<string, number> = { "blacklist-four": 4, "blacklist-five": 5, "caution-two": 2, "excellent-five": 0 };
    assert(trust.noShowCount === expectedNoShows[credential.slug], "No-show record changed");
    if (credential.slug === "excellent-five") assert(trust.isExcellent && history.totalCompleted === 5, "Excellent worker history changed");
    if (credential.slug.startsWith("blacklist")) assert(trust.isBlacklisted && trust.isApplicationBanned, "Blacklist or ban state changed");
    results.push({ name: user.name, phone: user.phone, birthDate: profile.birthDate.toISOString().slice(0, 10), age: ageFromBirthDate(profile.birthDate), bank: profile.bankName, maskedAccount: maskBankAccount(profile.bankAccount), loggedIn: true, noShows: trust.noShowCount, blacklisted: trust.isBlacklisted, excellent: trust.isExcellent, completed: history.totalCompleted });
    // Short-lived verification session only. No passwords are included here.
    const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: 300_000 });
    writeFileSync(`/tmp/bow-refined-${credential.slug}.session`, token, { mode: 0o600 });
  }
  const blacklisted = await managerCaller.trust.blacklistedWorkers();
  assert(blacklisted.filter(row => manifest.ids.workerProfiles.includes(row.profile.id)).length === 2, "Manager blacklist disappeared");
  const discovery = await buildOnWorksRouter.createCaller({ user: { id: credentials[2].userId } } as any).jobs.discover({ period: "CURRENT" });
  assert(discovery.filter(row => manifest.ids.openJobs.includes(row.job.id)).length === 24, "Current generated jobs missing");
  console.log(JSON.stringify({ visibleLabelsRemoved: true, generatedHistoricalRecordsPreserved: true, dateCounts, accounts: results }, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error instanceof Error ? error.message : "Verification failed"); process.exit(1); });
