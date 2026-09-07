export type WorkspaceSessionUser = {
  loginMethod?: string | null;
  accountRole?: "MANAGER" | "WORKER" | null;
};

export function canAccessWorkspace(user: WorkspaceSessionUser | null | undefined) {
  return user?.loginMethod === "phone-password" && (user.accountRole === "MANAGER" || user.accountRole === "WORKER");
}
