"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { createClient } from "@/lib/supabase/client";
import { siteMediaStorage } from "@/lib/site-media";

export type PublicSiteImageSlot = "church-logo" | "homepage-hero" | "evangelism-banner";

type SiteImageProps = Omit<ImageProps, "src"> & {
  slot: PublicSiteImageSlot;
  fallbackSrc: string;
};

export function SiteImage({ slot, fallbackSrc, alt, ...imageProps }: SiteImageProps) {
  const [src, setSrc] = useState(fallbackSrc);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await createClient().from("site_images")
        .select("media_path")
        .eq("slot", slot)
        .eq("is_published", true)
        .maybeSingle();
      if (active && data?.media_path) setSrc(siteMediaStorage.publicUrl(data.media_path));
    }
    void load().catch(() => undefined);
    return () => { active = false; };
  }, [slot]);

  return <Image {...imageProps} src={src} alt={alt} unoptimized />;
}
