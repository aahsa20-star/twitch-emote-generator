/**
 * Signed, expiring passphrase cookie (R1b, 実装設計 §3).
 *
 * Cookie:   emote-access-v1 = base64url(payload) "." base64url(HMAC-SHA256)
 * Payload:  { v: 1, aud: "emote-passphrase", iat, exp }   (Unix seconds)
 * Key:      HMAC-SHA256(master, "emote-passphrase-v1\0" + normalize(PASSPHRASE))
 *           → changing the passphrase (materially) OR the dedicated secret
 *             invalidates every outstanding cookie. AUTH_SECRET is NOT reused.
 *
 * Verification is pure and offline (no DB / no Twitch): the passphrase path
 * must keep working during a Twitch outage (仕様書 §7).
 *
 * The legacy fixed-value cookie `emote-subscriber=1` is never trusted and is
 * never auto-upgraded (A05).
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "emote-access-v1";
export const LEGACY_COOKIE_NAME = "emote-subscriber";
export const PASSPHRASE_TTL_SEC = 30 * 24 * 60 * 60; // 30 days, no sliding renewal
export const CLOCK_SKEW_SEC = 60;
export const MAX_COOKIE_LEN = 2048;
export const MAX_PASSPHRASE_LEN = 512;
export const MIN_SECRET_LEN = 32;

const PAYLOAD_VERSION = 1;
const PAYLOAD_AUD = "emote-passphrase";
const KEY_LABEL = "emote-passphrase-v1\0";

/** 空白（半角/全角）全除去 + 大小文字無視。句読点は一致必須のまま (fix14 と同じ)。 */
export function normalizePassphrase(s: string): string {
  return s.replace(/\s/g, "").toLowerCase();
}

export function derivePassphraseKey(masterSecret: string, normalizedPassphrase: string): Buffer {
  return createHmac("sha256", masterSecret).update(KEY_LABEL + normalizedPassphrase, "utf8").digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(key: Buffer, payloadB64: string): Buffer {
  return createHmac("sha256", key).update(payloadB64, "utf8").digest();
}

export interface IssuedToken {
  token: string;
  /** Unix ms */
  expiresAtMs: number;
  issuedAtMs: number;
}

export function issuePassphraseToken(key: Buffer, nowMs: number): IssuedToken {
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + PASSPHRASE_TTL_SEC;
  const payloadB64 = b64url(
    Buffer.from(JSON.stringify({ v: PAYLOAD_VERSION, aud: PAYLOAD_AUD, iat, exp }), "utf8"),
  );
  const sig = b64url(sign(key, payloadB64));
  return { token: `${payloadB64}.${sig}`, expiresAtMs: exp * 1000, issuedAtMs: iat * 1000 };
}

export type VerifyFailure =
  | "missing"
  | "malformed"
  | "bad-signature"
  | "bad-claims"
  | "not-yet-valid"
  | "expired";

export type VerifyResult =
  | { ok: true; expiresAtMs: number; issuedAtMs: number }
  | { ok: false; reason: VerifyFailure };

/**
 * Verify a cookie value. Never throws; every failure is "not authenticated".
 * Constant-time signature comparison on fixed-length digests.
 */
export function verifyPassphraseToken(
  token: string | undefined | null,
  key: Buffer,
  nowMs: number,
): VerifyResult {
  if (!token) return { ok: false, reason: "missing" };
  if (typeof token !== "string" || token.length > MAX_COOKIE_LEN) {
    return { ok: false, reason: "malformed" };
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [payloadB64, sigB64] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(payloadB64) || !/^[A-Za-z0-9_-]+$/.test(sigB64)) {
    return { ok: false, reason: "malformed" };
  }

  // Signature first: an attacker must not learn anything about claim parsing.
  const expected = sign(key, payloadB64);
  let provided: Buffer;
  try {
    provided = Buffer.from(sigB64, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad-claims" };
  const p = payload as Record<string, unknown>;
  const { v, aud, iat, exp } = p;
  if (v !== PAYLOAD_VERSION || aud !== PAYLOAD_AUD) return { ok: false, reason: "bad-claims" };
  if (
    typeof iat !== "number" || typeof exp !== "number" ||
    !Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)
  ) {
    return { ok: false, reason: "bad-claims" };
  }
  if (exp - iat !== PASSPHRASE_TTL_SEC) return { ok: false, reason: "bad-claims" };

  const nowSec = Math.floor(nowMs / 1000);
  if (iat > nowSec + CLOCK_SKEW_SEC) return { ok: false, reason: "not-yet-valid" };
  if (exp <= nowSec) return { ok: false, reason: "expired" };

  return { ok: true, expiresAtMs: exp * 1000, issuedAtMs: iat * 1000 };
}

/** Timing-safe passphrase comparison on HMAC digests of the normalized values. */
export function passphraseMatches(input: string, expected: string, key: Buffer): boolean {
  const a = createHmac("sha256", key).update(normalizePassphrase(input), "utf8").digest();
  const b = createHmac("sha256", key).update(normalizePassphrase(expected), "utf8").digest();
  return timingSafeEqual(a, b);
}

export type PassphraseConfigError =
  | "missing-passphrase"
  | "passphrase-too-long"
  | "missing-secret"
  | "weak-secret";

export type PassphraseConfig =
  | { ok: true; key: Buffer; passphrase: string }
  | { ok: false; reason: PassphraseConfigError };

let cached: { secret: string; passphrase: string; key: Buffer } | null = null;

/**
 * Resolve the server-side passphrase configuration from env. The derived key
 * is cached per (secret, passphrase) pair. Values are never logged.
 */
export function getPassphraseConfig(env: NodeJS.ProcessEnv = process.env): PassphraseConfig {
  const passphrase = env.PASSPHRASE ?? "";
  const secret = env.PASSPHRASE_COOKIE_SECRET ?? "";
  if (!passphrase || normalizePassphrase(passphrase) === "") return { ok: false, reason: "missing-passphrase" };
  if (passphrase.length > MAX_PASSPHRASE_LEN) return { ok: false, reason: "passphrase-too-long" };
  if (!secret) return { ok: false, reason: "missing-secret" };
  if (secret.length < MIN_SECRET_LEN) return { ok: false, reason: "weak-secret" };

  if (!cached || cached.secret !== secret || cached.passphrase !== passphrase) {
    cached = { secret, passphrase, key: derivePassphraseKey(secret, normalizePassphrase(passphrase)) };
  }
  return { ok: true, key: cached.key, passphrase };
}

/** Cookie attributes shared by set / clear (実装設計 §3.2). */
export function accessCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
