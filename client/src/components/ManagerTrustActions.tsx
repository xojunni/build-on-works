import { AlertTriangle, Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/MobileShell";
import { trpc } from "@/lib/trpc";

export function ManagerTrustActions({ assignment, managerReview, onSaved }: { assignment: { id: number; status: string }; managerReview: any; onSaved: () => Promise<unknown> | void }) {
  const [open, setOpen] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<"NORMAL" | "LATE">("NORMAL");
  const [skillScore, setSkillScore] = useState(3);
  const [safetyStatus, setSafetyStatus] = useState<"PASS" | "FAIL">("PASS");
  const review = trpc.buildOnWorks.trust.submitManagerReview.useMutation({ onSuccess: async () => { toast.success("인부 근무 평가가 저장되었습니다."); setOpen(false); await onSaved(); }, onError: error => toast.error(error.message) });
  const noShow = trpc.buildOnWorks.trust.reportNoShow.useMutation({ onSuccess: async () => { toast.success("무단 노쇼가 기록되었습니다."); await onSaved(); }, onError: error => toast.error(error.message) });

  if (assignment.status === "COMPLETED") {
    if (managerReview) return <div className="mt-3"><StatusPill tone="blue">근무 평가 작성 완료</StatusPill></div>;
    return <div className="mt-3">{open ? <div className="rounded-xl border border-[#d56835]/20 bg-[#fff7f1] p-3"><div className="flex items-center justify-between"><p className="text-sm font-extrabold text-[#523427]">근무 평가</p><button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-[#718079]">닫기</button></div><p className="mt-1 text-[11px] leading-5 text-[#874027]">완료된 일감에 대해 한 번만 저장되며, 제출 후 수정할 수 없습니다.</p><fieldset className="mt-3"><legend className="text-xs font-bold text-[#56615b]">근태</legend><div className="mt-2 grid grid-cols-2 gap-2"><Choice active={attendanceStatus === "NORMAL"} onClick={() => setAttendanceStatus("NORMAL")}>정상 근무</Choice><Choice active={attendanceStatus === "LATE"} onClick={() => setAttendanceStatus("LATE")}>지각</Choice></div></fieldset><fieldset className="mt-3"><legend className="text-xs font-bold text-[#56615b]">작업 숙련도</legend><div className="mt-2 grid grid-cols-5 gap-1.5">{[1, 2, 3, 4, 5].map(score => <button key={score} type="button" onClick={() => setSkillScore(score)} aria-label={`숙련도 ${score}점`} className={`grid h-9 place-items-center rounded-lg text-sm font-extrabold transition ${skillScore === score ? "bg-[#173d38] text-white" : "bg-white text-[#718079]"}`}>{score}</button>)}</div></fieldset><fieldset className="mt-3"><legend className="text-xs font-bold text-[#56615b]">안전수칙 준수</legend><div className="mt-2 grid grid-cols-2 gap-2"><Choice active={safetyStatus === "PASS"} onClick={() => setSafetyStatus("PASS")}>PASS</Choice><Choice active={safetyStatus === "FAIL"} danger onClick={() => setSafetyStatus("FAIL")}>FAIL</Choice></div></fieldset><Button type="button" disabled={review.isPending} onClick={() => review.mutate({ assignmentId: assignment.id, attendanceStatus, skillScore, safetyStatus })} className="mt-4 h-10 w-full rounded-xl bg-[#173d38] font-bold">{review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Star className="mr-1 h-4 w-4" />평가 제출하기</>}</Button></div> : <Button type="button" onClick={() => setOpen(true)} variant="outline" size="sm" className="w-full rounded-xl border-[#173d38]/20 text-[#173d38]"><Star className="mr-1 h-4 w-4" />근무 평가하기</Button>}</div>;
  }

  if (assignment.status === "ASSIGNED") return <div className="mt-3 rounded-xl bg-[#fff7f1] p-3"><p className="text-[11px] leading-5 text-[#874027]">근무일이 지난 뒤에도 출근 기록이 없으면 무단 노쇼로 기록할 수 있습니다.</p><Button type="button" disabled={noShow.isPending} onClick={() => { if (window.confirm("출근 기록이 없는지 확인했습니다. 이 인부를 무단 노쇼로 기록할까요?")) noShow.mutate({ assignmentId: assignment.id }); }} variant="outline" size="sm" className="mt-2 w-full rounded-xl border-[#d56835]/30 text-[#bf4239]">{noShow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><AlertTriangle className="mr-1 h-4 w-4" />무단 노쇼 기록</>}</Button></div>;
  if (assignment.status === "NO_SHOW") return <div className="mt-3"><StatusPill tone="red">무단 노쇼 기록됨</StatusPill></div>;
  return null;
}

function Choice({ active, danger = false, onClick, children }: { active: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`h-9 rounded-lg text-xs font-extrabold transition ${active ? danger ? "bg-[#bf4239] text-white" : "bg-[#173d38] text-white" : "bg-white text-[#718079]"}`}>{children}</button>;
}
