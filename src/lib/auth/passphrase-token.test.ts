import { describe, expect, it } from "vitest";
import {
  PASSPHRASE_TTL_SEC,
  derivePassphraseKey,
  getPassphraseConfig,
  issuePassphraseToken,
  normalizePassphrase,
  passphraseMatches,
  verifyPassphraseToken,
} from "./passphrase-token";

const SECRET = "0123456789abcdef0123456789abcdef";
const PASS = "あなたと出会えた日、それはもう記念日ってことで。";
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);

describe("passphrase token (A01 / A05 / A06)", () => {
  const key = derivePassphraseKey(SECRET, normalizePassphrase(PASS));

  it("issues and verifies a token", () => {
    const { token, expiresAtMs } = issuePassphraseToken(key, NOW);
    const v = verifyPassphraseToken(token, key, NOW + 1000);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.expiresAtMs).toBe(expiresAtMs);
    expect(expiresAtMs - NOW).toBe(PASSPHRASE_TTL_SEC * 1000);
  });

  it("rejects a tampered payload and a tampered signature", () => {
    const { token } = issuePassphraseToken(key, NOW);
    const [p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ v: 1, aud: "emote-passphrase", iat: 1, exp: 1 + PASSPHRASE_TTL_SEC })).toString("base64url");
    expect(verifyPassphraseToken(`${forgedPayload}.${s}`, key, NOW)).toEqual({ ok: false, reason: "bad-signature" });
    const flipped = s.slice(0, -1) + (s.endsWith("A") ? "B" : "A");
    expect(verifyPassphraseToken(`${p}.${flipped}`, key, NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects malformed inputs without throwing", () => {
    expect(verifyPassphraseToken(undefined, key, NOW)).toEqual({ ok: false, reason: "missing" });
    expect(verifyPassphraseToken("", key, NOW)).toEqual({ ok: false, reason: "missing" });
    expect(verifyPassphraseToken("1", key, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyPassphraseToken("a.b.c", key, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyPassphraseToken("a".repeat(3000), key, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyPassphraseToken("!!!.???", key, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("legacy fixed value '1' is never accepted", () => {
    expect(verifyPassphraseToken("1", key, NOW).ok).toBe(false);
  });

  it("expires after 30 days and does not slide", () => {
    const { token } = issuePassphraseToken(key, NOW);
    expect(verifyPassphraseToken(token, key, NOW + PASSPHRASE_TTL_SEC * 1000 - 1000).ok).toBe(true);
    expect(verifyPassphraseToken(token, key, NOW + PASSPHRASE_TTL_SEC * 1000)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a token from the future beyond clock skew", () => {
    const { token } = issuePassphraseToken(key, NOW + 5 * 60 * 1000);
    expect(verifyPassphraseToken(token, key, NOW)).toEqual({ ok: false, reason: "not-yet-valid" });
    const { token: near } = issuePassphraseToken(key, NOW + 30 * 1000);
    expect(verifyPassphraseToken(near, key, NOW).ok).toBe(true);
  });

  it("changing the secret or the passphrase invalidates old tokens", () => {
    const { token } = issuePassphraseToken(key, NOW);
    const keyNewSecret = derivePassphraseKey("f".repeat(32), normalizePassphrase(PASS));
    const keyNewPass = derivePassphraseKey(SECRET, normalizePassphrase("べつのあいことば"));
    expect(verifyPassphraseToken(token, keyNewSecret, NOW).ok).toBe(false);
    expect(verifyPassphraseToken(token, keyNewPass, NOW).ok).toBe(false);
    // Whitespace / case-only changes are the same passphrase.
    const keySamePass = derivePassphraseKey(SECRET, normalizePassphrase("あなたと 出会えた日、それはもう記念日ってことで。 "));
    expect(verifyPassphraseToken(token, keySamePass, NOW).ok).toBe(true);
  });

  it("passphraseMatches normalizes whitespace and case only", () => {
    expect(passphraseMatches("あなたと出会えた日、それはもう 記念日ってことで。", PASS, key)).toBe(true);
    expect(passphraseMatches("あなたと出会えた日 それはもう記念日ってことで", PASS, key)).toBe(false);
    expect(passphraseMatches("ABC", "abc", key)).toBe(true);
  });

  it("getPassphraseConfig validates env", () => {
    expect(getPassphraseConfig({ PASSPHRASE: "", PASSPHRASE_COOKIE_SECRET: SECRET } as unknown as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: "missing-passphrase" });
    expect(getPassphraseConfig({ PASSPHRASE: "x", PASSPHRASE_COOKIE_SECRET: "" } as unknown as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: "missing-secret" });
    expect(getPassphraseConfig({ PASSPHRASE: "x", PASSPHRASE_COOKIE_SECRET: "short" } as unknown as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: "weak-secret" });
    expect(getPassphraseConfig({ PASSPHRASE: "x".repeat(513), PASSPHRASE_COOKIE_SECRET: SECRET } as unknown as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: "passphrase-too-long" });
    const ok = getPassphraseConfig({ PASSPHRASE: PASS, PASSPHRASE_COOKIE_SECRET: SECRET } as unknown as NodeJS.ProcessEnv);
    expect(ok.ok).toBe(true);
  });
});
