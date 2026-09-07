type WorkerProfileDetail = {
  id: number;
  birthDate: Date | null;
  certificate: string | null;
  phone: string | null;
  bankName: string | null;
  bankAccount: string | null;
  status: string;
};

type WorkerUserDetail = {
  id: number;
  name: string | null;
  phone: string | null;
};

export function ageFromBirthDate(birthDate: Date | null, referenceDate = new Date()) {
  if (!birthDate) return null;
  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayThisYear = new Date(Date.UTC(referenceDate.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate()));
  if (referenceDate < birthdayThisYear) age -= 1;
  return Math.max(0, age);
}

export function maskBankAccount(account: string | null) {
  if (!account) return "등록되지 않음";
  const compact = account.replace(/\s|-/g, "");
  if (compact.length <= 4) return "••••";
  return `•••• ${compact.slice(-4)}`;
}

export function toManagerWorkerDetail(row: { profile: WorkerProfileDetail; user: WorkerUserDetail }) {
  return {
    profile: {
      id: row.profile.id,
      birthDate: row.profile.birthDate,
      certificate: row.profile.certificate,
      phone: row.profile.phone,
      bankName: row.profile.bankName,
      bankAccount: maskBankAccount(row.profile.bankAccount),
      status: row.profile.status,
    },
    user: {
      id: row.user.id,
      name: row.user.name,
      phone: row.user.phone,
    },
    age: ageFromBirthDate(row.profile.birthDate),
  };
}
