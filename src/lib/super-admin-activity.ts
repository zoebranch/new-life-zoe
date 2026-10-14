import type { SupabaseClient } from "@supabase/supabase-js";

export type SuperAdminActivityAction =
  | "unit_created"
  | "leader_login_created"
  | "leader_password_reset"
  | "leader_login_suspended"
  | "leader_login_reactivated"
  | "leader_email_changed"
  | "unit_archived"
  | "unit_restored"
  | "cell_request_approved"
  | "cell_request_rejected";

export type SuperAdminActivityEntity = "cell" | "zone" | "leader" | "cell_request" | "join_request";

export async function recordSuperAdminActivity(
  client: SupabaseClient,
  actorId: string,
  activity: {
    action: SuperAdminActivityAction;
    entityType: SuperAdminActivityEntity;
    entityId?: string | number | null;
    entityName?: string;
    summary: string;
  },
) {
  const { error } = await client.from("super_admin_activity").insert({
    actor_id: actorId,
    action: activity.action,
    entity_type: activity.entityType,
    entity_id: activity.entityId == null ? null : String(activity.entityId),
    entity_name: activity.entityName ?? "",
    summary: activity.summary,
  });
  if (error) {
    console.error("Super Admin activity could not be recorded:", error.message);
    return false;
  }
  return true;
}
