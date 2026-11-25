/**
 * Browser-side helper for calling our own /api routes. Auth lives in httpOnly cookies,
 * so no token handling is needed here.
 * Throws an Error whose message is the server's message; on 401 it sends the user to /login.
 */
async function request(path, init) {
  let response;
  try {
    response = await fetch(`/api${path}`, { ...init, cache: "no-store" });
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

export function api(path, { method = "GET", body } = {}) {
  return request(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Uploads FormData (multipart); the browser sets the Content-Type boundary itself. */
export function apiUpload(path, formData) {
  return request(path, { method: "POST", body: formData });
}

/**
 * Uploads files one request at a time to /storage/:id/files.
 * Returns the list of { name, message } that failed (empty when everything uploaded).
 */
export async function uploadProductFiles(productId, files) {
  const failed = [];
  for (const file of files) {
    try {
      const form = new FormData();
      form.append("file", file);
      await apiUpload(`/storage/${productId}/files`, form);
    } catch (error) {
      failed.push({ name: file.name, message: error.message });
    }
  }
  return failed;
}
