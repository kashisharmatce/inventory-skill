import { handle, json, readJson } from "@/lib/http";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { loginWithPasscode } from "@/services/auth.service";

// POST /api/admin/login  { passcode }  -> sets the signed httpOnly session cookie
export const POST = handle(async (request) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const token = await loginWithPasscode(await readJson(request), ip);

  const response = json({ status: true, message: "Logged in successfully" });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
});
