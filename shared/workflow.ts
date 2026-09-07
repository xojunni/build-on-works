export type AssignmentState = "PENDING" | "ASSIGNED" | "REJECTED" | "CANCELED" | "COMPLETED";
export type PaymentState = "PENDING" | "PAID" | "CANCELED";

const assignmentTransitions: Record<AssignmentState, AssignmentState[]> = {
  PENDING: ["ASSIGNED", "REJECTED", "CANCELED"],
  ASSIGNED: ["COMPLETED"],
  REJECTED: [],
  CANCELED: [],
  COMPLETED: [],
};

const paymentTransitions: Record<PaymentState, PaymentState[]> = {
  PENDING: ["PAID", "CANCELED"],
  PAID: [],
  CANCELED: [],
};

export function canTransitionAssignment(from: AssignmentState, to: AssignmentState) {
  return assignmentTransitions[from].includes(to);
}

export function canTransitionPayment(from: PaymentState, to: PaymentState) {
  return paymentTransitions[from].includes(to);
}

export function duplicateMessage(kind: "assignment" | "payment") {
  return kind === "assignment" ? "이미 신청했거나 처리된 일감입니다." : "해당 일감의 급여 정산이 이미 생성되었습니다.";
}
