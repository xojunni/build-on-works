import { koreanWorkDate } from "./attendanceDate";

const DAY_MS = 24 * 60 * 60 * 1000;
export const JOB_LIST_RETENTION_DAYS = 14;

/** MySQL DATE is a calendar date, not the browser's local timestamp. */
function workDateTimestamp(value: Date | string) {
  const day = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const timestamp = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) throw new Error("일감 근무일이 올바르지 않습니다.");
  return timestamp;
}

export function jobLifecycle(jobDate: Date | string, now = new Date()) {
  const daysPast = Math.floor((koreanWorkDate(now).getTime() - workDateTimestamp(jobDate)) / DAY_MS);
  return { isPast: daysPast > 0, daysPast, hideFromListings: daysPast >= JOB_LIST_RETENTION_DAYS };
}

/** Main lists use jobDate > cutoff. Historical records deliberately do not. */
export function jobListCutoff(now = new Date()) {
  const date = koreanWorkDate(now);
  date.setUTCDate(date.getUTCDate() - JOB_LIST_RETENTION_DAYS);
  return date;
}
