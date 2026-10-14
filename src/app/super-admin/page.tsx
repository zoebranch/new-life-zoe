"use client";
import {fetchAllRows} from "@/lib/fetch-all-rows";
import {useDashboardRefresh} from "@/lib/use-dashboard-refresh";
import Link from "next/link";
import RegionalCellReports from "@/components/regional-cell-reports";
import UnitLeaderEditor from "@/components/unit-leader-editor";
import CareRequestInbox from "@/components/care-request-inbox";
import MinistryRequestInbox from "@/components/ministry-request-inbox";
import ZoneReportInbox from "@/components/zone-report-inbox";
import "./dashboard.css";
import { useState, useEffect, useCallback } from "react";
import { SiteImage } from "@/components/site-image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mapCell, mapZone } from "@/lib/church-data";
import { recordSuperAdminActivity, type SuperAdminActivityAction, type SuperAdminActivityEntity } from "@/lib/super-admin-activity";
import type { Cell, Member, Zone } from "@/data/cells";

type CellRequest = {
  id: string;
  cellName: string;
  area: string;
  leader: string;
  phone: string;
  zoneId: number;
  zoneName: string;
  requestedBy: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  date: string;
};

type JoinRequest = {
  id: string;
  cell_id: number;
  name: string;
  gender: "Male" | "Female";
  age: number;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  cells: { name: string }[] | null;
};

type IssuedCredentials = {
  notification?: {status:"accepted"|"not_configured"|"failed"; message:string};
  success: boolean;
  kind: "cell" | "zone";
  name: string;
  email: string;
  password: string;
  role: "cell_leader" | "zone_leader";
  recordId: number;
  purpose?: "created" | "reset" | "reactivated";
};

type LeaderAccount = {
  user_id: string;
  username: string;
  display_name: string;
  role: "cell_leader" | "zone_leader";
  cell_id: number | null;
  zone_id: number | null;
  is_suspended: boolean;
};

type ManagedCell = Cell & { isActive: boolean };
type ManagedZone = Zone & { isActive: boolean };
type EmailChangeTarget = {
  kind: "cell" | "zone";
  recordId: number;
  unitName: string;
  displayName: string;
  currentEmail: string;
};

type AdminActivity = {
  id: string;
  action: SuperAdminActivityAction;
  entity_type: SuperAdminActivityEntity;
  entity_name: string;
  summary: string;
  created_at: string;
};

function TopBar({ hideMenu = false, onHome, onMenuToggle }: { hideMenu?: boolean; onHome: () => void; onMenuToggle: () => void }) {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl h-[64px] flex items-center border-b border-black/5">
      <div className="w-full px-5 md:px-10 flex items-center justify-between">
        <div onClick={onHome} className="flex items-center gap-3.5 cursor-pointer">
          <SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="Zoe Church" width={42} height={42} className="w-[42px] h-[42px] rounded-full object-contain bg-white" />
          <div className="leading-[0.9]"><p className="font-black text-[12.5px] text-black">NEW LIFE CHRISTIAN CENTER</p><p className="font-black text-[10px] tracking-[0.18em] text-[#E10600] mt-[2px]">ZOE BRANCH</p></div>
        </div>
        {!hideMenu && (<button onClick={onMenuToggle} aria-label="Open dashboard menu" className="w-10 h-10 flex flex-col items-center justify-center gap-[5px]"><span className="w-6 h-[2px] bg-black block rounded-full"/><span className="w-6 h-[2px] bg-black block rounded-full"/><span className="w-6 h-[2px] bg-black block rounded-full"/></button>)}
      </div>
    </header>
  );
}

export default function SuperAdmin() {
 const revision=useDashboardRefresh();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cells, setCells] = useState<ManagedCell[]>([]);
  const [zones, setZones] = useState<ManagedZone[]>([]);
  const [leaderAccounts, setLeaderAccounts] = useState<LeaderAccount[]>([]);
  const [leaderAccountsError, setLeaderAccountsError] = useState("");
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [activityLoadError, setActivityLoadError] = useState("");
  const [activityNotice, setActivityNotice] = useState("");
  const [dashboardLoadErrors, setDashboardLoadErrors] = useState<string[]>([]);
  const [requests, setRequests] = useState<CellRequest[]>([]);
  const [pendingCareCount,setPendingCareCount]=useState(0);
  const [pendingMinistryCount,setPendingMinistryCount]=useState(0);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<"overview"|"cells"|"zones"|"accounts"|"requests">("overview");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark"|"light">("light");
  const [showDeleteManager, setShowDeleteManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCellsDetail, setShowCellsDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", area:"", leader:"", phone:"", email:"", zoneId:"1" });
  const [zoneForm, setZoneForm] = useState({ number:"", name:"", leader:"", phone:"", email:"" });
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState("");
  const [issuedCredentials, setIssuedCredentials] = useState<IssuedCredentials | null>(null);
  const [showExistingLoginForm, setShowExistingLoginForm] = useState(false);
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);
  const [existingLoginForm, setExistingLoginForm] = useState({ kind: "cell" as "cell" | "zone", recordId: "", email: "" });
  const [resetPasswordForm, setResetPasswordForm] = useState({ kind: "cell" as "cell" | "zone", recordId: "" });
  const [requestToProvision, setRequestToProvision] = useState<CellRequest | null>(null);
  const [requestLeaderEmail, setRequestLeaderEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingCellId, setChangingCellId] = useState<number | null>(null);
  const [changingZoneId, setChangingZoneId] = useState<number | null>(null);
  const [changingLeaderKey, setChangingLeaderKey] = useState<string | null>(null);
  const [emailChangeTarget, setEmailChangeTarget] = useState<EmailChangeTarget | null>(null);
  const [newLeaderEmail, setNewLeaderEmail] = useState("");
  const [emailChangeConfirmed, setEmailChangeConfirmed] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [leaderEmailNotice, setLeaderEmailNotice] = useState("");
  const [notificationNotice,setNotificationNotice]=useState("");
  const [notifyingLeader,setNotifyingLeader]=useState<string|null>(null);

  const notifyLeader = async (userId:string) => {
    setNotifyingLeader(userId);setNotificationNotice("");
    try {
      const response=await fetch("/api/super-admin/notify-leader",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId})});
      const result=await response.json();
      setNotificationNotice(result.notification?.message||result.error||"The notification could not be sent.");
    } catch {setNotificationNotice("The notification could not be sent. Please try again.");}
    finally {setNotifyingLeader(null);}
  };

  const refreshData = useCallback(async () => {
    const supabase = createClient();
    const [cellsResult, zonesResult, requestsResult, leaderAccountsResult, activityResult] = await Promise.all([
      fetchAllRows((from,to) => supabase.from("cells").select("id,zone_id,name,area,leader,phone,meeting_day,meeting_time,reported_member_count,is_active").order("name").order("id").range(from,to)),
      fetchAllRows((from,to) => supabase.from("zones").select("id,number,name,leader,phone,is_active").order("number").order("id").range(from,to)),
      fetchAllRows((from,to) => supabase.from("cell_creation_requests").select("id,zone_id,cell_name,area,leader,phone,reason,status,created_at,requested_by").order("created_at", { ascending: false }).order("id").range(from,to)),
      fetchAllRows((from,to) => supabase.from("profiles").select("user_id,username,display_name,role,cell_id,zone_id,is_suspended").in("role", ["cell_leader", "zone_leader"]).order("display_name").order("user_id").range(from,to)),
      supabase.from("super_admin_activity").select("id,action,entity_type,entity_name,summary,created_at").order("created_at", { ascending: false }).limit(8),
    ]);
    const loadErrors: string[] = [];
    if (!cellsResult.error) setCells((cellsResult.data ?? []).map((row) => ({ ...mapCell(row), isActive: row.is_active })));
    else loadErrors.push("Cells could not be loaded. Refresh the dashboard and try again.");
    if (!zonesResult.error) setZones((zonesResult.data ?? []).map((row) => ({ ...mapZone(row), isActive: row.is_active })));
    else loadErrors.push("Zones could not be loaded. Refresh the dashboard and try again.");
    if (leaderAccountsResult.error) {
      const missingSuspensionSchema = leaderAccountsResult.error.code === "42703";
      setLeaderAccountsError(missingSuspensionSchema
        ? "Leader accounts are temporarily unavailable. Please contact your administrator."
        : "Leader logins could not be loaded. Refresh the dashboard and try again.");
    } else {
      setLeaderAccountsError("");
      setLeaderAccounts((leaderAccountsResult.data ?? []).map((row) => ({
        ...row,
        role: row.role as LeaderAccount["role"],
        cell_id: row.cell_id === null ? null : Number(row.cell_id),
        zone_id: row.zone_id === null ? null : Number(row.zone_id),
      })));
    }
    if (activityResult.error) {
      setActivityLoadError("Recent activity is temporarily unavailable. Please try again later.");
    } else {
      setActivityLoadError("");
      setActivity(activityResult.data as AdminActivity[]);
    }
    if (requestsResult.error) loadErrors.push("Cell creation requests could not be loaded. Refresh the dashboard and try again.");
    if (!requestsResult.error) {
      const zoneNames = new Map((zonesResult.data ?? []).map((zone) => [Number(zone.id), zone.name]));
      const requesterIds = (requestsResult.data ?? []).map((row) => row.requested_by);
      const { data: requesterRows } = requesterIds.length
        ? await supabase.from("profiles").select("user_id,display_name,username").in("user_id", requesterIds)
        : { data: [] };
      const requesterNames = new Map((requesterRows ?? []).map((profile) => [profile.user_id, profile.display_name || profile.username]));
      setRequests((requestsResult.data ?? []).map((row) => ({
        id: row.id, cellName: row.cell_name, area: row.area, leader: row.leader,
        phone: row.phone, zoneId: Number(row.zone_id), zoneName: zoneNames.get(Number(row.zone_id)) ?? "Unknown zone",
        requestedBy: requesterNames.get(row.requested_by) ?? "Zone leader", reason: row.reason, status: row.status,
        date: row.created_at,
      })));
    }
    setDashboardLoadErrors(loadErrors);
    return loadErrors;
  }, []);

  const saveActivity = async (entry: {
    action: SuperAdminActivityAction;
    entityType: SuperAdminActivityEntity;
    entityId?: string | number | null;
    entityName?: string;
    summary: string;
  }) => {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      setActivityNotice("The action completed, but its history could not be saved. Refresh and check your Super Admin session.");
      return false;
    }
    const saved = await recordSuperAdminActivity(supabase, user.id, entry);
    setActivityNotice(saved ? "" : "The action completed, but its activity record could not be saved.");
    return saved;
  };

  const noteServerActivity = (logged: boolean | undefined) => {
    setActivityNotice(logged === false
      ? "The action completed, but its activity record could not be saved."
      : "");
  };

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/leaders"); return; }
      const { data: profile, error } = await supabase.from("profiles").select("role,is_suspended").eq("user_id", user.id).maybeSingle();
      if (error || profile?.is_suspended || profile?.role !== "superadmin") { router.replace("/leaders"); return; }
      const { data: joinData, error: joinError } = await fetchAllRows((from,to) => supabase.from("member_join_requests")
        .select("id,cell_id,name,gender,age,phone,status,created_at,cells(name)")
        .order("created_at", { ascending: false }).order("id").range(from,to));
      const { data: memberData, error: memberError } = await fetchAllRows((from,to) => supabase.from("members")
        .select("id,cell_id,name,gender,age,phone,area,joined_at").order("name").order("id").range(from,to));
      if (!active) return;
      setJoinRequests(joinData ?? []);
      if (!memberError) setAllMembers((memberData ?? []).map((member) => ({
        id: member.id, cellId: Number(member.cell_id), name: member.name,
        gender: member.gender, age: member.age, phone: member.phone,
        area: member.area, joinedAt: member.joined_at,
      })));
      const t = user.user_metadata.dashboard_theme === "dark" ? "dark" : "light";
      setTheme(t);
      const otherLoadErrors = await refreshData();
      const loadErrors = [
        ...(joinError ? ["Member join requests could not be loaded."] : []),
        ...(memberError ? ["Member records could not be loaded."] : []),
        ...otherLoadErrors,
      ];
      setDashboardLoadErrors(loadErrors);
      if (active) setReady(true);
    }
    void loadDashboard();
    return () => { active = false; };
  }, [router, refreshData, revision]);

  const [themeSaving,setThemeSaving]=useState(false);
  const toggleTheme = async () => {if(themeSaving)return;setThemeSaving(true);try{const nt=theme==="dark"?"light":"dark";const {error}=await createClient().auth.updateUser({data:{dashboard_theme:nt}});if(error)throw error;setTheme(nt);}catch{setActivityNotice("Your display preference could not be saved. Please try again.");}finally{setThemeSaving(false);}};

  const openCellDetails = async (cell: Cell) => {
    setProvisionError("");
    setSelected(cell);
    const { data, error } = await createClient().from("members")
      .select("id,cell_id,name,gender,age,phone,area,joined_at")
      .eq("cell_id", cell.id).order("name");
    if (error) {
      setProvisionError("We couldn't load this cell's members. Refresh and try again.");
      setMembers([]);
      return;
    }
    setMembers((data ?? []).map((member) => ({
      id: member.id, cellId: Number(member.cell_id), name: member.name,
      gender: member.gender, age: member.age, phone: member.phone, area: member.area, joinedAt: member.joined_at,
    })));
  };

  const goHome = () => {
    setSelected(null);
    setShowCellsDetail(false);
    setTab("overview");
    setShowCreateForm(false);
    setMenuOpen(false);
    setShowDeleteManager(false);
    setShowSettings(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const provisionLeader = async (payload: Record<string, unknown>) => {
    setProvisioning(true);
    setProvisionError("");
    setIssuedCredentials(null);
    try {
      const response = await fetch("/api/super-admin/create-org-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Creation failed.");
      setIssuedCredentials({ ...result, purpose: "created" });
      noteServerActivity(result.activityLogged);
      await refreshData();
      return true;
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : "We couldn't create this account.");
      return false;
    } finally {
      setProvisioning(false);
    }
  };

  const addCell = async () => {
    if (!form.name.trim() || !form.area.trim() || !form.leader.trim() || !form.email.trim()) {
      setProvisionError("Enter the cell name, area, leader name, and leader email.");
      return;
    }
    if (await provisionLeader({ kind: "cell", ...form, zoneId: Number(form.zoneId) })) {
      setForm({ name:"", area:"", leader:"", phone:"", email:"", zoneId:form.zoneId });
    }
  };

  const addZone = async () => {
    if (!zoneForm.number || !zoneForm.name.trim() || !zoneForm.leader.trim() || !zoneForm.email.trim()) {
      setProvisionError("Enter the zone number, name, leader name, and leader email.");
      return;
    }
    if (await provisionLeader({ kind: "zone", ...zoneForm, number: Number(zoneForm.number) })) {
      setZoneForm({ number:"", name:"", leader:"", phone:"", email:"" });
    }
  };

  const createExistingLeaderLogin = async () => {
    const recordId = Number(existingLoginForm.recordId);
    if (!Number.isSafeInteger(recordId) || !existingLoginForm.email.trim()) {
      setProvisionError("Choose an existing cell or zone and enter the leader's email.");
      return;
    }
    const created = await provisionLeader({
      mode: "existing", kind: existingLoginForm.kind, recordId, email: existingLoginForm.email.trim(),
    });
    if (created) {
      setExistingLoginForm({ ...existingLoginForm, recordId: "", email: "" });
      setShowExistingLoginForm(false);
    }
  };

  const resetLeaderPassword = async () => {
    const recordId = Number(resetPasswordForm.recordId);
    if (!Number.isSafeInteger(recordId) || recordId < 1) {
      setProvisionError("Choose the cell or zone whose leader needs a new password.");
      return;
    }
    if (!confirm("This replaces the leader's current password. Continue?")) return;
    setProvisioning(true);
    setProvisionError("");
    setIssuedCredentials(null);
    try {
      const response = await fetch("/api/super-admin/reset-org-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: resetPasswordForm.kind, recordId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Password reset failed.");
      setIssuedCredentials({ ...result, purpose: "reset" });
      noteServerActivity(result.activityLogged);
      setShowResetPasswordForm(false);
      setResetPasswordForm({ ...resetPasswordForm, recordId: "" });
      await refreshData();
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : "We couldn't reset this password.");
    } finally {
      setProvisioning(false);
    }
  };

  const setLeaderLoginSuspended = async (account: LeaderAccount) => {
    const kind = account.role === "cell_leader" ? "cell" : "zone";
    const recordId = account.role === "cell_leader" ? account.cell_id : account.zone_id;
    if (!recordId) {
      setProvisionError("This leader login is missing its cell or zone assignment.");
      return;
    }
    const action = account.is_suspended ? "reactivate" : "suspend";
    const unitName = account.role === "cell_leader"
      ? cells.find((cell) => cell.id === recordId)?.name ?? "this cell"
      : zones.find((zone) => zone.id === recordId)?.name ?? "this zone";
    const prompt = action === "suspend"
      ? `Suspend the login for ${account.display_name || account.username} (${unitName})? They will be blocked from signing in and their current password will stop working.`
      : `Reactivate the login for ${account.display_name || account.username} (${unitName})? A new temporary password will be generated; their previous password will not work.`;
    if (!confirm(prompt)) return;
    const key = `${kind}:${recordId}`;
    setChangingLeaderKey(key);
    setProvisionError("");
    setIssuedCredentials(null);
    try {
      const response = await fetch("/api/super-admin/set-org-login-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, recordId, action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't update this leader login.");
      noteServerActivity(result.activityLogged);
      if (action === "reactivate") setIssuedCredentials({ ...result, purpose: "reactivated" });
      await refreshData();
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : "We couldn't update this leader login.");
    } finally {
      setChangingLeaderKey(null);
    }
  };

  const approveRequest = (req: CellRequest) => {
    setRequestToProvision(req);
    setRequestLeaderEmail("");
  };

  const finishApproveRequest = async () => {
    if (!requestToProvision || !requestLeaderEmail.trim()) return;
    const req = requestToProvision;
    const created = await provisionLeader({
      kind: "cell", name: req.cellName, area: req.area, leader: req.leader,
      phone: req.phone, zoneId: Number(req.zoneId), email: requestLeaderEmail.trim(), requestId:req.id,
    });
    if (!created) return;
    setRequestToProvision(null);
    await refreshData();
  };

  const rejectRequest = async (id: string) => {
    if(!confirm("Reject this cell request?")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("cell_creation_requests").update({
      status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id,
    }).eq("id", id).eq("status", "pending").select("id,cell_name").maybeSingle();
    if (error || !data) {
      setProvisionError("We couldn't update this request. Refresh and try again.");
      return;
    }
    await saveActivity({
      action: "cell_request_rejected", entityType: "cell_request", entityId: id,
      entityName: data.cell_name, summary: `Rejected the cell request for ${data.cell_name}.`,
    });
    await refreshData();
  };

  const setCellActive = async (cell: ManagedCell) => {
    const nextActive = !cell.isActive;
    const action = nextActive ? "restore" : "archive";
    if (!confirm(`${nextActive ? "Restore" : "Archive"} ${cell.name}? ${nextActive ? "It will reappear in the public directory." : "It will be hidden from the public directory, and its records will be kept."}`)) return;
    setChangingCellId(cell.id);
    setProvisionError("");
    const supabase = createClient();
    const { error } = await supabase.from("cells").update({ is_active: nextActive }).eq("id", cell.id);
    if (error) setProvisionError(`We couldn't ${action} this cell. Please try again or contact your administrator.`);
    else {
      await saveActivity({
        action: nextActive ? "unit_restored" : "unit_archived", entityType: "cell", entityId: cell.id,
        entityName: cell.name, summary: `${nextActive ? "Restored" : "Archived"} cell ${cell.name}.`,
      });
      await refreshData();
    }
    setChangingCellId(null);
  };

  const openLeaderEmailChange = (account: LeaderAccount) => {
    const kind = account.role === "cell_leader" ? "cell" : "zone";
    const recordId = account.role === "cell_leader" ? account.cell_id : account.zone_id;
    if (!recordId) {
      setProvisionError("This leader login is missing its cell or zone assignment.");
      return;
    }
    const unitName = kind === "cell"
      ? cells.find((cell) => cell.id === recordId)?.name ?? "Cell"
      : zones.find((zone) => zone.id === recordId)?.name ?? "Zone";
    setLeaderEmailNotice("");
    setEmailChangeTarget({ kind, recordId, unitName, displayName: account.display_name || account.username, currentEmail: account.username });
    setNewLeaderEmail("");
    setEmailChangeConfirmed(false);
  };

  const changeLeaderEmail = async () => {
    if (!emailChangeTarget || !emailChangeConfirmed) return;
    const email = newLeaderEmail.trim().toLowerCase();
    if (!email) return;
    setChangingEmail(true);
    setProvisionError("");
    setLeaderEmailNotice("");
    try {
      const response = await fetch("/api/super-admin/change-org-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: emailChangeTarget.kind, recordId: emailChangeTarget.recordId, email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't change this leader's email.");
      noteServerActivity(result.activityLogged);
      setEmailChangeTarget(null);
      setNewLeaderEmail("");
      setEmailChangeConfirmed(false);
      setLeaderEmailNotice(`${result.name}'s login email is now ${result.email}. Their password has not changed; give the new email to the leader privately.`);
      await refreshData();
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : "We couldn't change this leader's email.");
    } finally {
      setChangingEmail(false);
    }
  };

  const setZoneActive = async (zone: ManagedZone) => {
    const nextActive = !zone.isActive;
    const action = nextActive ? "restore" : "archive";
    const message = nextActive
      ? `Restore Zone ${zone.number} · ${zone.name}? Its active cells will be available again.`
      : `Archive Zone ${zone.number} · ${zone.name}? Its leader will lose access and its cells will be hidden from the public directory. Records will be kept.`;
    if (!confirm(message)) return;
    setChangingZoneId(zone.id);
    setProvisionError("");
    const supabase = createClient();
    const { error } = await supabase.from("zones").update({ is_active: nextActive }).eq("id", zone.id);
    if (error) setProvisionError(`We couldn't ${action} this zone. Please try again or contact your administrator.`);
    else {
      await saveActivity({
        action: nextActive ? "unit_restored" : "unit_archived", entityType: "zone", entityId: zone.id,
        entityName: zone.name, summary: `${nextActive ? "Restored" : "Archived"} Zone ${zone.number} · ${zone.name}.`,
      });
      await refreshData();
    }
    setChangingZoneId(null);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) return alert("Use at least 6 characters for your password.");
    if (newPassword!== confirmPassword) return alert("The passwords do not match.");
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    if (error) return alert("Password update failed. Please try again.");
    alert(" Password updated.");
    setNewPassword(""); setConfirmPassword(""); setShowSettings(false);
  };

  const bg = theme === "dark"? "bg-[#0a0a0a]" : "bg-[#f6f6f7]";
  const cardBg = theme === "dark"? "bg-[#151515] border-[#222]" : "bg-white border-gray-200 shadow-sm";
  const text = theme === "dark"? "text-white" : "text-black";
  const subText = theme === "dark"? "text-gray-400" : "text-gray-500";
  const inputBg = theme === "dark"? "bg-[#0a0a0a] border-[#222] text-white" : "bg-white border-gray-200 text-black";
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const pendingJoinRequests = joinRequests.filter((request) => request.status === "pending");
  const suspendedLeaderCount = leaderAccounts.filter((account) => account.is_suspended).length;
  const activeLeaderCount = leaderAccounts.filter((account) => !account.is_suspended).length;
  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (!ready) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-[11px] tracking-[0.2em]">Loading your dashboard…</div>;

  if (showCellsDetail) {
    return (
      <div className="super-admin-shell" data-theme={theme}>
        <TopBar hideMenu onHome={goHome} onMenuToggle={()=>setMenuOpen((open)=>!open)} />
        <div className={`min-h-screen ${bg} ${text} p-6 pt-[80px]`}>
          <div className="max-w-6xl mx-auto">
            <button onClick={()=>setShowCellsDetail(false)} className="bg-[#222] text-white px-4 py-2 rounded-full text-xs font-bold mb-6">← Back to Dashboard</button>
            <div className="flex justify-between items-end mb-6"><div><Link href="/super-admin/reports" className="inline-block mb-4 bg-green-700 text-white px-5 py-3 rounded-full font-bold text-sm">Reports &amp; backups</Link><h1 className="text-2xl font-black">Cell directory</h1><p className={`${subText} text-sm mt-1`}>{cells.length} cells • {allMembers.length} members total</p></div></div>
            <div className="grid gap-4">
              {[...zones].sort((a,b)=>a.number-b.number).map((zone)=>{
                const zCells = cells.filter((c)=>c.zoneId===zone.id);
                if(!zCells.length) return null;
                return (
                  <div key={zone.id} className={`${cardBg} border rounded-[24px] p-5`}>
                    <h3 className="font-black text-[13px] mb-4">ZONE {zone.number} • {zone.name} • {zone.leader} • {zone.phone}</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {zCells.map((c)=>{
                        const count = allMembers.filter((m)=>m.cellId===c.id).length;
                        return (<div key={c.id} className={`${inputBg} border rounded-xl p-4`}><div className="flex justify-between"><b className="text-[12px]">{c.name}</b><span className="bg-[#cc0000] text-white text-[9px] px-2 py-1 rounded-full">{count} members</span></div><p className={`text-[11px] ${subText} mt-1`}> {c.area} •  {c.meetingDay} {c.meetingTime}</p><p className={`text-[11px] ${subText}`}> {c.leader} •  {c.phone}</p></div>);
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-shell" data-theme={theme}>
      <TopBar onHome={goHome} onMenuToggle={()=>setMenuOpen((open)=>!open)} />
      {menuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl pt-[80px]">
          <div className="w-full px-6 max-w-sm ml-auto h-full bg-[#151515] border-l border-[#222] p-6 overflow-auto">
            <div className="flex justify-between items-center mb-8"><h2 className="font-black text-white">Menu</h2><button aria-label="Close dashboard menu" onClick={()=>setMenuOpen(false)} className="w-8 h-8 rounded-full bg-white/10 text-white">✕</button></div>
            <div className="space-y-4">
              <button onClick={goHome} className="w-full text-left bg-[#222] text-white p-4 rounded-2xl text-sm font-bold"> Dashboard overview</button>
              <Link href="/super-admin/reports" className="block w-full text-left bg-green-700 text-white p-4 rounded-2xl text-sm font-bold">Reports &amp; backups</Link>
              <button onClick={()=>{setMenuOpen(false); router.push("/super-admin/website");}} className="w-full text-left bg-[#222] text-white p-4 rounded-2xl text-sm font-bold"> Website management</button>
              <button onClick={()=>{setShowCellsDetail(true); setMenuOpen(false);}} className="w-full text-left bg-[#cc0000] text-white p-4 rounded-2xl text-sm font-bold"> Cell directory</button>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4"><p className="text-white font-bold text-sm mb-3"> Theme</p><button onClick={toggleTheme} disabled={themeSaving} className="w-full bg-[#222] text-white py-3 rounded-full text-xs font-bold">{theme==="dark"?" Light Mode":" Dark Mode"}</button></div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4"><p className="text-white font-bold text-sm mb-1">Cell Archive</p><p className="text-[10px] text-gray-400 mb-3">Archive hides a cell from the public directory and keeps its records. You can restore it later.</p><button onClick={()=>{setShowDeleteManager(!showDeleteManager); setShowSettings(false);}} className="w-full bg-red-900/30 text-red-300 py-3 rounded-full text-xs font-bold border border-red-900/50">{showDeleteManager?"Hide":"Manage Cell Archive"}</button>{showDeleteManager && (<div className="mt-4 space-y-2 max-h-[300px] overflow-auto">{cells.map((c)=><div key={c.id} className="bg-[#151515] p-2.5 rounded-xl flex items-center justify-between gap-3 text-[11px] text-white"><span>{c.name}{!c.isActive && <span className="ml-2 text-yellow-300">Archived</span>}</span><button disabled={changingCellId === c.id} onClick={()=>void setCellActive(c)} className="bg-red-900/70 disabled:opacity-50 px-3 py-1 rounded-full text-[9px]">{changingCellId === c.id ? "Saving…" : c.isActive ? "Archive" : "Restore"}</button></div>)}</div>)}</div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4"><p className="text-white font-bold text-sm mb-3"> Settings</p><button onClick={()=>{setShowSettings(!showSettings); setShowDeleteManager(false);}} className="w-full bg-[#222] text-white py-3 rounded-full text-xs font-bold">Change Password</button>{showSettings && (<div className="mt-4 space-y-2"><input type="password" placeholder="New Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full bg-[#151515] border border-[#222] p-3 rounded-full text-xs text-white outline-none"/><input type="password" placeholder="Confirm" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full bg-[#151515] border border-[#222] p-3 rounded-full text-xs text-white outline-none"/><button onClick={changePassword} className="w-full bg-[#cc0000] py-3 rounded-full text-xs font-bold text-white">Update</button></div>)}</div>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="w-full bg-white text-black py-3 rounded-full text-xs font-bold">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showExistingLoginForm && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-5">
        <form onSubmit={async(event)=>{event.preventDefault(); await createExistingLeaderLogin();}} className={`${cardBg} w-full max-w-md rounded-[24px] border p-6`}>
          <h2 className="font-black text-lg">Create a Login for an Existing Leader</h2>
          <p className={`${subText} mt-2 text-sm`}>This links a login to an existing cell or zone without creating a duplicate.</p>
          <div className="mt-5 space-y-3">
            <select value={existingLoginForm.kind} onChange={event=>setExistingLoginForm({ kind: event.target.value as "cell" | "zone", recordId: "", email: existingLoginForm.email })} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`}>
              <option value="cell">Cell leader</option>
              <option value="zone">Zone leader</option>
            </select>
            <select required value={existingLoginForm.recordId} onChange={event=>setExistingLoginForm({...existingLoginForm,recordId:event.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`}>
              <option value="">Choose {existingLoginForm.kind === "cell" ? "a cell" : "a zone"}</option>
              {existingLoginForm.kind === "cell"
              ? cells.filter((cell)=>cell.isActive).map((cell)=><option key={cell.id} value={cell.id}>{cell.name} · {cell.leader}</option>)
                : zones.filter((zone)=>zone.isActive).map((zone)=><option key={zone.id} value={zone.id}>Zone {zone.number} · {zone.name} · {zone.leader}</option>)}
            </select>
            <input type="email" aria-label="Leader email" required placeholder="Leader email" value={existingLoginForm.email} onChange={event=>setExistingLoginForm({...existingLoginForm,email:event.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
          </div>
          {provisionError && <p role="alert" className="mt-3 text-sm text-red-300">{provisionError}</p>}
          <div className="mt-4 flex gap-2">
            <button disabled={provisioning} className="flex-1 rounded-full bg-[#cc0000] py-3 text-sm font-bold text-white disabled:opacity-50">{provisioning ? "Creating login…" : "Create Login"}</button>
            <button type="button" onClick={()=>setShowExistingLoginForm(false)} className="admin-secondary-link">Cancel</button>
          </div>
        </form>
      </div>}
      {showResetPasswordForm && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-5">
        <form onSubmit={async(event)=>{event.preventDefault(); await resetLeaderPassword();}} className={`${cardBg} w-full max-w-md rounded-[24px] border p-6`}>
          <h2 className="font-black text-lg">Issue a New Temporary Password</h2>
          <p className={`${subText} mt-2 text-sm`}>Use this if a leader lost their sign-in details. Their current password will stop working.</p>
          <div className="mt-5 space-y-3">
            <select value={resetPasswordForm.kind} onChange={event=>setResetPasswordForm({ kind: event.target.value as "cell" | "zone", recordId: "" })} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`}>
              <option value="cell">Cell leader</option><option value="zone">Zone leader</option>
            </select>
            <select required value={resetPasswordForm.recordId} onChange={event=>setResetPasswordForm({...resetPasswordForm,recordId:event.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`}>
              <option value="">Choose {resetPasswordForm.kind === "cell" ? "a cell" : "a zone"}</option>
              {resetPasswordForm.kind === "cell"
                ? cells.filter((cell)=>cell.isActive).map((cell)=><option key={cell.id} value={cell.id}>{cell.name} · {cell.leader}</option>)
                : zones.filter((zone)=>zone.isActive).map((zone)=><option key={zone.id} value={zone.id}>Zone {zone.number} · {zone.name} · {zone.leader}</option>)}
            </select>
          </div>
          {provisionError && <p role="alert" className="mt-3 text-sm text-red-300">{provisionError}</p>}
          <div className="mt-4 flex gap-2">
            <button disabled={provisioning} className="flex-1 rounded-full bg-[#cc0000] py-3 text-sm font-bold text-white disabled:opacity-50">{provisioning ? "Resetting…" : "Reset Password"}</button>
            <button type="button" onClick={()=>setShowResetPasswordForm(false)} className="admin-secondary-link">Cancel</button>
          </div>
        </form>
      </div>}
      {emailChangeTarget && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-5">
        <form onSubmit={async(event)=>{event.preventDefault(); await changeLeaderEmail();}} className={`${cardBg} w-full max-w-md rounded-[24px] border p-6`}>
          <h2 className="font-black text-lg">Change leader login email</h2>
          <p className={`${subText} mt-2 text-sm`}>This updates the sign-in email for {emailChangeTarget.displayName} ({emailChangeTarget.kind}: {emailChangeTarget.unitName}). Their password and access status stay the same.</p>
          <label className="mt-5 block text-xs font-bold">Current email</label>
          <p className={`${inputBg} mt-1 break-all rounded-xl border p-3 text-sm`}>{emailChangeTarget.currentEmail}</p>
          <label htmlFor="new-leader-email" className="mt-4 block text-xs font-bold">New login email</label>
          <input id="new-leader-email" type="email" required autoFocus value={newLeaderEmail} onChange={event=>setNewLeaderEmail(event.target.value)} placeholder="leader@example.com" className={`mt-1 w-full ${inputBg} border p-3 rounded-xl text-sm outline-none`} />
          <label className="mt-4 flex items-start gap-2 text-xs leading-5">
            <input type="checkbox" checked={emailChangeConfirmed} onChange={event=>setEmailChangeConfirmed(event.target.checked)} className="mt-1 accent-red-600" />
            <span>I confirmed this new email address with the leader. They will use it the next time they sign in.</span>
          </label>
          <div className="mt-5 flex gap-2">
            <button disabled={changingEmail || !emailChangeConfirmed} className="flex-1 rounded-full bg-[#cc0000] py-3 text-sm font-bold text-white disabled:opacity-50">{changingEmail ? "Updating…" : "Save new email"}</button>
            <button type="button" disabled={changingEmail} onClick={()=>setEmailChangeTarget(null)} className="admin-secondary-link">Cancel</button>
          </div>
        </form>
      </div>}
      {requestToProvision && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-5">
        <form onSubmit={async(event)=>{event.preventDefault(); await finishApproveRequest();}} className={`${cardBg} w-full max-w-md rounded-[24px] border p-6`}>
          <h2 className="font-black text-lg">Create {requestToProvision.cellName}</h2>
          <p className={`${subText} mt-2 text-sm`}>Enter the cell leader&apos;s email. Zoe will create the cell and a sign-in account together.</p>
          <input type="email" required autoFocus placeholder="Cell leader email" value={requestLeaderEmail} onChange={event=>setRequestLeaderEmail(event.target.value)} className={`mt-5 w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
          <div className="mt-4 flex gap-2">
            <button disabled={provisioning} className="flex-1 rounded-full bg-[#cc0000] py-3 text-sm font-bold text-white disabled:opacity-50">{provisioning ? "Creating…" : "Approve request"}</button>
            <button type="button" onClick={()=>setRequestToProvision(null)} className="admin-secondary-link">Cancel</button>
          </div>
        </form>
      </div>}

      {selected? (
        <div className={`min-h-screen ${bg} ${text} p-6 pt-[80px]`}><div className="max-w-5xl mx-auto"><button onClick={()=>setSelected(null)} className="bg-[#222] text-white px-4 py-2 rounded-full text-xs font-bold mb-6">← Back</button>{provisionError && <p role="alert" className="mb-4 text-sm text-red-300">{provisionError}</p>}<div className={`${cardBg} border rounded-[24px] p-6 mb-6`}><h1 className="text-3xl font-black">{selected.name}</h1><p className={`${subText} text-sm mt-1`}>{selected.area} • {selected.leader} • {selected.phone}</p></div><div className={`${cardBg} border rounded-[24px] p-6`}><h2 className="font-bold mb-4">Members ({members.length})</h2>{members.length===0?<p className={`${subText} text-sm`}>No registered members.</p>:members.map((m)=><div key={m.id} className={`${inputBg} border p-3 rounded-xl text-xs mb-2`}><b>{m.name}</b> • {m.gender} • {m.age}y</div>)}</div></div></div>
      ) : (
        <div className={`min-h-screen ${bg} ${text} p-6 pt-[80px]`}><div className="max-w-6xl mx-auto">
          <div className="admin-page-heading">
            <div><p className="admin-eyebrow">Church administration</p><h1>Super Admin Dashboard</h1><p className="admin-description">Manage your church, support your leaders, and review ministry progress.</p></div>
            <div className="admin-quick-actions"><Link href="/super-admin/reports" className="admin-primary-link">Reports &amp; backups <span aria-hidden="true">↗</span></Link><Link href="/super-admin/website" className="admin-secondary-link">Manage website <span aria-hidden="true">↗</span></Link></div>
          </div>
          <nav id="admin-tabs" className="admin-navigation" aria-label="Dashboard sections">
            {([{id:"overview",label:"Overview"},{id:"cells",label:"Cells"},{id:"zones",label:"Zones"},{id:"accounts",label:"Leader accounts"},{id:"requests",label:"Requests"}] as const).map(item=><button key={item.id} aria-current={tab===item.id?"page":undefined} onClick={()=>{setTab(item.id);setShowCreateForm(false);setSearch("");}}>{item.label}{item.id==="requests"&&pendingRequests.length+pendingJoinRequests.length+pendingMinistryCount+pendingCareCount>0&&<span className="admin-count">{pendingRequests.length+pendingJoinRequests.length+pendingMinistryCount+pendingCareCount}</span>}</button>)}
          </nav>
          {(tab==="cells"||tab==="zones")&&<UnitLeaderEditor key={tab} kind={tab==="cells"?"cell":"zone"} units={tab==="cells"?cells:zones} onSaved={async()=>{await refreshData();}}/>}
          <CareRequestInbox visible={tab==="overview"||tab==="requests"} onPendingCountChange={setPendingCareCount}/>
          <MinistryRequestInbox visible={tab==="overview"||tab==="requests"} onPendingCountChange={setPendingMinistryCount}/>
          {tab==="overview"&&<>
          <RegionalCellReports/><ZoneReportInbox/>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Church operations summary">
            {[
              { label: "Active zones", value: zones.filter((zone) => zone.isActive).length, accent: "admin-metric-value" },
              { label: "Active cells", value: cells.filter((cell) => cell.isActive).length, accent: "admin-metric-value" },
              { label: "Leader accounts", value: leaderAccountsError ? "—" : activeLeaderCount, accent: "admin-metric-value" },
              { label: "Pending items", value: leaderAccountsError ? "—" : pendingRequests.length + pendingJoinRequests.length + pendingMinistryCount + pendingCareCount + suspendedLeaderCount, accent: "admin-metric-value" },
            ].map((card) => <article key={card.label} className={`${cardBg} rounded-2xl border p-4`}>
              <p className={`${subText} text-[10px] font-bold uppercase tracking-wider`}>{card.label}</p>
              <p className={`mt-2 text-3xl font-black ${card.accent}`}>{card.value}</p>
            </article>)}
          </section>
          <section className={`${cardBg} mb-6 rounded-[24px] border p-5`} aria-labelledby="attention-heading">
            <div className="mb-3"><h2 id="attention-heading" className="font-bold">Needs attention</h2><p className={`${subText} mt-1 text-xs`}>Items that may need a Super Admin follow-up.</p></div>
            <div className="grid gap-2 md:grid-cols-3">
              {pendingRequests.length > 0 && <button onClick={() => { setTab("requests"); scrollToSection("admin-tabs"); }} className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-left hover:bg-amber-950/40">
                <p className="text-sm font-bold text-amber-200">{pendingRequests.length} cell {pendingRequests.length === 1 ? "request" : "requests"}</p><p className="mt-1 text-[11px] text-gray-400">Waiting for review from zone leaders</p>
              </button>}
              {pendingJoinRequests.length > 0 && <button onClick={() => {setTab("requests");}} className="rounded-xl border border-blue-700/40 bg-blue-950/20 p-3 text-left hover:bg-blue-950/40">
                <p className="text-sm font-bold text-blue-200">{pendingJoinRequests.length} member {pendingJoinRequests.length === 1 ? "join request" : "join requests"}</p><p className="mt-1 text-[11px] text-gray-400">Waiting for the assigned cell leader</p>
              </button>}
              {suspendedLeaderCount > 0 && <button onClick={() => {setTab("accounts");}} className="rounded-xl border border-red-700/40 bg-red-950/20 p-3 text-left hover:bg-red-950/40">
                <p className="text-sm font-bold text-red-200">{suspendedLeaderCount} suspended {suspendedLeaderCount === 1 ? "login" : "logins"}</p><p className="mt-1 text-[11px] text-gray-400">Review leader login access</p>
              </button>}
              {pendingRequests.length + pendingJoinRequests.length + pendingMinistryCount + pendingCareCount + suspendedLeaderCount === 0 && !leaderAccountsError && <p className={`${subText} rounded-xl border border-white/10 p-3 text-sm`}>No pending items. Your church operations are up to date.</p>}
              {pendingRequests.length + pendingJoinRequests.length + pendingMinistryCount + pendingCareCount + suspendedLeaderCount === 0 && leaderAccountsError && <p className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">Some leader account statuses could not be checked.</p>}
              {leaderAccountsError && <p className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">Leader login status could not be checked.</p>}
            </div>
          </section>
          <section className={`${cardBg} mb-6 rounded-[24px] border p-5`} aria-labelledby="recent-activity-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 id="recent-activity-heading" className="font-bold">Recent activity</h2><p className={`${subText} mt-1 text-xs`}>Recent changes across your church.</p></div><span className={`${subText} text-[10px]`}>Latest {activity.length}</span></div>
            {activityLoadError ? <p role="status" className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">{activityLoadError}</p>
              : activity.length === 0 ? <p className={`${subText} rounded-xl border border-white/10 p-3 text-sm`}>No activity has been recorded yet.</p>
              : <div className="divide-y divide-white/10">{activity.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-1 last:pb-1">
                <div><p className="text-xs font-semibold">{item.summary}</p><p className={`${subText} mt-1 text-[10px]`}>{item.entity_type.replaceAll("_", " ")}{item.entity_name ? ` · ${item.entity_name}` : ""} · Super Admin</p></div>
                <time className={`${subText} text-[10px]`} dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
              </div>)}</div>}
            {activityNotice && <p role="status" className="mt-3 rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">{activityNotice}</p>}
          </section>
          </>}
          {dashboardLoadErrors.length > 0 && <div role="alert" className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200"><p className="font-bold">Some dashboard information did not load.</p><ul className="mt-1 list-disc pl-5">{dashboardLoadErrors.map((message)=><li key={message}>{message}</li>)}</ul></div>}
          {provisionError && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{provisionError}</p>}
          {issuedCredentials && <section className="mb-6 rounded-[24px] border border-green-700/50 bg-green-950/30 p-6" aria-labelledby="new-login-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="new-login-heading" className="font-bold text-green-200">{issuedCredentials.purpose === "reactivated" ? `${issuedCredentials.name} leader login reactivated` : issuedCredentials.purpose === "reset" ? `${issuedCredentials.name} leader password reset` : `${issuedCredentials.name} and leader login created`}</h2>
                <p className="mt-1 text-xs text-gray-300">Give these sign-in details privately to the leader. The temporary password will only be shown here once.</p>
                {issuedCredentials.notification&&<p role="status" className="mt-2 text-sm">{issuedCredentials.notification.message}</p>}
              </div>
              <button onClick={()=>setIssuedCredentials(null)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">Done</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-black/30 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400">Sign-in email</p><p className="mt-1 break-all font-mono text-sm">{issuedCredentials.email}</p></div>
              <div className="rounded-xl bg-black/30 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400">Temporary password</p><p className="mt-1 break-all font-mono text-sm">{issuedCredentials.password}</p></div>
            </div>
            <button onClick={()=>void navigator.clipboard.writeText(`Zoe Church login: ${window.location.origin}/leaders\nEmail: ${issuedCredentials.email}\nTemporary password: ${issuedCredentials.password}`)} className="mt-4 rounded-full bg-green-700 px-5 py-2.5 text-xs font-bold text-white">Copy sign-in details</button>
          </section>}
          {tab==="accounts"&&<>
          <section className={`${cardBg} border rounded-[24px] p-5 mb-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-bold">Account management</h2><p className={`${subText} mt-1 text-xs`}>Manage sign-in access for your cell and zone leaders.</p></div>
              <div className="flex flex-wrap gap-2"><button onClick={()=>{setProvisionError("");setShowExistingLoginForm(true);}} className="rounded-full bg-[#222] px-5 py-3 text-xs font-bold text-white">Add leader account</button><button onClick={()=>{setProvisionError("");setShowResetPasswordForm(true);}} className="rounded-full bg-[#222] px-5 py-3 text-xs font-bold text-white">Reset leader password</button></div>
            </div>
          </section>
          <section id="leader-access-section" className={`${cardBg} border rounded-[24px] p-5 mb-6 scroll-mt-20`} aria-labelledby="leader-access-heading">
            <div className="mb-4">
              <h2 id="leader-access-heading" className="font-bold">Leader accounts</h2>
              <p className={`${subText} mt-1 text-xs`}>Manage contact details and sign-in access. Reactivated accounts receive a new temporary password.</p>
            </div>
            {leaderEmailNotice && <p role="status" className="mb-3 rounded-xl border border-green-700/50 bg-green-950/30 p-3 text-xs text-green-200">{leaderEmailNotice}</p>}
            {notificationNotice&&<p role="status" className="mb-3 text-sm">{notificationNotice}</p>}
            {leaderAccountsError ? <p role="status" className="rounded-xl border border-yellow-800 bg-yellow-950/30 p-3 text-xs text-yellow-200">{leaderAccountsError}</p>
              : leaderAccounts.length === 0 ? <p className={`${subText} text-sm`}>No leader accounts.</p>
              : <div className="space-y-2 max-h-80 overflow-auto">
                {leaderAccounts.map((account)=>{
                  const kind = account.role === "cell_leader" ? "cell" : "zone";
                  const recordId = account.role === "cell_leader" ? account.cell_id : account.zone_id;
                  const unitName = account.role === "cell_leader"
                    ? cells.find((cell)=>cell.id === recordId)?.name ?? "Cell"
                    : zones.find((zone)=>zone.id === recordId)?.name ?? "Zone";
                  const busyKey = `${kind}:${recordId}`;
                  return <div key={account.user_id} className={`${inputBg} border p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs`}>
                    <div><b>{account.display_name || account.username}</b><p className={`${subText} mt-1`}>{kind === "zone" ? "Zone" : "Cell"}: {unitName} · {account.username} · {account.is_suspended ? "Suspended" : "Active"}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={!recordId || changingEmail} onClick={()=>openLeaderEmailChange(account)} className="rounded-full bg-blue-900/60 px-4 py-2 text-[10px] font-bold text-blue-200 disabled:opacity-50">Change email</button>
                      <button disabled={account.is_suspended||notifyingLeader!==null} onClick={()=>void notifyLeader(account.user_id)} className="admin-secondary-link disabled:opacity-50">{notifyingLeader===account.user_id?"Sending…":"Send assignment email"}</button>
                      <button disabled={!recordId || changingLeaderKey === busyKey} onClick={()=>void setLeaderLoginSuspended(account)} className={`rounded-full px-4 py-2 text-[10px] font-bold disabled:opacity-50 ${account.is_suspended ? "bg-green-900/60 text-green-200" : "bg-red-900/60 text-red-200"}`}>
                        {changingLeaderKey === busyKey ? "Saving…" : account.is_suspended ? "Reactivate login" : "Suspend login"}
                      </button>
                    </div>
                  </div>;
                })}
              </div>}
          </section>
          </>}
          {tab==="requests"&&<section id="join-request-oversight" className={`${cardBg} border rounded-[24px] p-6 mb-6 scroll-mt-20`} aria-labelledby="oversight-requests-heading">
            <h2 id="oversight-requests-heading" className="font-bold mb-4">Membership requests · {joinRequests.length}</h2>
            {joinRequests.length === 0 ? <p className={`${subText} text-sm`}>No join requests.</p> : <div className="space-y-2 max-h-80 overflow-auto">
              {joinRequests.map((request)=><div key={request.id} className={`${inputBg} border p-3 rounded-xl text-xs`}>
                <b>{request.name}</b> · {request.gender} · {request.age} · {request.phone}
                <p className={`${subText} mt-1`}>{request.cells?.[0]?.name ?? `Cell ${request.cell_id}`} · {request.status} · {new Date(request.created_at).toLocaleDateString()}</p>
              </div>)}
            </div>}
          </section>}
          {(tab==="cells"||tab==="zones")&&<div className="admin-section-toolbar"><div><h2>{tab==="cells"?"Cell directory":"Zones"}</h2><p>{tab==="cells"?"Browse cells and their assigned leaders.":"Organize zones and manage their status."}</p></div><div className="admin-toolbar-actions">{tab==="cells"&&<input aria-label="Search cells" placeholder="Search cells, areas or leaders" value={search} onChange={e=>setSearch(e.target.value)} className={inputBg}/>}<button className="admin-primary-link" onClick={()=>setShowCreateForm(value=>!value)}>{showCreateForm?"Cancel":tab==="cells"?"Create cell":"Create zone"}</button></div></div>}
          {tab==="cells"? (
            <div className={showCreateForm?"grid md:grid-cols-2 gap-6":"grid gap-6"}>
              {showCreateForm&&<div className={`${cardBg} border rounded-[24px] p-6 h-fit`}>
                <h2 className="font-bold mb-4">Create a cell</h2>
                <div className="space-y-3">
                  <select value={form.zoneId} onChange={e=>setForm({...form, zoneId:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`}>{[...zones].filter((zone)=>zone.isActive).sort((a,b)=>a.number-b.number).map((z)=><option key={z.id} value={z.id}>ZONE {z.number} - {z.name}</option>)}</select>
                  <input aria-label="Cell Name" placeholder="Cell Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input aria-label="Area" placeholder="Area" value={form.area} onChange={e=>setForm({...form,area:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input aria-label="Leader" placeholder="Leader" value={form.leader} onChange={e=>setForm({...form,leader:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input aria-label="Phone" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input type="email" aria-label="Cell leader email" required placeholder="Cell leader email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <p className="text-[10px] text-gray-500">The leader signs in with this email. Zoe generates a temporary password for you to give them.</p>
                  <button disabled={provisioning} onClick={()=>void addCell()} className="w-full bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-50 py-3 rounded-full font-black text-sm text-white transition">{provisioning ? "Creating cell and login…" : "Create cell"}</button>
                </div>
              </div>}
              {cells.filter(c=>`${c.name} ${c.area} ${c.leader}`.toLowerCase().includes(search.toLowerCase())).length===0&&<p className={subText}>No cells match your search.</p>}
              <div className={showCreateForm?"space-y-4":"grid gap-4 md:grid-cols-2 xl:grid-cols-3 content-start"}>
                {[...zones].sort((a,b)=>a.number-b.number).map((zone)=>{
                  let zCells = cells.filter((c)=>c.zoneId===zone.id || c.zoneId===zone.number);
                  if(search) zCells = zCells.filter((c)=>`${c.name} ${c.area} ${c.leader}`.toLowerCase().includes(search.toLowerCase()));
                  if(!zCells.length) return null;
                  return (<div key={zone.id} className={`${cardBg} border rounded-[24px] p-4`}><h3 className="font-black text-[12px] mb-3">ZONE {zone.number} • {zone.name} • {zone.leader}</h3><div className="space-y-2">{zCells.map((c)=><button type="button" aria-label={`View ${c.name}`} key={c.id} onClick={()=>openCellDetails(c)} className={`${inputBg} admin-cell-row border p-3 rounded-xl flex justify-between items-center text-xs cursor-pointer hover:border-[#cc0000]/50 transition`}><span><b>{c.name}</b>{!c.isActive && <span className="ml-2 text-yellow-400">ARCHIVED</span>}<br/><span className={subText}>{c.area}</span></span><span className="bg-[#222] text-white px-3 py-1 rounded-full text-[10px]">View</span></button>)}</div></div>);
                })}
              </div>
            </div>
          ) : tab==="zones"? (
            <div className={showCreateForm?"grid md:grid-cols-2 gap-6":"grid gap-6"}>
              {showCreateForm&&<div className={`${cardBg} border rounded-[24px] p-6 h-fit`}>
                <h2 className="font-bold mb-4">Create a zone</h2>
                <div className="space-y-3">
                  <input aria-label="Zone number" placeholder="Zone number" type="number" value={zoneForm.number} onChange={e=>setZoneForm({...zoneForm,number:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input aria-label="Zone name" placeholder="Zone name" value={zoneForm.name} onChange={e=>setZoneForm({...zoneForm,name:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input aria-label="Zone Leader Name" placeholder="Zone Leader Name" value={zoneForm.leader} onChange={e=>setZoneForm({...zoneForm,leader:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input aria-label="Phone" placeholder="Phone" value={zoneForm.phone} onChange={e=>setZoneForm({...zoneForm,phone:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <input type="email" aria-label="Zone leader email" required placeholder="Zone leader email" value={zoneForm.email} onChange={e=>setZoneForm({...zoneForm,email:e.target.value})} className={`w-full ${inputBg} border p-3 rounded-full text-sm outline-none`} />
                  <p className="text-[10px] text-gray-500">The leader signs in with this email. Zoe generates a temporary password for you to give them.</p>
                  <button disabled={provisioning} onClick={()=>void addZone()} className="w-full bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-50 py-3 rounded-full font-black text-sm text-white transition">{provisioning ? "Creating zone and login…" : "Create zone"}</button>
                </div>
              </div>}
              <div className={`${cardBg} border rounded-[24px] p-6`}><h2 className="font-bold mb-4">All Zones ({zones.length})</h2><div className="space-y-2">{[...zones].sort((a,b)=>a.number-b.number).map((z)=><div key={z.id} className={`${inputBg} border p-3 rounded-xl flex items-center justify-between gap-3 text-xs`}><span><b>ZONE {z.number} - {z.name}</b>{!z.isActive && <span className="ml-2 text-yellow-400">ARCHIVED</span>}<br/><span className={subText}>{z.leader} • {z.phone}</span></span><button disabled={changingZoneId === z.id} onClick={()=>void setZoneActive(z)} className="bg-red-900/70 text-white disabled:opacity-50 px-3 py-1 rounded-full text-[9px]">{changingZoneId === z.id ? "Saving…" : z.isActive ? "Archive" : "Restore"}</button></div>)}</div></div>
            </div>
          ) : tab==="requests"? (
            <div className={`${cardBg} border rounded-[24px] p-6`}>
              <h2 className="font-bold mb-4"> Cell creation requests ({pendingRequests.length} pending)</h2>
              {requests.length===0? <p className={`${subText} text-sm`}>No cell creation requests.</p> :
                <div className="space-y-3">
                  {requests.map((r)=><div key={r.id} className={`${inputBg} border p-4 rounded-xl`}>
                    <div className="flex justify-between gap-2"><b className="text-sm">{r.cellName}</b><span className="bg-yellow-400 text-black px-2 py-1 rounded-full text-[9px] font-bold">{r.zoneName} · {r.status}</span></div>
                    <p className={`${subText} text-xs mt-2`}> {r.area} •  {r.leader} •  {r.phone}</p>
                    <p className={`${subText} text-xs`}> Reason: {r.reason || "Expansion"} • Requested by: {r.requestedBy} • {new Date(r.date).toLocaleDateString()}</p>
                    {r.status === "pending" && <div className="flex gap-2 mt-3"><button onClick={()=>approveRequest(r)} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full text-xs font-bold"> Approve request</button><button onClick={()=>void rejectRequest(r.id)} className="bg-[#222] text-white px-5 py-2 rounded-full text-xs"> Reject</button></div>}
                  </div>)}
                </div>
              }
            </div>
          ) : null}
        </div></div>
      )}
    </div>
  );
}
