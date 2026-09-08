import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { canAccessWorkspace } from "@shared/sessionAccess";
import ManagerWorkspace from "@/pages/ManagerWorkspace";
import PhoneAuth from "@/pages/PhoneAuth";
import WorkerWorkspace from "@/pages/WorkerWorkspace";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppContent() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const hasPhoneSession = isAuthenticated && canAccessWorkspace(user);
  const viewer = trpc.buildOnWorks.account.viewer.useQuery(undefined, { enabled: hasPhoneSession, retry: false });
  if (loading || (hasPhoneSession && viewer.isLoading)) return <div className="grid min-h-screen place-items-center bg-[#173d38]"><Loader2 className="h-7 w-7 animate-spin text-white" /></div>;
  const authAccount = viewer.data?.account;
  if (!hasPhoneSession || !authAccount) return <PhoneAuth />;

  const name = authAccount.name || user?.name || "현장 사용자";
  if (authAccount.accountRole === "MANAGER") return <ManagerWorkspace userName={name} onLogout={logout} />;
  return <WorkerWorkspace userName={name} onLogout={logout} />;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-center" /><AppContent /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
