import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordSuperAdminActivity } from "@/lib/super-admin-activity";

export const runtime = "nodejs";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const sessionClient = await createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  if (userError || !user) return fail("Sign in as a superadmin to change a leader email.", 401);

  const { data: adminProfile, error: profileError } = await sessionClient.from("profiles")
    .select("role,is_suspended").eq("user_id", user.id).maybeSingle();
  if (profileError || adminProfile?.role !== "superadmin" || adminProfile.is_suspended) {
    return fail("Only an active superadmin can change leader emails.", 403);
  }

  let payload: { kind?: string; recordId?: number; email?: string };
  try {
    payload = await request.json() as { kind?: string; recordId?: number; email?: string };
  } catch {
    return fail("Invalid request.", 400);
  }

  const kind = payload.kind;
  const recordId = Number(payload.recordId);
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if ((kind !== "cell" && kind !== "zone") || !Number.isSafeInteger(recordId) || recordId < 1) {
    return fail("Choose an assigned cell or zone leader.", 400);
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("Enter a valid new email address.", 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return fail("Server setup is incomplete. Ask the site administrator to configure the Supabase server key.", 503);

  const role = kind === "cell" ? "cell_leader" : "zone_leader";
  const scopeColumn = kind === "cell" ? "cell_id" : "zone_id";
  const table = kind === "cell" ? "cells" : "zones";
  const admin = createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const [{ data: unit, error: unitError }, { data: leader, error: leaderError }] = await Promise.all([
    admin.from(table).select("id,name").eq("id", recordId).maybeSingle(),
    admin.from("profiles").select("user_id,username,role,is_suspended")
      .eq(scopeColumn, recordId).eq("role", role).maybeSingle(),
  ]);
  if (unitError || !unit) return fail(`The selected ${kind} was not found.`, 404);
  if (leaderError) return fail("The leader assignment could not be checked. Contact the site administrator.", 409);
  if (!leader) return fail(`This ${kind} does not have a leader login yet.`, 404);
  if (String(leader.username).toLowerCase() === email) return fail("Enter an email address different from the current one.", 400);

  const [{ data: conflictingProfiles, error: conflictError }, { data: pendingInvite, error: inviteError }, { data: authResult, error: authReadError }] = await Promise.all([
    admin.from("profiles").select("user_id,username").eq("username", email),
    admin.from("leader_invites").select("email").eq("email", email).maybeSingle(),
    admin.auth.admin.getUserById(leader.user_id),
  ]);
  if (conflictError) return fail("The new email could not be checked. Try again.", 409);
  if (inviteError) return fail("The new email could not be checked. Try again.", 409);
  if (conflictingProfiles?.some((profile) => profile.user_id !== leader.user_id)) return fail("That email is already assigned to another church login.", 409);
  if (pendingInvite) return fail("That email is reserved for another leader account that has not been activated yet.", 409);
  if (authReadError || !authResult.user?.email || authResult.user.email.toLowerCase() !== String(leader.username).toLowerCase()) {
    return fail("The login email does not match its church profile. Contact the site administrator before changing it.", 409);
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(leader.user_id, {
    email,
    email_confirm: true,
  });
  if (authUpdateError) {
    console.error("Superadmin leader email change failed:", authUpdateError.message);
    return fail("We couldn't update that email. Confirm it is correct and is not already registered, then try again.", 400);
  }

  const { data: updatedProfile, error: profileUpdateError } = await admin.from("profiles")
    .update({ username: email }).eq("user_id", leader.user_id).select("user_id").maybeSingle();
  if (profileUpdateError || !updatedProfile) {
    const { error: rollbackError } = await admin.auth.admin.updateUserById(leader.user_id, {
      email: authResult.user.email,
      email_confirm: true,
    });
    if (rollbackError) console.error("Leader email rollback failed after profile update error:", rollbackError.message);
    console.error("Superadmin leader email profile update failed:", profileUpdateError?.message ?? "Profile was not updated.");
    return fail("The login email could not be safely synchronized. Contact the site administrator before retrying.", 500);
  }

  const activityLogged = await recordSuperAdminActivity(admin, user.id, {
    action: "leader_email_changed",
    entityType: "leader",
    entityId: recordId,
    entityName: String(unit.name),
    summary: `Changed the login email for the ${kind} leader of ${unit.name}.`,
  });

  return NextResponse.json({
    success: true,
    kind,
    name: String(unit.name),
    oldEmail: String(leader.username),
    email,
    role,
    recordId,
    passwordChanged: false,
    activityLogged,
  });
}
