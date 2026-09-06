import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFeatureFlags } from "@/lib/auth/feature-flags";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/passphrase-token";
import { resolveAccess } from "@/lib/auth/resolve-access";
import { checkRequestOrigin, readJsonBody } from "@/lib/auth/origin-check";
import { validateDownloadRequest } from "@/lib/download/profiles";

/**
 * POST /api/download-check — server-side save permission (R1c, 実装設計 §8).
 *
 * Body (new): { platform, assetType: "emote"|"badge", files: [{size, format}] }
 * Body (legacy, 1 release): { size, format }
 *
 *   400 invalid-body / invalid-output   input problems (never a follow prompt)
 *   403 access-required                 not unlocked (follow or passphrase)
 *   403 origin-mismatch                 cross-site request
 *   200 { allowed: true, grants }       proceed (bytes never leave the browser)
 *
 * DOWNLOAD_LOCK_ENABLED=false skips the access gate but keeps input validation.
 */
const MAX_BODY_BYTES = 4096;

export async function POST(req: NextRequest) {
  const origin = checkRequestOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ allowed: false, reason: "origin-mismatch" }, { status: 403 });
  }

  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (body === undefined) {
    return NextResponse.json({ allowed: false, reason: "invalid-body" }, { status: 400 });
  }
  const v = validateDownloadRequest(body);
  if (!v.ok) {
    return NextResponse.json({ allowed: false, reason: v.reason, detail: v.detail }, { status: 400 });
  }

  const flags = getFeatureFlags();
  if (!flags.DOWNLOAD_LOCK_ENABLED) {
    return NextResponse.json({ allowed: true, reason: "killswitch-disabled" });
  }

  const access = await resolveAccess({
    accessCookie: req.cookies.get(ACCESS_COOKIE_NAME)?.value,
    getSession: auth,
    flags,
  });

  if (access.isUnlocked) {
    return NextResponse.json({ allowed: true, grants: access.grants, legacy: v.legacy });
  }

  if (flags.SITE_LOCK_ENABLED) {
    return NextResponse.json({ allowed: false, reason: "access-required", tier: access.tier }, { status: 403 });
  }

  // Trial allowance (SITE_LOCK_ENABLED=false only): Twitch 28px PNG.
  const { request } = v;
  const trialOk =
    request.assetType === "emote" &&
    request.platform === "twitch" &&
    request.files.every((f) => f.size === 28 && f.format === "png");
  if (trialOk) {
    return NextResponse.json({ allowed: true, reason: "trial-allowance" });
  }
  return NextResponse.json({ allowed: false, reason: "access-required", tier: access.tier }, { status: 403 });
}
