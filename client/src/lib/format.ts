export const won = (value: number) => new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);

export const dateKo = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
};

export const timeKo = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(value));
};

export const dateInputValue = () => new Date().toISOString().slice(0, 10);
