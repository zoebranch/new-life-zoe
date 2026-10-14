"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { siteMediaStorage } from "@/lib/site-media";
import { SiteImage } from "@/components/site-image";
import { useSiteSettings } from "@/lib/use-site-settings";
type WelcomePhoto = { id:string; title:string; media_path:string };
export default function WelcomePhotoCollage() {
  const settings = useSiteSettings();
  const [videoFailed,setVideoFailed] = useState(false);
  const [photos,setPhotos]=useState<WelcomePhoto[]>([]);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try {
        const {data,error}=await createClient().from("site_content").select("id,title,media_path").eq("kind","photo").eq("is_published",true).not("media_path","is",null).order("display_order").order("created_at",{ascending:false});
        if(active && !error)setPhotos((data??[]) as WelcomePhoto[]);
      } catch { /* Keep the church image while gallery photos are unavailable. */ }
    })();
    return()=>{active=false;};
  },[]);
  return <div className={`welcome-photo-collage ${settings.homepage_copy.collage_motion === "still" ? "welcome-photos-still" : ""}`} aria-label="Life at Zoe Branch">
    <svg width="0" height="0" aria-hidden="true" className="welcome-photo-masks"><defs><clipPath id="welcome-capsule-mask" clipPathUnits="objectBoundingBox"><path d="M .56 .025 C .76 -.035 1 .075 .98 .255 L .46 .925 C .27 1.065 .01 .98 .02 .775 L .45 .13 Q .5 .055 .56 .025 Z"/></clipPath><clipPath id="welcome-drop-mask" clipPathUnits="objectBoundingBox"><path d="M .5 0 L .95 .66 C 1.15 .94 .86 1 .5 1 C .14 1 -.15 .94 .05 .66 Z"/></clipPath></defs></svg>
    {[0,1,2].map(index=>{const selected = settings.homepage_copy[`collage_photo_${index+1}` as "collage_photo_1" | "collage_photo_2" | "collage_photo_3"]; const directPath=index===1?settings.homepage_copy.collage_upload_2:index===2?settings.homepage_copy.collage_upload_3:""; const photo = photos.find(item=>item.id===selected) ?? photos[index]; return <div className={`welcome-photo-shape welcome-photo-shape-${index+1}`} key={index}>
      <div className="welcome-photo-inner">{index===0 && settings.homepage_copy.collage_video_path && !videoFailed ? <video key={settings.homepage_copy.collage_video_path} src={siteMediaStorage.publicUrl(settings.homepage_copy.collage_video_path)} autoPlay muted loop playsInline preload="metadata" aria-label="Zoe Branch welcome video" onError={()=>setVideoFailed(true)}/> : directPath ? <Image unoptimized src={siteMediaStorage.publicUrl(directPath)} alt={index===1?"Zoe Branch community":"Life at Zoe Branch"} fill sizes="(max-width:760px) 45vw, 24vw"/> : photo ? <Image unoptimized src={siteMediaStorage.publicUrl(photo.media_path)} alt={photo.title} fill sizes="(max-width:760px) 45vw, 24vw"/> : <SiteImage slot="homepage-hero" fallbackSrc="/hero.jpg" className="welcome-photo-fallback" alt={index===0 ? "Worship and ministry at Zoe Branch" : ""} fill sizes="(max-width:760px) 45vw, 24vw"/>}</div>
    </div>;})}
  </div>;
}
