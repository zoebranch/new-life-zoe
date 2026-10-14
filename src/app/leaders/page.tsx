"use client";

import { useEffect, useState } from "react";
import { SiteImage } from "@/components/site-image";
import { createClient } from "@/lib/supabase/client";

export default function LeadersLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("disabled") === "1") {
      const timer = window.setTimeout(() => setError("This leader login is suspended. Contact the super admin."), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError || !data.user) {
      setError("Sign-in failed. Check your email and password.");
      setBusy(false);
      return;
    }
    const profileResult = await supabase.from("profiles")
      .select("role,is_suspended")
      .eq("user_id", data.user.id).maybeSingle();
    let profile: { role: string; is_suspended?: boolean } | null = profileResult.data;
    let profileError = profileResult.error;
    if (profileError?.code === "42703") {
      const fallback = await supabase.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
      profile = fallback.data as { role: string } | null;
      profileError = fallback.error;
    }
    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError(profileError
        ? `We couldn't read this account's Zoe Church role: ${profileError.message}`
        : "This account has no Zoe Church role yet. Contact the administrator.");
      setBusy(false);
      return;
    }
    if (profile.is_suspended) {
      await supabase.auth.signOut();
      setError("This leader login has been suspended. Contact the super admin.");
      setBusy(false);
      return;
    }
    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const destination = profile.role === "superadmin" ? "/super-admin"
      : profile.role === "zone_leader" ? "/zone-leader"
      : profile.role === "cell_leader" ? "/cell-admin"
      : "/leaders";
    const allowedPath = requestedPath && !requestedPath.includes("\\")
      && (requestedPath === destination || requestedPath.startsWith(`${destination}/`))
      ? requestedPath : null;
    window.location.assign(allowedPath ?? destination);
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <div className="w-full bg-white h-[68px] flex items-center px-5 md:px-10">
        <div className="flex items-center gap-3.5">
          <SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="ZOE Logo" width={44} height={44} className="w-[44px] h-[44px] rounded-full object-contain" />
          <div className="leading-[0.9]">
            <p className="font-black text-[13px] text-black">NEW LIFE CHRISTIAN CENTER</p>
            <p className="font-black text-[10.5px] tracking-[0.18em] text-[#E10600] mt-[2px]">ZOE BRANCH</p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-5">
        <form onSubmit={handleLogin} className="w-full max-w-[360px] bg-[#111111] border border-white/[0.06] rounded-[24px] p-8">
          <h1 className="font-black text-[14px] tracking-[0.14em] text-white text-center mb-8">ZOE LEADER LOGIN</h1>
          <div className="flex flex-col gap-3">
            <input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full h-[46px] px-5 rounded-full bg-[#E9EEF5] text-black text-[13px] font-medium outline-none placeholder:text-black/40" />
            <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full h-[46px] px-5 rounded-full bg-[#E9EEF5] text-black text-[13px] font-medium outline-none placeholder:text-black/40" />
            {error && <p role="alert" className="text-red-400 text-xs text-center">{error}</p>}
            <button disabled={busy} className="w-full h-[44px] rounded-full bg-[#E10600] hover:bg-[#c10500] disabled:opacity-50 text-white font-black text-[12px] tracking-[0.1em] mt-2 transition">{busy ? "SIGNING IN…" : "SIGN IN"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
