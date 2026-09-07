import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import ManagerWorkspace from "@/pages/ManagerWorkspace";
import Onboarding from "@/pages/Onboarding";
import WorkerWorkspace from "@/pages/WorkerWorkspace";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppContent() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const viewer = trpc.buildOnWorks.account.viewer.useQuery(undefined, { enabled: isAuthenticated });

  if (loading || (isAuthenticated && viewer.isLoading)) return <div className="grid min-h-screen place-items-center bg-[#173d38]"><Loader2 className="h-7 w-7 animate-spin text-white" /></div>;
  if (!isAuthenticated || !viewer.data?.account.accountRole) return <Onboarding onComplete={() => viewer.refetch()} />;

  const name = viewer.data.account.name || user?.name || "현장 사용자";
  if (viewer.data.account.accountRole === "MANAGER") return <ManagerWorkspace userName={name} onLogout={logout} />;
  return <WorkerWorkspace userName={name} onLogout={logout} />;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-center" /><AppContent /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
