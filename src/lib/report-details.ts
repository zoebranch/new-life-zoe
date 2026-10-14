export type ReportDetails = {
  men: number | null; women: number | null; children: number | null;
  visitorDetails: string; followUp: string; evangelismLocation: string;
  challenges: string; prayerRequests: string; submittedAt: string; submittedBy: string;
};

// A dated attendance record is not itself an evangelism activity.
export function hasEvangelismActivity(report: {
  peopleReached: number; tracts: number; soulsWon: number; teamCount: number; contacts: number;
  evangelismNotes: string; evangelismLocation?: string;
}) {
  return [report.peopleReached, report.tracts, report.soulsWon, report.teamCount, report.contacts].some(count => count > 0)
    || Boolean(report.evangelismNotes.trim() || report.evangelismLocation?.trim());
}

export function mapReportDetails(row: Record<string, unknown>): ReportDetails {
  const count = (key: string) => row[key] == null ? null : Number(row[key]);
  return {
    men: count("attendance_men"), women: count("attendance_women"), children: count("attendance_children"),
    visitorDetails: String(row.visitor_details ?? ""), followUp: String(row.follow_up ?? ""),
    evangelismLocation: String(row.evangelism_location ?? ""), challenges: String(row.challenges ?? ""),
    prayerRequests: String(row.prayer_requests ?? ""), submittedAt: String(row.created_at ?? ""),
    submittedBy: String(row.reporter_name ?? ""),
  };
}

export const emptyDetailedForm = { men: "", women: "", children: "", visitorDetails: "", followUp: "", evangelismLocation: "", challenges: "", prayerRequests: "" };
