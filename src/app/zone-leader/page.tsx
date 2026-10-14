"use client";
import {fetchAllRows} from "@/lib/fetch-all-rows";
import {useDashboardRefresh} from "@/lib/use-dashboard-refresh";
import { useState, useEffect, useMemo } from "react";
import { hasEvangelismActivity, mapReportDetails, type ReportDetails } from "@/lib/report-details";
import ZoneWeeklyReview, {currentWeek} from "@/components/zone-weekly-review";
import "./dashboard.css";
import { SiteImage } from "@/components/site-image";
import type { PostgrestError } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mapCell, mapZone } from "@/lib/church-data";
import type { Cell, Member, Zone } from "@/data/cells";

type ZoneLeaderAuth = {
  user_id: string;
  username: string;
  display_name: string;
  role: "zone_leader";
  zone_id: number;
  zoneId: number;
};

type AttendanceLog = ReportDetails & {
  id: string | number;
  cellId: number;
  date: string;
  attendance: number;
  visitors: number;
  soulsWon: number;
  evangelism: number;
  offeringAmount: number;
  evangelismDate: string | null;
  peopleReached: number;
  tracts: number;
  teamCount: number;
  contacts: number;
  evangelismNotes: string;
};

type EvangelismLog = {
  id: string | number;
  cellId: number;
  date: string;
  peopleReached: number;
  tracts: number;
  soulsWon: number;
  teamCount: number;
  reportedBy?: string;
  area?: string;
  contacts?: number;
  notes?: string;
};

type CellPerformance = {
  cell: Cell;
  logs: AttendanceLog[];
  evanLogs: EvangelismLog[];
  totalAtt: number;
  totalOffering: number;
  totalSouls: number;
  totalEvan: number;
  totalSoulsEvan: number;
  totalTracts: number;
  avg: number;
  avgEvan: number;
  memberCount: number;
};

type MonthlyAttendance = { month: string; logs: AttendanceLog[]; totalAtt: number; avgAtt: number };
type MonthlyEvangelism = { month: string; logs: EvangelismLog[]; totalReached: number; totalTracts: number; avgReached: number };

export default function ZoneLeader() {
 const revision=useDashboardRefresh();
  const router = useRouter();
  const [auth, setAuth] = useState<ZoneLeaderAuth | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [zone, setZone] = useState<Zone | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [evangelismLogs, setEvangelismLogs] = useState<EvangelismLog[]>([]);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => currentWeek().from);
  const [endDate, setEndDate] = useState(() => currentWeek().to);
  const [requestForm, setRequestForm] = useState({ cellName: "", area: "", leader: "", phone: "", reason: "" });
  const [showRequest, setShowRequest] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [detailTab, setDetailTab] = useState<"attendance" | "evangelism">("attendance");
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/leaders"); return; }
      const { data: profile, error } = await supabase.from("profiles")
        .select("user_id,username,display_name,role,zone_id,is_suspended")
        .eq("user_id", user.id).maybeSingle();
      if (error || profile?.is_suspended || profile?.role !== "zone_leader" || profile.zone_id == null) {
        router.replace("/leaders"); return;
      }
      const [zoneResult, cellsResult] = await Promise.all([
        supabase.from("zones").select("id,number,name,leader,phone").eq("id", profile.zone_id).single(),
        fetchAllRows((from,to) => supabase.from("cells").select("id,zone_id,name,area,leader,phone,meeting_day,meeting_time,reported_member_count").eq("zone_id", profile.zone_id).eq("is_active", true).order("name").order("id").range(from,to)),
      ]);
      if (!active) return;
      if (zoneResult.error || !zoneResult.data || cellsResult.error) { router.replace("/leaders"); return; }
      const admin = { ...profile, zoneId: Number(profile.zone_id), role: profile.role } as ZoneLeaderAuth;
      setAuth(admin);
      setZone(mapZone(zoneResult.data));
      const zoneCells = cellsResult.data ?? [];
      const mappedCells = zoneCells.map((cell) => mapCell(cell));
      setCells(mappedCells);
      const cellIds = zoneCells.map((cell) => cell.id);
      if (cellIds.length) {
        const [memberRows, attendanceRows, evangelismRows] = await Promise.all([
          fetchAllRows((from,to) => supabase.from("members").select("id,cell_id,name,gender,age,phone,area,joined_at")
            .in("cell_id", cellIds).order("name").order("id").range(from,to)),
          fetchAllRows((from,to) => supabase.from("attendance_reports").select("*")
            .in("cell_id", cellIds).order("report_date", { ascending: false }).order("id").range(from,to)),
          fetchAllRows((from,to) => supabase.from("evangelism_reports").select("id,cell_id,report_date,people_reached,tracts,souls_won,team_count,contacts,notes")
            .in("cell_id", cellIds).order("report_date", { ascending: false }).order("id").range(from,to)),
        ]);
        if (!active) return;
        if (memberRows.error || attendanceRows.error || evangelismRows.error) {
          setDashboardError("Some reports or member records couldn't be loaded. Refresh and try again.");
        } else setDashboardError("");
        if (!memberRows.error) setMembers((memberRows.data ?? []).map((member) => ({
          id: member.id, cellId: Number(member.cell_id), name: member.name,
          gender: member.gender, age: member.age, phone: member.phone,
          area: member.area, joinedAt: member.joined_at,
        })) as Member[]);
        if (!attendanceRows.error) setAttendance((attendanceRows.data ?? []).map((row) => ({
          ...mapReportDetails(row), id: row.id, cellId: Number(row.cell_id), date: row.report_date,
          attendance: row.attendance, visitors: row.visitors, soulsWon: row.souls_won,
          evangelism: row.evangelism, offeringAmount: Number(row.offering_amount ?? 0),
          evangelismDate: row.evangelism_date, peopleReached: Number(row.people_reached ?? 0),
          tracts: Number(row.tracts ?? 0), teamCount: Number(row.team_count ?? 0),
          contacts: Number(row.contacts ?? 0), evangelismNotes: row.evangelism_notes ?? "",
        })));
        if (!evangelismRows.error) setEvangelismLogs((evangelismRows.data ?? []).map((row) => ({
          ...mapReportDetails(row), id: row.id, cellId: Number(row.cell_id), date: row.report_date,
          peopleReached: row.people_reached, tracts: row.tracts, soulsWon: row.souls_won,
          teamCount: row.team_count, contacts: row.contacts, notes: row.notes,
          reportedBy: "Cell leader", area: mappedCells.find((cell) => cell.id === Number(row.cell_id))?.area ?? "",
        })));
      } else {
        setMembers([]);
        setAttendance([]);
        setEvangelismLogs([]);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, [router, revision]);

  useEffect(() => {
    if (!auth || cells.length === 0) return;
    const supabase = createClient();
    const cellIds = new Set(cells.map((cell) => cell.id));
    const channel = supabase.channel(`zone-cell-reports-${auth.zone_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_reports" }, (payload) => {
        if (payload.eventType === "DELETE") { setAttendance(current=>current.filter(r=>String(r.id)!==String(payload.old.id))); return; }
        const row = payload.new as Record<string, unknown>;
        const cellId = Number(row.cell_id);
        if (!cellIds.has(cellId)) return;
        const report: AttendanceLog = {
          ...mapReportDetails(row), id: String(row.id), cellId, date: String(row.report_date),
          attendance: Number(row.attendance), visitors: Number(row.visitors),
          soulsWon: Number(row.souls_won), evangelism: Number(row.evangelism),
          offeringAmount: Number(row.offering_amount ?? 0),
          evangelismDate: typeof row.evangelism_date === "string" ? row.evangelism_date : null,
          peopleReached: Number(row.people_reached ?? 0), tracts: Number(row.tracts ?? 0),
          teamCount: Number(row.team_count ?? 0), contacts: Number(row.contacts ?? 0),
          evangelismNotes: String(row.evangelism_notes ?? ""),
        };
        setAttendance((current) => [report, ...current.filter(existing=>String(existing.id)!==String(report.id))]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [auth, cells]);

  const filtered = useMemo(()=> attendance.filter(a=> a.date >= startDate && a.date <= endDate), [attendance, startDate, endDate]);
  const filteredEvan = useMemo(()=> evangelismLogs.filter(a=> a.date >= startDate && a.date <= endDate), [evangelismLogs, startDate, endDate]);

  const cellPerformance = useMemo<CellPerformance[]>(()=> cells.map((c)=>{
    const logs = filtered.filter(f=>f.cellId===c.id);
    const integratedEvanLogs: EvangelismLog[] = attendance
      .filter((log) => log.cellId === c.id && log.evangelismDate !== null && log.evangelismDate >= startDate && log.evangelismDate <= endDate && hasEvangelismActivity(log))
      .map((log) => ({ id: `attendance-${log.id}`, cellId: log.cellId, date: log.evangelismDate!, peopleReached: log.peopleReached, tracts: log.tracts, soulsWon: log.soulsWon, teamCount: log.teamCount, contacts: log.contacts, notes: log.evangelismNotes }));
    const legacyEvanLogs = filteredEvan.filter((log) => log.cellId === c.id);
    const evanLogs = [...legacyEvanLogs, ...integratedEvanLogs];
    const totalAtt = logs.reduce((s,a)=>s+a.attendance,0);
    const totalOffering = logs.reduce((s,a)=>s+a.offeringAmount,0);
    const totalSouls = logs.reduce((s,a)=>s+a.soulsWon,0);
    const totalEvan = evanLogs.reduce((s,a)=>s+a.peopleReached,0);
    const totalSoulsEvan = evanLogs.reduce((s,a)=>s+a.soulsWon,0);
    const totalTracts = evanLogs.reduce((s,a)=>s+a.tracts,0);
    const avg = logs.length? Math.round(totalAtt/logs.length):0;
    const avgEvan = evanLogs.length? Math.round(totalEvan/evanLogs.length):0;
    const memberCount = members.filter((member)=>member.cellId===c.id).length;
    return { cell:c, logs, evanLogs, totalAtt, totalOffering, totalSouls, totalEvan, totalSoulsEvan, totalTracts, avg, avgEvan, memberCount };
  }), [cells, filtered, filteredEvan, members, attendance, startDate, endDate]);

  const sendRequest = async () => {
    if (!zone || !auth) return;
    if (!requestForm.cellName.trim() || !requestForm.area.trim() || !requestForm.leader.trim()) return alert("Enter a cell name, area, and proposed leader so Super Admin can create its login.");
    const { error } = await createClient().from("cell_creation_requests").insert({
      zone_id: auth.zone_id, requested_by: auth.user_id,
      cell_name: requestForm.cellName.trim(), area: requestForm.area.trim(),
      leader: requestForm.leader.trim(), phone: requestForm.phone.trim(), reason: requestForm.reason.trim(),
    });
    if (error) return alert("We couldn't send the request. Check your connection and try again.");
    alert("Cell request sent to the Super Admin.");
    setRequestForm({ cellName:"", area:"", leader:"", phone:"", reason:"" }); setShowRequest(false);
  };

  const handleChangePassword = async () => {
    if (!newPass ||!confirmPass) return alert("Fill all fields Boss!");
    if (newPass!== confirmPass) return alert("New passwords don't match!");
    if (newPass.length < 6) return alert("Password must be 6+ characters!");
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      alert("Your sign-in session expired. Sign in again before changing your password.");
      router.replace("/leaders");
      return;
    }
    const profileResult = await supabase.from("profiles").select("is_suspended").eq("user_id", user.id).maybeSingle();
    let profile: { is_suspended?: boolean; user_id?: string } | null = profileResult.data;
    let profileError: PostgrestError | null = profileResult.error;
    if (profileError?.code === "42703") {
      const fallback = await supabase.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();
      profile = fallback.data as { user_id: string } | null;
      profileError = fallback.error;
    }
    if (profileError || !profile) {
      return alert("We couldn't verify this leader account. No password was changed. Please refresh and try again; if it continues, contact the super admin.");
    }
    if (profile.is_suspended) {
      await supabase.auth.signOut();
      router.replace("/leaders?disabled=1");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) return alert("Password update failed. Please try again.");
    alert("✅ Password Changed!");
    setShowPasswordModal(false); setNewPass(""); setConfirmPass("");
  };

  if (!auth) return null;

  if (selectedCell) {
    const perf = cellPerformance.find(p=>p.cell.id===selectedCell.id);
    const cellMembers = members.filter((member)=>member.cellId===selectedCell.id);
    const myEvanLogs = perf?.evanLogs ?? evangelismLogs.filter((log)=>log.cellId===selectedCell.id);
    const male = cellMembers.filter((member)=>member.gender==="Male").length;
    const female = cellMembers.filter((member)=>member.gender==="Female").length;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const allCellLogs = attendance.filter(log=>log.cellId===selectedCell.id);
    const allCellEvan = [...evangelismLogs.filter(log=>log.cellId===selectedCell.id), ...allCellLogs.filter(log=>log.evangelismDate && hasEvangelismActivity(log)).map(log=>({date:log.evangelismDate!,peopleReached:log.peopleReached,soulsWon:log.soulsWon}))];
    const thisMonthLogs = allCellLogs.filter((log)=>log.date.slice(0, 7) === currentMonth);
    const thisMonthEvan = allCellEvan.filter((log)=>log.date.slice(0, 7) === currentMonth);
    const lastMonthLogs = allCellLogs.filter((log)=>log.date.slice(0, 7) === previousMonth);

    const avgAttMonth = thisMonthLogs.length? Math.round(thisMonthLogs.reduce((sum, log)=>sum+log.attendance,0)/thisMonthLogs.length):0;
    const avgEvanMonth = thisMonthEvan.length? Math.round(thisMonthEvan.reduce((sum, log)=>sum+log.peopleReached,0)/thisMonthEvan.length):0;
    const avgSoulsMonth = thisMonthEvan.length? Math.round(thisMonthEvan.reduce((sum, log)=>sum+log.soulsWon,0)/thisMonthEvan.length):0;
    const lastMonthAverage = lastMonthLogs.length ? lastMonthLogs.reduce((sum, log)=>sum+log.attendance,0)/lastMonthLogs.length : 0;
    const growthRate = lastMonthAverage ? Math.round(((avgAttMonth - Math.round(lastMonthAverage))/Math.max(1, Math.round(lastMonthAverage)))*100) : 0;
    const attendanceRate = cellMembers.length && perf?.avg? Math.round((perf.avg / cellMembers.length)*100):0;

    const monthlyStats = Object.values((perf?.logs ?? []).reduce<Record<string, MonthlyAttendance>>((groups, log)=>{
      const key = log.date.slice(0,7);
      const group = groups[key] ?? (groups[key] = { month:key, logs:[], totalAtt:0, avgAtt:0 });
      group.logs.push(log); group.totalAtt += log.attendance;
      group.avgAtt = Math.round(group.totalAtt/group.logs.length);
      return groups;
    },{})).reverse();
    const monthlyEvanStats = Object.values(myEvanLogs.reduce<Record<string, MonthlyEvangelism>>((groups, log)=>{
      const key = log.date.slice(0,7);
      const group = groups[key] ?? (groups[key] = { month:key, logs:[], totalReached:0, totalTracts:0, avgReached:0 });
      group.logs.push(log); group.totalReached += log.peopleReached; group.totalTracts += log.tracts;
      group.avgReached = Math.round(group.totalReached/group.logs.length);
      return groups;
    },{})).reverse();

    return (
      <div className="zone-leader-dashboard">
        <header className="fixed top-0 w-full z-50 bg-white/95 h-[64px] flex items-center border-b"><div className="w-full px-5 flex justify-between"><div onClick={()=>setSelectedCell(null)} className="flex items-center gap-3 cursor-pointer"><SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="Zoe Church" width={42} height={42} className="w-[42px] h-[42px] rounded-full"/><p className="font-black text-[12px]">ZOE - ZONE LEADER</p></div></div></header>
        <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pt-[80px]"><div className="max-w-6xl mx-auto">
          <button onClick={()=>setSelectedCell(null)} className="bg-[#222] px-5 py-2 rounded-full text-xs font-bold mb-6">← Back to Zone</button>
          {dashboardError && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{dashboardError}</p>}

          <div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 mb-6">
            <h1 className="text-3xl font-black">{selectedCell.name}</h1>
            <p className="text-sm text-gray-400 mt-1">📍 {selectedCell.area} • 👤 {selectedCell.leader}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="bg-[#0a0a0a] border border-[#222] px-3 py-1 rounded-full text-[10px]">👥 {cellMembers.length} TOTAL MEMBERS</span>
              <span className="bg-[#0a0a0a] border border-[#222] px-3 py-1 rounded-full text-[10px]">♂️ {male} Male</span>
              <span className="bg-[#0a0a0a] border border-[#222] px-3 py-1 rounded-full text-[10px]">♀️ {female} Female</span>
              <span className="bg-[#cc0000]/20 border border-[#cc0000]/30 px-3 py-1 rounded-full text-[10px]">📢 {myEvanLogs.length} Evangelism Reports</span>
              <span className="bg-green-900/30 border border-green-800/40 px-3 py-1 rounded-full text-[10px]">Offering in selected period: {Number(perf?.totalOffering ?? 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#151515] border border-[#222] rounded-2xl p-4"><p className="text-[11px] text-gray-500">AVG ATT</p><p className="text-2xl font-black">{perf?.avg || 0}</p></div>
            <div className="bg-[#151515] border border-[#222] rounded-2xl p-4"><p className="text-[11px] text-gray-500">PEOPLE REACHED</p><p className="text-2xl font-black text-[#cc0000]">{perf?.totalEvan || 0}</p></div>
            <div className="bg-[#151515] border border-[#222] rounded-2xl p-4"><p className="text-[11px] text-gray-500">TRACTS</p><p className="text-2xl font-black">{perf?.totalTracts || 0}</p></div>
            <div className="bg-[#151515] border border-[#222] rounded-2xl p-4"><p className="text-[11px] text-gray-500">SOULS (EVAN)</p><p className="text-2xl font-black text-green-400">{perf?.totalSoulsEvan || 0}</p></div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2 bg-[#151515] border border-[#222] rounded-[24px] p-6">
              <h2 className="font-black text-sm mb-4">📊 MONTHLY PERFORMANCE - {new Date().toLocaleString('default',{month:'long'})}</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0a0a0a] rounded-xl p-3 text-center border border-[#222]"><p className="text-[10px] text-gray-500">AVG ATT / MONTH</p><p className="text-xl font-black mt-1">{avgAttMonth}</p><p className="text-[9px] text-gray-500">{thisMonthLogs.length} meetings</p></div>
                <div className="bg-[#0a0a0a] rounded-xl p-3 text-center border border-[#222]"><p className="text-[10px] text-gray-500">AVG EVAN / MONTH</p><p className="text-xl font-black mt-1 text-[#cc0000]">{avgEvanMonth}</p><p className="text-[9px] text-gray-500">{thisMonthEvan.length} reports</p></div>
                <div className="bg-[#0a0a0a] rounded-xl p-3 text-center border border-[#222]"><p className="text-[10px] text-gray-500">AVG SOULS / MONTH</p><p className="text-xl font-black mt-1 text-green-400">{avgSoulsMonth}</p></div>
              </div>
              {monthlyStats.length>0 && <div className="mt-6"><p className="text-[11px] font-bold text-gray-400 mb-2">ATTENDANCE HISTORY BY MONTH</p><div className="space-y-2">{monthlyStats.map((month)=><div key={month.month} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl flex justify-between text-xs"><span className="font-bold">{month.month}</span><span>AVG Att: {month.avgAtt} • {month.logs.length} reports</span></div>)}</div></div>}
              {monthlyEvanStats.length>0 && <div className="mt-6"><p className="text-[11px] font-bold text-gray-400 mb-2">EVANGELISM HISTORY BY MONTH</p><div className="space-y-2">{monthlyEvanStats.map((month)=><div key={month.month} className="bg-[#0a0a0a] border border-[#cc0000]/20 p-3 rounded-xl flex justify-between text-xs"><span className="font-bold">{month.month}</span><span>AVG Reached: {month.avgReached} • Tracts: {month.totalTracts} • {month.logs.length} reports</span></div>)}</div></div>}
            </div>

            <div className="bg-[#151515] border border-[#222] rounded-[24px] p-6">
              <h2 className="font-black text-sm mb-4">👥 ENTIRE CELL MEMBERSHIP ({cellMembers.length})</h2>
              {cellMembers.length===0? <p className="text-gray-500 text-xs py-6 text-center">No members added yet</p> : <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">{cellMembers.map((member)=><div key={member.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs"><div className="flex justify-between"><span className="font-bold">{member.name}</span><span className="text-[10px] bg-[#222] px-2 py-1 rounded-full">{member.gender}</span></div><div className="flex justify-between mt-1 text-gray-400"><span>{member.age}y • {member.phone || 'No phone'}</span><span>{new Date(member.joinedAt).toLocaleDateString()}</span></div></div>)}</div>}
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#cc0000]/20 to-[#151515] border border-[#cc0000]/30 rounded-[24px] p-6 mb-6">
            <h2 className="font-black text-sm mb-4">📈 AUTO CALCULATED ZONE STATS FOR THIS CELL</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">ATTENDANCE RATE</p><p className="text-lg font-black mt-1">{attendanceRate}%</p></div>
              <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">GROWTH vs LAST MONTH</p><p className={`text-lg font-black mt-1 ${growthRate>=0?'text-green-400':'text-red-400'}`}>{growthRate>=0?'+':''}{growthRate}%</p></div>
              <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">SOULS PER EVANGELISM REPORT</p><p className="text-lg font-black mt-1">{myEvanLogs.length? (myEvanLogs.reduce((sum,log)=>sum+log.soulsWon,0)/myEvanLogs.length).toFixed(1):0}</p></div>
              <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">REACHED PER TEAM</p><p className="text-lg font-black mt-1">{myEvanLogs.length? (myEvanLogs.reduce((sum,log)=>sum+log.peopleReached,0)/Math.max(1,myEvanLogs.reduce((sum,log)=>sum+log.teamCount,0))).toFixed(1):0}</p></div>
            </div>
          </div>

          <ZoneWeeklyReview cells={[selectedCell]} reports={attendance} outreach={evangelismLogs} from={startDate} to={endDate} onWeekChange={(from,to)=>{setStartDate(from);setEndDate(to);}}/>
          {/* TABS FOR DETAILED REPORTS */}
          <div className="flex gap-2 mb-4">
            <button onClick={()=>setDetailTab("attendance")} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${detailTab==="attendance"?"bg-white text-black":"bg-[#222] text-white"}`}>📊 ATTENDANCE ({perf?.logs.length || 0})</button>
            <button onClick={()=>setDetailTab("evangelism")} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${detailTab==="evangelism"?"bg-[#cc0000] text-white":"bg-[#222] text-white"}`}>📢 EVANGELISM ({myEvanLogs.length})</button>
          </div>

          {detailTab==="attendance"? (
            <div className="bg-[#151515] border border-[#222] rounded-[24px] p-6">
              <h3 className="font-bold text-sm mb-3">Attendance Reports ({perf?.logs.length || 0})</h3>
              {!perf?.logs || perf.logs.length===0? <p className="text-center text-gray-500 text-sm py-10">No reports yet.</p> : perf.logs.slice().reverse().map((log)=><div key={log.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs mb-2"><div className="flex justify-between gap-3"><span>Attendance {log.date}</span><span>Att:{log.attendance} Vis:{log.visitors} Offering:{log.offeringAmount.toFixed(2)}</span></div><p className="mt-1 text-gray-400">{log.evangelismDate ? `Evangelism ${log.evangelismDate} · Reached ${log.peopleReached} · Souls ${log.soulsWon} · Tracts ${log.tracts} · Team ${log.teamCount} · Contacts ${log.contacts}` : `Souls won ${log.soulsWon} · Evangelism details not recorded`}</p>{log.evangelismNotes && <p className="mt-1 text-gray-400">{log.evangelismNotes}</p>}</div>)}
            </div>
          ) : (
            <div className="bg-[#151515] border border-[#cc0000]/30 rounded-[24px] p-6">
              <h3 className="font-bold text-sm mb-3">📢 Evangelism Reports - {selectedCell.name}</h3>
              {myEvanLogs.length===0? <p className="text-center text-gray-500 text-sm py-10">No evangelism reports yet.</p> : myEvanLogs.slice().reverse().map((report)=><div key={report.id} className="bg-[#0a0a0a] border border-[#222] p-4 rounded-xl mb-3">
                <div className="flex justify-between items-start"><div><p className="font-black text-sm">📅 {report.date} • 📍 {report.area}</p><p className="text-[11px] text-gray-400 mt-1">Team: {report.teamCount} members • Reported by {report.reportedBy}</p></div><span className="text-xs bg-[#cc0000] px-3 py-1 rounded-full font-bold">{report.peopleReached} Reached</span></div>
                <div className="grid grid-cols-4 gap-2 mt-3 text-[11px]">
                  <div className="bg-[#151515] p-2 rounded-lg text-center border border-[#222]"><p className="text-gray-500 text-[9px]">TEAM</p><p className="font-bold">{report.teamCount}</p></div>
                  <div className="bg-[#151515] p-2 rounded-lg text-center border border-[#222]"><p className="text-gray-500 text-[9px]">TRACTS</p><p className="font-bold">{report.tracts}</p></div>
                  <div className="bg-[#151515] p-2 rounded-lg text-center border border-[#222]"><p className="text-gray-500 text-[9px]">SOULS</p><p className="font-bold text-green-400">{report.soulsWon}</p></div>
                  <div className="bg-[#151515] p-2 rounded-lg text-center border border-[#222]"><p className="text-gray-500 text-[9px]">CONTACTS</p><p className="font-bold">{report.contacts}</p></div>
                </div>
                {report.notes && <div className="mt-3 bg-[#151515] p-3 rounded-xl border border-[#222]"><p className="text-[10px] text-gray-500">NOTES / TESTIMONY:</p><p className="text-xs mt-1 italic text-gray-300">&quot;{report.notes}&quot;</p></div>}
              </div>)}
            </div>
          )}
        </div></div>
      </div>
    );
  }

  return (
    <div className="zone-leader-dashboard">
      <header className="fixed top-0 w-full z-50 bg-white/95 h-[64px] flex items-center border-b"><div className="w-full px-5 md:px-10 flex justify-between"><div className="flex items-center gap-3"><SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="Zoe Church" width={42} height={42} className="w-[42px] h-[42px] rounded-full"/><p className="font-black text-[12px]">ZOE - ZONE LEADER</p></div><button onClick={()=>setMenuOpen(!menuOpen)} className="w-10 h-10 flex flex-col gap-[5px] justify-center"><span className="w-6 h-[2px] bg-black block"/><span className="w-6 h-[2px] bg-black block"/><span className="w-6 h-[2px] bg-black block"/></button></div></header>
      {menuOpen && (<div className="fixed inset-0 z-[60] bg-black/90 pt-[80px]"><div className="w-full max-w-sm ml-auto h-full bg-[#151515] border-l border-[#222] p-6 flex flex-col"><button onClick={()=>setMenuOpen(false)} className="w-8 h-8 rounded-full bg-white/10 text-white mb-6">✕</button><div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 mb-4"><p className="text-[10px] text-gray-500 font-bold">LOGGED IN AS</p><p className="font-black text-sm mt-1">{auth.username}</p><p className="text-xs text-gray-400">{zone?.name}</p></div><button onClick={()=>{setShowPasswordModal(true); setMenuOpen(false);}} className="w-full bg-[#222] border border-[#333] text-white py-3 rounded-full text-xs font-bold mb-3">🔑 Change Password</button><form action="/api/auth/logout" method="post" className="mt-auto"><button type="submit" className="w-full bg-white text-black py-3 rounded-full text-xs font-bold">Logout</button></form></div></div>)}
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pt-[80px]"><div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-black mb-6">{zone?.name} · Zone dashboard</h1>
        {dashboardError && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{dashboardError}</p>}
        <ZoneWeeklyReview cells={cells} reports={attendance} outreach={evangelismLogs} from={startDate} to={endDate} onWeekChange={(from,to)=>{setStartDate(from);setEndDate(to);}}/>
        <div className="bg-[#151515] border border-[#222] rounded-[24px] p-5 mb-6">
          <div className="flex gap-3 mb-4 flex-wrap"><button onClick={()=>setShowRequest(true)} className="ml-auto bg-[#cc0000] px-5 py-2 rounded-full text-xs font-bold">➕ Request Cell</button></div>
          {attendance.length===0 && evangelismLogs.length===0? <div className="text-center py-12"><p className="text-gray-500 text-sm">No reports yet</p><p className="text-gray-600 text-xs mt-2">Real stats will appear when cell leaders submit reports</p></div> : <>{cellPerformance.length===0?<p className="text-center text-gray-500 text-sm py-10">No cells in this zone yet</p>:<div className="space-y-3">{cellPerformance.map((performance)=>{ const maxAtt = Math.max(...cellPerformance.map((item)=>item.totalAtt),1); return (<div key={performance.cell.id} className="flex items-center gap-3"><span className="w-[140px] text-[11px] font-bold truncate">{performance.cell.name}</span><div className="flex-1 bg-[#0a0a0a] h-[24px] rounded-full overflow-hidden border border-[#222]"><div className="bg-[#cc0000] h-full rounded-full transition-all" style={{width:`${(performance.totalAtt/maxAtt)*100}%`}}/></div><span className="text-[11px]">{performance.totalAtt>0?`Att:${performance.totalAtt}`:"No data"}</span><span className="text-[10px] bg-[#cc0000]/20 px-2 py-1 rounded-full">📢 {performance.totalEvan} reached</span></div>); })}</div>}</>}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {cellPerformance.map((performance)=>(
            <div key={performance.cell.id} onClick={()=>setSelectedCell(performance.cell)} className="bg-[#151515] border border-[#222] rounded-[24px] p-5 cursor-pointer hover:border-[#cc0000]/50">
              <h3 className="font-black text-[13px]">{performance.cell.name}</h3><p className="text-[11px] text-gray-400">📍 {performance.cell.area} • 👥 {performance.memberCount} Members • 📢 {performance.evanLogs.length} Evan Reports</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3"><div className="bg-[#0a0a0a] rounded-xl p-2 text-center"><p className="text-[9px]">AVG</p><p className="font-black">{performance.avg}</p></div><div className="bg-[#0a0a0a] rounded-xl p-2 text-center"><p className="text-[9px]">REACHED</p><p className="font-black text-[#cc0000]">{performance.totalEvan}</p></div><div className="bg-[#0a0a0a] rounded-xl p-2 text-center"><p className="text-[9px]">TRACTS</p><p className="font-black">{performance.totalTracts}</p></div><div className="bg-[#0a0a0a] rounded-xl p-2 text-center"><p className="text-[9px]">MEMBERS</p><p className="font-black">{performance.memberCount}</p></div><div className="bg-[#0a0a0a] rounded-xl p-2 text-center"><p className="text-[9px]">OFFERING</p><p className="font-black">{performance.totalOffering.toFixed(2)}</p></div></div>
            </div>
          ))}
        </div>
        {showRequest && (<div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-6"><div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 w-full max-w-md"><h2 className="font-black mb-4">Request New Cell</h2><div className="space-y-3"><input placeholder="Cell Name" value={requestForm.cellName} onChange={e=>setRequestForm({...requestForm,cellName:e.target.value})} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/><input placeholder="Area" value={requestForm.area} onChange={e=>setRequestForm({...requestForm,area:e.target.value})} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/><button onClick={sendRequest} className="w-full bg-[#cc0000] py-3 rounded-full font-black text-sm">Send to Super Admin</button><button onClick={()=>setShowRequest(false)} className="w-full bg-[#222] py-3 rounded-full text-sm">Cancel</button></div></div></div>)}
      </div></div>
      {showPasswordModal && (<div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-6"><div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 w-full max-w-sm"><h2 className="font-black text-lg mb-4">Change Password</h2><div className="space-y-3"><input type="password" placeholder="New Password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm" /><input type="password" placeholder="Confirm New Password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm" /><button onClick={handleChangePassword} className="w-full bg-[#cc0000] py-3 rounded-full font-black text-sm">Update Password</button><button onClick={()=>setShowPasswordModal(false)} className="w-full bg-[#222] py-3 rounded-full text-sm">Cancel</button></div></div></div>)}
    </div>
  );
}
