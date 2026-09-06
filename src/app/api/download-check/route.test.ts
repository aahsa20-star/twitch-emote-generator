import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import type { FeatureFlags } from "@/types/auth";

const state: { session: Session | null; flags: FeatureFlags } = {
  session: null,
  flags: { SITE_LOCK_ENABLED: true, TRIAL_MODE_ENABLED: true, FOLLOW_AUTH_ENABLED: true, PREMIUM_LOCK_ENABLED: true, DOWNLOAD_LOCK_ENABLED: true },
};
vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@/lib/auth/feature-flags", () => ({ getFeatureFlags: () => state.flags }));

import { POST } from "./route";
import { ACCESS_COOKIE_NAME, derivePassphraseKey, issuePassphraseToken, normalizePassphrase } from "@/lib/auth/passphrase-token";
import { EXPORT_PROFILES, PLATFORMS } from "@/lib/download/profiles";

const ORIGIN = "https://twitch-emote-generator.vercel.app";
const SECRET = "s".repeat(40);
const PASS = "pass phrase";
const BID = "777";

function post(body: unknown, cookie?: string) {
  return new NextRequest(`${ORIGIN}/api/download-check`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function signedCookie(now = Date.now()) {
  const key = derivePassphraseKey(SECRET, normalizePassphrase(PASS));
  return `${ACCESS_COOKIE_NAME}=${issuePassphraseToken(key, now).token}`;
}

function followerSession(o: Partial<Session["user"]> = {}): Session {
  return {
    expires: new Date(Date.now() + 3600_000).toISOString(),
    user: {
      id: "u1", name: "A", isFollower: true, followerStatus: "following",
      followCheckedAt: Date.now() - 60_000, followAttemptedAt: Date.now() - 60_000,
      followAttemptOutcome: "following", followBroadcasterId: BID,
      scope: "openid user:read:email user:read:follows", ...o,
    },
  } as Session;
}

describe("POST /api/download-check (A13 / A14 / A05)", () => {
  beforeEach(() => {
    process.env.PASSPHRASE = PASS;
    process.env.PASSPHRASE_COOKIE_SECRET = SECRET;
    process.env.AUTH_TWITCH_BROADCASTER_ID = BID;
    state.session = null;
    state.flags = { SITE_LOCK_ENABLED: true, TRIAL_MODE_ENABLED: true, FOLLOW_AUTH_ENABLED: true, PREMIUM_LOCK_ENABLED: true, DOWNLOAD_LOCK_ENABLED: true };
  });
  afterEach(() => {
    delete process.env.PASSPHRASE;
    delete process.env.PASSPHRASE_COOKIE_SECRET;
    delete process.env.AUTH_TWITCH_BROADCASTER_ID;
  });

  it("allows every platform's full size set for a passphrase-unlocked anonymous user", async () => {
    for (const platform of PLATFORMS) {
      for (const format of ["png", "gif"] as const) {
        const res = await POST(post({ platform, assetType: "emote", files: EXPORT_PROFILES[platform].sizes.map((size) => ({ size, format })) }, signedCookie()));
        expect(res.status, `${platform}/${format}`).toBe(200);
        expect(await res.json()).toMatchObject({ allowed: true, grants: ["passphrase"] });
      }
    }
    const badge = await POST(post({ platform: "twitch", assetType: "badge", files: [{ size: 18, format: "png" }, { size: 36, format: "png" }, { size: 72, format: "png" }] }, signedCookie()));
    expect(badge.status).toBe(200);
  });

  it("allows a logged-in follower without passphrase", async () => {
    state.session = followerSession();
    const res = await POST(post({ platform: "discord", assetType: "emote", files: [{ size: 128, format: "gif" }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ allowed: true, grants: ["follower"] });
  });

  it("403 access-required for a non-follower / anonymous; legacy cookie '1' is not a grant", async () => {
    const anon = await POST(post({ platform: "twitch", assetType: "emote", files: [{ size: 28, format: "png" }] }));
    expect(anon.status).toBe(403);
    expect(await anon.json()).toMatchObject({ allowed: false, reason: "access-required" });
    const legacy = await POST(post({ platform: "twitch", assetType: "emote", files: [{ size: 28, format: "png" }] }, "emote-subscriber=1"));
    expect(legacy.status).toBe(403);
    state.session = followerSession({ isFollower: false, followerStatus: "not-following", followAttemptOutcome: "not-following" });
    const nf = await POST(post({ platform: "twitch", assetType: "emote", files: [{ size: 112, format: "png" }] }));
    expect(nf.status).toBe(403);
  });

  it("tampered / expired cookies are rejected", async () => {
    const good = signedCookie();
    const tampered = good.slice(0, -2) + "zz";
    expect((await POST(post({ platform: "twitch", files: [{ size: 28, format: "png" }] }, tampered))).status).toBe(403);
    const expired = signedCookie(Date.now() - 31 * 24 * 3600 * 1000);
    expect((await POST(post({ platform: "twitch", files: [{ size: 28, format: "png" }] }, expired))).status).toBe(403);
  });

  it("400 invalid-output / invalid-body are input errors even when unlocked", async () => {
    const wrongSize = await POST(post({ platform: "twitch", assetType: "emote", files: [{ size: 128, format: "png" }] }, signedCookie()));
    expect(wrongSize.status).toBe(400);
    expect(await wrongSize.json()).toMatchObject({ allowed: false, reason: "invalid-output" });
    const badBody = await POST(post({ platform: "twitch", files: [] }, signedCookie()));
    expect(badBody.status).toBe(400);
    expect(await badBody.json()).toMatchObject({ reason: "invalid-body" });
  });

  it("legacy {size, format} body still works for one release", async () => {
    const res = await POST(post({ size: 128, format: "png" }, signedCookie()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ allowed: true, legacy: true });
  });

  it("403 on cross-site origin", async () => {
    const req = new NextRequest(`${ORIGIN}/api/download-check`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", cookie: signedCookie() },
      body: JSON.stringify({ platform: "twitch", files: [{ size: 28, format: "png" }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ reason: "origin-mismatch" });
  });

  it("DOWNLOAD_LOCK_ENABLED=false skips the gate but keeps validation", async () => {
    state.flags = { ...state.flags, DOWNLOAD_LOCK_ENABLED: false };
    expect((await POST(post({ platform: "twitch", files: [{ size: 112, format: "gif" }] }))).status).toBe(200);
    expect((await POST(post({ platform: "twitch", files: [{ size: 999, format: "gif" }] }))).status).toBe(400);
  });

  it("SITE_LOCK_ENABLED=false: trial allowance is Twitch 28px PNG only", async () => {
    state.flags = { ...state.flags, SITE_LOCK_ENABLED: false };
    expect((await POST(post({ platform: "twitch", files: [{ size: 28, format: "png" }] }))).status).toBe(200);
    expect((await POST(post({ platform: "twitch", files: [{ size: 56, format: "png" }] }))).status).toBe(403);
    expect((await POST(post({ platform: "discord", files: [{ size: 32, format: "png" }] }))).status).toBe(403);
  });

  it("FOLLOW_AUTH_ENABLED=false ignores follower evidence (A17)", async () => {
    state.flags = { ...state.flags, FOLLOW_AUTH_ENABLED: false };
    state.session = followerSession();
    expect((await POST(post({ platform: "twitch", files: [{ size: 28, format: "png" }] }))).status).toBe(403);
    expect((await POST(post({ platform: "twitch", files: [{ size: 28, format: "png" }] }, signedCookie()))).status).toBe(200);
  });
});
