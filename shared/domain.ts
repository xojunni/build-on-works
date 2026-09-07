export const APP_NAME = "Build On Works";

export const ROLE_LABELS = {
  MANAGER: "인력소장",
  WORKER: "인부",
} as const;

export const WORKER_STATUS_LABELS = {
  UNAFFILIATED: "인력소 미가입",
  PENDING: "승인 대기중",
  ACTIVE: "재직중",
  REJECTED: "가입 요청 거절",
  INACTIVE: "비활성",
} as const;

export const ASSIGNMENT_STATUS_LABELS = {
  PENDING: "대기중",
  ASSIGNED: "진행 중",
  REJECTED: "거절됨",
  CANCELED: "취소됨",
  COMPLETED: "완료",
} as const;

export const PAYMENT_STATUS_LABELS = {
  PENDING: "지급 대기",
  PAID: "지급완료",
  CANCELED: "정산 취소",
} as const;

export function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(amount);
}

export function formatKoreanDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value));
}
