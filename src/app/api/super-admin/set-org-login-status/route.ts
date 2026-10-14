import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeTemporaryPassword } from "@/lib/leader-credentials";
import { recordSuperAdminActivity } from "@/lib/super-admin-activity";

export const runtime = "nodejs";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const sessionClient = await createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  if (userError || !user) return fail("Sign in as a superadmin to manage leader logins.", 401);

  const { data: adminProfile, error: profileError } = await sessionClient.from("profiles")
    .select("role,is_suspended").eq("user_id", user.id).maybeSingle();
  if (profileError || adminProfile?.role !== "superadmin" || adminProfile.is_suspended) {
    return fail("Only an active superadmin can manage leader logins.", 403);
  }

  let payload: { kind?: string; recordId?: number; action?: string };
  try {
    payload = await request.json() as { kind?: string; recordId?: number; action?: string };
  } catch {
    return fail("Invalid request.", 400);
  }
  if ((payload.kind !== "cell" && payload.kind !== "zone")
    || !Number.isSafeInteger(Number(payload.recordId)) || Number(payload.recordId) < 1
    || (payload.action !== "suspend" && payload.action !== "reactivate")) {
    return fail("Choose a cell or zone leader and a valid login action.", 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return fail("Server setup is incomplete. Ask the site administrator to configure the Supabase server key.", 503);

  const kind = payload.kind;
  const recordId = Number(payload.recordId);
  const action = payload.action;
  const role = kind === "cell" ? "cell_leader" : "zone_leader";
  const scopeColumn = kind === "cell" ? "cell_id" : "zone_id";
  const table = kind === "cell" ? "cells" : "zones";
  const admin = createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const [{ data: unit, error: unitError }, { data: leader, error: leaderError }] = await Promise.all([
    admin.from(table).select("id,name,is_active").eq("id", recordId).maybeSingle(),
    admin.from("profiles").select("user_id,username,role,is_suspended")
      .eq(scopeColumn, recordId).eq("role", role).maybeSingle(),
  ]);
  if (unitError || !unit) return fail(`The selected ${kind} was not found.`, 404);
  if (unit.is_active === false) return fail("Restore this unit before managing its leader login.", 409);
  if (leaderError) return fail("The leader assignment could not be checked. Contact the site administrator.", 409);
  if (!leader) return fail(`This ${kind} does not have a leader login yet.`, 404);
  if (action === "suspend" && leader.is_suspended) return fail("This leader login is already suspended.", 409);
  if (action === "reactivate" && !leader.is_suspended) return fail("This leader login is already active.", 409);

  if (action === "suspend") {
    const { error: profileUpdateError } = await admin.from("profiles")
      .update({ is_suspended: true }).eq("user_id", leader.user_id);
    if (profileUpdateError) {
      console.error("Leader suspension profile update failed:", profileUpdateError.message);
      return fail("We couldn't suspend this login. Try again or contact the site administrator.", 500);
    }
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(leader.user_id, {
      ban_duration: "876000h",
      password: makeTemporaryPassword(),
    });
    if (authUpdateError) {
      await admin.from("profiles").update({ is_suspended: false }).eq("user_id", leader.user_id);
      console.error("Leader Auth suspension failed:", authUpdateError.message);
      return fail("The login could not be disabled in Supabase Auth. The account was restored; try again.", 500);
    }
    const activityLogged = await recordSuperAdminActivity(admin, user.id, {
      action: "leader_login_suspended",
      entityType: "leader",
      entityId: recordId,
      entityName: String(unit.name),
      summary: `Suspended the ${kind} leader login for ${unit.name}.`,
    });
    return NextResponse.json({ success: true, action, kind, name: String(unit.name), activityLogged });
  }

  const password = makeTemporaryPassword();
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(leader.user_id, {
    ban_duration: "none",
    password,
  });
  if (authUpdateError) {
    console.error("Leader Auth reactivation failed:", authUpdateError.message);
    return fail("We couldn't reactivate this login. It remains suspended; try again.", 500);
  }
  const { error: profileUpdateError } = await admin.from("profiles")
    .update({ is_suspended: false }).eq("user_id", leader.user_id);
  if (profileUpdateError) {
    await admin.auth.admin.updateUserById(leader.user_id, { ban_duration: "876000h" });
    console.error("Leader reactivation profile update failed:", profileUpdateError.message);
    return fail("The login remains suspended because its status could not be safely updated. Try again.", 500);
  }

  const activityLogged = await recordSuperAdminActivity(admin, user.id, {
    action: "leader_login_reactivated",
    entityType: "leader",
    entityId: recordId,
    entityName: String(unit.name),
    summary: `Reactivated the ${kind} leader login for ${unit.name}.`,
  });

  return NextResponse.json({
    success: true,
    action,
    kind,
    name: String(unit.name),
    email: String(leader.username),
    password,
    role,
    recordId,
    activityLogged,
  });
}
