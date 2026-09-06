import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";


import { POST, DELETE } from "./route";
import { _resetRateLimitMemory } from "@/lib/auth/rate-limit";
import { ACCESS_COOKIE_NAME, LEGACY_COOKIE_NAME } from "@/lib/auth/passphrase-token";

const ORIGIN = "https://twitch-emote-generator.vercel.app";
const SECRET = "s".repeat(40);
const PASS = "あなたと出会えた日、それはもう記念日ってことで。";

function post(body: unknown, headers: Record<string, string> = {}, ip = "203.0.113.1") {
  return new NextRequest(`${ORIGIN}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": ip, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/auth (A01 / A05 / A06 / A19)", () => {
  beforeEach(() => {
    _resetRateLimitMemory();
    process.env.PASSPHRASE = PASS;
    process.env.PASSPHRASE_COOKIE_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.PASSPHRASE;
    delete process.env.PASSPHRASE_COOKIE_SECRET;
  });

  it("issues the signed cookie and clears the legacy cookie on success", async () => {
    const res = await POST(post({ passphrase: " あなたと出会えた日、 それはもう記念日ってことで。" }));
    expect(res.status).toBe(200);
    const setCookies = res.headers.getSetCookie();
    const access = setCookies.find((c) => c.startsWith(`${ACCESS_COOKIE_NAME}=`))!;
    expect(access).toBeDefined();
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=lax/i);
    expect(access).toMatch(/Max-Age=2592000/);
    expect(access.split(";")[0].split("=")[1]).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const legacy = setCookies.find((c) => c.startsWith(`${LEGACY_COOKIE_NAME}=`))!;
    expect(legacy).toMatch(/Max-Age=0/);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(typeof j.expiresAt).toBe("number");
  });

  it("rejects a wrong passphrase with 401 and no cookie; punctuation matters", async () => {
    const res = await POST(post({ passphrase: "あなたと出会えた日 それはもう記念日ってことで" }));
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toHaveLength(0);
    expect(await res.json()).toEqual({ ok: false, reason: "mismatch" });
  });

  it("400 on empty / non-string / oversized bodies", async () => {
    expect((await POST(post({ passphrase: "" }))).status).toBe(400);
    expect((await POST(post({ passphrase: 1 }))).status).toBe(400);
    expect((await POST(post({ passphrase: "x".repeat(600) }))).status).toBe(400);
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ passphrase: "x" }, { "content-type": "text/plain" }))).status).toBe(400);
  });

  it("403 on a cross-site origin", async () => {
    const res = await POST(post({ passphrase: PASS }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("503 when the server passphrase / secret is not configured (no leak of details)", async () => {
    delete process.env.PASSPHRASE_COOKIE_SECRET;
    const res = await POST(post({ passphrase: PASS }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "temporarily-unavailable" });
  });

  it("429 after 10 attempts in the window (attempts counted regardless of outcome), other IPs unaffected", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await POST(post({ passphrase: "wrong" }));
      expect(r.status).toBe(401);
    }
    const blocked = await POST(post({ passphrase: PASS }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
    const other = await POST(post({ passphrase: PASS }, {}, "198.51.100.9"));
    expect(other.status).toBe(200);
  });

  it("legacy cookie alone never yields a new cookie (no auto-upgrade)", async () => {
    const res = await POST(post({ passphrase: "wrong" }, { cookie: `${LEGACY_COOKIE_NAME}=1` }));
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});

describe("DELETE /api/auth (A15)", () => {
  it("clears both cookies only", async () => {
    const req = new NextRequest(`${ORIGIN}/api/auth`, { method: "DELETE", headers: { origin: ORIGIN } });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`${ACCESS_COOKIE_NAME}=;`) && /Max-Age=0/.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`${LEGACY_COOKIE_NAME}=;`) && /Max-Age=0/.test(c))).toBe(true);
    expect(cookies.some((c) => /authjs|next-auth/.test(c))).toBe(false);
  });
});
