"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SITE_SETTINGS, mergeSiteSettings, type SiteSettings } from "@/lib/site-settings";

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await createClient().from("site_settings").select("*").eq("id", true).maybeSingle();
        if (active && data) setSettings(mergeSiteSettings(data as Partial<SiteSettings>));
      } catch {
        // Keep the existing public defaults available if Supabase is offline.
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return settings;
}
