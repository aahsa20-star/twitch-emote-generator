/**
 * Output profiles shared by UI, the download-check API and ZIP export
 * (仕様書 §9, 実装設計 §8). Pure data + validation; safe on client and server.
 *
 * Sizes are the CURRENT outputs of the pipeline — this file does not change
 * what is generated, it makes every save path and the API agree on it.
 */

import type { ExportMode } from "@/types/emote";

export type Platform = ExportMode; // "twitch" | "discord" | "7tv" | "bttv" | "ffz"
export type AssetType = "emote" | "badge";
export type FileFormat = "png" | "gif";

export const PLATFORMS: readonly Platform[] = ["twitch", "discord", "7tv", "bttv", "ffz"];

export const EXPORT_PROFILES: Record<Platform, { sizes: readonly number[]; formats: readonly FileFormat[] }> = {
  twitch: { sizes: [28, 56, 112], formats: ["png", "gif"] },
  discord: { sizes: [32, 64, 128], formats: ["png", "gif"] },
  "7tv": { sizes: [32, 64, 96, 128], formats: ["png", "gif"] },
  bttv: { sizes: [28, 56, 112], formats: ["png", "gif"] },
  ffz: { sizes: [32, 64, 128], formats: ["png", "gif"] },
};

/** Twitch subscriber badge: PNG only. */
export const BADGE_PROFILE = { platform: "twitch" as Platform, sizes: [18, 36, 72] as readonly number[], formats: ["png"] as readonly FileFormat[] };

export const MAX_FILES_PER_REQUEST = 16;

export interface DownloadFile {
  size: number;
  format: FileFormat;
}

export interface DownloadRequest {
  platform: Platform;
  assetType: AssetType;
  files: DownloadFile[];
}

export type DownloadValidation =
  | { ok: true; request: DownloadRequest; legacy: boolean }
  | { ok: false; reason: "invalid-body" | "invalid-output"; detail: string };

function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}
function isFormat(v: unknown): v is FileFormat {
  return v === "png" || v === "gif";
}
function isSize(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= 4096;
}

/** Validate that every file is producible for the platform / asset type. */
export function validateFilesForProfile(req: DownloadRequest): { ok: true } | { ok: false; detail: string } {
  const profile = req.assetType === "badge" ? BADGE_PROFILE : EXPORT_PROFILES[req.platform];
  if (req.assetType === "badge" && req.platform !== "twitch") {
    return { ok: false, detail: "badge is Twitch-only" };
  }
  for (const f of req.files) {
    if (!profile.sizes.includes(f.size)) return { ok: false, detail: `size ${f.size} not in ${req.platform}/${req.assetType}` };
    if (!profile.formats.includes(f.format)) return { ok: false, detail: `format ${f.format} not allowed for ${req.assetType}` };
  }
  return { ok: true };
}

/**
 * Parse + validate the download-check body.
 *
 * New shape: { platform, assetType, files: [{size, format}] }
 * Legacy shape (1 release, 実装設計 §8): { size, format } — 28/56/112 → twitch,
 * 32/64/96/128 → 7tv (superset of discord/ffz). Removal is tracked in REPORT.md.
 */
export function validateDownloadRequest(body: unknown): DownloadValidation {
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid-body", detail: "body must be an object" };
  const b = body as Record<string, unknown>;

  // Legacy compatibility
  if (!("files" in b) && "size" in b) {
    if (!isSize(b.size) || !isFormat(b.format)) return { ok: false, reason: "invalid-body", detail: "legacy size/format invalid" };
    const size = b.size;
    const platform: Platform = [28, 56, 112].includes(size) ? "twitch" : [32, 64, 96, 128].includes(size) ? "7tv" : "twitch";
    const request: DownloadRequest = { platform, assetType: "emote", files: [{ size, format: b.format }] };
    const v = validateFilesForProfile(request);
    if (!v.ok) return { ok: false, reason: "invalid-output", detail: v.detail };
    return { ok: true, request, legacy: true };
  }

  if (!isPlatform(b.platform)) return { ok: false, reason: "invalid-body", detail: "platform invalid" };
  const assetType = b.assetType ?? "emote";
  if (assetType !== "emote" && assetType !== "badge") return { ok: false, reason: "invalid-body", detail: "assetType invalid" };
  if (!Array.isArray(b.files) || b.files.length < 1 || b.files.length > MAX_FILES_PER_REQUEST) {
    return { ok: false, reason: "invalid-body", detail: `files must have 1..${MAX_FILES_PER_REQUEST} entries` };
  }
  const files: DownloadFile[] = [];
  for (const f of b.files) {
    if (!f || typeof f !== "object") return { ok: false, reason: "invalid-body", detail: "file entry invalid" };
    const { size, format } = f as Record<string, unknown>;
    if (!isSize(size) || !isFormat(format)) return { ok: false, reason: "invalid-body", detail: "file size/format invalid" };
    files.push({ size, format });
  }
  const request: DownloadRequest = { platform: b.platform, assetType, files };
  const v = validateFilesForProfile(request);
  if (!v.ok) return { ok: false, reason: "invalid-output", detail: v.detail };
  return { ok: true, request, legacy: false };
}

/** Machine-readable reasons returned by POST /api/download-check. */
export type DownloadDenyReason =
  | "invalid-body"
  | "invalid-output"
  | "access-required"
  | "site-locked"
  | "rate-limited"
  | "temporarily-unavailable"
  | "origin-mismatch";

/**
 * Client-side gate used by every save entry point (PC / mobile main button,
 * per-size preview card, ZIP, badge, recommended patterns). Resolves `true`
 * when the save may proceed. The implementer (EmoteGenerator) fills the
 * platform from the current export mode when omitted.
 */
export type DownloadGate = (files: DownloadFile[], assetType?: AssetType, platform?: Platform) => Promise<boolean>;
