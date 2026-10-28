import { Building2, Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusPill } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export function WorkerAgencyReviewAction({ assignment, review, onSaved }: { assignment: { id: number; status: string }; review: any; onSaved: () => Promise<unknown> | void }) {
  const [open, setOpen] = useState(false);
  const [wageStatus, setWageStatus] = useState<"NORMAL" | "LATE" | "UNPAID">("NORMAL");
  const [siteSafetyScore, setSiteSafetyScore] = useState(3);
  const [facilitiesScore, setFacilitiesScore] = useState(3);
  const submit = trpc.buildOnWorks.trust.submitWorkerAgencyReview.useMutation({ onSuccess: async () => { toast.success("인력소 평가가 저장되었습니다."); setOpen(false); await onSaved(); }, onError: error => toast.error(error.message) });
  if (assignment.status !== "COMPLETED") return null;
  if (review) return <div className="mt-4"><StatusPill tone="blue">인력소 평가 작성 완료</StatusPill></div>;
  if (!open) return <Button type="button" onClick={() => setOpen(true)} variant="outline" size="sm" className="mt-4 rounded-xl border-[#173d38]/20 text-[#173d38]"><Building2 className="mr-1 h-4 w-4" />이 인력소 평가하기</Button>;
  return <div className="mt-4 rounded-xl border border-[#173d38]/15 bg-[#f1f7f3] p-3"><div className="flex items-center justify-between"><p className="text-sm font-extrabold text-[#173d38]">인력소 평가</p><button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-[#718079]">닫기</button></div><p className="mt-1 text-[11px] leading-5 text-[#56615b]">실제 근무 경험을 기준으로 한 번만 작성할 수 있습니다.</p><fieldset className="mt-3"><legend className="text-xs font-bold text-[#56615b]">임금 지급 상태</legend><div className="mt-2 grid grid-cols-3 gap-1.5"><Choice active={wageStatus === "NORMAL"} onClick={() => setWageStatus("NORMAL")}>정상</Choice><Choice active={wageStatus === "LATE"} onClick={() => setWageStatus("LATE")}>지연</Choice><Choice active={wageStatus === "UNPAID"} danger onClick={() => setWageStatus("UNPAID")}>미지급</Choice></div></fieldset><ScoreSelect label="현장 안전성" value={siteSafetyScore} onChange={setSiteSafetyScore} /><ScoreSelect label="휴게·편의시설" value={facilitiesScore} onChange={setFacilitiesScore} /><Button type="button" disabled={submit.isPending} onClick={() => submit.mutate({ assignmentId: assignment.id, wageStatus, siteSafetyScore, facilitiesScore })} className="mt-4 h-10 w-full rounded-xl bg-[#173d38] font-bold">{submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Star className="mr-1 h-4 w-4" />평가 제출하기</>}</Button></div>;
}

function ScoreSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <fieldset className="mt-3"><legend className="text-xs font-bold text-[#56615b]">{label}</legend><div className="mt-2 grid grid-cols-5 gap-1.5">{[1, 2, 3, 4, 5].map(score => <button key={score} type="button" onClick={() => onChange(score)} aria-label={`${label} ${score}점`} className={`grid h-9 place-items-center rounded-lg text-sm font-extrabold transition ${value === score ? "bg-[#173d38] text-white" : "bg-white text-[#718079]"}`}>{score}</button>)}</div></fieldset>;
}

function Choice({ active, danger = false, onClick, children }: { active: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`h-9 rounded-lg text-xs font-extrabold transition ${active ? danger ? "bg-[#bf4239] text-white" : "bg-[#173d38] text-white" : "bg-white text-[#718079]"}`}>{children}</button>;
}
