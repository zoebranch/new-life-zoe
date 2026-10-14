"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SiteImage } from "@/components/site-image";
import { createClient } from "@/lib/supabase/client";
import { mapCell } from "@/lib/church-data";
import { useSiteSettings } from "@/lib/use-site-settings";

export default function JoinPage() {
  const params = useParams();
  const settings = useSiteSettings();
  const cellId = Number(params.id);
  const [cell, setCell] = useState<ReturnType<typeof mapCell> | undefined>(undefined);
  const [cellLoaded, setCellLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCell() {
      setCellLoaded(false);
      setLoadError("");
      setCell(undefined);
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase.from("cells")
          .select("id,zone_id,name,area,leader,phone,meeting_day,meeting_time,reported_member_count,is_active")
          .eq("id", cellId).eq("is_active", true).maybeSingle();
        if (!active) return;
        if (loadError) setLoadError("The cell could not be loaded. Please return to the directory and try again.");
        else if (data) {
          const { data: zone, error: zoneError } = await supabase.from("zones")
            .select("id").eq("id", data.zone_id).eq("is_active", true).maybeSingle();
          if (zoneError) setLoadError("The cell could not be loaded. Please return to the directory and try again.");
          else if (zone) setCell(mapCell(data));
        }
      } catch {
        if (active) setLoadError("The cell could not be loaded. Please return to the directory and try again.");
      }
      if (active) setCellLoaded(true);
    }
    void loadCell();
    return () => { active = false; };
  }, [cellId]);

  if (!cellLoaded) return <div className="min-h-screen bg-[#0a0a0a] text-white p-8 text-center">Loading cell…</div>;
  if (!cell) return <div className="min-h-screen bg-[#0a0a0a] text-white p-8 text-center"><p>{loadError || "Cell not found or no longer accepting requests."}</p><Link href="/cells" className="inline-block mt-4 rounded-full bg-white px-5 py-2 text-sm font-bold text-black">Back to cells</Link></div>;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let submitError: Error | null = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("member_join_requests").insert({
        cell_id: cell.id,
        name: name.trim(),
        phone: phone.trim(),
        gender,
        age: Number(age),
      });
      submitError = error;
    } catch {
      submitError = new Error("Request failed");
    }
    setBusy(false);
    if (submitError) {
      setError(submitError.message.includes("CELL_ALREADY_REGISTERED") ? "You already belong to a cell or have a join request awaiting review. Please contact your cell leader if you need to move to another cell." : submitError.message.includes("CELL_CONTACT_INVALID") ? "Please enter a complete phone number." : "We couldn't submit your request. Please check your details and try again.");
      return;
    }
    setDone(true);
  };

  if(done) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="bg-[#151515] border border-[#222] rounded-[24px] p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
          <h2 className="font-black text-xl mt-4">Welcome to {cell.name}!</h2>
          <p className="text-gray-400 text-sm mt-2">Your request has been sent to the cell leader for review.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* HEADER WITH SAME LOGO */}
      <div className="bg-white text-black px-5 md:px-10 h-[64px] flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3.5">
          <SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="ZOE Logo" width={42} height={42} className="w-[42px] h-[42px] rounded-full object-contain bg-white" />
          <div className="leading-[0.9]">
            <p className="font-black text-[12.5px] tracking-[-0.01em] text-black">{settings.church_name}</p>
            <p className="font-black text-[10px] tracking-[0.18em] text-[#E10600] mt-[2px]">{settings.branch_name}</p>
          </div>
        </div>
        <Link href="/cells" className="bg-black text-white text-xs px-4 py-2 rounded-full font-bold">← Back</Link>
      </div>

      <div className="max-w-[520px] mx-auto p-6">
        <div className="bg-[#151515] border border-[#222] rounded-[24px] p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-black">Join {cell.name}</h1>
              <p className="text-gray-400 text-[12px] mt-1">{cell.area} • Leader: {cell.leader}</p>
              <p className="text-[10px] text-gray-500 mt-1">{cell.meetingDay} • {cell.meetingTime} • 📞 {cell.phone}</p>
            </div>
            <span className="text-[8px] bg-[#222] px-2 py-1 rounded-full text-gray-400">{cell.area}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black tracking-widest text-gray-400">FULL NAME</label>
              <input required placeholder="John Phiri" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3.5 rounded-full mt-1 text-sm focus:border-red-600 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black tracking-widest text-gray-400">PHONE NUMBER</label>
              <input required placeholder="097..." value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3.5 rounded-full mt-1 text-sm focus:border-red-600 outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="w-1/2">
                <label className="text-[10px] font-black tracking-widest text-gray-400">GENDER</label>
                <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3.5 rounded-full mt-1 text-sm outline-none">
                  <option>Male</option><option>Female</option>
                </select>
              </div>
              <div className="w-1/2">
                <label className="text-[10px] font-black tracking-widest text-gray-400">AGE</label>
                <input required type="number" min="0" max="120" placeholder="25" value={age} onChange={e=>setAge(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3.5 rounded-full mt-1 text-sm focus:border-red-600 outline-none" />
              </div>
            </div>
            {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={busy} className="w-full bg-[#cc0000] hover:bg-red-700 disabled:opacity-60 text-white py-4 rounded-full font-black text-sm mt-2">
              {busy ? "Sending request…" : `Request to join ${cell.area} Cell`}
            </button>
            <p className="text-center text-[10px] text-gray-500 mt-2">You can belong to one cell at a time. If you need to change cells, contact your cell leader.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
