import {
  date,
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const accountRoles = ["MANAGER", "WORKER"] as const;
export const workerStatuses = ["UNAFFILIATED", "PENDING", "ACTIVE", "REJECTED", "INACTIVE"] as const;
export const membershipStatuses = ["PENDING", "ACTIVE", "REJECTED", "INACTIVE"] as const;
export const jobStatuses = ["RECRUITING", "CLOSED", "CANCELED"] as const;
export const assignmentStatuses = ["PENDING", "ASSIGNED", "REJECTED", "CANCELED", "COMPLETED"] as const;
export const paymentStatuses = ["PENDING", "PAID", "CANCELED"] as const;

/** Core OAuth account managed by the template, extended with Build On Works membership metadata. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  accountRole: mysqlEnum("accountRole", accountRoles),
  loginMethod: varchar("loginMethod", { length: 64 }).default("manus-oauth"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const agencies = mysqlTable(
  "agencies",
  {
    id: int("id").autoincrement().primaryKey(),
    managerId: int("managerId").notNull().references(() => users.id),
    name: varchar("name", { length: 100 }).notNull(),
    region: varchar("region", { length: 100 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => ({
    managerIndex: index("agencies_manager_idx").on(table.managerId),
    regionIndex: index("agencies_region_idx").on(table.region),
  })
);

export const workerProfiles = mysqlTable(
  "worker_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    agencyId: int("agencyId").references(() => agencies.id),
    birthDate: date("birthDate"),
    certificate: varchar("certificate", { length: 200 }),
    phone: varchar("phone", { length: 20 }),
    bankAccount: varchar("bankAccount", { length: 100 }),
    bankName: varchar("bankName", { length: 50 }),
    status: mysqlEnum("status", workerStatuses).default("UNAFFILIATED").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userUnique: uniqueIndex("worker_profiles_user_unique").on(table.userId),
    agencyStatusIndex: index("worker_profiles_agency_status_idx").on(table.agencyId, table.status),
  })
);

/** A worker can independently request and hold membership at multiple agencies. */
export const workerAgencyMemberships = mysqlTable(
  "worker_agency_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    workerId: int("workerId").notNull().references(() => workerProfiles.id),
    agencyId: int("agencyId").notNull().references(() => agencies.id),
    status: mysqlEnum("status", membershipStatuses).default("PENDING").notNull(),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    respondedAt: timestamp("respondedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    workerAgencyUnique: uniqueIndex("worker_agency_memberships_unique").on(table.workerId, table.agencyId),
    agencyStatusIndex: index("worker_agency_memberships_agency_status_idx").on(table.agencyId, table.status),
    workerStatusIndex: index("worker_agency_memberships_worker_status_idx").on(table.workerId, table.status),
  })
);

export const jobs = mysqlTable(
  "jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    agencyId: int("agencyId").notNull().references(() => agencies.id),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    region: varchar("region", { length: 100 }).notNull(),
    address: text("address"),
    siteLatitude: double("siteLatitude"),
    siteLongitude: double("siteLongitude"),
    geofenceRadiusMeters: int("geofenceRadiusMeters").default(150).notNull(),
    siteGeocodedAt: timestamp("siteGeocodedAt"),
    jobDate: date("jobDate").notNull(),
    startTime: varchar("startTime", { length: 10 }),
    endTime: varchar("endTime", { length: 10 }),
    requiredWorkers: int("requiredWorkers").notNull(),
    dailyWage: int("dailyWage").notNull(),
    status: mysqlEnum("status", jobStatuses).default("RECRUITING").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    agencyStatusDateIndex: index("jobs_agency_status_date_idx").on(table.agencyId, table.status, table.jobDate),
    regionStatusIndex: index("jobs_region_status_idx").on(table.region, table.status),
  })
);

export const jobAssignments = mysqlTable(
  "job_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull().references(() => jobs.id),
    workerId: int("workerId").notNull().references(() => workerProfiles.id),
    status: mysqlEnum("status", assignmentStatuses).default("PENDING").notNull(),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    respondedAt: timestamp("respondedAt"),
    completedAt: timestamp("completedAt"),
    canceledAt: timestamp("canceledAt"),
  },
  table => ({
    jobWorkerUnique: uniqueIndex("job_assignments_job_worker_unique").on(table.jobId, table.workerId),
    workerStatusIndex: index("job_assignments_worker_status_idx").on(table.workerId, table.status),
    jobStatusIndex: index("job_assignments_job_status_idx").on(table.jobId, table.status),
  })
);

export const attendanceRecords = mysqlTable(
  "attendance_records",
  {
    id: int("id").autoincrement().primaryKey(),
    workerId: int("workerId").notNull().references(() => workerProfiles.id),
    jobId: int("jobId").notNull().references(() => jobs.id),
    workDate: date("workDate").notNull(),
    checkIn: timestamp("checkIn"),
    checkOut: timestamp("checkOut"),
    checkInLatitude: double("checkInLatitude"),
    checkInLongitude: double("checkInLongitude"),
    checkInAccuracyMeters: int("checkInAccuracyMeters"),
    checkInDistanceMeters: int("checkInDistanceMeters"),
    checkOutLatitude: double("checkOutLatitude"),
    checkOutLongitude: double("checkOutLongitude"),
    checkOutAccuracyMeters: int("checkOutAccuracyMeters"),
    checkOutDistanceMeters: int("checkOutDistanceMeters"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    workerJobDateUnique: uniqueIndex("attendance_worker_job_date_unique").on(table.workerId, table.jobId, table.workDate),
    workerIndex: index("attendance_worker_idx").on(table.workerId, table.workDate),
  })
);

export const paymentRecords = mysqlTable(
  "payment_records",
  {
    id: int("id").autoincrement().primaryKey(),
    workerId: int("workerId").notNull().references(() => workerProfiles.id),
    jobId: int("jobId").notNull().references(() => jobs.id),
    agencyId: int("agencyId").notNull().references(() => agencies.id),
    amount: int("amount").notNull(),
    description: text("description"),
    status: mysqlEnum("status", paymentStatuses).default("PENDING").notNull(),
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    workerJobUnique: uniqueIndex("payment_worker_job_unique").on(table.workerId, table.jobId),
    workerStatusIndex: index("payment_worker_status_idx").on(table.workerId, table.status),
    agencyStatusIndex: index("payment_agency_status_idx").on(table.agencyId, table.status),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WorkerProfile = typeof workerProfiles.$inferSelect;
export type WorkerAgencyMembership = typeof workerAgencyMemberships.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobAssignment = typeof jobAssignments.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type PaymentRecord = typeof paymentRecords.$inferSelect;
