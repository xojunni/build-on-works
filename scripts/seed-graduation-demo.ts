import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, isNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import {
  agencies,
  attendanceRecords,
  jobAssignments,
  jobs,
  managerWorkerReviews,
  noShowReports,
  paymentRecords,
  users,
  workerAgencyMemberships,
  workerAgencyReviews,
  workerProfiles,
} from "../drizzle/schema";
import * as schema from "../drizzle/schema";

/**
 * Graduation demo seed for the 2026-11 demonstration.
 *
 * Run manually only after review:
 *   DATABASE_URL='…' pnpm exec tsx scripts/seed-graduation-demo.ts
 *
 * This script intentionally performs no update or delete. It either inserts missing
 * demo rows or verifies the exact safe demo rows already created by a prior run.
 */

const DEMO_OPEN_ID_PREFIX = "demo:graduation-2026:";
const DEMO_LOGIN_METHOD = "graduation-demo";
const OPEN_JOB_MARKER = "[졸업 시연용 가상 일감 · 2026-11]";
const HISTORY_MARKER = "[졸업 시연용 가상 이력 · 2026-10]";
const MANIFEST_PATH = join(
  process.env.HOME || "/home/ubuntu",
  ".demo-manifest-2026.json"
);

const DEMO_WORKERS = [
  { slug: "blacklist-four", name: "[시연] 김도현" },
  { slug: "blacklist-five", name: "[시연] 박지훈" },
  { slug: "caution-two", name: "[시연] 이서연" },
  { slug: "excellent-five", name: "[시연] 최민석" },
] as const;

type DemoWorker = (typeof DEMO_WORKERS)[number];
type ActiveAgency = {
  id: number;
  managerId: number;
  name: string;
  region: string;
};
type SourceLocation = {
  agencyId: number;
  region: string;
  address: string;
  siteLatitude: number;
  siteLongitude: number;
  geofenceRadiusMeters: number;
  siteGeocodedAt: Date | null;
};
type WorkTemplate = { title: string; detail: string };
type JobSpec = {
  agency: ActiveAgency;
  title: string;
  description: string;
  marker: string;
  scenarioKey: string;
  jobDate: Date;
  region: string;
  address: string | null;
  siteLatitude: number | null;
  siteLongitude: number | null;
  geofenceRadiusMeters: number;
  siteGeocodedAt: Date | null;
  requiredWorkers: number;
  dailyWage: number;
  status: "RECRUITING" | "CLOSED";
  createdAt: Date;
  updatedAt: Date;
};

const WORK_TEMPLATES: Record<string, WorkTemplate[]> = {
  construction: [
    {
      title: "자재 운반 및 현장 정리 보조",
      detail: "자재 적재 위치를 정리하고 반장 지시에 따라 현장 동선을 보조",
    },
    {
      title: "콘크리트 타설 보조",
      detail: "타설 구간 주변 정리와 장비·자재 전달을 보조",
    },
    {
      title: "내부 마감 자재 정리 보조",
      detail: "마감 자재 분류와 층별 운반, 작업 구역 정리를 보조",
    },
    {
      title: "철근 자재 정리 및 운반 보조",
      detail: "철근 자재 적치와 작업 구역 주변 정리를 보조",
    },
    {
      title: "배관 굴착 현장 보조",
      detail: "굴착 구간 안전 정리와 자재 운반을 보조",
    },
    {
      title: "외벽 비계 자재 정리 보조",
      detail: "비계 자재 분류와 현장 안전 통로 정리를 보조",
    },
  ],
  logistics: [
    {
      title: "물류센터 입출고 상하차 보조",
      detail: "입고 상품 상하차와 지정 구역 적치를 보조",
    },
    {
      title: "파렛트 분류 및 적치 보조",
      detail: "출고 구역별 파렛트 분류와 적치 작업을 보조",
    },
    {
      title: "신선식품 포장 및 출고 보조",
      detail: "포장 자재 준비와 출고 대기 상품 정리를 보조",
    },
    {
      title: "택배 분류장 간선 상차 보조",
      detail: "배송 권역별 분류와 간선 상차 준비를 보조",
    },
  ],
  cleaning: [
    {
      title: "상가 공용부 청소 보조",
      detail: "공용 통로와 계단 청소, 폐기물 분리수거를 보조",
    },
    {
      title: "준공 현장 정리 청소 보조",
      detail: "준공 전 실내 정리와 바닥·창호 주변 청소를 보조",
    },
    {
      title: "사무시설 정기 청소 보조",
      detail: "사무시설 공용 공간 청소와 소모품 보충을 보조",
    },
    {
      title: "주차장 환경 정비 보조",
      detail: "주차 구역 정리와 바닥 청소, 안내 표지 정비를 보조",
    },
  ],
  manufacturing: [
    {
      title: "생산라인 포장 보조",
      detail: "완제품 포장과 박스 적재, 라인 주변 정리를 보조",
    },
    {
      title: "부품 검수 및 분류 보조",
      detail: "입고 부품 수량 확인과 규격별 분류를 보조",
    },
    {
      title: "공장 출고 준비 보조",
      detail: "출고 제품 라벨 부착과 파렛트 적재를 보조",
    },
    {
      title: "조립 공정 자재 공급 보조",
      detail: "조립 라인 자재 공급과 작업대 정리를 보조",
    },
  ],
  agriculture: [
    {
      title: "농산물 선별 및 포장 보조",
      detail: "수확 농산물 선별과 포장 박스 정리를 보조",
    },
    {
      title: "비닐하우스 작물 관리 보조",
      detail: "작물 주변 정리와 수확 상자 운반을 보조",
    },
    {
      title: "농산물 출하 상차 보조",
      detail: "출하 물량 분류와 차량 상차 준비를 보조",
    },
    {
      title: "축사 주변 환경 정리 보조",
      detail: "축사 통로 정리와 사료 자재 운반을 보조",
    },
  ],
  event: [
    {
      title: "행사장 설치 및 철수 보조",
      detail: "행사 집기 운반과 안내 동선 설치·철수를 보조",
    },
    {
      title: "전시장 부스 자재 운반 보조",
      detail: "부스 자재 반입과 전시장 통로 정리를 보조",
    },
    {
      title: "지역행사 운영 정리 보조",
      detail: "행사장 안내물 정리와 운영 물품 배치를 보조",
    },
    {
      title: "공연장 객석 정비 보조",
      detail: "객석 주변 정리와 안내 물품 배치를 보조",
    },
  ],
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

/** MySQL DATE values are represented as midnight UTC, never browser-local midnight. */
function dateAtUtc(date: string) {
  assert(/^2026-\d{2}-\d{2}$/.test(date), `Invalid calendar date: ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

function calendarDate(value: Date | string) {
  return typeof value === "string"
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

/** Creates an instant corresponding to the requested Korea Standard Time (UTC+09:00). */
function koreaTime(date: string, hour: number, minute = 0) {
  const hourText = String(hour).padStart(2, "0");
  const minuteText = String(minute).padStart(2, "0");
  return new Date(`${date}T${hourText}:${minuteText}:00.000+09:00`);
}

function addCalendarDays(date: string, days: number) {
  const result = dateAtUtc(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function assertNotFuture(label: string, timestamp: Date, now: Date) {
  assert(
    timestamp.getTime() <= now.getTime(),
    `${label} must not be later than the real execution time.`
  );
}

function sameInstant(actual: Date | null, expected: Date | null) {
  if (actual === null || expected === null) return actual === expected;
  return actual.getTime() === expected.getTime();
}

function workCategory(agencyName: string) {
  const text = agencyName.replace(/\s+/g, "").toLowerCase();
  if (/(물류|배송|운송|택배|유통)/.test(text)) return "logistics";
  if (/(청소|환경|미화)/.test(text)) return "cleaning";
  if (/(제조|공장|산업|생산)/.test(text)) return "manufacturing";
  if (/(농|축산|영농|과수)/.test(text)) return "agriculture";
  if (/(행사|이벤트|공연|전시|서비스)/.test(text)) return "event";
  return "construction";
}

function workFor(agency: ActiveAgency, sequence: number) {
  const templates =
    WORK_TEMPLATES[workCategory(agency.name)] ?? WORK_TEMPLATES.construction;
  return templates[sequence % templates.length]!;
}

function safeSourceLocation(
  agency: ActiveAgency,
  locationsByAgency: Map<number, SourceLocation>,
  now: Date
) {
  const source = locationsByAgency.get(agency.id);
  if (!source) {
    return {
      region: agency.region,
      address: null,
      siteLatitude: null,
      siteLongitude: null,
      geofenceRadiusMeters: 150,
      siteGeocodedAt: null,
    };
  }

  return {
    region: source.region,
    address: source.address,
    siteLatitude: source.siteLatitude,
    siteLongitude: source.siteLongitude,
    geofenceRadiusMeters: source.geofenceRadiusMeters,
    // Preserve an existing geocode timestamp only when it is not in the future.
    siteGeocodedAt:
      source.siteGeocodedAt && source.siteGeocodedAt.getTime() <= now.getTime()
        ? source.siteGeocodedAt
        : null,
  };
}

function demoOpenId(worker: DemoWorker) {
  return `${DEMO_OPEN_ID_PREFIX}${worker.slug}`;
}

function demoAccountTimestamp() {
  return koreaTime("2026-10-01", 9);
}

function isExpectedDemoAccount(
  user: typeof users.$inferSelect,
  worker: DemoWorker
) {
  return (
    user.openId === demoOpenId(worker) &&
    user.name === worker.name &&
    user.email === null &&
    user.phone === null &&
    user.passwordHash === null &&
    user.accountRole === "WORKER" &&
    user.loginMethod === DEMO_LOGIN_METHOD &&
    user.role === "user"
  );
}

const manifestIds = {
  users: new Set<number>(),
  workerProfiles: new Set<number>(),
  memberships: new Set<number>(),
  openJobs: new Set<number>(),
  historyJobs: new Set<number>(),
  noShowAssignments: new Set<number>(),
  noShowReports: new Set<number>(),
  completedAssignments: new Set<number>(),
  attendanceRecords: new Set<number>(),
  paymentRecords: new Set<number>(),
  managerWorkerReviews: new Set<number>(),
  workerAgencyReviews: new Set<number>(),
};

type ManifestBucket = keyof typeof manifestIds;

function remember(bucket: ManifestBucket, id: number) {
  manifestIds[bucket].add(id);
}

async function writeManifest(now: Date, agencyCount: number) {
  const ids = Object.fromEntries(
    Object.entries(manifestIds).map(([key, values]) => [
      key,
      [...values].sort((a, b) => a - b),
    ])
  );
  const counts = Object.fromEntries(
    Object.entries(manifestIds).map(([key, values]) => [key, values.size])
  );
  const manifest = {
    seed: "graduation-demo-2026",
    generatedAt: now.toISOString(),
    demoIdentityPrefix: DEMO_OPEN_ID_PREFIX,
    markers: { openJobs: OPEN_JOB_MARKER, history: HISTORY_MARKER },
    activeAgencyCount: agencyCount,
    counts,
    ids,
  };
  const temporaryPath = `${MANIFEST_PATH}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryPath, MANIFEST_PATH);
  return counts;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is required to run this seed.");

  let existingManifest: { refinedAt?: string } | null = null;
  try { existingManifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (existingManifest?.refinedAt) fail("These generated accounts were already refined. Do not rerun the original seed; use the manifest-based refinement/verification scripts.");

  const now = new Date();
  const accountTimestamp = demoAccountTimestamp();
  assertNotFuture("Demo account timestamp", accountTimestamp, now);

  // These are the latest no-show events by design. They expire on 2026-11-11,
  // while the workers remain blacklisted until seven post-ban completions exist.
  const noShowDateGroups = [
    {
      workerSlug: "blacklist-four",
      dates: ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"],
    },
    {
      workerSlug: "blacklist-five",
      dates: [
        "2026-10-05",
        "2026-10-09",
        "2026-10-15",
        "2026-10-21",
        "2026-10-27",
      ],
    },
    { workerSlug: "caution-two", dates: ["2026-10-08", "2026-10-19"] },
  ] as const;
  const excellentDates = [
    "2026-10-02",
    "2026-10-07",
    "2026-10-12",
    "2026-10-16",
    "2026-10-22",
  ] as const;

  for (const group of noShowDateGroups) {
    for (const date of group.dates)
      assertNotFuture(`No-show report ${date}`, koreaTime(addCalendarDays(date, 1), 9), now);
  }
  for (const date of excellentDates) {
    assertNotFuture(`Completed attendance ${date}`, koreaTime(date, 19), now);
    assertNotFuture(
      `Manager review ${date}`,
      koreaTime(addCalendarDays(date, 1), 10),
      now
    );
  }

  const pool = createPool(databaseUrl);
  const db = drizzle({ client: pool, schema, mode: "default" });

  try {
    const activeAgencies = await db
      .select({
        id: agencies.id,
        managerId: agencies.managerId,
        name: agencies.name,
        region: agencies.region,
      })
      .from(agencies)
      .where(isNull(agencies.deletedAt))
      .orderBy(agencies.id);
    assert(
      activeAgencies.length > 0,
      "At least one nondeleted agency is required before seeding demo data."
    );

    const sourceRows = await db
      .select({
        id: jobs.id,
        agencyId: jobs.agencyId,
        region: jobs.region,
        address: jobs.address,
        siteLatitude: jobs.siteLatitude,
        siteLongitude: jobs.siteLongitude,
        geofenceRadiusMeters: jobs.geofenceRadiusMeters,
        siteGeocodedAt: jobs.siteGeocodedAt,
      })
      .from(jobs)
      .orderBy(jobs.id);

    // Exact coordinates are copied only from a pre-existing job that also has its
    // own address and region. Agencies without this source use no coordinates and
    // no simulated address.
    const sourceLocations = new Map<number, SourceLocation>();
    for (const row of sourceRows) {
      if (sourceLocations.has(row.agencyId)) continue;
      if (
        typeof row.address !== "string" ||
        !row.address.trim() ||
        !row.region.trim() ||
        row.siteLatitude === null ||
        row.siteLongitude === null ||
        !Number.isFinite(row.siteLatitude) ||
        !Number.isFinite(row.siteLongitude)
      ) {
        continue;
      }
      sourceLocations.set(row.agencyId, {
        agencyId: row.agencyId,
        region: row.region,
        address: row.address,
        siteLatitude: row.siteLatitude,
        siteLongitude: row.siteLongitude,
        geofenceRadiusMeters: row.geofenceRadiusMeters,
        siteGeocodedAt: row.siteGeocodedAt,
      });
    }

    const profilesBySlug = new Map<
      string,
      { userId: number; workerId: number }
    >();

    // Batch 1: every demo identity, profile and active multi-agency membership.
    await db.transaction(async tx => {
      for (const worker of DEMO_WORKERS) {
        const openId = demoOpenId(worker);
        const existingUsers = await tx
          .select()
          .from(users)
          .where(eq(users.openId, openId))
          .limit(2);
        assert(
          existingUsers.length <= 1,
          `Ambiguous demo account identity for ${worker.slug}.`
        );

        let user = existingUsers[0];
        if (user) {
          assert(
            isExpectedDemoAccount(user, worker),
            `Existing ${worker.slug} account is not this safe demo identity.`
          );
        } else {
          await tx.insert(users).values({
            openId,
            name: worker.name,
            email: null,
            phone: null,
            passwordHash: null,
            accountRole: "WORKER",
            loginMethod: DEMO_LOGIN_METHOD,
            role: "user",
            createdAt: accountTimestamp,
            updatedAt: accountTimestamp,
            lastSignedIn: accountTimestamp,
          });
          const inserted = await tx
            .select()
            .from(users)
            .where(eq(users.openId, openId))
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read the inserted demo account for ${worker.slug}.`
          );
          user = inserted[0]!;
        }
        remember("users", user.id);

        const existingProfiles = await tx
          .select()
          .from(workerProfiles)
          .where(eq(workerProfiles.userId, user.id))
          .limit(2);
        assert(
          existingProfiles.length <= 1,
          `Ambiguous worker profile for ${worker.slug}.`
        );
        const primaryAgency = activeAgencies[0]!;

        let profile = existingProfiles[0];
        if (profile) {
          assert(
            profile.agencyId === primaryAgency.id &&
              profile.status === "ACTIVE" &&
              profile.birthDate === null &&
              profile.certificate === null &&
              profile.phone === null &&
              profile.bankName === null &&
              profile.bankAccount === null,
            `Existing profile for ${worker.slug} is not the expected PII-free demo profile.`
          );
        } else {
          await tx.insert(workerProfiles).values({
            userId: user.id,
            agencyId: primaryAgency.id,
            birthDate: null,
            certificate: null,
            phone: null,
            bankName: null,
            bankAccount: null,
            status: "ACTIVE",
            createdAt: accountTimestamp,
            updatedAt: accountTimestamp,
          });
          const inserted = await tx
            .select()
            .from(workerProfiles)
            .where(eq(workerProfiles.userId, user.id))
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read the inserted demo profile for ${worker.slug}.`
          );
          profile = inserted[0]!;
        }
        remember("workerProfiles", profile.id);
        profilesBySlug.set(worker.slug, {
          userId: user.id,
          workerId: profile.id,
        });

        for (const agency of activeAgencies) {
          const memberships = await tx
            .select()
            .from(workerAgencyMemberships)
            .where(
              and(
                eq(workerAgencyMemberships.workerId, profile.id),
                eq(workerAgencyMemberships.agencyId, agency.id)
              )
            )
            .limit(2);
          assert(
            memberships.length <= 1,
            `Ambiguous ${worker.slug} membership at agency ${agency.id}.`
          );

          let membership = memberships[0];
          if (membership) {
            assert(
              membership.status === "ACTIVE",
              `Existing ${worker.slug} membership at agency ${agency.id} is not ACTIVE.`
            );
          } else {
            await tx.insert(workerAgencyMemberships).values({
              workerId: profile.id,
              agencyId: agency.id,
              status: "ACTIVE",
              requestedAt: accountTimestamp,
              respondedAt: accountTimestamp,
              createdAt: accountTimestamp,
              updatedAt: accountTimestamp,
            });
            const inserted = await tx
              .select()
              .from(workerAgencyMemberships)
              .where(
                and(
                  eq(workerAgencyMemberships.workerId, profile.id),
                  eq(workerAgencyMemberships.agencyId, agency.id)
                )
              )
              .limit(2);
            assert(
              inserted.length === 1,
              `Could not read the inserted membership for ${worker.slug}.`
            );
            membership = inserted[0]!;
          }
          remember("memberships", membership.id);
        }
      }
    });

    type JobExecutor = Pick<typeof db, "select" | "insert">;
    const ensureJob = async (tx: JobExecutor, spec: JobSpec) => {
      const matching = await tx
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.agencyId, spec.agency.id),
            eq(jobs.title, spec.title),
            eq(jobs.jobDate, spec.jobDate),
            like(jobs.description, `%${spec.marker}%`)
          )
        )
        .limit(2);
      assert(
        matching.length <= 1,
        `Ambiguous demo job natural key: ${spec.scenarioKey}.`
      );

      let job = matching[0];
      if (job) {
        assert(
          job.description === spec.description &&
            job.status === spec.status &&
            calendarDate(job.jobDate) === calendarDate(spec.jobDate),
          `Existing job for ${spec.scenarioKey} differs from the insert-only demo specification.`
        );
      } else {
        await tx.insert(jobs).values({
          agencyId: spec.agency.id,
          title: spec.title,
          description: spec.description,
          region: spec.region,
          address: spec.address,
          siteLatitude: spec.siteLatitude,
          siteLongitude: spec.siteLongitude,
          geofenceRadiusMeters: spec.geofenceRadiusMeters,
          siteGeocodedAt: spec.siteGeocodedAt,
          jobDate: spec.jobDate,
          startTime: "08:00",
          endTime: "17:00",
          requiredWorkers: spec.requiredWorkers,
          dailyWage: spec.dailyWage,
          status: spec.status,
          createdAt: spec.createdAt,
          updatedAt: spec.updatedAt,
        });
        const inserted = await tx
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.agencyId, spec.agency.id),
              eq(jobs.title, spec.title),
              eq(jobs.jobDate, spec.jobDate),
              eq(jobs.description, spec.description)
            )
          )
          .limit(2);
        assert(
          inserted.length === 1,
          `Could not read the inserted job for ${spec.scenarioKey}.`
        );
        job = inserted[0]!;
      }
      return job;
    };

    const openJobs = Array.from({ length: 12 }, (_, dayOffset) => {
      const date = addCalendarDays("2026-11-03", dayOffset);
      return [0, 1].map(slot => {
        const sequence = dayOffset * 2 + slot;
        const agency = activeAgencies[sequence % activeAgencies.length]!;
        const work = workFor(agency, sequence);
        const location = safeSourceLocation(agency, sourceLocations, now);
        const scenarioKey = `graduation-open-${date}-${slot + 1}`;
        return {
          agency,
          title: work.title,
          description: `${OPEN_JOB_MARKER}\n${agency.name} 관할 ${location.region} 현장입니다. ${work.detail}합니다. 근무 전 안전교육 후 담당 반장 지시에 따라 작업합니다.\n시나리오: ${scenarioKey}`,
          marker: OPEN_JOB_MARKER,
          scenarioKey,
          jobDate: dateAtUtc(date),
          ...location,
          requiredWorkers: 2 + ((sequence * 3) % 5),
          dailyWage: 150_000 + (sequence % 5) * 10_000,
          status: "RECRUITING" as const,
          createdAt: now,
          updatedAt: now,
        } satisfies JobSpec;
      });
    }).flat();
    assert(
      openJobs.length === 24,
      "The future recruiting-job plan must contain exactly 24 jobs."
    );

    // Batch 2: exactly two unassigned recruiting jobs for every 2026-11-03…14 date.
    await db.transaction(async tx => {
      for (const spec of openJobs) {
        const job = await ensureJob(tx, spec);
        const assignments = await tx
          .select()
          .from(jobAssignments)
          .where(eq(jobAssignments.jobId, job.id))
          .limit(1);
        assert(
          assignments.length === 0,
          `Future demo job ${spec.scenarioKey} must remain unassigned.`
        );
        remember("openJobs", job.id);
      }
    });

    const noShowPlans = noShowDateGroups.flatMap((group, workerIndex) =>
      group.dates.map((date, occurrence) => ({
        workerSlug: group.workerSlug,
        date,
        occurrence,
        sequence: workerIndex * 10 + occurrence,
      }))
    );
    assert(
      noShowPlans.length === 11,
      "The no-show history plan must contain 11 assignments."
    );

    // Batch 3: no-show histories only. These assignments never get attendance,
    // payment, completion, or review rows.
    await db.transaction(async tx => {
      for (const plan of noShowPlans) {
        const worker = profilesBySlug.get(plan.workerSlug);
        assert(worker, `Missing demo worker profile for ${plan.workerSlug}.`);
        const agency = activeAgencies[plan.sequence % activeAgencies.length]!;
        const work = workFor(agency, plan.sequence + 12);
        const location = safeSourceLocation(agency, sourceLocations, now);
        const reportAt = koreaTime(addCalendarDays(plan.date, 1), 9);
        const requestedAt = koreaTime(addCalendarDays(plan.date, -2), 9);
        const respondedAt = koreaTime(addCalendarDays(plan.date, -1), 16);
        const scenarioKey = `graduation-no-show-${plan.workerSlug}-${plan.date}-${plan.occurrence + 1}`;
        const job = await ensureJob(tx, {
          agency,
          title: `${work.title} (배정 이력 ${plan.occurrence + 1})`,
          description: `${HISTORY_MARKER}\n${agency.name} ${location.region} 현장의 과거 배정 이력입니다. ${work.detail}했습니다.\n시나리오: ${scenarioKey}`,
          marker: HISTORY_MARKER,
          scenarioKey,
          jobDate: dateAtUtc(plan.date),
          ...location,
          requiredWorkers: 2 + ((plan.sequence + 1) % 5),
          dailyWage: 150_000 + ((plan.sequence + 2) % 5) * 10_000,
          status: "CLOSED",
          createdAt: requestedAt,
          updatedAt: reportAt,
        });
        remember("historyJobs", job.id);

        const assignments = await tx
          .select()
          .from(jobAssignments)
          .where(
            and(
              eq(jobAssignments.jobId, job.id),
              eq(jobAssignments.workerId, worker.workerId)
            )
          )
          .limit(2);
        assert(
          assignments.length <= 1,
          `Ambiguous no-show assignment for ${scenarioKey}.`
        );
        let assignment = assignments[0];
        if (assignment) {
          assert(
            assignment.status === "NO_SHOW" && assignment.completedAt === null,
            `Existing no-show assignment for ${scenarioKey} is not a pure no-show.`
          );
        } else {
          await tx.insert(jobAssignments).values({
            jobId: job.id,
            workerId: worker.workerId,
            status: "NO_SHOW",
            requestedAt,
            respondedAt,
            completedAt: null,
            canceledAt: null,
          });
          const inserted = await tx
            .select()
            .from(jobAssignments)
            .where(
              and(
                eq(jobAssignments.jobId, job.id),
                eq(jobAssignments.workerId, worker.workerId)
              )
            )
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read no-show assignment for ${scenarioKey}.`
          );
          assignment = inserted[0]!;
        }
        remember("noShowAssignments", assignment.id);

        const [attendance] = await tx
          .select({ id: attendanceRecords.id })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.jobId, job.id),
              eq(attendanceRecords.workerId, worker.workerId)
            )
          )
          .limit(1);
        const [payment] = await tx
          .select({ id: paymentRecords.id })
          .from(paymentRecords)
          .where(
            and(
              eq(paymentRecords.jobId, job.id),
              eq(paymentRecords.workerId, worker.workerId)
            )
          )
          .limit(1);
        const [managerReview] = await tx
          .select({ id: managerWorkerReviews.id })
          .from(managerWorkerReviews)
          .where(eq(managerWorkerReviews.assignmentId, assignment.id))
          .limit(1);
        const [agencyReview] = await tx
          .select({ id: workerAgencyReviews.id })
          .from(workerAgencyReviews)
          .where(eq(workerAgencyReviews.assignmentId, assignment.id))
          .limit(1);
        assert(
          !attendance && !payment && !managerReview && !agencyReview,
          `No-show ${scenarioKey} has non-no-show history rows.`
        );

        const reports = await tx
          .select()
          .from(noShowReports)
          .where(eq(noShowReports.assignmentId, assignment.id))
          .limit(2);
        assert(
          reports.length <= 1,
          `Ambiguous no-show report for ${scenarioKey}.`
        );
        let report = reports[0];
        if (report) {
          assert(
            report.workerId === worker.workerId &&
              report.agencyId === agency.id &&
              report.managerUserId === agency.managerId &&
              sameInstant(report.reportedAt, reportAt),
            `Existing no-show report for ${scenarioKey} differs from the expected responsible manager/agency.`
          );
        } else {
          await tx.insert(noShowReports).values({
            assignmentId: assignment.id,
            workerId: worker.workerId,
            agencyId: agency.id,
            managerUserId: agency.managerId,
            reportedAt: reportAt,
          });
          const inserted = await tx
            .select()
            .from(noShowReports)
            .where(eq(noShowReports.assignmentId, assignment.id))
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read no-show report for ${scenarioKey}.`
          );
          report = inserted[0]!;
        }
        remember("noShowReports", report.id);
      }
    });

    // Batch 4: five complete, paid, mutually reviewed jobs for the excellent worker.
    await db.transaction(async tx => {
      const excellent = profilesBySlug.get("excellent-five");
      assert(excellent, "Missing excellent demo worker profile.");

      for (const [occurrence, date] of excellentDates.entries()) {
        const agency =
          activeAgencies[(occurrence + 1) % activeAgencies.length]!;
        const work = workFor(agency, occurrence + 24);
        const location = safeSourceLocation(agency, sourceLocations, now);
        const checkIn = koreaTime(date, 8); // 08:00 Korea time (23:00 UTC on the prior calendar date)
        const checkOut = koreaTime(date, 17); // 17:00 Korea time
        const paidAt = koreaTime(date, 19);
        const managerSubmittedAt = koreaTime(addCalendarDays(date, 1), 10);
        const workerSubmittedAt = koreaTime(date, 20);
        const requestedAt = koreaTime(addCalendarDays(date, -3), 9);
        const respondedAt = koreaTime(addCalendarDays(date, -2), 15);
        const scenarioKey = `graduation-excellent-${date}-${occurrence + 1}`;
        const job = await ensureJob(tx, {
          agency,
          title: `${work.title} (완료 이력 ${occurrence + 1})`,
          description: `${HISTORY_MARKER}\n${agency.name} ${location.region} 현장의 완료·정산 이력입니다. ${work.detail}했습니다.\n시나리오: ${scenarioKey}`,
          marker: HISTORY_MARKER,
          scenarioKey,
          jobDate: dateAtUtc(date),
          ...location,
          requiredWorkers: 2 + ((occurrence + 2) % 5),
          dailyWage: 150_000 + ((occurrence + 3) % 5) * 10_000,
          status: "CLOSED",
          createdAt: requestedAt,
          updatedAt: paidAt,
        });
        remember("historyJobs", job.id);

        const assignments = await tx
          .select()
          .from(jobAssignments)
          .where(
            and(
              eq(jobAssignments.jobId, job.id),
              eq(jobAssignments.workerId, excellent.workerId)
            )
          )
          .limit(2);
        assert(
          assignments.length <= 1,
          `Ambiguous completed assignment for ${scenarioKey}.`
        );
        let assignment = assignments[0];
        if (assignment) {
          assert(
            assignment.status === "COMPLETED" &&
              sameInstant(assignment.completedAt, checkOut),
            `Existing assignment for ${scenarioKey} is not the expected completed history.`
          );
        } else {
          await tx.insert(jobAssignments).values({
            jobId: job.id,
            workerId: excellent.workerId,
            status: "COMPLETED",
            requestedAt,
            respondedAt,
            completedAt: checkOut,
            canceledAt: null,
          });
          const inserted = await tx
            .select()
            .from(jobAssignments)
            .where(
              and(
                eq(jobAssignments.jobId, job.id),
                eq(jobAssignments.workerId, excellent.workerId)
              )
            )
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read completed assignment for ${scenarioKey}.`
          );
          assignment = inserted[0]!;
        }
        remember("completedAssignments", assignment.id);

        const attendanceRows = await tx
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.workerId, excellent.workerId),
              eq(attendanceRecords.jobId, job.id),
              eq(attendanceRecords.workDate, dateAtUtc(date))
            )
          )
          .limit(2);
        assert(
          attendanceRows.length <= 1,
          `Ambiguous attendance record for ${scenarioKey}.`
        );
        let attendance = attendanceRows[0];
        if (attendance) {
          assert(
            sameInstant(attendance.checkIn, checkIn) &&
              sameInstant(attendance.checkOut, checkOut),
            `Existing attendance for ${scenarioKey} does not represent Korea 08:00–17:00.`
          );
        } else {
          const hasSourceCoordinates =
            location.siteLatitude !== null && location.siteLongitude !== null;
          await tx.insert(attendanceRecords).values({
            workerId: excellent.workerId,
            jobId: job.id,
            workDate: dateAtUtc(date),
            checkIn,
            checkOut,
            checkInLatitude: hasSourceCoordinates
              ? location.siteLatitude
              : null,
            checkInLongitude: hasSourceCoordinates
              ? location.siteLongitude
              : null,
            checkInAccuracyMeters: hasSourceCoordinates ? 20 : null,
            checkInDistanceMeters: hasSourceCoordinates ? 0 : null,
            checkOutLatitude: hasSourceCoordinates
              ? location.siteLatitude
              : null,
            checkOutLongitude: hasSourceCoordinates
              ? location.siteLongitude
              : null,
            checkOutAccuracyMeters: hasSourceCoordinates ? 20 : null,
            checkOutDistanceMeters: hasSourceCoordinates ? 0 : null,
            createdAt: checkIn,
            updatedAt: checkOut,
          });
          const inserted = await tx
            .select()
            .from(attendanceRecords)
            .where(
              and(
                eq(attendanceRecords.workerId, excellent.workerId),
                eq(attendanceRecords.jobId, job.id),
                eq(attendanceRecords.workDate, dateAtUtc(date))
              )
            )
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read attendance record for ${scenarioKey}.`
          );
          attendance = inserted[0]!;
        }
        remember("attendanceRecords", attendance.id);

        const paymentRows = await tx
          .select()
          .from(paymentRecords)
          .where(
            and(
              eq(paymentRecords.workerId, excellent.workerId),
              eq(paymentRecords.jobId, job.id)
            )
          )
          .limit(2);
        assert(
          paymentRows.length <= 1,
          `Ambiguous payment record for ${scenarioKey}.`
        );
        let payment = paymentRows[0];
        if (payment) {
          assert(
            payment.agencyId === agency.id &&
              payment.amount === job.dailyWage &&
              payment.status === "PAID" &&
              sameInstant(payment.paidAt, paidAt),
            `Existing payment for ${scenarioKey} is not the expected paid history.`
          );
        } else {
          await tx.insert(paymentRecords).values({
            workerId: excellent.workerId,
            jobId: job.id,
            agencyId: agency.id,
            amount: job.dailyWage,
            description: `[졸업 시연용 가상 지급] ${scenarioKey}`,
            status: "PAID",
            paidAt,
            createdAt: checkOut,
            updatedAt: paidAt,
          });
          const inserted = await tx
            .select()
            .from(paymentRecords)
            .where(
              and(
                eq(paymentRecords.workerId, excellent.workerId),
                eq(paymentRecords.jobId, job.id)
              )
            )
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read payment record for ${scenarioKey}.`
          );
          payment = inserted[0]!;
        }
        remember("paymentRecords", payment.id);

        const managerReviewRows = await tx
          .select()
          .from(managerWorkerReviews)
          .where(eq(managerWorkerReviews.assignmentId, assignment.id))
          .limit(2);
        assert(
          managerReviewRows.length <= 1,
          `Ambiguous manager review for ${scenarioKey}.`
        );
        let managerReview = managerReviewRows[0];
        if (managerReview) {
          assert(
            managerReview.workerId === excellent.workerId &&
              managerReview.agencyId === agency.id &&
              managerReview.managerUserId === agency.managerId &&
              managerReview.attendanceStatus === "NORMAL" &&
              managerReview.skillScore >= 4 &&
              managerReview.safetyStatus === "PASS",
            `Existing manager review for ${scenarioKey} is not an excellent PASS review.`
          );
        } else {
          await tx.insert(managerWorkerReviews).values({
            assignmentId: assignment.id,
            workerId: excellent.workerId,
            agencyId: agency.id,
            managerUserId: agency.managerId,
            attendanceStatus: "NORMAL",
            skillScore: 5,
            safetyStatus: "PASS",
            submittedAt: managerSubmittedAt,
          });
          const inserted = await tx
            .select()
            .from(managerWorkerReviews)
            .where(eq(managerWorkerReviews.assignmentId, assignment.id))
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read manager review for ${scenarioKey}.`
          );
          managerReview = inserted[0]!;
        }
        remember("managerWorkerReviews", managerReview.id);

        const agencyReviewRows = await tx
          .select()
          .from(workerAgencyReviews)
          .where(eq(workerAgencyReviews.assignmentId, assignment.id))
          .limit(2);
        assert(
          agencyReviewRows.length <= 1,
          `Ambiguous worker agency review for ${scenarioKey}.`
        );
        let agencyReview = agencyReviewRows[0];
        if (agencyReview) {
          assert(
            agencyReview.workerId === excellent.workerId &&
              agencyReview.agencyId === agency.id &&
              agencyReview.workerUserId === excellent.userId &&
              agencyReview.wageStatus === "NORMAL" &&
              agencyReview.siteSafetyScore >= 4 &&
              agencyReview.facilitiesScore >= 4,
            `Existing worker agency review for ${scenarioKey} is not the expected completed-job review.`
          );
        } else {
          await tx.insert(workerAgencyReviews).values({
            assignmentId: assignment.id,
            workerId: excellent.workerId,
            agencyId: agency.id,
            workerUserId: excellent.userId,
            wageStatus: "NORMAL",
            siteSafetyScore: 5,
            facilitiesScore: 5,
            submittedAt: workerSubmittedAt,
          });
          const inserted = await tx
            .select()
            .from(workerAgencyReviews)
            .where(eq(workerAgencyReviews.assignmentId, assignment.id))
            .limit(2);
          assert(
            inserted.length === 1,
            `Could not read worker agency review for ${scenarioKey}.`
          );
          agencyReview = inserted[0]!;
        }
        remember("workerAgencyReviews", agencyReview.id);
      }
    });

    assert(
      manifestIds.users.size === 4,
      "Expected exactly four demo user identities."
    );
    assert(
      manifestIds.workerProfiles.size === 4,
      "Expected exactly four demo worker profiles."
    );
    assert(
      manifestIds.memberships.size === activeAgencies.length * 4,
      "Every demo worker must be ACTIVE at every nondeleted agency."
    );
    assert(
      manifestIds.openJobs.size === 24,
      "Expected exactly 24 unassigned recruiting demo jobs."
    );
    assert(
      manifestIds.historyJobs.size === 16,
      "Expected 11 no-show and 5 completed historical jobs."
    );
    assert(
      manifestIds.noShowAssignments.size === 11 &&
        manifestIds.noShowReports.size === 11,
      "Expected exactly 11 no-show assignment/report pairs."
    );
    assert(
      manifestIds.completedAssignments.size === 5,
      "Expected exactly five completed assignments for the excellent worker."
    );
    assert(
      manifestIds.attendanceRecords.size === 5 &&
        manifestIds.paymentRecords.size === 5,
      "Expected exactly five completed attendance/payment pairs."
    );
    assert(
      manifestIds.managerWorkerReviews.size === 5 &&
        manifestIds.workerAgencyReviews.size === 5,
      "Expected exactly five mutual completed-job review pairs."
    );

    const counts = await writeManifest(now, activeAgencies.length);
    // Do not log IDs, agency names, manager data, or any DATABASE_URL component.
    console.log(JSON.stringify(counts));
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  // Deliberately suppress driver errors, which can include connection details.
  console.error("Graduation demo seed failed.");
  process.exitCode = 1;
});
