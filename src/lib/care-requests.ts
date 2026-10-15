export const careKinds = {
  visit: { name: "Plan a visit", intro: "Let us know when you’re coming. We look forward to welcoming you." },
  appointment: { name: "Meet the pastor", intro: "Request a conversation with the pastor. Your appointment is confirmed only after the church approves it." },
  prayer: { name: "Request prayer", intro: "Send a private prayer request to your cell leader. Use your name and phone number as registered with your cell." },
  bereavement: { name: "Report a bereavement", intro: "Let the church know about a loss so we can offer support and discuss any funeral notice." },
  newborn: { name: "Share a newborn announcement", intro: "Share the good news with the church care team." },
  hospital: { name: "Report a hospital admission", intro: "Let the church care team know someone needs support. Share only the details needed to arrange care." },
  other: { name: "Other care concern", intro: "Tell the church secretary about an accident or another concern that may need prayer, a visit, or support." },
} as const;
export type CareKind = keyof typeof careKinds;
export const memberCareKinds: CareKind[] = ["prayer", "bereavement", "newborn", "hospital", "other"];
export function localDateToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
