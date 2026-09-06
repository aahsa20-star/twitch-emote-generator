/**
 * Save-screen plan (09 §4 保存する): destination → format → sizes → files.
 * Sizes come from the existing download profiles (single definition shared
 * with the server guard) — this module never keeps its own size table.
 */
import { BADGE_PROFILE, EXPORT_PROFILES, type AssetType, type DownloadFile, type FileFormat, type Platform } from "@/lib/download/profiles";

export type ExportFormat = FileFormat;

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitch: "Twitch",
  discord: "Discord",
  "7tv": "7TV",
  bttv: "BTTV",
  ffz: "FFZ",
};

/** Minimal view of a generated output the plan needs (no blobs). */
export interface PlanVariant {
  size: number;
  /** Bytes of the animated GIF when one was generated. */
  gifBytes: number | null;
  /** Bytes of the static PNG (from its data URL). */
  pngBytes: number | null;
}

export interface ExportPlanFile extends DownloadFile {
  filename: string;
  /** Real byte size when known, otherwise null (never estimated). */
  bytes: number | null;
  /** The output exists for this size / format. */
  available: boolean;
}

export interface ExportPlan {
  platform: Platform;
  assetType: AssetType;
  format: ExportFormat;
  /** Largest first. */
  files: ExportPlanFile[];
  primary: ExportPlanFile | null;
  /** GIF is offered for this asset (badge → never). */
  gifOffered: boolean;
  /** Every listed file exists (safe to zip / step through). */
  allAvailable: boolean;
  /** Human title such as 「112px GIF」. */
  primaryLabel: string;
}

/** Initial format: animated output → GIF, otherwise PNG. */
export function defaultExportFormat(hasAnimatedOutput: boolean): ExportFormat {
  return hasAnimatedOutput ? "gif" : "png";
}

/** Exact decoded byte length of a base64 data URL (null when not base64). */
export function dataUrlBytes(dataUrl: string): number | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(0, comma).includes(";base64")) return null;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
}

export function buildExportPlan(input: {
  platform: Platform;
  assetType: AssetType;
  format: ExportFormat;
  variants: PlanVariant[];
}): ExportPlan {
  const { assetType } = input;
  // Badges are Twitch-only (BADGE_PROFILE): the plan's platform must be what the
  // API is asked for, whatever destination the emote had (12 §2).
  const platform: Platform = assetType === "badge" ? BADGE_PROFILE.platform : input.platform;
  const profile = assetType === "badge" ? BADGE_PROFILE : EXPORT_PROFILES[platform];
  const gifOffered = profile.formats.includes("gif");
  const format: ExportFormat = gifOffered ? input.format : "png";
  const sizes = [...profile.sizes].sort((a, b) => b - a);

  const files: ExportPlanFile[] = sizes.map((size) => {
    if (assetType === "badge") {
      // Badge PNGs are rendered on demand from the canvas; bytes are not known
      // until then and are never estimated.
      return { size, format: "png", filename: `badge_${size}.png`, bytes: null, available: true };
    }
    const v = input.variants.find((x) => x.size === size);
    const bytes = !v ? null : format === "gif" ? v.gifBytes : v.pngBytes;
    const available = !!v && (format === "png" ? v.pngBytes !== null : v.gifBytes !== null);
    return { size, format, filename: `emote_${size}px.${format}`, bytes, available };
  });

  const primary = files[0] ?? null;
  return {
    platform,
    assetType,
    format,
    files,
    primary,
    gifOffered,
    allAvailable: files.length > 0 && files.every((f) => f.available),
    primaryLabel: primary ? `${primary.size}px ${primary.format.toUpperCase()}` : "",
  };
}
