import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const path = request.nextUrl.pathname;
  const redirect = (url: URL) => {
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    return redirected;
  };
  const expectedRole = path.startsWith("/super-admin") && path !== "/super-admin/login"
    ? "superadmin"
    : path.startsWith("/cell-admin")
      ? "cell_leader"
      : path.startsWith("/zone-leader")
        ? "zone_leader"
        : null;

  if (!expectedRole) {
    await supabase.auth.getClaims();
    return response;
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") {
    const login = new URL(expectedRole === "superadmin" ? "/super-admin/login" : "/leaders", request.url);
    if (expectedRole !== "superadmin") login.searchParams.set("next", path);
    return redirect(login);
  }

  const profileResult = await supabase.from("profiles").select("role,is_suspended").eq("user_id", userId).maybeSingle();
  let profile: { role: string; is_suspended?: boolean } | null = profileResult.data;
  let profileError = profileResult.error;
  if (profileError?.code === "42703") {
    const fallback = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
    profile = fallback.data as { role: string } | null;
    profileError = fallback.error;
  }
  if (profileError) return redirect(new URL("/leaders", request.url));
  if (profile?.is_suspended) {
    return redirect(new URL("/leaders?disabled=1", request.url));
  }
  if (!profile || profile.role !== expectedRole) {
    const target = profile?.role === "superadmin" ? "/super-admin"
      : profile?.role === "zone_leader" ? "/zone-leader"
      : profile?.role === "cell_leader" ? "/cell-admin"
      : "/leaders";
    return redirect(new URL(target, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

