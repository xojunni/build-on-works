import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import mysql from "mysql2/promise";

const snapshotPath = "/home/ubuntu/.build-on-works-before-graduation.json";
const tables = ["users", "agencies", "worker_profiles", "worker_agency_memberships", "jobs", "job_assignments", "attendance_records", "payment_records", "manager_worker_reviews", "worker_agency_reviews", "no_show_reports"];

function hash(row: Record<string, unknown>, table: string) {
  const copy = { ...row };
  // Live authentication legitimately updates these while demonstration data is seeded.
  if (table === "users") { delete copy.updatedAt; delete copy.lastSignedIn; }
  return createHash("sha256").update(JSON.stringify(copy)).digest("hex");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const current: Record<string, Record<string, string>> = {};
    for (const table of tables) {
      const [rows] = await db.query(`SELECT * FROM \`${table}\` ORDER BY id`);
      current[table] = Object.fromEntries((rows as Array<Record<string, unknown>>).map(row => [String(row.id), hash(row, table)]));
    }
    if (process.argv.includes("--record")) {
      writeFileSync(snapshotPath, JSON.stringify(current), { mode: 0o600 });
      console.log(JSON.stringify({ recorded: true, counts: Object.fromEntries(tables.map(table => [table, Object.keys(current[table]).length])) }, null, 2));
      return;
    }
    const before = JSON.parse(readFileSync(snapshotPath, "utf8")) as typeof current;
    const changes: string[] = [];
    for (const table of tables) {
      for (const [id, digest] of Object.entries(before[table])) {
        if (current[table][id] !== digest) changes.push(`${table}:${id}`);
      }
    }
    console.log(JSON.stringify({ existingRecordsPreserved: changes.length === 0, changedOriginalIds: changes, addedRows: Object.fromEntries(tables.map(table => [table, Object.keys(current[table]).length - Object.keys(before[table]).length])) }, null, 2));
    if (changes.length) process.exitCode = 1;
  } finally { await db.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Data verification failed"); process.exitCode = 1; });
