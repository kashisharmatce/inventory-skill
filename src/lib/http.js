import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export const json = (body, status = 200) => NextResponse.json(body, { status });

/** Wraps a route handler: ApiError -> its status; anything else -> generic 500 (details only in server logs). */
export function handle(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return json({ status: false, message: error.message }, error.status);
      }
      console.error(error);
      return json({ status: false, message: "Internal Server Error" }, 500);
    }
  };
}

/** Parses a JSON body; returns {} for a missing/invalid body so validators produce the error message. */
export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
