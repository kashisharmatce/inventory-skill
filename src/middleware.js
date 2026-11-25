import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PROTECTED_PAGES = ["/dashboard", "/inventory", "/user-track", "/audit-report"];

const matches = (pathname, list) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

function redirectTo(request, pathname) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const loggedIn = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.ADMIN_PASSCODE
  );

  if (pathname === "/") return redirectTo(request, loggedIn ? "/dashboard" : "/login");
  if (!loggedIn && matches(pathname, PROTECTED_PAGES)) return redirectTo(request, "/login");
  if (loggedIn && pathname === "/login") return redirectTo(request, "/dashboard");

  // API routes enforce the session themselves (JSON 401) via requireAdmin().
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
