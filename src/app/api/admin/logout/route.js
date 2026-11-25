import { handle, json } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

// POST /api/admin/logout
export const POST = handle(async () => {
  const response = json({ status: true, message: "Logged out successfully" });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
});
