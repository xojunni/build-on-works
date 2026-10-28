export type AttendanceReviewStatus = "NORMAL" | "LATE";
export type SafetyReviewStatus = "PASS" | "FAIL";
export type WageReviewStatus = "NORMAL" | "LATE" | "UNPAID";

type Dated = { id: number; at: Date };

export type WorkerReviewEvent = Dated & {
  skillScore: number;
  safetyStatus: SafetyReviewStatus;
  attendanceStatus: AttendanceReviewStatus;
};

export type NoShowEvent = Dated;
export type NormalCompletionEvent = Dated;

export type AgencyReviewEvent = Dated & {
  wageStatus: WageReviewStatus;
  siteSafetyScore: number;
  facilitiesScore: number;
};

type WorkerTrustTimelineEvent =
  | (WorkerReviewEvent & { kind: "review" })
  | (NoShowEvent & { kind: "noShow" });

function byDateThenId(a: Dated, b: Dated) {
  return a.at.getTime() - b.at.getTime() || a.id - b.id;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Calculates worker reputation from immutable review, no-show and completed-attendance events.
 * The result is derived on the server; the client never supplies counts, badges or ban dates.
 */
export function summarizeWorkerTrust(
  reviews: WorkerReviewEvent[],
  noShows: NoShowEvent[],
  normalCompletions: NormalCompletionEvent[],
  now = new Date()
) {
  const sortedReviews = [...reviews].sort(byDateThenId);
  const sortedNoShows = [...noShows].sort(byDateThenId);
  const completed = [...normalCompletions].sort(byDateThenId);

  const timeline: WorkerTrustTimelineEvent[] = [
    ...sortedReviews.map(event => ({ ...event, kind: "review" as const })),
    ...sortedNoShows.map(event => ({ ...event, kind: "noShow" as const })),
  ].sort(byDateThenId);

  let excellentStreak = 0;
  for (const event of timeline) {
    if (event.kind === "noShow") {
      excellentStreak = 0;
      continue;
    }
    if (event.skillScore >= 4 && event.safetyStatus === "PASS") excellentStreak += 1;
    else excellentStreak = 0;
  }

  const noShowCount = sortedNoShows.length;
  const latestNoShow = sortedNoShows.at(-1);
  const applicationBanUntil = !latestNoShow
    ? null
    : noShowCount >= 4
      ? addDays(latestNoShow.at, 14)
      : noShowCount === 3
        ? addDays(latestNoShow.at, 7)
        : null;

  const rehabilitationCompletedCount = noShowCount >= 4 && applicationBanUntil
    ? completed.filter(event => event.at.getTime() >= applicationBanUntil.getTime()).length
    : 0;
  const isBlacklisted = noShowCount >= 4 && rehabilitationCompletedCount < 7;
  const isApplicationBanned = !!applicationBanUntil && now.getTime() < applicationBanUntil.getTime();
  const lateCount = sortedReviews.filter(review => review.attendanceStatus === "LATE").length;
  const skillAverage = sortedReviews.length
    ? rounded(sortedReviews.reduce((sum, review) => sum + review.skillScore, 0) / sortedReviews.length)
    : null;
  const safetyPassCount = sortedReviews.filter(review => review.safetyStatus === "PASS").length;

  return {
    reviewCount: sortedReviews.length,
    skillAverage,
    safetyPassCount,
    lateCount,
    noShowCount,
    excellentStreak,
    isExcellent: excellentStreak >= 5,
    applicationBanUntil,
    isApplicationBanned,
    isBlacklisted,
    rehabilitationCompletedCount,
    status: isBlacklisted ? "BLACKLISTED" as const : isApplicationBanned ? "BANNED" as const : noShowCount > 0 ? "CAUTION" as const : excellentStreak >= 5 ? "EXCELLENT" as const : "NORMAL" as const,
  };
}

/** Calculates agency excellence from worker reviews, resetting on unpaid wages or a safety score of 1. */
export function summarizeAgencyTrust(reviews: AgencyReviewEvent[]) {
  const sorted = [...reviews].sort(byDateThenId);
  let normalPaymentCount = 0;
  let facilitiesAtLeast3Count = 0;
  let isExcellent = false;

  for (const review of sorted) {
    if (review.wageStatus === "UNPAID" || review.siteSafetyScore === 1) {
      normalPaymentCount = 0;
      facilitiesAtLeast3Count = 0;
      isExcellent = false;
      continue;
    }
    if (review.wageStatus === "NORMAL") normalPaymentCount += 1;
    if (review.facilitiesScore >= 3) facilitiesAtLeast3Count += 1;
    if (normalPaymentCount >= 10 && facilitiesAtLeast3Count >= 30) isExcellent = true;
  }

  return {
    reviewCount: sorted.length,
    safetyAverage: sorted.length ? rounded(sorted.reduce((sum, review) => sum + review.siteSafetyScore, 0) / sorted.length) : null,
    facilitiesAverage: sorted.length ? rounded(sorted.reduce((sum, review) => sum + review.facilitiesScore, 0) / sorted.length) : null,
    normalPaymentCount,
    facilitiesAtLeast3Count,
    isExcellent,
    status: isExcellent ? "EXCELLENT" as const : "NORMAL" as const,
  };
}
