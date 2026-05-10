import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { evaluateAccess } from "@/lib/auth/premium";
import { getFeatureFlags } from "@/lib/auth/feature-flags";

/**
 * POST /api/download-check
 *
 * Server-side download permission check (FOLLOWER_AUTH_DESIGN.md §4).
 *
 * Body: { size: 28 | 56 | 112, format: "png" | "gif" }
 *
 * Logic:
 *   1. DOWNLOAD_LOCK_ENABLED=false → always 200 (killswitch)
 *   2. Premium (follower OR PASSPHRASE-cookie) → 200
 *   3. trial: 28 + png → 200 (trial allowance)
 *   4. else → 403 with reason
 *
 * The client receives 200 to proceed with the canvas-side blob generation
 * (image bytes never leave the browser — see CLAUDE.md ブラウザ完結原則).
 * On 403 the client opens FollowGateModal.
 *
 * Bypass risk: a sufficiently determined user can skip the fetch in
 * devtools and call the underlying `<a>.click()` directly. Acceptable
 * per design §4.4 (95% protection, not 100%).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { allowed: false, reason: "invalid-body" },
      { status: 400 },
    );
  }

  const size = (body as { size?: unknown })?.size;
  const format = (body as { format?: unknown })?.format;

  if (typeof size !== "number" || ![28, 56, 112].includes(size)) {
    return NextResponse.json(
      { allowed: false, reason: "invalid-size" },
      { status: 400 },
    );
  }
  if (format !== "png" && format !== "gif") {
    return NextResponse.json(
      { allowed: false, reason: "invalid-format" },
      { status: 400 },
    );
  }

  const flags = getFeatureFlags();
  const session = await auth();

  // PASSPHRASE-cookie based isSubscribed (set by /api/auth POST)
  const cookieStore = await cookies();
  const isSubscribed = cookieStore.get("emote-subscriber")?.value === "1";

  const access = evaluateAccess({
    session: session ?? null,
    isSubscribed,
    flags,
  });

  // 1. Download-lock killswitch off → unconditionally allow
  if (!flags.DOWNLOAD_LOCK_ENABLED) {
    return NextResponse.json({ allowed: true, reason: "killswitch-disabled" });
  }

  // 2. Premium tier → always allowed
  if (access.tier === "premium") {
    return NextResponse.json({ allowed: true, reason: access.reason });
  }

  // 3. Trial allowance: 28px PNG only
  if (size === 28 && format === "png") {
    return NextResponse.json({ allowed: true, reason: "trial-allowance" });
  }

  // 4. Trial blocked
  return NextResponse.json(
    { allowed: false, reason: "trial-restriction", tier: access.tier },
    { status: 403 },
  );
}
