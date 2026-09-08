import * as React from "react";
import { BadgeCheck, BriefcaseBusiness, CalendarDays, CreditCard, Loader2, Phone, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc";

type WorkerDetailRow = {
  user: { name: string | null; phone: string | null };
  profile: {
    id: number;
    phone: string | null;
    certificate: string | null;
    bankName: string | null;
    bankAccount: string;
  };
  age: number | null;
};

export function WorkerDetailCard({ row }: { row: WorkerDetailRow }) {
  const history = trpc.buildOnWorks.workHistory.managerWorker.useQuery({ workerId: row.profile.id });
  return <WorkerDetailContent row={row} history={history.data} loading={history.isLoading} />;
}

export function WorkerDetailContent({ row, history, loading }: { row: WorkerDetailRow; history?: any; loading?: boolean }) {
  const phone = row.profile.phone || row.user.phone || "등록되지 않음";
  return (
    <div className="mt-3 rounded-2xl border border-[#173d38]/10 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Detail icon={UserRound} label="이름" value={row.user.name || "이름 없음"} />
        <Detail icon={CalendarDays} label="나이" value={row.age === null ? "생년월일 미등록" : `만 ${row.age}세`} />
        <Detail icon={Phone} label="연락처" value={phone} />
        <Detail icon={BadgeCheck} label="이수증 번호" value={row.profile.certificate || "등록되지 않음"} />
      </div>
      <div className="mt-3 border-t border-[#1d2422]/6 pt-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#56615b]"><CreditCard className="h-3.5 w-3.5 text-[#d56835]" />급여 계좌 <span className="font-normal text-[#8a958f]">· 일부 마스킹</span></p>
        <p className="mt-1 text-sm font-bold text-[#1d2422]">{row.profile.bankName || "은행 미등록"} {row.profile.bankAccount}</p>
      </div>
      <section className="mt-3 border-t border-[#1d2422]/6 pt-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#56615b]"><BriefcaseBusiness className="h-3.5 w-3.5 text-[#d56835]" />실제 근무 이력 <span className="font-normal text-[#8a958f]">· 완료 일감 기준</span></p>
        {loading ? <div className="mt-3 flex items-center gap-2 text-xs text-[#718079]"><Loader2 className="h-3.5 w-3.5 animate-spin" />근무 이력 확인 중</div> : history ? <WorkHistory history={history} /> : <p className="mt-2 text-xs text-[#718079]">근무 이력을 불러올 수 없습니다.</p>}
      </section>
    </div>
  );
}

function WorkHistory({ history }: { history: any }) {
  return <div className="mt-3 space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f6f7f4] p-3"><p className="text-[11px] font-bold text-[#718079]">전체 완료</p><p className="mt-1 text-lg font-extrabold text-[#173d38]">{history.totalCompleted}회</p></div><div className="rounded-xl bg-[#fff4ed] p-3"><p className="text-[11px] font-bold text-[#a14d2d]">내 인력소 완료</p><p className="mt-1 text-lg font-extrabold text-[#d56835]">{history.currentAgencyCompleted ?? 0}회</p></div></div>{history.agencies.length ? <div><p className="text-[11px] font-bold text-[#718079]">실제 근무 인력소</p><div className="mt-2 space-y-1.5">{history.agencies.map((item: any) => <div key={item.agency.id} className="flex items-center justify-between rounded-lg bg-[#f6f7f4] px-3 py-2"><span className="truncate text-xs font-bold text-[#26312d]">{item.agency.name}</span><span className="text-xs font-extrabold text-[#d56835]">{item.completedCount}회</span></div>)}</div></div> : <p className="rounded-xl bg-[#f6f7f4] p-3 text-center text-xs text-[#718079]">완료한 일감이 아직 없습니다.</p>}{history.recentJobs.length ? <div><p className="text-[11px] font-bold text-[#718079]">최근 완료 일감</p><div className="mt-2 space-y-1.5">{history.recentJobs.slice(0, 3).map((job: any) => <div key={job.assignmentId} className="rounded-lg border border-[#1d2422]/5 px-3 py-2"><p className="truncate text-xs font-bold text-[#26312d]">{job.title}</p><p className="mt-0.5 text-[11px] text-[#718079]">{job.agency.name}</p></div>)}</div></div> : null}</div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f6f7f4] p-3">
      <p className="flex items-center gap-1 text-[11px] font-bold text-[#718079]"><Icon className="h-3 w-3 text-[#d56835]" />{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-[#26312d]">{value}</p>
    </div>
  );
}
