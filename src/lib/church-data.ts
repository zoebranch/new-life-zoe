import type { Cell, Zone } from "@/data/cells";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  user_id: string;
  username: string;
  display_name: string;
  role: "superadmin" | "zone_leader" | "cell_leader";
  cell_id: number | null;
  zone_id: number | null;
};

export function mapCell(row: Record<string, unknown>): Cell {
  return {
    id: Number(row.id), zoneId: Number(row.zone_id), name: String(row.name ?? ""),
    area: String(row.area ?? ""), leader: String(row.leader ?? ""), phone: String(row.phone ?? ""),
    meetingDay: String(row.meeting_day ?? "Tuesday"), meetingTime: String(row.meeting_time ?? "18:00 - 19:00"),
    members: Number(row.reported_member_count ?? 0),
  };
}

export function mapZone(row: Record<string, unknown>): Zone {
  return { id: Number(row.id), number: Number(row.number), name: String(row.name ?? ""), leader: String(row.leader ?? ""), phone: String(row.phone ?? "") };
}

export async function fetchPublicCells() {
  const supabase = createClient();
  const { data, error } = await supabase.from("cells")
    .select("id,zone_id,name,area,leader,phone,meeting_day,meeting_time,reported_member_count")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((row) => mapCell(row));
}

export async function fetchMyProfile() {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return null;
  const { data, error } = await supabase.from("profiles")
    .select("user_id,username,display_name,role,cell_id,zone_id")
    .eq("user_id", authData.user.id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

