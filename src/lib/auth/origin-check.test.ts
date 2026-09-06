import { describe, expect, it } from "vitest";
import { checkRequestOrigin, readJsonBody } from "./origin-check";

const url = "https://twitch-emote-generator.vercel.app/api/auth";

describe("checkRequestOrigin", () => {
  it("accepts same-origin Origin header", () => {
    const req = new Request(url, { method: "POST", headers: { origin: "https://twitch-emote-generator.vercel.app" } });
    expect(checkRequestOrigin(req, {} as unknown as NodeJS.ProcessEnv)).toEqual({ ok: true });
  });
  it("rejects a foreign Origin", () => {
    const req = new Request(url, { method: "POST", headers: { origin: "https://evil.example" } });
    expect(checkRequestOrigin(req, {} as unknown as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: "origin-mismatch" });
  });
  it("accepts APP_ORIGIN entries", () => {
    const req = new Request(url, { method: "POST", headers: { origin: "https://emote.example.com" } });
    expect(checkRequestOrigin(req, { APP_ORIGIN: "https://emote.example.com/, https://other.example" } as unknown as NodeJS.ProcessEnv)).toEqual({ ok: true });
  });
  it("without Origin: allows same-origin / none / absent Sec-Fetch-Site, rejects cross-site", () => {
    expect(checkRequestOrigin(new Request(url, { method: "POST" }), {} as unknown as NodeJS.ProcessEnv)).toEqual({ ok: true });
    expect(checkRequestOrigin(new Request(url, { method: "POST", headers: { "sec-fetch-site": "same-origin" } }), {} as unknown as NodeJS.ProcessEnv)).toEqual({ ok: true });
    expect(checkRequestOrigin(new Request(url, { method: "POST", headers: { "sec-fetch-site": "cross-site" } }), {} as unknown as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: "cross-site" });
  });
});

describe("readJsonBody", () => {
  it("parses JSON within the cap and rejects oversized / non-JSON bodies", async () => {
    const ok = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: 1 }) });
    expect(await readJsonBody(ok, 100)).toEqual({ a: 1 });
    const big = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: "x".repeat(200) }) });
    expect(await readJsonBody(big, 100)).toBeUndefined();
    const text = new Request(url, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect(await readJsonBody(text, 100)).toBeUndefined();
    const bad = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect(await readJsonBody(bad, 100)).toBeUndefined();
  });
});
