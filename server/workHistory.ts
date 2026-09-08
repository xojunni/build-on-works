export type CompletedWorkEntry = {
  assignmentId: number;
  status: string;
  completedAt: Date | null;
  job: {
    id: number;
    title: string;
    jobDate: Date;
    agencyId: number;
  };
  agency: {
    id: number;
    name: string;
    region: string;
  };
};

export function summarizeWorkHistory(entries: CompletedWorkEntry[], currentAgencyId?: number) {
  const completed = entries
    .filter(entry => entry.status === "COMPLETED")
    .sort((a, b) => (b.completedAt ?? b.job.jobDate).getTime() - (a.completedAt ?? a.job.jobDate).getTime());
  const byAgency = new Map<number, { agency: CompletedWorkEntry["agency"]; completedCount: number }>();

  for (const entry of completed) {
    const current = byAgency.get(entry.agency.id);
    byAgency.set(entry.agency.id, current ? { ...current, completedCount: current.completedCount + 1 } : { agency: entry.agency, completedCount: 1 });
  }

  return {
    totalCompleted: completed.length,
    currentAgencyCompleted: currentAgencyId ? completed.filter(entry => entry.agency.id === currentAgencyId).length : null,
    agencies: Array.from(byAgency.values()).sort((a, b) => b.completedCount - a.completedCount || a.agency.name.localeCompare(b.agency.name)),
    recentJobs: completed.map(entry => ({
      assignmentId: entry.assignmentId,
      title: entry.job.title,
      jobDate: entry.job.jobDate,
      completedAt: entry.completedAt,
      agency: entry.agency,
    })),
  };
}
