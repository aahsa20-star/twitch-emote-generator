import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  MAX_PASSPHRASE_LEN,
  PASSPHRASE_TTL_SEC,
  accessCookieOptions,
  getPassphraseConfig,
  issuePassphraseToken,
  normalizePassphrase,
  passphraseMatches,
} from "@/lib/auth/passphrase-token";
import { checkRequestOrigin, readJsonBody } from "@/lib/auth/origin-check";
import { consumeRateLimit, getClientIp, rateLimitKey } from "@/lib/auth/rate-limit";

/**
 * PASSPHRASE 認証エンドポイント (R1b: 署名付き Cookie + 試行制限).
 *
 * POST   body {passphrase} → 200 {ok, expiresAt} + Set-Cookie emote-access-v1
 *        400 形式不正 / 401 不一致 / 403 Origin 不一致 / 429 試行過多 / 503 設定不備
 * DELETE 新旧 Cookie を削除（Twitch session には触らない）
 *
 * - 旧固定値 Cookie `emote-subscriber=1` からの自動昇格はしない（A05）。
 * - 試行は成功/失敗を問わず送信元単位で 10 回 / 15 分。
 * - 正解・設定値はレスポンスにもログにも出さない。
 */
const MAX_BODY_BYTES = 2048;
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_SEC = 15 * 60;

function clearCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE_NAME, "", accessCookieOptions(0));
  res.cookies.set(LEGACY_COOKIE_NAME, "", accessCookieOptions(0));
}

export async function POST(req: NextRequest) {
  const origin = checkRequestOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ ok: false, reason: "origin-mismatch" }, { status: 403 });
  }

  const body = await readJsonBody(req, MAX_BODY_BYTES);
  const passphrase = (body as { passphrase?: unknown } | undefined)?.passphrase;
  if (
    typeof passphrase !== "string" ||
    passphrase.length === 0 ||
    passphrase.length > MAX_PASSPHRASE_LEN ||
    normalizePassphrase(passphrase) === ""
  ) {
    return NextResponse.json({ ok: false, reason: "invalid-body" }, { status: 400 });
  }

  const cfg = getPassphraseConfig();
  if (!cfg.ok) {
    console.error(`[api/auth] passphrase config error: ${cfg.reason}`);
    return NextResponse.json({ ok: false, reason: "temporarily-unavailable" }, { status: 503 });
  }

  const rl = await consumeRateLimit({
    key: rateLimitKey("passphrase", getClientIp(req.headers)),
    limit: ATTEMPT_LIMIT,
    windowSec: ATTEMPT_WINDOW_SEC,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  if (!passphraseMatches(passphrase, cfg.passphrase, cfg.key)) {
    return NextResponse.json({ ok: false, reason: "mismatch" }, { status: 401 });
  }

  const issued = issuePassphraseToken(cfg.key, Date.now());
  const res = NextResponse.json({ ok: true, expiresAt: issued.expiresAtMs });
  res.cookies.set(ACCESS_COOKIE_NAME, issued.token, accessCookieOptions(PASSPHRASE_TTL_SEC));
  // Remove the legacy fixed-value cookie so it can never be mistaken for a grant.
  res.cookies.set(LEGACY_COOKIE_NAME, "", accessCookieOptions(0));
  return res;
}

export async function DELETE(req: NextRequest) {
  const origin = checkRequestOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ ok: false, reason: "origin-mismatch" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  clearCookies(res);
  return res;
}
