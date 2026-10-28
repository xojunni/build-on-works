/** Application-ban countdown, NOT a promise of blacklist removal. */
export function remainingBanDays(until: Date | string | number | null | undefined, now = Date.now()) {
  if (until == null) return 0;
  const timestamp = new Date(until).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.ceil((timestamp - now) / (24 * 60 * 60 * 1000)));
}
