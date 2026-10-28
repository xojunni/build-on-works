import { randomBytes } from "node:crypto";
import { chmod, lstat, open, readFile, writeFile } from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import { jobs, paymentRecords, users, workerProfiles } from "../drizzle/schema";
import { getDb } from "../server/db";
import { cleanGeneratedJobDescription } from "../server/demoDataFormat";
import { hashPassword, verifyPassword } from "../server/routers/phoneAuth";

const MANIFEST_PATH = "/home/ubuntu/.demo-manifest-2026.json";
const CREDENTIALS_PATH = "/home/ubuntu/.bow-demo-credentials.json";
const BACKUP_PATH = "/home/ubuntu/.bow-before-demo-refinement.json";
const DEMO_OPEN_ID_PREFIX = "demo:graduation-2026:";
const FILE_MODE = 0o600;

const WORKER_DETAILS = [
  {
    slug: "blacklist-four",
    name: "김도현",
    birthDate: "1990-03-14",
    phone: "01000007101",
    certificate: "321-2021-7101",
    bankName: "국민은행",
    bankAccount: "00000000007101",
  },
  {
    slug: "blacklist-five",
    name: "박지훈",
    birthDate: "1986-11-22",
    phone: "01000007102",
    certificate: "322-2020-7102",
    bankName: "신한은행",
    bankAccount: "00000000007102",
  },
  {
    slug: "caution-two",
    name: "이서연",
    birthDate: "1996-06-09",
    phone: "01000007103",
    certificate: "323-2024-7103",
    bankName: "농협은행",
    bankAccount: "00000000007103",
  },
  {
    slug: "excellent-five",
    name: "최민석",
    birthDate: "1992-08-17",
    phone: "01000007104",
    certificate: "324-2022-7104",
    bankName: "우리은행",
    bankAccount: "00000000007104",
  },
] as const;

type Manifest = {
  seed: string;
  demoIdentityPrefix: string;
  refinedAt?: string;
  ids: {
    users: number[];
    workerProfiles: number[];
    openJobs: number[];
    historyJobs: number[];
    paymentRecords: number[];
  };
};

type WorkerTarget = (typeof WORKER_DETAILS)[number] & {
  userId: number;
  workerId: number;
};

type CredentialAccount = {
  userId: number;
  workerId: number;
  slug: string;
  name: string;
  phone: string;
  password: string;
};

type CredentialFile = {
  accounts: CredentialAccount[];
};

type BackupFile = {
  version: 1;
  createdAt: string;
  users: unknown[];
  workerProfiles: unknown[];
  jobs: unknown[];
  paymentRecords: unknown[];
};

type UserUpdate = {
  id: number;
  before: typeof users.$inferSelect;
  values: {
    openId?: string;
    name?: string;
    phone?: string;
    passwordHash?: string;
    loginMethod?: string;
  };
};

type WorkerProfileUpdate = {
  id: number;
  before: typeof workerProfiles.$inferSelect;
  values: {
    birthDate?: Date;
    certificate?: string;
    phone?: string;
    bankName?: string;
    bankAccount?: string;
  };
};

type JobUpdate = {
  id: number;
  before: typeof jobs.$inferSelect;
  description: string | null;
};

type PaymentUpdate = {
  id: number;
  before: typeof paymentRecords.$inferSelect;
  description: string;
};

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === code;
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requireExactIdList(value: unknown, expectedLength: number, message: string): asserts value is number[] {
  requireCondition(Array.isArray(value) && value.length === expectedLength, message);
  requireCondition(value.every(id => Number.isSafeInteger(id) && id > 0), message);
  requireCondition(new Set(value).size === value.length, message);
}

function readManifest(value: unknown): Manifest {
  requireCondition(typeof value === "object" && value !== null, "The demo manifest is invalid.");
  const manifest = value as Partial<Manifest>;
  requireCondition(manifest.seed === "graduation-demo-2026", "The demo manifest does not identify the graduation seed.");
  requireCondition(manifest.demoIdentityPrefix === DEMO_OPEN_ID_PREFIX, "The demo manifest identity prefix is unexpected.");
  requireCondition(manifest.refinedAt === undefined || typeof manifest.refinedAt === "string", "The demo manifest refinement timestamp is invalid.");
  requireCondition(typeof manifest.ids === "object" && manifest.ids !== null, "The demo manifest has no record IDs.");

  const ids = manifest.ids as Manifest["ids"];
  requireExactIdList(ids.users, WORKER_DETAILS.length, "The demo manifest user IDs are invalid.");
  requireExactIdList(ids.workerProfiles, WORKER_DETAILS.length, "The demo manifest worker profile IDs are invalid.");
  requireExactIdList(ids.openJobs, 24, "The demo manifest open-job IDs are invalid.");
  requireExactIdList(ids.historyJobs, 16, "The demo manifest history-job IDs are invalid.");
  requireExactIdList(ids.paymentRecords, 5, "The demo manifest payment IDs are invalid.");

  return {
    seed: manifest.seed,
    demoIdentityPrefix: manifest.demoIdentityPrefix,
    refinedAt: manifest.refinedAt,
    ids,
  };
}

async function loadManifest(): Promise<Manifest> {
  return readManifest(JSON.parse(await readFile(MANIFEST_PATH, "utf8")));
}

function credentialAccountsFor(workers: readonly WorkerTarget[]): CredentialAccount[] {
  return workers.map(worker => ({
    userId: worker.userId,
    workerId: worker.workerId,
    slug: worker.slug,
    name: worker.name,
    phone: worker.phone,
    password: `Bow!${randomBytes(9).toString("base64url")}`,
  }));
}

function readCredentialFile(value: unknown, workers: readonly WorkerTarget[]): CredentialFile {
  requireCondition(typeof value === "object" && value !== null, "The private credential file is invalid.");
  const candidate = value as Partial<CredentialFile>;
  requireCondition(Array.isArray(candidate.accounts) && candidate.accounts.length === workers.length, "The private credential file is incomplete.");

  const accountsByUserId = new Map<number, CredentialAccount>();
  for (const account of candidate.accounts) {
    requireCondition(typeof account === "object" && account !== null, "The private credential file is invalid.");
    const typed = account as Partial<CredentialAccount>;
    requireCondition(
      Number.isSafeInteger(typed.userId)
        && Number.isSafeInteger(typed.workerId)
        && typeof typed.slug === "string"
        && typeof typed.name === "string"
        && typeof typed.phone === "string"
        && typeof typed.password === "string"
        && typed.password.length >= 16
        && typed.password.length <= 72,
      "The private credential file is invalid.",
    );
    requireCondition(!accountsByUserId.has(typed.userId), "The private credential file has duplicate users.");
    accountsByUserId.set(typed.userId, typed as CredentialAccount);
  }

  for (const worker of workers) {
    const account = accountsByUserId.get(worker.userId);
    requireCondition(
      account
        && account.workerId === worker.workerId
        && account.slug === worker.slug
        && account.name === worker.name
        && account.phone === worker.phone,
      "The private credential file is for different users.",
    );
  }

  return { accounts: [...accountsByUserId.values()] };
}

function passwordForUser(credentials: CredentialFile, userId: number): string {
  const account = credentials.accounts.find(candidate => candidate.userId === userId);
  requireCondition(account, "A seeded user has no private credential.");
  return account.password;
}

async function readExistingPrivateJson(path: string): Promise<unknown | undefined> {
  try {
    const stats = await lstat(path);
    requireCondition(stats.isFile() && !stats.isSymbolicLink(), "A private refinement file is not a regular file.");
    await chmod(path, FILE_MODE);
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (isErrno(error, "ENOENT")) return undefined;
    throw error;
  }
}

async function createPrivateJsonOnce(path: string, value: unknown): Promise<boolean> {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(path, "wx", FILE_MODE);
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await file.sync();
    return true;
  } catch (error) {
    if (isErrno(error, "EEXIST")) return false;
    throw error;
  } finally {
    await file?.close();
  }
}

async function loadOrCreateCredentials(workers: readonly WorkerTarget[]): Promise<CredentialFile> {
  const existing = await readExistingPrivateJson(CREDENTIALS_PATH);
  if (existing !== undefined) return readCredentialFile(existing, workers);

  const generated: CredentialFile = { accounts: credentialAccountsFor(workers) };
  if (await createPrivateJsonOnce(CREDENTIALS_PATH, generated)) return generated;

  const racedFile = await readExistingPrivateJson(CREDENTIALS_PATH);
  requireCondition(racedFile !== undefined, "The private credential file could not be created.");
  return readCredentialFile(racedFile, workers);
}

function assertBackupRows(rows: unknown[], allowedIds: readonly number[], label: string): void {
  const allowed = new Set(allowedIds);
  const seen = new Set<number>();
  for (const row of rows) {
    requireCondition(typeof row === "object" && row !== null && "id" in row, "The private backup file is invalid.");
    const id = (row as { id?: unknown }).id;
    requireCondition(Number.isSafeInteger(id) && allowed.has(id), `The private backup has an unrelated ${label} row.`);
    requireCondition(!seen.has(id), "The private backup file has duplicate rows.");
    seen.add(id);
  }
}

function readBackupFile(value: unknown, manifest: Manifest): BackupFile {
  requireCondition(typeof value === "object" && value !== null, "The private backup file is invalid.");
  const candidate = value as Partial<BackupFile>;
  requireCondition(
    candidate.version === 1
      && typeof candidate.createdAt === "string"
      && Array.isArray(candidate.users)
      && Array.isArray(candidate.workerProfiles)
      && Array.isArray(candidate.jobs)
      && Array.isArray(candidate.paymentRecords),
    "The private backup file is invalid.",
  );
  assertBackupRows(candidate.users, manifest.ids.users, "user");
  assertBackupRows(candidate.workerProfiles, manifest.ids.workerProfiles, "worker profile");
  assertBackupRows(candidate.jobs, [...manifest.ids.openJobs, ...manifest.ids.historyJobs], "job");
  assertBackupRows(candidate.paymentRecords, manifest.ids.paymentRecords, "payment");
  return candidate as BackupFile;
}

async function writeBackupOnce(backup: BackupFile, manifest: Manifest): Promise<void> {
  const existing = await readExistingPrivateJson(BACKUP_PATH);
  if (existing !== undefined) {
    readBackupFile(existing, manifest);
    return;
  }

  if (await createPrivateJsonOnce(BACKUP_PATH, backup)) return;

  const racedFile = await readExistingPrivateJson(BACKUP_PATH);
  requireCondition(racedFile !== undefined, "The private backup file could not be created.");
  readBackupFile(racedFile, manifest);
}

function sameDate(value: Date | string | null, expected: string): boolean {
  if (value instanceof Date) return value.toISOString().slice(0, 10) === expected;
  return value === expected;
}

function cleanPaymentDescription(description: string | null): string {
  if (description === "일급 정산") return description;
  requireCondition(
    typeof description === "string" && /^\[졸업 시연용 가상 지급\]\s+graduation-excellent-[\s\S]*$/.test(description),
    "A seeded payment description is unexpected.",
  );
  return "일급 정산";
}

function passwordMatches(password: string, storedHash: string | null): boolean {
  try {
    return verifyPassword(password, storedHash);
  } catch {
    return false;
  }
}

async function stampManifestRefined(): Promise<void> {
  const value: unknown = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const manifest = readManifest(value);
  if (manifest.refinedAt !== undefined) return;

  requireCondition(typeof value === "object" && value !== null && !Array.isArray(value), "The demo manifest is invalid.");
  const document = value as Record<string, unknown>;
  document.refinedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

async function refine(): Promise<{ users: number; workerProfiles: number; jobs: number; paymentRecords: number }> {
  const manifest = await loadManifest();
  const db = await getDb();
  requireCondition(db, "Database access is not available.");

  const jobIds = [...manifest.ids.openJobs, ...manifest.ids.historyJobs];
  requireCondition(new Set(jobIds).size === jobIds.length, "The demo manifest job IDs overlap.");

  return db.transaction(async tx => {
    const [seededUsers, seededProfiles, seededJobs, seededPayments] = await Promise.all([
      tx.select().from(users).where(inArray(users.id, manifest.ids.users)),
      tx.select().from(workerProfiles).where(inArray(workerProfiles.id, manifest.ids.workerProfiles)),
      tx.select().from(jobs).where(inArray(jobs.id, jobIds)),
      tx.select().from(paymentRecords).where(inArray(paymentRecords.id, manifest.ids.paymentRecords)),
    ]);

    requireCondition(seededUsers.length === manifest.ids.users.length, "One or more seeded users are missing.");
    requireCondition(seededProfiles.length === manifest.ids.workerProfiles.length, "One or more seeded worker profiles are missing.");
    requireCondition(seededJobs.length === jobIds.length, "One or more seeded jobs are missing.");
    requireCondition(seededPayments.length === manifest.ids.paymentRecords.length, "One or more seeded payment records are missing.");

    const workers: WorkerTarget[] = WORKER_DETAILS.map((detail, index) => ({
      ...detail,
      userId: manifest.ids.users[index],
      workerId: manifest.ids.workerProfiles[index],
    }));
    const phoneToUserId = new Map(workers.map(worker => [worker.phone, worker.userId]));
    const openIdToUserId = new Map(workers.map(worker => [`phone:${worker.phone}`, worker.userId]));

    const [phoneCollisions, openIdCollisions] = await Promise.all([
      tx.select({ id: users.id, phone: users.phone }).from(users).where(inArray(users.phone, workers.map(worker => worker.phone))),
      tx.select({ id: users.id, openId: users.openId }).from(users).where(inArray(users.openId, workers.map(worker => `phone:${worker.phone}`))),
    ]);

    for (const row of phoneCollisions) {
      requireCondition(row.phone !== null && phoneToUserId.get(row.phone) === row.id, "A target phone belongs to another user.");
    }
    for (const row of openIdCollisions) {
      requireCondition(openIdToUserId.get(row.openId) === row.id, "A target open ID belongs to another user.");
    }

    const usersById = new Map(seededUsers.map(row => [row.id, row]));
    const profilesById = new Map(seededProfiles.map(row => [row.id, row]));
    for (const worker of workers) {
      const user = usersById.get(worker.userId);
      const profile = profilesById.get(worker.workerId);
      requireCondition(user, "A seeded user could not be loaded.");
      requireCondition(profile && profile.userId === worker.userId, "A seeded worker profile does not belong to its expected user.");
      requireCondition(
        user.openId === `${DEMO_OPEN_ID_PREFIX}${worker.slug}` || user.openId === `phone:${worker.phone}`,
        "A seeded user identity is unexpected.",
      );
    }

    const credentials = await loadOrCreateCredentials(workers);
    const userUpdates: UserUpdate[] = [];
    const profileUpdates: WorkerProfileUpdate[] = [];

    for (const worker of workers) {
      const user = usersById.get(worker.userId)!;
      const profile = profilesById.get(worker.workerId)!;
      const password = passwordForUser(credentials, worker.userId);
      const expectedOpenId = `phone:${worker.phone}`;
      const userValues: UserUpdate["values"] = {};
      if (user.openId !== expectedOpenId) userValues.openId = expectedOpenId;
      if (user.name !== worker.name) userValues.name = worker.name;
      if (user.phone !== worker.phone) userValues.phone = worker.phone;
      if (user.loginMethod !== "phone-password") userValues.loginMethod = "phone-password";
      if (!passwordMatches(password, user.passwordHash)) userValues.passwordHash = hashPassword(password);
      if (Object.keys(userValues).length > 0) userUpdates.push({ id: user.id, before: user, values: userValues });

      const profileValues: WorkerProfileUpdate["values"] = {};
      if (!sameDate(profile.birthDate, worker.birthDate)) profileValues.birthDate = new Date(`${worker.birthDate}T00:00:00.000Z`);
      if (profile.phone !== worker.phone) profileValues.phone = worker.phone;
      if (profile.certificate !== worker.certificate) profileValues.certificate = worker.certificate;
      if (profile.bankName !== worker.bankName) profileValues.bankName = worker.bankName;
      if (profile.bankAccount !== worker.bankAccount) profileValues.bankAccount = worker.bankAccount;
      if (Object.keys(profileValues).length > 0) profileUpdates.push({ id: profile.id, before: profile, values: profileValues });
    }

    const jobUpdates: JobUpdate[] = seededJobs.flatMap(job => {
      const description = cleanGeneratedJobDescription(job.description);
      return description === job.description ? [] : [{ id: job.id, before: job, description }];
    });
    const paymentUpdates: PaymentUpdate[] = seededPayments.flatMap(payment => {
      const description = cleanPaymentDescription(payment.description);
      return description === payment.description ? [] : [{ id: payment.id, before: payment, description }];
    });

    if (userUpdates.length + profileUpdates.length + jobUpdates.length + paymentUpdates.length > 0) {
      await writeBackupOnce({
        version: 1,
        createdAt: new Date().toISOString(),
        users: userUpdates.map(update => update.before),
        workerProfiles: profileUpdates.map(update => update.before),
        jobs: jobUpdates.map(update => update.before),
        paymentRecords: paymentUpdates.map(update => update.before),
      }, manifest);
    }

    for (const update of userUpdates) {
      await tx.update(users).set(update.values).where(eq(users.id, update.id));
    }
    for (const update of profileUpdates) {
      await tx.update(workerProfiles).set(update.values).where(eq(workerProfiles.id, update.id));
    }
    for (const update of jobUpdates) {
      await tx.update(jobs).set({ description: update.description }).where(eq(jobs.id, update.id));
    }
    for (const update of paymentUpdates) {
      await tx.update(paymentRecords).set({ description: update.description }).where(eq(paymentRecords.id, update.id));
    }

    return {
      users: userUpdates.length,
      workerProfiles: profileUpdates.length,
      jobs: jobUpdates.length,
      paymentRecords: paymentUpdates.length,
    };
  });
}

async function main(): Promise<void> {
  const counts = await refine();
  await stampManifestRefined();
  console.log(
    `Graduation demo refinement complete: users=${counts.users}, workerProfiles=${counts.workerProfiles}, jobs=${counts.jobs}, paymentRecords=${counts.paymentRecords}`,
  );
}

main().then(() => process.exit(0)).catch(() => {
  console.error("Graduation demo refinement did not complete cleanly.");
  process.exit(1);
});
