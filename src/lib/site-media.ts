import { createClient } from "@/lib/supabase/client";

const bucketName = "website-media";

export type SiteMediaKind = "theme" | "event" | "photo" | "download";

export type UploadedSiteMedia = {
  path: string;
  contentType: string;
  fileName: string;
};

export interface SiteMediaStorage {
  upload(file: File, kind: SiteMediaKind): Promise<UploadedSiteMedia>;
  publicUrl(path: string): string;
  remove(path: string): Promise<void>;
}

function safeFileName(fileName: string) {
  const normalized = fileName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return normalized.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "media-file";
}

const supabaseSiteMedia: SiteMediaStorage = {
  async upload(file, kind) {
    const path = `${kind}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error } = await createClient().storage.from(bucketName).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return { path, contentType: file.type || "application/octet-stream", fileName: file.name };
  },
  publicUrl(path) {
    const futureStorageBaseUrl = process.env.NEXT_PUBLIC_SITE_MEDIA_BASE_URL?.replace(/\/$/, "");
    if (futureStorageBaseUrl) {
      return `${futureStorageBaseUrl}/${path.split("/").map(encodeURIComponent).join("/")}`;
    }
    return createClient().storage.from(bucketName).getPublicUrl(path).data.publicUrl;
  },
  async remove(path) {
    const { error } = await createClient().storage.from(bucketName).remove([path]);
    if (error) throw error;
  },
};

// Keep storage access behind this interface so the church server can replace
// Supabase Storage later without changing the website editor or content model.
export const siteMediaStorage: SiteMediaStorage = supabaseSiteMedia;
