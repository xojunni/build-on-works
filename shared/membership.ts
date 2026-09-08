export type MembershipStatus = "PENDING" | "ACTIVE" | "REJECTED" | "INACTIVE";

export function isActiveMembership(status: MembershipStatus | null | undefined) {
  return status === "ACTIVE";
}

export function membershipLabel(status: MembershipStatus) {
  return { PENDING: "승인 대기중", ACTIVE: "승인됨", REJECTED: "가입 요청 거절", INACTIVE: "소속 종료" }[status];
}
