import type { ReportDetails } from "@/lib/report-details";

export type FullReport = ReportDetails & {
  id: string | number; date: string; attendance: number; visitors: number; offeringAmount: number;
  evangelismDate: string | null; peopleReached: number; tracts: number; soulsWon: number;
  teamCount: number; contacts: number; evangelismNotes: string;
};

export function FullCellReport({ report: r, leader }: { report: FullReport; leader: string }) {
  const details = [
    ["Visitor names and details", r.visitorDetails], ["Follow-up progress", r.followUp],
    ["Evangelism location", r.evangelismLocation], ["Evangelism notes / testimony", r.evangelismNotes],
    ["Challenges", r.challenges], ["Prayer requests", r.prayerRequests],
  ];
  return <section className="rounded-xl border border-gray-600 p-4 my-3 text-sm">
    <h3 className="font-bold text-lg">Cell report · {r.date}</h3>
    <p className="text-xs mt-1">Cell leader: {leader || "Not recorded"} · Submitted by: {r.submittedBy || "Not recorded"} · Submitted: {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "Not recorded"}</p>
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
      {[["Attendance", r.attendance], ["Men", r.men ?? "Not recorded"], ["Women", r.women ?? "Not recorded"], ["Children", r.children ?? "Not recorded"], ["Visitors", r.visitors], ["Offering", r.offeringAmount.toFixed(2)], ["Evangelism date", r.evangelismDate || "Not recorded"], ["People reached", r.peopleReached], ["Tracts", r.tracts], ["Souls won", r.soulsWon], ["Team members", r.teamCount], ["Contacts", r.contacts]].map(([label, value]) => <div key={label}><dt className="text-xs opacity-70">{label}</dt><dd className="font-bold">{value}</dd></div>)}
    </dl>
    {details.map(([label, value]) => <div key={label} className="mt-3"><h4 className="font-bold text-xs">{label}</h4><p className="whitespace-pre-wrap break-words mt-1">{value || "Not recorded"}</p></div>)}
  </section>;
}
