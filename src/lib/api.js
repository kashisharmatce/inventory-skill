/**
 * Browser-side helper for calling our own /api routes. Auth lives in httpOnly Supabase cookies,
 * so no token handling is needed here.
 * Throws an Error whose message is the server's message; on 401 it sends the user to /login.
 */
export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Network error. Please check your connection and try again.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON response
  }

  if (!response.ok || payload?.status === false) {
    if (response.status === 401 && !path.startsWith("/admin/login") && typeof window !== "undefined") {
      window.location.assign("/login");
    }
    const error = new Error(payload?.message || response.statusText || "Request failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}
