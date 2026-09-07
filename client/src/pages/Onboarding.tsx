import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Building2, CheckCircle2, HardHat, Loader2, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const setup = trpc.buildOnWorks.account.setup.useMutation({
    onSuccess: async () => { await utils.buildOnWorks.account.viewer.invalidate(); toast.success("계정 설정이 완료되었습니다."); onComplete(); },
    onError: error => toast.error(error.message),
  });
  const [role, setRole] = useState<"MANAGER" | "WORKER">("MANAGER");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [certificate, setCertificate] = useState("");
  const [bankName, setBankName] = useState("국민은행");
  const [bankAccount, setBankAccount] = useState("");

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#173d38]"><Loader2 className="h-7 w-7 animate-spin text-white" /></div>;
  if (!isAuthenticated) return <Landing onStart={() => startLogin()} />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setup.mutate({ accountRole: role, name, phone, ...(role === "WORKER" ? { birthDate, certificate, bankName, bankAccount } : {}) });
  };

  return <div className="min-h-screen bg-[#f7f5f0] px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]"><div className="mx-auto max-w-md"><div className="mb-8 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#173d38] text-white shadow-lg shadow-[#173d38]/20"><HardHat className="h-5 w-5" /></div><div><p className="text-sm font-extrabold tracking-[-0.04em]">Build On Works</p><p className="text-xs text-[#76817c]">현장을 기반으로 사람과 일을 연결하다</p></div></div><div className="rounded-[1.75rem] border border-[#1d2422]/5 bg-white p-6 shadow-xl shadow-[#153b36]/[0.06]"><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d56835]">첫 설정</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.06em]">어떤 역할로<br />시작하시나요?</h1><p className="mt-3 text-sm leading-6 text-[#708079]">역할에 따라 필요한 메뉴와 권한을 안전하게 설정합니다. 언제나 역할별 데이터만 볼 수 있습니다.</p><form onSubmit={submit} className="mt-7 space-y-5"><div className="grid grid-cols-2 gap-3"><RoleCard active={role === "MANAGER"} icon={Building2} title="인력소장" text="인력소·일감·급여를 관리" onClick={() => setRole("MANAGER")} /><RoleCard active={role === "WORKER"} icon={HardHat} title="인부" text="일감·출퇴근·급여를 확인" onClick={() => setRole("WORKER")} /></div><Field label="이름"><Input required value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" /></Field><Field label="전화번호"><Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" inputMode="tel" /></Field>{role === "WORKER" ? <><Field label="생년월일"><Input required type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} /></Field><Field label="이수증 등록번호"><Input value={certificate} onChange={e => setCertificate(e.target.value)} placeholder="선택 입력" /></Field><div className="grid grid-cols-2 gap-3"><Field label="은행"><select value={bankName} onChange={e => setBankName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="국민은행">국민은행</option><option value="신한은행">신한은행</option><option value="농협은행">농협은행</option><option value="우리은행">우리은행</option></select></Field><Field label="계좌번호"><Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="선택 입력" inputMode="numeric" /></Field></div></> : null}<Button disabled={setup.isPending} className="h-13 w-full rounded-2xl bg-[#173d38] text-base font-bold hover:bg-[#0e2e2a]">{setup.isPending ? <Loader2 className="animate-spin" /> : <>계속하기 <ArrowRight className="ml-1 h-4 w-4" /></>}</Button></form></div></div></div>;
}

function Landing({ onStart }: { onStart: () => void }) { return <div className="min-h-screen overflow-hidden bg-[#173d38] text-white"><div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-between px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e86f3e] shadow-lg shadow-black/20"><HardHat className="h-5 w-5" /></div><span className="font-extrabold tracking-[-0.04em]">Build On Works</span></div><section className="py-10"><p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#ffb18c]">Workforce operations, simplified</p><h1 className="max-w-2xl text-5xl font-extrabold leading-[0.98] tracking-[-0.075em] sm:text-6xl">사람과 일을<br />현장에 맞게<br /><span className="text-[#ff9b70]">연결합니다.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-white/70">인력소장과 인부가 일감, 출퇴근, 급여를 각자의 화면에서 간편하고 안전하게 관리합니다.</p><div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-center text-xs font-bold"><Feature icon={Building2} label="인력소 관리" /><Feature icon={CheckCircle2} label="출퇴근 기록" /><Feature icon={ShieldCheck} label="역할별 보안" /></div></section><Button onClick={onStart} className="h-14 w-full rounded-2xl bg-[#e86f3e] text-base font-bold text-white hover:bg-[#f58252] sm:max-w-md">계정으로 시작하기 <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>; }
function Feature({ icon: Icon, label }: { icon: typeof Building2; label: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-2 py-4"><Icon className="mx-auto mb-2 h-4 w-4 text-[#ffb18c]" /><span>{label}</span></div>; }
function RoleCard({ active, icon: Icon, title, text, onClick }: { active: boolean; icon: typeof Building2; title: string; text: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#d56835] bg-[#fff4ed] shadow-sm" : "border-[#1d2422]/10 bg-[#fafaf8]"}`}><Icon className={`mb-4 h-5 w-5 ${active ? "text-[#d56835]" : "text-[#738078]"}`} /><p className="font-bold">{title}</p><p className="mt-1 text-[11px] leading-4 text-[#718079]">{text}</p></button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-2"><Label className="text-xs font-bold text-[#49554f]">{label}</Label>{children}</label>; }
