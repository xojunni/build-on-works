import type { LucideIcon } from "lucide-react";
import { Bell, ChevronRight, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type TabItem = { id: string; label: string; icon: LucideIcon };

export function MobileShell({
  name,
  eyebrow,
  tabs,
  activeTab,
  onTabChange,
  children,
}: {
  name: string;
  eyebrow: string;
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-canvas min-h-screen bg-[#f7f5f0] text-[#1d2422]">
      <div className="mx-auto min-h-screen max-w-6xl pb-28">
        <header className="sticky top-0 z-30 border-b border-[#1d2422]/5 bg-[#f7f5f0]/88 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-[#d56835]"><Sparkles className="h-3 w-3" /> Build On Works</p>
              <h1 className="truncate text-lg font-bold tracking-[-0.04em]">{name}<span className="ml-2 font-medium text-[#718079]">{eyebrow}</span></h1>
            </div>
            <button aria-label="알림" className="grid h-10 w-10 place-items-center rounded-2xl border border-[#1d2422]/10 bg-white/75 shadow-sm transition active:scale-95"><Bell className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-6 md:px-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1d2422]/10 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return <button key={tab.id} onClick={() => onTabChange(tab.id)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition active:scale-95 ${active ? "bg-[#173d38] text-white shadow-lg shadow-[#173d38]/15" : "text-[#77827d] hover:bg-[#173d38]/5"}`}><Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} /><span>{tab.label}</span></button>;
          })}
        </div>
      </nav>
    </div>
  );
}

export function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold tracking-[-0.045em]">{title}</h2>{detail ? <p className="mt-1 text-sm text-[#718079]">{detail}</p> : null}</div>{action}</div>;
}

export function Metric({ label, value, tone = "plain" }: { label: string; value: string | number; tone?: "plain" | "orange" | "green" }) {
  const tones = { plain: "bg-white", orange: "bg-[#e86f3e] text-white", green: "bg-[#173d38] text-white" };
  return <div className={`rounded-[1.35rem] p-4 shadow-sm ${tones[tone]}`}><p className={`text-xs font-medium ${tone === "plain" ? "text-[#78837d]" : "text-white/72"}`}>{label}</p><p className="mt-1 text-xl font-extrabold tracking-[-0.05em]">{value}</p></div>;
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "orange" | "green" | "blue" | "red" }) {
  const tones = { neutral: "bg-[#eef0ed] text-[#5d6b64]", orange: "bg-[#fff0e9] text-[#c95225]", green: "bg-[#e4f1ed] text-[#167054]", blue: "bg-[#e8f0ff] text-[#3263ae]", red: "bg-[#ffeceb] text-[#bf4239]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function ArrowLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-bold text-[#d56835]">{children}<ChevronRight className="h-3.5 w-3.5" /></button>;
}
