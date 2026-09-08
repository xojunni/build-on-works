const koreaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** DB의 DATE 열 비교와 고유 제약에 사용할 한국 시간대의 자정 날짜입니다. */
export function koreanWorkDate(now = new Date()) {
  const parts = koreaDateFormatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00.000Z`);
}
