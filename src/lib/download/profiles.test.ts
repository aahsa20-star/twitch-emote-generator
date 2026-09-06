import { describe, expect, it } from "vitest";
import { BADGE_PROFILE, EXPORT_PROFILES, PLATFORMS, validateDownloadRequest } from "./profiles";

describe("download profiles (A13)", () => {
  it("accepts every platform × size × format the pipeline produces", () => {
    for (const platform of PLATFORMS) {
      const { sizes, formats } = EXPORT_PROFILES[platform];
      for (const format of formats) {
        const v = validateDownloadRequest({ platform, assetType: "emote", files: sizes.map((size) => ({ size, format })) });
        expect(v.ok, `${platform}/${format}`).toBe(true);
      }
    }
  });

  it("accepts Twitch badges as PNG only", () => {
    expect(validateDownloadRequest({ platform: "twitch", assetType: "badge", files: BADGE_PROFILE.sizes.map((size) => ({ size, format: "png" })) }).ok).toBe(true);
    const gif = validateDownloadRequest({ platform: "twitch", assetType: "badge", files: [{ size: 72, format: "gif" }] });
    expect(gif.ok).toBe(false);
    if (!gif.ok) expect(gif.reason).toBe("invalid-output");
    const discordBadge = validateDownloadRequest({ platform: "discord", assetType: "badge", files: [{ size: 72, format: "png" }] });
    expect(discordBadge.ok).toBe(false);
  });

  it("rejects sizes outside the profile with invalid-output (not a follow prompt)", () => {
    const v = validateDownloadRequest({ platform: "twitch", assetType: "emote", files: [{ size: 128, format: "png" }] });
    expect(v).toMatchObject({ ok: false, reason: "invalid-output" });
    const v2 = validateDownloadRequest({ platform: "discord", assetType: "emote", files: [{ size: 112, format: "png" }] });
    expect(v2).toMatchObject({ ok: false, reason: "invalid-output" });
  });

  it("rejects malformed bodies with invalid-body", () => {
    expect(validateDownloadRequest(null)).toMatchObject({ ok: false, reason: "invalid-body" });
    expect(validateDownloadRequest({ platform: "youtube", files: [{ size: 28, format: "png" }] })).toMatchObject({ ok: false, reason: "invalid-body" });
    expect(validateDownloadRequest({ platform: "twitch", files: [] })).toMatchObject({ ok: false, reason: "invalid-body" });
    expect(validateDownloadRequest({ platform: "twitch", files: Array(17).fill({ size: 28, format: "png" }) })).toMatchObject({ ok: false, reason: "invalid-body" });
    expect(validateDownloadRequest({ platform: "twitch", files: [{ size: 28.5, format: "png" }] })).toMatchObject({ ok: false, reason: "invalid-body" });
    expect(validateDownloadRequest({ platform: "twitch", files: [{ size: "28", format: "png" }] })).toMatchObject({ ok: false, reason: "invalid-body" });
    expect(validateDownloadRequest({ platform: "twitch", files: [{ size: 28, format: "webp" }] })).toMatchObject({ ok: false, reason: "invalid-body" });
  });

  it("legacy {size, format} body maps 28/56/112 → twitch and 32/64/96/128 → 7tv", () => {
    const t = validateDownloadRequest({ size: 112, format: "gif" });
    expect(t).toMatchObject({ ok: true, legacy: true, request: { platform: "twitch" } });
    const s = validateDownloadRequest({ size: 128, format: "png" });
    expect(s).toMatchObject({ ok: true, legacy: true, request: { platform: "7tv" } });
    expect(validateDownloadRequest({ size: 100, format: "png" }).ok).toBe(false);
  });
});
