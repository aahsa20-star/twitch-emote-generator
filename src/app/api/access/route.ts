import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/passphrase-token";
import { resolveAccess } from "@/lib/auth/resolve-access";

/**
 * GET /api/access — public AccessSnapshot for the client (実装設計 §6).
 *
 * Uses the `auth(handler)` route wrapper so that any JWT changes made by the
 * jwt callback (token refresh) are written back to the session cookie —
 * a bare `auth()` call inside a Route Handler cannot set cookies.
 *
 * Never returns secrets. `Cache-Control: no-store`.
 * A passphrase grant is evaluated first and is never dropped because the
 * Twitch identity could not be resolved.
 */
export const dynamic = "force-dynamic";

export const GET = auth(async (req) => {
  const snapshot = await resolveAccess({
    accessCookie: req.cookies.get(ACCESS_COOKIE_NAME)?.value,
    getSession: async () => req.auth,
  });
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
});
