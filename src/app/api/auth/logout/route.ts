import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Local logout returned an error:", error.message);
  } catch (error) {
    console.error("Local logout failed:", error instanceof Error ? error.message : "Unknown error");
  }

  const response = NextResponse.redirect(new URL("/leaders", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
