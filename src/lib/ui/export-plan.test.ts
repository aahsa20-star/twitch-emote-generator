import { describe, expect, it } from "vitest";
import { BADGE_PROFILE, EXPORT_PROFILES } from "@/lib/download/profiles";
import { buildExportPlan, dataUrlBytes, defaultExportFormat, formatBytes, type PlanVariant } from "./export-plan";

const twitchVariants: PlanVariant[] = [
  { size: 28, gifBytes: 2000, pngBytes: 300 },
  { size: 56, gifBytes: 5000, pngBytes: 800 },
  { size: 112, gifBytes: 40000, pngBytes: 3000 },
];

describe("export plan", () => {
  it("default format follows the output", () => {
    expect(defaultExportFormat(true)).toBe("gif");
    expect(defaultExportFormat(false)).toBe("png");
  });

  it("lists the profile sizes largest-first with real bytes", () => {
    const plan = buildExportPlan({ platform: "twitch", assetType: "emote", format: "gif", variants: twitchVariants });
    expect(plan.files.map((f) => f.size)).toEqual([...EXPORT_PROFILES.twitch.sizes].sort((a, b) => b - a));
    expect(plan.primary?.filename).toBe("emote_112px.gif");
    expect(plan.primary?.bytes).toBe(40000);
    expect(plan.primaryLabel).toBe("112px GIF");
    expect(plan.allAvailable).toBe(true);
  });

  it("PNG uses the static bytes and never estimates missing ones", () => {
    const plan = buildExportPlan({
      platform: "discord",
      assetType: "emote",
      format: "png",
      variants: [{ size: 128, gifBytes: null, pngBytes: 1200 }],
    });
    expect(plan.files.map((f) => f.size)).toEqual([128, 64, 32]);
    expect(plan.files[0]).toMatchObject({ bytes: 1200, available: true, filename: "emote_128px.png" });
    expect(plan.files[1]).toMatchObject({ bytes: null, available: false });
    expect(plan.allAvailable).toBe(false);
  });

  it("GIF is unavailable when no animated output exists", () => {
    const plan = buildExportPlan({
      platform: "7tv",
      assetType: "emote",
      format: "gif",
      variants: [128, 96, 64, 32].map((size) => ({ size, gifBytes: null, pngBytes: 100 })),
    });
    expect(plan.files.every((f) => !f.available)).toBe(true);
    expect(plan.gifOffered).toBe(true);
  });

  it("badge plans are PNG-only from the badge profile", () => {
    const plan = buildExportPlan({ platform: "twitch", assetType: "badge", format: "gif", variants: twitchVariants });
    expect(plan.format).toBe("png");
    expect(plan.gifOffered).toBe(false);
    expect(plan.files.map((f) => f.size)).toEqual([...BADGE_PROFILE.sizes].sort((a, b) => b - a));
    expect(plan.files[0].filename).toBe("badge_72.png");
    expect(plan.files.every((f) => f.bytes === null && f.available)).toBe(true);
  });

  it("dataUrlBytes decodes exact base64 length", () => {
    // "hi" → aGk= (2 bytes), "hey" → aGV5 (3 bytes)
    expect(dataUrlBytes("data:image/png;base64,aGk=")).toBe(2);
    expect(dataUrlBytes("data:image/png;base64,aGV5")).toBe(3);
    expect(dataUrlBytes("data:text/plain,hello")).toBeNull();
  });

  it("formats bytes for display", () => {
    expect(formatBytes(500)).toBe("1KB");
    expect(formatBytes(49453)).toBe("48KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00MB");
  });
});
