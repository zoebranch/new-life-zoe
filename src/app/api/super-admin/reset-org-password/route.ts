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
  if (userError || !user) return fail("Sign in as a superadmin to reset a leader password.", 401);

  const { data: profile, error: profileError } = await sessionClient.from("profiles")
    .select("role,is_suspended").eq("user_id", user.id).maybeSingle();
  if (profileError || profile?.role !== "superadmin" || profile.is_suspended) return fail("Only an active superadmin can reset leader passwords.", 403);

  let payload: { kind?: string; recordId?: number };
  try {
    payload = await request.json() as { kind?: string; recordId?: number };
  } catch {
    return fail("Invalid request.", 400);
  }
  if ((payload.kind !== "cell" && payload.kind !== "zone") || !Number.isSafeInteger(Number(payload.recordId)) || Number(payload.recordId) < 1) {
    return fail("Choose an existing cell or zone.", 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return fail("Server setup is incomplete. Ask the site administrator to configure the Supabase server key.", 503);

  const kind = payload.kind;
  const recordId = Number(payload.recordId);
  const role = kind === "cell" ? "cell_leader" : "zone_leader";
  const scopeColumn = kind === "cell" ? "cell_id" : "zone_id";
  const table = kind === "cell" ? "cells" : "zones";
  const admin = createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const [{ data: record, error: recordError }, { data: assigned, error: assignmentError }] = await Promise.all([
    admin.from(table).select("id,name,leader,is_active").eq("id", recordId).maybeSingle(),
    admin.from("profiles").select("user_id,username,role,is_suspended").eq(scopeColumn, recordId).eq("role", role).maybeSingle(),
  ]);
  if (recordError || !record) return fail(`The selected ${kind} was not found.`, 404);
  if (record.is_active === false) return fail("Restore this cell or zone before resetting its leader password.", 409);
  if (assignmentError) return fail("This unit has more than one leader login or its assignment couldn't be checked. Contact the site administrator.", 409);
  if (!assigned) return fail("This cell or zone does not have a leader login yet. Use Create login for an existing leader first.", 404);
  if (assigned.is_suspended) return fail("This leader's login is suspended. Reactivate it to issue new sign-in details.", 409);

  const password = makeTemporaryPassword();
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(assigned.user_id, { password });
  if (updateError || !updated.user) {
    console.error("Superadmin leader password reset failed:", updateError?.message ?? "Supabase returned no user.");
    return fail("We couldn't reset this leader's password. Try again or contact the site administrator.", 400);
  }

  const activityLogged = await recordSuperAdminActivity(admin, user.id, {
    action: "leader_password_reset",
    entityType: "leader",
    entityId: recordId,
    entityName: String(record.name),
    summary: `Issued a new temporary password for the ${kind} leader of ${record.name}.`,
  });

  return NextResponse.json({
    success: true,
    kind,
    name: String(record.name),
    email: String(assigned.username),
    password,
    role,
    recordId,
    activityLogged,
  });
}
