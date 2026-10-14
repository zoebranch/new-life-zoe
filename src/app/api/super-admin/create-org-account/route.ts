import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeTemporaryPassword } from "@/lib/leader-credentials";
import { recordSuperAdminActivity } from "@/lib/super-admin-activity";
import {notifyLeaderAssignment} from "@/lib/leader-notification";

export const runtime = "nodejs";

type CreatePayload = {
  mode?: "new" | "existing";
  kind: "cell" | "zone";
  name?: string;
  leader?: string;
  email: string;
  phone?: string;
  area?: string;
  zoneId?: number;
  number?: number;
  recordId?: number;
  requestId?: string;
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const sessionClient = await createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  if (userError || !user) return fail("Sign in as a superadmin to create leaders.", 401);

  const { data: profile, error: profileError } = await sessionClient.from("profiles")
    .select("role,is_suspended").eq("user_id", user.id).maybeSingle();
  if (profileError || profile?.role !== "superadmin" || profile.is_suspended) return fail("Only an active superadmin can create cells, zones, and leader accounts.", 403);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return fail("Server setup is incomplete. Ask the site administrator to configure the Supabase server key.", 503);

  let payload: CreatePayload;
  try {
    payload = await request.json() as CreatePayload;
  } catch {
    return fail("Invalid request.", 400);
  }

  const kind = payload.kind;
  const mode = payload.mode === "existing" ? "existing" : "new";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const leader = typeof payload.leader === "string" ? payload.leader.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const area = typeof payload.area === "string" ? payload.area.trim() : "";
  const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
  if (requestId && (kind !== "cell" || mode !== "new" || !/^[0-9a-f-]{36}$/i.test(requestId))) {
    return fail("Choose a valid pending cell request.", 400);
  }
  if ((kind !== "cell" && kind !== "zone") || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("Enter a valid leader email address.", 400);
  }
  if (mode === "existing") {
    if (!Number.isSafeInteger(Number(payload.recordId)) || Number(payload.recordId) < 1) {
      return fail("Choose an existing cell or zone.", 400);
    }
  } else {
    if (!name || name.length > 120 || !leader || leader.length > 160) {
      return fail("Enter the name and leader name.", 400);
    }
    if (kind === "cell" && (!area || area.length > 120 || !Number.isSafeInteger(Number(payload.zoneId)))) {
      return fail("Choose a zone and enter the cell area.", 400);
    }
    if (kind === "zone" && (!Number.isSafeInteger(Number(payload.number)) || Number(payload.number) < 1)) {
      return fail("Enter a valid zone number.", 400);
    }
  }

  const admin = createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const role = kind === "cell" ? "cell_leader" : "zone_leader";
  const password = makeTemporaryPassword();
  let recordId: number | null = mode === "existing" ? Number(payload.recordId) : null;
  let recordName = name;
  let recordLeader = leader;
  let createdRecord = false;
  let createdUserId: string | null = null;
  let inviteWritten = false;

  try {
    if (requestId) {
      const {data: pending, error} = await admin.from("cell_creation_requests")
        .select("status,zone_id,cell_name,area,leader,phone").eq("id",requestId).maybeSingle();
      if (error) throw error;
      if (!pending || pending.status !== "pending") return fail("This request is no longer pending. Refresh the dashboard.",409);
      if (Number(pending.zone_id) !== Number(payload.zoneId) || pending.cell_name.trim().toUpperCase() !== name.toUpperCase()
        || pending.area.trim() !== area || pending.leader.trim().toUpperCase() !== leader.toUpperCase() || (pending.phone ?? "").trim() !== phone) {
        return fail("The request details changed. Refresh before approving it.",409);
      }
    }
    if (mode === "existing") {
      const table = kind === "cell" ? "cells" : "zones";
      const scopeColumn = kind === "cell" ? "cell_id" : "zone_id";
      const { data: existing, error: existingError } = await admin.from(table)
        .select("id,name,leader,is_active").eq("id", recordId).maybeSingle();
      if (existingError || !existing) return fail(`The selected ${kind} was not found. Refresh and try again.`, 404);
      if (existing.is_active === false) return fail(`Restore this ${kind} before creating a leader login.`, 409);
      if (kind === "cell") {
        const { data: cell, error: cellError } = await admin.from("cells").select("zone_id").eq("id", recordId).single();
        if (cellError) throw cellError;
        const { data: zone, error: zoneError } = await admin.from("zones").select("is_active").eq("id", cell.zone_id).single();
        if (zoneError) throw zoneError;
        if (!zone.is_active) return fail("Restore the cell’s zone before creating its leader login.", 409);
      }
      recordName = String(existing.name);
      recordLeader = String(existing.leader ?? "");
      const { data: assigned, error: assignedError } = await admin.from("profiles")
        .select("user_id").eq(scopeColumn, recordId).maybeSingle();
      if (assignedError) throw assignedError;
      if (assigned) return fail("This cell or zone already has a leader login.", 409);
    } else {
      if (kind === "cell") {
        const { data: zone, error: zoneError } = await admin.from("zones")
          .select("id,is_active").eq("id", Number(payload.zoneId)).maybeSingle();
        if (zoneError || !zone || zone.is_active === false) return fail("Choose an active zone for this cell.", 400);
        const { data, error } = await admin.from("cells").insert({
          zone_id: Number(payload.zoneId), name: name.toUpperCase(), area,
          leader: leader.toUpperCase(), phone, ...(requestId ? {creation_request_id:requestId} : {}),
        }).select("id").single();
        if (error) throw error;
        recordId = Number(data.id);
      } else {
        const { data, error } = await admin.from("zones").insert({
          number: Number(payload.number), name: name.toUpperCase(), leader: leader.toUpperCase(), phone,
        }).select("id").single();
        if (error) throw error;
        recordId = Number(data.id);
      }
      createdRecord = true;
    }

    const invite = {
      email, role, created_by: user.id,
      cell_id: kind === "cell" ? recordId : null,
      zone_id: kind === "zone" ? recordId : null,
    };
    const { error: inviteError } = await admin.from("leader_invites").insert(invite);
    if (inviteError) throw inviteError;
    inviteWritten = true;

    const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: recordLeader },
    });
    if (createUserError || !userData.user) throw createUserError ?? new Error("Supabase did not return the new leader account.");
    createdUserId = userData.user.id;

    const { data: newProfile, error: newProfileError } = await admin.from("profiles")
      .select("role,cell_id,zone_id").eq("user_id", createdUserId).maybeSingle();
    if (newProfileError || newProfile?.role !== role || (kind === "cell" ? newProfile.cell_id : newProfile.zone_id) !== recordId) {
      throw new Error("The leader account was created, but its role could not be confirmed.");
    }

    if (requestId) {
      const {data: reviewed,error} = await admin.from("cell_creation_requests").update({
        status:"approved", reviewed_at:new Date().toISOString(), reviewed_by:user.id,
      }).eq("id",requestId).eq("status","pending").select("id").maybeSingle();
      if (error || !reviewed) throw new Error("The request could not be approved; provisioning was rolled back.");
    }

    const activityLogged = await recordSuperAdminActivity(admin, user.id, {
      action: requestId ? "cell_request_approved" : mode === "existing" ? "leader_login_created" : "unit_created",
      entityType: requestId ? "cell_request" : mode === "existing" ? "leader" : kind,
      entityId: requestId ?? recordId,
      entityName: recordName,
      summary: requestId ? `Approved the cell request for ${recordName} and created its leader login.` : mode === "existing"
        ? `Created a leader login for ${kind} ${recordName}.`
        : `Created ${kind} ${recordName} and its leader login.`,
    }).catch(() => false);

    // Notification failure must never undo a successfully provisioned account.
    const notification = await notifyLeaderAssignment({userId:createdUserId,email,leader:recordLeader,kind,name:recordName.toUpperCase()});
    return NextResponse.json({
      success: true,
      kind,
      name: recordName,
      email,
      password,
      role,
      recordId,
      activityLogged,
      notification,
    });
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    if (inviteWritten) await admin.from("leader_invites").delete().eq("email", email);
    if (createdRecord && recordId !== null) {
      if (kind === "cell") await admin.from("cells").delete().eq("id", recordId);
      else await admin.from("zones").delete().eq("id", recordId);
    }
    const detail = error instanceof Error ? error.message : "Unknown Supabase error";
    console.error("Superadmin provisioning failed:", detail);
    return fail(`We couldn't create the ${kind} leader login. Check that this email is not already registered, then try again.`, 400);
  }
}
