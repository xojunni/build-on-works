import * as React from "react";
import { BadgeCheck, CalendarDays, CreditCard, Phone, UserRound } from "lucide-react";

type WorkerDetailRow = {
  user: { name: string | null; phone: string | null };
  profile: {
    phone: string | null;
    certificate: string | null;
    bankName: string | null;
    bankAccount: string;
  };
  age: number | null;
};

export function WorkerDetailCard({ row }: { row: WorkerDetailRow }) {
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
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f6f7f4] p-3">
      <p className="flex items-center gap-1 text-[11px] font-bold text-[#718079]"><Icon className="h-3 w-3 text-[#d56835]" />{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-[#26312d]">{value}</p>
    </div>
  );
}
