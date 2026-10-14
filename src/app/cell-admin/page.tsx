"use client";
import "./dashboard.css";
import {fetchAllRows} from "@/lib/fetch-all-rows";
import {useDashboardRefresh} from "@/lib/use-dashboard-refresh";
import { useState, useEffect } from "react";
import { hasEvangelismActivity, mapReportDetails, type ReportDetails, emptyDetailedForm } from "@/lib/report-details";
import { CellReportGenerator } from "@/components/cell-report-generator";
import { isValidOffering } from "@/lib/report-validation";
import { SiteImage } from "@/components/site-image";
import type { PostgrestError } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import type { Cell } from "@/data/cells";
import { createClient } from "@/lib/supabase/client";
import { mapCell } from "@/lib/church-data";

type CellLeaderAuth = {
  user_id: string;
  username: string;
  display_name: string;
  role: "cell_leader";
  cell_id: number;
  cellId: number;
};

type Member = {
  id: string;
  cellId: number;
  name: string;
  gender: "Male" | "Female";
  age: number;
  phone: string;
  area: string;
  joinedAt: string;
};

type Attendance = ReportDetails & {
  id: string;
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

type Evangelism = {
  id: string;
  cellId: number;
  date: string;
  peopleReached: number;
  tracts: number;
  soulsWon: number;
  teamCount: number;
  contacts: number;
  reportedBy: string;
  area: string;
  notes: string;
};

type JoinRequest = {
  id: string;
  name: string;
  gender: "Male" | "Female";
  age: number;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type MonthlyAttendance = {
  month: string;
  logs: Attendance[];
  evangelismCount: number;
  totalAtt: number;
  totalEvan: number;
  avgAtt: number;
  avgEvan: number;
};

function localDateInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}


export default function CellAdmin() {
 const revision=useDashboardRefresh();
  const router = useRouter();
  const [auth, setAuth] = useState<CellLeaderAuth | null>(null);
  const [myCell, setMyCell] = useState<Cell | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [evangelismLogs, setEvangelismLogs] = useState<Evangelism[]>([]);
  const [form, setForm] = useState({ name:"", gender:"Male", age:"", phone:"", area:"" });
  const [attForm, setAttForm] = useState({ date: localDateInputValue(), evangelismDate: localDateInputValue(), attendance:"", visitors:"", soulsWon:"", peopleReached:"", tracts:"", teamCount:"", contacts:"", offeringAmount:"", evangelismNotes:"" });
  const [detailedForm,setDetailedForm] = useState(emptyDetailedForm);
  const [dashboardTheme,setDashboardTheme]=useState<"light"|"dark">("light");
  const [themeSaving,setThemeSaving]=useState(false);
  async function toggleDashboardTheme(){if(themeSaving)return;setThemeSaving(true);try{const next=dashboardTheme==="light"?"dark":"light";const {error}=await createClient().auth.updateUser({data:{dashboard_theme:next}});if(error)throw error;setDashboardTheme(next);}catch{setReportError("Your display preference could not be saved. Please try again.");}finally{setThemeSaving(false);}}
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requestError, setRequestError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [editingReportId,setEditingReportId] = useState<string | null>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(()=>{
    let active = true;
    async function loadDashboard() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/leaders"); return; }
      const { data: profile, error } = await supabase.from("profiles")
        .select("user_id,username,display_name,role,cell_id,is_suspended")
        .eq("user_id", user.id).maybeSingle();
      if (error || profile?.is_suspended || profile?.role !== "cell_leader" || profile.cell_id == null) {
        router.replace("/leaders"); return;
      }
      if(active)setDashboardTheme(user.user_metadata.dashboard_theme==="dark"?"dark":"light");
      const admin = { ...profile, cellId: Number(profile.cell_id), role: profile.role } as CellLeaderAuth;
      const [requestsResult, membersResult, cellResult, attendanceResult, evangelismResult] = await Promise.all([
        fetchAllRows((from,to) => supabase.from("member_join_requests")
          .select("id,name,gender,age,phone,status,created_at")
          .eq("cell_id", profile.cell_id).order("created_at", { ascending: false }).order("id").range(from,to)),
        fetchAllRows((from,to) => supabase.from("members")
          .select("id,cell_id,name,gender,age,phone,area,joined_at")
          .eq("cell_id", profile.cell_id).order("name").order("id").range(from,to)),
        supabase.from("cells").select("id,zone_id,name,area,leader,phone,meeting_day,meeting_time,reported_member_count")
          .eq("id", profile.cell_id).maybeSingle(),
        fetchAllRows((from,to) => supabase.from("attendance_reports")
          .select("*")
          .eq("cell_id", profile.cell_id).order("report_date", { ascending: false }).order("id").range(from,to)),
        fetchAllRows((from,to) => supabase.from("evangelism_reports")
          .select("id,cell_id,report_date,people_reached,tracts,souls_won,team_count,contacts,notes")
          .eq("cell_id", profile.cell_id).order("report_date", { ascending: false }).order("id").range(from,to)),
      ]);
      if (!active) return;
      setAuth(admin);
      if (cellResult.error || !cellResult.data) { router.replace("/leaders"); return; }
      const loadedCell = mapCell(cellResult.data);
      setMyCell(loadedCell);
      setMembers((membersResult.data ?? []).map((member) => ({
        id: member.id, cellId: Number(member.cell_id), name: member.name,
        gender: member.gender, age: member.age, phone: member.phone,
        area: member.area, joinedAt: member.joined_at,
      })));
      if (membersResult.error) setReportError("Member records couldn't be loaded. Refresh and try again.");
      if (attendanceResult.error || evangelismResult.error) {
        setReportError((current) => [current, "Reports couldn't be loaded. Refresh and try again."].filter(Boolean).join(" "));
      } else {
        setAttendance((attendanceResult.data ?? []).map((row) => ({
          ...mapReportDetails(row), id: row.id, cellId: Number(row.cell_id), date: row.report_date,
          attendance: row.attendance, visitors: row.visitors, soulsWon: row.souls_won,
          evangelism: row.evangelism, offeringAmount: Number(row.offering_amount ?? 0),
          evangelismDate: row.evangelism_date, peopleReached: Number(row.people_reached ?? 0),
          tracts: Number(row.tracts ?? 0), teamCount: Number(row.team_count ?? 0),
          contacts: Number(row.contacts ?? 0), evangelismNotes: row.evangelism_notes ?? "",
        })));
        setEvangelismLogs((evangelismResult.data ?? []).map((row) => ({
          ...mapReportDetails(row), id: row.id, cellId: Number(row.cell_id), date: row.report_date,
          peopleReached: row.people_reached, tracts: row.tracts, soulsWon: row.souls_won,
          teamCount: row.team_count, contacts: row.contacts,
          reportedBy: admin.display_name || admin.username, area: loadedCell.area, notes: row.notes,
        })));
      }
      if (requestsResult.error) setRequestError("Join requests couldn't be loaded. Refresh and try again.");
      else setJoinRequests(requestsResult.data ?? []);
    }
    void loadDashboard();
    return () => { active = false; };
  },[router, revision]);

  const reviewJoinRequest = async (id: string, approve: boolean) => {
    if (!auth?.cell_id) {
      setRequestError("Your cell login is not ready. Sign in again and retry.");
      return;
    }
    setReviewingId(id);
    setRequestError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("review_member_join_request", {
      p_request_id: id,
      p_approve: approve,
    });
    if (error) {
      setRequestError(error.message.includes("CELL_ALREADY_REGISTERED") ? "This person already belongs to a cell or has another pending request. Confirm their existing membership before proceeding." : "We couldn't review that request. Refresh and try again.");
      setReviewingId(null);
      return;
    }
    const [requestsResult, membersResult] = await Promise.all([
      fetchAllRows((from,to) => supabase.from("member_join_requests").select("id,name,gender,age,phone,status,created_at")
        .eq("cell_id", auth.cell_id).order("created_at", { ascending: false }).order("id").range(from,to)),
      fetchAllRows((from,to) => supabase.from("members").select("id,cell_id,name,gender,age,phone,area,joined_at")
        .eq("cell_id", auth.cell_id).order("name").order("id").range(from,to)),
    ]);
    if (requestsResult.error) setRequestError("The request was reviewed, but the list couldn't refresh.");
    else setJoinRequests(requestsResult.data ?? []);
    if (!membersResult.error) setMembers((membersResult.data ?? []).map((member) => ({
      id: member.id, cellId: Number(member.cell_id), name: member.name,
      gender: member.gender, age: member.age, phone: member.phone,
      area: member.area, joinedAt: member.joined_at,
    })));
    setReviewingId(null);
  };

  const myMembers = members.filter((member)=>member.cellId===myCell?.id);
  const myLogs = attendance.filter((log)=>log.cellId===myCell?.id);
  const allEvangelism = [
    ...myLogs.filter((log) => log.evangelismDate && hasEvangelismActivity(log))
      .map((log) => ({ id: `attendance-${log.id}`, date: log.evangelismDate!, teamCount: log.teamCount, peopleReached: log.peopleReached, tracts: log.tracts, soulsWon: log.soulsWon, contacts: log.contacts, notes: log.evangelismNotes })),
    ...evangelismLogs.filter((log) => log.cellId === myCell?.id)
      .map((log) => ({ id: log.id, date: log.date, teamCount: log.teamCount, peopleReached: log.peopleReached, tracts: log.tracts, soulsWon: log.soulsWon, contacts: log.contacts, notes: log.notes })),
  ];

  // MONTHLY CALCULATIONS FOR CELL LEADER
  const stats = (()=>{
    const now = new Date();
    const currentMonth = localDateInputValue().slice(0, 7);
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthLogs = myLogs.filter((log)=>log.date.slice(0, 7) === currentMonth);
    const lastMonthLogs = myLogs.filter((log)=>log.date.slice(0, 7) === previousMonth);
    const monthlyEvangelism = [
      ...myLogs.filter((log) => log.evangelismDate && hasEvangelismActivity(log)).map((log) => ({ date: log.evangelismDate!, peopleReached: log.peopleReached, soulsWon: log.soulsWon })),
      ...myLogs.filter((log) => !log.evangelismDate && log.evangelism > 0 && !evangelismLogs.some((oldLog) => oldLog.cellId === log.cellId && oldLog.date === log.date))
        .map((log) => ({ date: log.date, peopleReached: log.evangelism, soulsWon: log.soulsWon })),
      ...evangelismLogs.filter((log) => log.cellId === myCell?.id)
        .map((log) => ({ date: log.date, peopleReached: log.peopleReached, soulsWon: log.soulsWon })),
    ];
    const thisMonthEvangelism = monthlyEvangelism.filter((log) => log.date.slice(0, 7) === currentMonth);
    const totalAtt = myLogs.reduce((s,a)=>s+a.attendance,0);
    const totalSouls = monthlyEvangelism.reduce((s,a)=>s+a.soulsWon,0);
    const totalEvan = monthlyEvangelism.reduce((s,a)=>s+a.peopleReached,0);
    const avgAtt = myLogs.length? Math.round(totalAtt/myLogs.length):0;
    const avgAttMonth = thisMonthLogs.length? Math.round(thisMonthLogs.reduce((sum, log)=>sum+log.attendance,0)/thisMonthLogs.length):0;
    const avgEvanMonth = thisMonthEvangelism.length? Math.round(thisMonthEvangelism.reduce((sum, log)=>sum+log.peopleReached,0)/thisMonthEvangelism.length):0;
    const avgSoulsMonth = thisMonthEvangelism.length? Math.round(thisMonthEvangelism.reduce((sum, log)=>sum+log.soulsWon,0)/thisMonthEvangelism.length):0;
    const lastMonthAverage = lastMonthLogs.length ? lastMonthLogs.reduce((sum, log)=>sum+log.attendance,0)/lastMonthLogs.length : 0;
    const growth = lastMonthAverage ? Math.round(((avgAttMonth - Math.round(lastMonthAverage))/Math.max(1, Math.round(lastMonthAverage)))*100) : 0;
    const rate = myMembers.length && avgAtt? Math.round((avgAtt/myMembers.length)*100):0;

    const monthlyGroups = myLogs.reduce<Record<string, MonthlyAttendance>>((acc, log)=>{
      const key = log.date.slice(0,7);
      if (!acc[key]) acc[key] = { month:key, logs:[], evangelismCount:0, totalAtt:0, totalEvan:0, avgAtt:0, avgEvan:0 };
      acc[key].logs.push(log);
      acc[key].totalAtt += log.attendance;
      acc[key].avgAtt = Math.round(acc[key].totalAtt/acc[key].logs.length);
      return acc;
    },{});
    monthlyEvangelism.forEach((log) => {
      const key = log.date.slice(0,7);
      if (!monthlyGroups[key]) monthlyGroups[key] = { month:key, logs:[], evangelismCount:0, totalAtt:0, totalEvan:0, avgAtt:0, avgEvan:0 };
      monthlyGroups[key].evangelismCount += 1;
      monthlyGroups[key].totalEvan += log.peopleReached;
      monthlyGroups[key].avgEvan = Math.round(monthlyGroups[key].totalEvan / monthlyGroups[key].evangelismCount);
    });
    const monthlyGroup = Object.values(monthlyGroups).sort((a,b) => a.month.localeCompare(b.month)).reverse();

    const male = myMembers.filter((member)=>member.gender==="Male").length;
    const female = myMembers.filter((member)=>member.gender==="Female").length;

    return { totalAtt, totalSouls, totalEvan, avgAtt, avgAttMonth, avgEvanMonth, avgSoulsMonth, growth, rate, monthlyGroup, thisMonthLogs, thisMonthEvangelism, lastMonthLogs, male, female };
  })();

  const addMember = async () => {
    const name = form.name.trim();
    const age = Number(form.age);
    if (!name || !Number.isInteger(age) || age < 0 || age > 120 || !myCell?.id) {
      return alert("Enter the member's name and a valid age.");
    }
    setSavingMember(true);
    const { data, error } = await createClient().from("members").insert({
      cell_id: myCell.id,
      name: name.toUpperCase(),
      gender: form.gender,
      age,
      phone: form.phone.trim(),
      area: form.area.trim() || myCell.area,
    }).select("id,cell_id,name,gender,age,phone,area,joined_at").single();
    setSavingMember(false);
    if (error || !data) return alert(error?.message.includes("CELL_ALREADY_REGISTERED") ? "This person is already registered or has a pending request in another cell. Contact Super Admin to arrange a transfer." : "We couldn't save this member. Check your connection and try again.");
    setMembers((current) => [...current, {
      id: data.id, cellId: Number(data.cell_id), name: data.name,
      gender: data.gender, age: data.age, phone: data.phone,
      area: data.area, joinedAt: data.joined_at,
    }]);
    setForm({ name:"", gender:"Male", age:"", phone:"", area:"" });
    alert("Member added to the church records.");
  };

  const addAttendance = async () => {
    if (!myCell) return;
    const values = {
      attendance: Number(attForm.attendance), visitors: Number(attForm.visitors || 0),
      soulsWon: Number(attForm.soulsWon || 0), peopleReached: Number(attForm.peopleReached || 0),
      tracts: Number(attForm.tracts || 0), teamCount: Number(attForm.teamCount || 0), contacts: Number(attForm.contacts || 0),
    };
    const breakdown = [detailedForm.men,detailedForm.women,detailedForm.children];
    const hasBreakdown = breakdown.some(value=>value !== "");
    if (hasBreakdown && (breakdown.some(value=>value === "" || !Number.isSafeInteger(Number(value)) || Number(value)<0) || breakdown.reduce((total,value)=>total+Number(value),0)!==values.attendance)) {
      setReportError("Enter all three attendance groups (use 0 where needed). Men, women and children must add up to total attendance."); return;
    }
    const offeringAmount = Number(attForm.offeringAmount || 0);
    const evangelismHasValues = values.peopleReached > 0 || values.tracts > 0 || values.teamCount > 0 || values.contacts > 0 || values.soulsWon > 0 || Boolean(attForm.evangelismNotes.trim()) || Boolean(detailedForm.evangelismLocation.trim());
    if (!attForm.date || !attForm.attendance || (evangelismHasValues && !attForm.evangelismDate) || Object.values(values).some((value) => !Number.isSafeInteger(value) || value < 0) || !isValidOffering(offeringAmount)) {
      setReportError("Enter the attendance date, whole-number counts, and a valid offering. Include the evangelism date when entering evangelism details.");
      return;
    }
    setSavingReport(true);
    setReportError("");
    try {
      const supabase = createClient();
      const reportValues = {
        cell_id: myCell.id, report_date: attForm.date, attendance: values.attendance,
        visitors: values.visitors, souls_won: values.soulsWon, evangelism: values.peopleReached,
        offering_amount: offeringAmount,
        evangelism_date: evangelismHasValues ? attForm.evangelismDate : null,
        people_reached: values.peopleReached, tracts: values.tracts,
        team_count: values.teamCount, contacts: values.contacts,
        evangelism_notes: attForm.evangelismNotes.trim(),
        attendance_men: hasBreakdown ? Number(detailedForm.men) : null,
        attendance_women: hasBreakdown ? Number(detailedForm.women) : null,
        attendance_children: hasBreakdown ? Number(detailedForm.children) : null,
        visitor_details: detailedForm.visitorDetails.trim(), follow_up: detailedForm.followUp.trim(),
        evangelism_location: detailedForm.evangelismLocation.trim(), challenges: detailedForm.challenges.trim(),
        prayer_requests: detailedForm.prayerRequests.trim(), reporter_name: auth?.display_name || auth?.username || "",
        submitted_by: auth?.user_id,
      };
      const correctedValues = { ...reportValues, submitted_by: undefined, reporter_name: undefined };
      const query = editingReportId
        ? supabase.from("attendance_reports").update(correctedValues).eq("id",editingReportId).eq("cell_id",myCell.id)
        : supabase.from("attendance_reports").insert(reportValues);
      const {data,error} = await query.select("*").single();
      if (error || !data) throw error ?? new Error("No report was returned.");
      setAttendance((current) => [{
        ...mapReportDetails(data), id: data.id, cellId: Number(data.cell_id), date: data.report_date,
        attendance: data.attendance, visitors: data.visitors, soulsWon: data.souls_won,
        evangelism: data.evangelism, offeringAmount: Number(data.offering_amount ?? 0),
        evangelismDate: data.evangelism_date, peopleReached: Number(data.people_reached ?? 0),
        tracts: Number(data.tracts ?? 0), teamCount: Number(data.team_count ?? 0),
        contacts: Number(data.contacts ?? 0), evangelismNotes: data.evangelism_notes ?? "",
      }, ...current.filter(r=>r.id!==data.id)]);
      setEditingReportId(null);
      setDetailedForm(emptyDetailedForm);
      setAttForm({ date: localDateInputValue(), evangelismDate: localDateInputValue(), attendance:"", visitors:"", soulsWon:"", peopleReached:"", tracts:"", teamCount:"", contacts:"", offeringAmount:"", evangelismNotes:"" });
    } catch {
      setReportError("We couldn't submit this report. Check the connection and ensure the detailed reports database update has been applied.");
    } finally {
      setSavingReport(false);
    }
  };

  const editReport = (r: Attendance) => {
    setEditingReportId(r.id);
    setAttForm({date:r.date,evangelismDate:r.evangelismDate || localDateInputValue(),attendance:String(r.attendance),visitors:String(r.visitors),soulsWon:String(r.soulsWon),peopleReached:String(r.peopleReached),tracts:String(r.tracts),teamCount:String(r.teamCount),contacts:String(r.contacts),offeringAmount:r.offeringAmount.toFixed(2),evangelismNotes:r.evangelismNotes});
    setDetailedForm({men:r.men==null?"":String(r.men),women:r.women==null?"":String(r.women),children:r.children==null?"":String(r.children),visitorDetails:r.visitorDetails,followUp:r.followUp,evangelismLocation:r.evangelismLocation,challenges:r.challenges,prayerRequests:r.prayerRequests});
    setReportError(""); document.getElementById("submit-cell-report")?.scrollIntoView({behavior:"smooth",block:"start"});
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

  return (
    <div className="cell-leader-dashboard" data-theme={dashboardTheme}>
      <header className="fixed top-0 w-full z-50 bg-white/95 h-[64px] flex items-center border-b"><div className="w-full px-5 flex justify-between"><div className="flex items-center gap-3"><SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="Zoe Church" width={42} height={42} className="w-[42px] h-[42px] rounded-full"/><p className="font-black text-[12px]">ZOE - CELL LEADER</p></div><div className="cell-header-actions"><button type="button" onClick={toggleDashboardTheme} disabled={themeSaving} className="cell-theme-toggle" aria-label={`Switch to ${dashboardTheme === "light" ? "dark" : "light"} mode`} title={`Switch to ${dashboardTheme === "light" ? "dark" : "light"} mode`}><span aria-hidden="true">{dashboardTheme === "light" ? "☾" : "☀"}</span><span>{dashboardTheme === "light" ? "Dark mode" : "Light mode"}</span></button><button aria-label="Account menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)} className="w-10 h-10 flex flex-col gap-[5px] justify-center"><span className="w-6 h-[2px] bg-black block"/><span className="w-6 h-[2px] bg-black block"/><span className="w-6 h-[2px] bg-black block"/></button></div></div></header>
      {menuOpen && (<div className="fixed inset-0 z-[60] bg-black/90 pt-[80px]"><div className="w-full max-w-sm ml-auto h-full bg-[#151515] border-l border-[#222] p-6 flex flex-col"><button onClick={()=>setMenuOpen(false)} className="w-8 h-8 rounded-full bg-white/10 text-white mb-6">✕</button><div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 mb-4"><p className="text-[10px] text-gray-500 font-bold">LOGGED IN AS</p><p className="font-black text-sm mt-1">{auth.username}</p><p className="text-xs text-gray-400">{myCell?.name}</p></div><button onClick={()=>{setShowPasswordModal(true); setMenuOpen(false);}} className="w-full bg-[#222] border border-[#333] text-white py-3 rounded-full text-xs font-bold mb-3">🔑 Change Password</button><form action="/api/auth/logout" method="post" className="mt-auto"><button type="submit" className="w-full bg-white text-black py-3 rounded-full text-xs font-bold">Logout</button></form></div></div>)}

      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pt-[80px]"><div className="max-w-6xl mx-auto">
        <div className="cell-dashboard-heading"><div><p className="cell-dashboard-eyebrow">CELL LEADER WORKSPACE</p><h1 className="text-2xl font-black">{myCell?.name}</h1><p className="cell-dashboard-welcome">Welcome, {auth.display_name || auth.username}. Care for your members and keep your ministry reports up to date.</p></div><a className="cell-dashboard-primary" href="#submit-cell-report">New cell report <span aria-hidden="true">↗</span></a></div>
        <p className="text-sm text-gray-400 mb-2">{myCell?.area} · {myCell?.meetingDay} · {myCell?.meetingTime}</p>
        {reportError && <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{reportError}</p>}
        <div className="cell-dashboard-summary">
          <div><span>Registered members</span><strong>{myMembers.length}</strong><small>{stats.male} men · {stats.female} women</small></div>
          <div><span>Reports submitted</span><strong>{myLogs.length}</strong><small>{stats.thisMonthLogs.length} this month</small></div>
          <div><span>Pending requests</span><strong>{joinRequests.filter(request=>request.status==="pending").length}</strong><small>People waiting to join your cell</small></div>
        </div>
        <nav className="cell-dashboard-nav" aria-label="Dashboard sections"><a href="#cell-overview">Overview</a><a href="#join-requests-heading">Join requests</a><a href="#cell-members">Members</a><a href="#submit-cell-report">Submit report</a><a href="#cell-report-history">Report history</a></nav>

        <section className="bg-[#151515] border border-[#222] rounded-[24px] p-6 mb-6" aria-labelledby="join-requests-heading">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 id="join-requests-heading" className="font-black text-sm">JOIN REQUESTS</h2>
            <span className="text-[10px] text-gray-400">{joinRequests.filter((request) => request.status === "pending").length} pending</span>
          </div>
          {requestError && <p role="alert" className="text-red-400 text-xs mb-3">{requestError}</p>}
          {joinRequests.length === 0 ? <p className="text-gray-500 text-xs py-4 text-center">No join requests yet.</p> : (
            <div className="space-y-3">
              {joinRequests.map((request) => <article key={request.id} className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-bold text-sm">{request.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{request.gender} · {request.age} · {request.phone}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(request.created_at).toLocaleDateString()} · {request.status}</p>
                </div>
                {request.status === "pending" && <div className="flex gap-2">
                  <button disabled={reviewingId !== null} onClick={() => void reviewJoinRequest(request.id, true)} className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-full">{reviewingId === request.id ? "Saving…" : "Approve"}</button>
                  <button disabled={reviewingId !== null} onClick={() => void reviewJoinRequest(request.id, false)} className="bg-[#292929] hover:bg-[#383838] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-full">Reject</button>
                </div>}
              </article>)}
            </div>
          )}
        </section>

        {/* MONTHLY PERFORMANCE FOR CELL LEADER */}
        <div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 mb-6">
          <h2 id="cell-overview" className="font-black text-sm mb-4">Monthly overview · {new Date().toLocaleString('default',{month:'long'})}</h2>
          {stats.thisMonthLogs.length===0 && stats.thisMonthEvangelism.length===0? <p className="text-gray-500 text-xs py-4 text-center">No reports this month yet - submit a cell report!</p> : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0a0a0a] rounded-xl p-3 text-center border border-[#222]"><p className="text-[10px] text-gray-500">Average attendance</p><p className="text-xl font-black mt-1">{stats.avgAttMonth}</p><p className="text-[9px] text-gray-500">{stats.thisMonthLogs.length} meetings</p></div>
              <div className="bg-[#0a0a0a] rounded-xl p-3 text-center border border-[#222]"><p className="text-[10px] text-gray-500">Average people reached</p><p className="text-xl font-black mt-1 text-[#cc0000]">{stats.avgEvanMonth}</p></div>
              <div className="bg-[#0a0a0a] rounded-xl p-3 text-center border border-[#222]"><p className="text-[10px] text-gray-500">Average souls won</p><p className="text-xl font-black mt-1 text-green-400">{stats.avgSoulsMonth}</p></div>
            </div>
          )}
          {stats.monthlyGroup.length>0 && (
            <div className="mt-5"><p className="text-[11px] font-bold text-gray-400 mb-2">HISTORY BY MONTH</p><div className="flex gap-2 flex-wrap">{stats.monthlyGroup.map((month)=> <div key={month.month} className="bg-[#0a0a0a] border border-[#222] px-3 py-2 rounded-full text-[10px]"><b>{month.month}</b> • Att {month.avgAtt} Evan {month.avgEvan}</div>)}</div></div>
          )}
        </div>

        {/* AUTO STATS AT BOTTOM LIKE ZONE */}
        <div className="bg-gradient-to-r from-green-900/20 to-[#151515] border border-green-800/30 rounded-[24px] p-6 mb-6">
          <h2 className="font-black text-sm mb-4">Ministry progress</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">ATTENDANCE RATE</p><p className="text-lg font-black mt-1">{stats.rate}%</p><p className="text-[9px] text-gray-500">Avg {stats.avgAtt} / {myMembers.length} members</p></div>
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">GROWTH vs LAST MONTH</p><p className={`text-lg font-black mt-1 ${stats.growth>=0?'text-green-400':'text-red-400'}`}>{stats.growth>=0?'+':''}{stats.growth}%</p></div>
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">TOTAL SOULS WON</p><p className="text-lg font-black mt-1 text-green-400">{stats.totalSouls}</p><p className="text-[9px] text-gray-500">Souls recorded through evangelism</p></div>
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"><p className="text-[10px] text-gray-500">TOTAL EVANGELISM</p><p className="text-lg font-black mt-1 text-[#cc0000]">{stats.totalEvan}</p></div>
          </div>
        </div>

        {myCell && <CellReportGenerator cell={myCell} reports={myLogs} evangelism={allEvangelism} members={myMembers}/>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 h-fit">
            <h2 id="cell-members" className="font-bold mb-4">Add a member</h2>
            <div className="space-y-3"><label className="cell-input-label"><span>Full Name</span><input placeholder="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><div className="flex gap-2"><select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} className="w-1/2 bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"><option>Male</option><option>Female</option></select><label className="cell-input-label"><span>Age</span><input placeholder="Age" type="number" value={form.age} onChange={e=>setForm({...form,age:e.target.value})} className="w-1/2 bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label></div><label className="cell-input-label"><span>Phone</span><input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><button disabled={savingMember} onClick={()=>void addMember()} className="w-full bg-[#cc0000] py-3 rounded-full font-black text-sm disabled:opacity-50">{savingMember ? "Saving…" : "Add Member"}</button></div>

            <h3 className="font-bold mt-6 mb-3">Members ({myMembers.length})</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {myMembers.length===0? <p className="text-gray-500 text-xs">No members yet</p> : myMembers.map((member)=><div key={member.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs"><div className="flex justify-between"><span className="font-bold">{member.name}</span><span className="text-[10px] bg-[#222] px-2 py-1 rounded-full">{member.gender} • {member.age}y</span></div><div className="flex justify-between mt-1 text-gray-400"><span>📞 {member.phone || 'No phone'}</span><span>{new Date(member.joinedAt).toLocaleDateString()}</span></div></div>)}
            </div>
          </div>

          <div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 h-fit">
            <h2 id="submit-cell-report" className="font-bold mb-2 scroll-mt-20">{editingReportId ? "Edit Cell Report" : "Submit a cell report"}</h2>{editingReportId && <button className="mb-3 rounded-full border px-4 py-2 text-xs" onClick={()=>{setEditingReportId(null);setDetailedForm(emptyDetailedForm);setAttForm({date:localDateInputValue(),evangelismDate:localDateInputValue(),attendance:"",visitors:"",soulsWon:"",peopleReached:"",tracts:"",teamCount:"",contacts:"",offeringAmount:"",evangelismNotes:""});}}>Cancel edit</button>}
            <p className="text-xs text-gray-400 mb-4">Enter the attendance, offering and evangelism details together. The report is shared with your Zone Leader when submitted.</p>
            <div className="space-y-3"><label className="block text-xs text-gray-300">Attendance date<input aria-label="Attendance report date" type="date" value={attForm.date} onChange={e=>setAttForm({...attForm,date:e.target.value})} className="mt-1 w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-sm"/></label><div className="grid grid-cols-2 gap-2"><label className="cell-input-label"><span>Attendance</span><input aria-label="Attendance" placeholder="Attendance" type="number" min="0" step="1" value={attForm.attendance} onChange={e=>setAttForm({...attForm,attendance:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><label className="cell-input-label"><span>Visitors</span><input aria-label="Visitors" placeholder="Visitors" type="number" min="0" step="1" value={attForm.visitors} onChange={e=>setAttForm({...attForm,visitors:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><label className="cell-input-label"><span>Offering amount</span><input aria-label="Offering amount" placeholder="Offering amount" type="number" min="0" step="0.01" value={attForm.offeringAmount} onChange={e=>setAttForm({...attForm,offeringAmount:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><label className="cell-input-label"><span>Souls won</span><input aria-label="Souls won" placeholder="Souls won" type="number" min="0" step="1" value={attForm.soulsWon} onChange={e=>setAttForm({...attForm,soulsWon:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label></div><label className="block text-xs text-gray-300">Date evangelised<input aria-label="Evangelism date" type="date" value={attForm.evangelismDate} onChange={e=>setAttForm({...attForm,evangelismDate:e.target.value})} className="mt-1 w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-sm"/></label><div className="grid grid-cols-2 gap-2"><label className="cell-input-label"><span>People reached</span><input aria-label="People reached" placeholder="People reached" type="number" min="0" step="1" value={attForm.peopleReached} onChange={e=>setAttForm({...attForm,peopleReached:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><label className="cell-input-label"><span>Tracts distributed</span><input aria-label="Tracts distributed" placeholder="Tracts distributed" type="number" min="0" step="1" value={attForm.tracts} onChange={e=>setAttForm({...attForm,tracts:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><label className="cell-input-label"><span>Team members</span><input aria-label="Evangelism team members" placeholder="Team members" type="number" min="0" step="1" value={attForm.teamCount} onChange={e=>setAttForm({...attForm,teamCount:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><label className="cell-input-label"><span>Contacts made</span><input aria-label="Evangelism contacts" placeholder="Contacts made" type="number" min="0" step="1" value={attForm.contacts} onChange={e=>setAttForm({...attForm,contacts:e.target.value})} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm"/></label><textarea aria-label="Evangelism notes" placeholder="Evangelism notes or testimony (optional)" maxLength={2000} value={attForm.evangelismNotes} onChange={e=>setAttForm({...attForm,evangelismNotes:e.target.value})} className="col-span-2 bg-[#0a0a0a] border border-[#222] p-3 rounded-2xl text-sm"/></div><details className="cell-report-details"><summary>Additional report details <span>(optional)</span></summary><p className="text-xs text-gray-400">Optional attendance breakdown: adult men, adult women, and children. Each person belongs to one group; the groups must total attendance.</p><div className="grid grid-cols-3 gap-2">{([['men','Men'],['women','Women'],['children','Children']] as const).map(([key,label])=><label key={key} className="text-xs">{label}<input aria-label={`Attendance ${label.toLowerCase()}`} type="number" min="0" step="1" value={detailedForm[key]} onChange={e=>setDetailedForm({...detailedForm,[key]:e.target.value})} className="w-full mt-1 bg-[#0a0a0a] border border-[#333] rounded-xl p-3"/></label>)}</div>{([['visitorDetails','Visitor names and details'],['followUp','Follow-up progress'],['evangelismLocation','Evangelism location'],['challenges','Challenges'],['prayerRequests','Prayer requests']] as const).map(([key,label])=><label key={key} className="block text-xs">{label}<textarea aria-label={label} maxLength={key==='evangelismLocation'?300:2000} value={detailedForm[key]} onChange={e=>setDetailedForm({...detailedForm,[key]:e.target.value})} className="w-full mt-1 bg-[#0a0a0a] border border-[#333] rounded-xl p-3 text-sm"/></label>)}</details><button disabled={savingReport} onClick={()=>void addAttendance()} className="w-full bg-green-700 py-3 rounded-full font-black text-sm disabled:opacity-50">{savingReport ? "Saving report…" : editingReportId ? "Save Corrected Report" : "Submit report to Zone Leader"}</button></div>
            <h3 id="cell-report-history" className="font-bold mt-6 mb-3">Recent reports ({myLogs.length})</h3><div className="space-y-2">{myLogs.map((report)=><div key={report.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs"><div className="flex justify-between gap-3"><span>{report.date}</span><span>Attendance {report.attendance} · Visitors {report.visitors} · Offering {report.offeringAmount.toFixed(2)}</span></div><button disabled={savingReport} onClick={()=>editReport(report)} className="mt-2 px-3 py-2 rounded-full border font-bold disabled:opacity-40">Edit report</button><p className="mt-1 text-gray-400">Evangelism {report.evangelismDate || "—"} · Reached {report.peopleReached} · Souls {report.soulsWon} · Tracts {report.tracts}</p></div>)}</div>
          </div>
        </div>
      </div></div>

      {showPasswordModal && (<div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-6"><div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 w-full max-w-sm"><h2 className="font-black text-lg mb-4">Change Password</h2><div className="space-y-3"><label className="cell-input-label"><span>New Password</span><input type="password" placeholder="New Password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm" /></label><label className="cell-input-label"><span>Confirm New Password</span><input type="password" placeholder="Confirm New Password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 rounded-full text-sm" /></label><button onClick={handleChangePassword} className="w-full bg-[#cc0000] py-3 rounded-full font-black text-sm">Update Password</button><button onClick={()=>setShowPasswordModal(false)} className="w-full bg-[#222] py-3 rounded-full text-sm">Cancel</button></div></div></div>)}
    </div>
  );
}
