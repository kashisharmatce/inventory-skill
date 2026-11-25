import "server-only";
import { ApiError } from "@/lib/errors";
import { isValid } from "@/lib/validations";
import {
  assertNotLocked,
  clearFailures,
  getPasscode,
  recordFailure,
  safeEqual,
} from "@/lib/passcode";
import { createSessionToken } from "@/lib/session";

/** Checks the access code and returns a signed session token. `clientKey` is used for rate limiting. */
export async function loginWithPasscode(body, clientKey) {
  const code = body?.passcode;
  if (!isValid(code)) throw new ApiError(400, "Access code is required");

  const passcode = getPasscode();
  assertNotLocked(clientKey);

  if (!safeEqual(code, passcode)) {
    recordFailure(clientKey);
    throw new ApiError(401, "Invalid access code");
  }

  clearFailures(clientKey);
  return createSessionToken(passcode);
}
