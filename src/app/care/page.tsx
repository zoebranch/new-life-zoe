import CareRequestPage from "@/components/care-request-page";
import { memberCareKinds, type CareKind } from "@/lib/care-requests";
export default async function CarePage({ searchParams }: { searchParams: Promise<{ request?: string | string[] }> }) {
  const { request } = await searchParams;
  const kind = typeof request === "string" && memberCareKinds.includes(request as CareKind) ? request as CareKind : "prayer";
  return <CareRequestPage key={kind} mode="care" initialKind={kind}/>;
}
