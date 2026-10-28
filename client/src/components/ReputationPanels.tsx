import * as React from "react";
import { AlertTriangle, Award, Loader2, ShieldCheck, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { remainingBanDays } from "@/lib/trustDisplay";

function useClock() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  return now;
}

export function JobPeriodTabs({ value, onChange, currentLabel = "현재 일감" }: { value: "CURRENT" | "PAST"; onChange: (value: "CURRENT" | "PAST") => void; currentLabel?: string }) {
  return <div className="grid grid-cols-2 gap-2 rounded-[1.3rem] bg-[#edf1ec] p-1.5" aria-label="일감 기간 선택">{([["CURRENT", currentLabel], ["PAST", "지난 일감"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`rounded-xl px-3 py-3 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173d38] ${value === id ? "bg-[#173d38] text-white shadow-sm" : "text-[#65726c]"}`}>{label}</button>)}</div>;
}

export function WorkerReputationBadges({ trust, now = Date.now() }: { trust?: any; now?: number }) {
  if (!trust) return null;
  const days = remainingBanDays(trust.applicationBanUntil, now);
  const banned = trust.isApplicationBanned && days > 0;
  const pill = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold";
  return <div className="flex flex-wrap gap-1.5" aria-label="인부 신뢰 상태">
    {trust.isBlacklisted ? <span className={`${pill} bg-[#fff0ef] text-[#b84236]`}>블랙리스트</span> : null}
    {banned ? <span className={`${pill} bg-[#fff4ed] text-[#b65c31]`}>신청 제한 · {days}일 남음</span> : null}
    {trust.noShowCount > 0 ? <span className={`${pill} bg-[#fff8df] text-[#9a6b16]`}>{trust.isBlacklisted || banned ? "노쇼" : "노쇼 경고"} {trust.noShowCount}회</span> : null}
    {trust.isExcellent ? <span className={`${pill} bg-[#ecf7ef] text-[#167054]`}>우수 인부</span> : null}
    {!trust.isBlacklisted && !banned && !trust.noShowCount && !trust.isExcellent ? <span className={`${pill} bg-[#e9f1ec] text-[#173d38]`}>제재 없음</span> : null}
  </div>;
}

export function ApplicantTrustBadge({ workerId }: { workerId: number }) {
  const trust = trpc.buildOnWorks.trust.workerSummary.useQuery({ workerId }, { refetchInterval: 60_000 });
  const now = useClock();
  return <div className="mt-2">{trust.isLoading ? <p className="text-[11px] text-[#718079]">신뢰 상태 확인 중</p> : trust.error ? <p className="text-[11px] text-[#bf4239]">신뢰 상태를 확인하지 못했습니다.</p> : <WorkerReputationBadges trust={trust.data} now={now} />}</div>;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl bg-[#f6f7f4] p-3"><p className="text-[11px] font-bold text-[#718079]">{label}</p><p className="mt-1 text-base font-extrabold text-[#173d38]">{value}</p></div>;
}

export function WorkerReputationContent({ trust, loading = false, error = false, now = Date.now() }: { trust?: any; loading?: boolean; error?: boolean; now?: number }) {
  const days = remainingBanDays(trust?.applicationBanUntil, now);
  const banned = trust?.isApplicationBanned && days > 0;
  return <section className="rounded-[1.5rem] border border-[#173d38]/10 bg-white p-5">
    <p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-[#d56835]" />내 신뢰·평가 현황</p>
    <p className="mt-1 text-xs leading-5 text-[#718079]">모든 인력소의 완료 평가와 노쇼 기록을 합산한 상태입니다.</p>
    {loading ? <p className="mt-4 flex items-center gap-2 text-sm text-[#718079]"><Loader2 className="h-4 w-4 animate-spin" />신뢰 정보 확인 중</p> : error || !trust ? <p className="mt-4 text-sm text-[#bf4239]">신뢰 정보를 불러오지 못했습니다. 다시 시도해 주세요.</p> : <>
      <div className="mt-4"><WorkerReputationBadges trust={trust} now={now} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><Fact label="블랙리스트 상태" value={trust.isBlacklisted ? "블랙리스트" : "해당 없음"} /><Fact label="신청 제한 남은 기간" value={banned ? `${days}일 남음` : "제한 없음"} /><Fact label="누적 노쇼" value={`${trust.noShowCount}회`} /><Fact label="우수 인부 등급" value={trust.isExcellent ? "우수 인부" : "일반 인부"} /><Fact label="숙련도 평균" value={trust.skillAverage == null ? "평가 대기" : `${trust.skillAverage} / 5`} /><Fact label="완료 평가·안전 준수" value={`${trust.reviewCount}건 · Pass ${trust.safetyPassCount}회`} /></div>
      <p className="mt-3 text-xs text-[#718079]">우수 평가 연속 {trust.excellentStreak} / 5회 · 지각 {trust.lateCount}회</p>
      {banned ? <p className="mt-3 rounded-xl bg-[#fff4ed] p-3 text-xs leading-5 text-[#b65c31]">신규 일감 신청 제한: {new Date(trust.applicationBanUntil).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}까지. 남은 일수는 24시간 단위로 올림한 값입니다.</p> : null}
      {trust.isBlacklisted ? <p className="mt-3 rounded-xl bg-[#fff0ef] p-3 text-xs leading-5 text-[#b84236]">블랙리스트는 신청 제한 기간이 끝나도 바로 해제되지 않습니다. 제한 종료 후 정상 출퇴근 완료 {trust.rehabilitationCompletedCount} / 7회에 도달하면 자동 해제됩니다.</p> : trust.noShowCount > 0 ? <p className="mt-3 text-xs leading-5 text-[#9a6b16]">노쇼 1~2회는 경고, 3회는 7일 신청 제한, 4회 이상은 14일 신청 제한과 블랙리스트 대상입니다.</p> : null}
    </>}
  </section>;
}

export function WorkerReputationPanel() {
  const trust = trpc.buildOnWorks.trust.mine.useQuery(undefined, { refetchInterval: 60_000 });
  return <WorkerReputationContent trust={trust.data} loading={trust.isLoading} error={!!trust.error} now={useClock()} />;
}

export function AgencyReputationContent({ agencyName, trust }: { agencyName: string; trust: any }) {
  return <div><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-bold"><Star className="h-5 w-5 text-[#d56835]" />내 인력소 평가</p><p className="mt-1 text-xs text-[#718079]">{agencyName} · 완료 일감 기반 인부 평가 {trust.reviewCount}건</p></div><span className="shrink-0 rounded-full bg-[#ecf7ef] px-2.5 py-1 text-[11px] font-extrabold text-[#167054]">{trust.isExcellent ? "우수 인력소" : "일반 인력소"}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><Fact label="현장 안전성 평균" value={trust.safetyAverage == null ? "평가 대기" : `${trust.safetyAverage} / 5`} /><Fact label="휴게·편의시설 평균" value={trust.facilitiesAverage == null ? "평가 대기" : `${trust.facilitiesAverage} / 5`} /><Fact label="우수 산정 정상 지급" value={`${trust.normalPaymentCount} / 10회`} /><Fact label="우수 산정 편의시설 3점 이상" value={`${trust.facilitiesAtLeast3Count} / 30회`} /></div><p className="mt-3 text-xs leading-5 text-[#718079]">인부의 노쇼·블랙리스트는 인부에게 적용되는 제재이며, 인력소장 개인 제재가 아닙니다. 인력소는 임금·안전·편의시설 평가로 신뢰를 산정합니다.</p></div>;
}

export function ManagerReputationPanel() {
  const data = trpc.buildOnWorks.trust.managerOverview.useQuery(undefined, { refetchInterval: 60_000 });
  const now = useClock();
  if (data.isLoading) return <section className="mt-5 rounded-[1.5rem] bg-white p-5 text-sm text-[#718079]">인력소 신뢰 현황 확인 중</section>;
  if (data.error) return <section className="mt-5 rounded-[1.5rem] bg-white p-5 text-sm text-[#bf4239]">인력소 평가를 불러오지 못했습니다.</section>;
  if (!data.data) return null;
  const { agency, trust, workers } = data.data;
  const visible = workers.filter(row => row.trust.noShowCount > 0 || row.trust.isExcellent || row.trust.isBlacklisted);
  return <section className="mt-5 space-y-5 rounded-[1.5rem] border border-[#173d38]/10 bg-white p-5"><AgencyReputationContent agencyName={agency.name} trust={trust} /><div className="border-t border-[#1d2422]/6 pt-4"><p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 text-[#d56835]" />관련 인부 신뢰 현황</p><p className="mt-1 text-xs leading-5 text-[#718079]">내 인력소에 가입하거나 일감을 신청한 인부만 표시합니다.</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><Fact label="블랙리스트" value={`${workers.filter(row => row.trust.isBlacklisted).length}명`} /><Fact label="노쇼 경고·주의" value={`${workers.filter(row => row.trust.noShowCount > 0 && !row.trust.isBlacklisted).length}명`} /><Fact label="우수 인부" value={`${workers.filter(row => row.trust.isExcellent).length}명`} /></div><div className="mt-3 space-y-2">{visible.length ? visible.map(row => <div key={row.profile.id} className="rounded-xl bg-[#f7f8f6] p-3"><p className="text-sm font-bold">{row.user.name ?? "이름 없음"}</p><div className="mt-2"><WorkerReputationBadges trust={row.trust} now={now} /></div>{row.trust.isBlacklisted ? <p className="mt-2 text-[11px] leading-5 text-[#b84236]">신청 제한 종료 후 정상 완료 {row.trust.rehabilitationCompletedCount} / 7회로 블랙리스트 해제</p> : null}</div>) : <p className="rounded-xl bg-[#f6f7f4] p-4 text-center text-xs text-[#718079]">블랙리스트·노쇼 경고·우수 등급 인부가 아직 없습니다.</p>}</div></div></section>;
}
