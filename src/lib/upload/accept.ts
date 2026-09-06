/**
 * Accepted input types and size limits — the single definition the upload UI
 * renders its hints from (09 §1: 制限は定義から表示する). Pure, no DOM.
 */

export type UploadKind = "image" | "gif" | "video";

export const STATIC_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const GIF_TYPES = ["image/gif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
/** Formats the browser cannot draw on a canvas: ask for a conversion instead. */
export const CONVERT_FIRST_TYPES = ["image/heic", "image/heif"] as const;

export const UPLOAD_LIMITS: Record<UploadKind, number> = {
  image: 10 * 1024 * 1024,
  gif: 30 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

export const UPLOAD_LABELS: Record<UploadKind, { formats: string; limit: string }> = {
  image: { formats: "PNG / JPG / WEBP", limit: formatMb(UPLOAD_LIMITS.image) },
  gif: { formats: "GIF", limit: formatMb(UPLOAD_LIMITS.gif) },
  video: { formats: "MP4 / MOV / WEBM", limit: formatMb(UPLOAD_LIMITS.video) },
};

/** `accept` attribute for the file input (explicit list, not `image/*`). */
export const UPLOAD_ACCEPT_ATTR = [...STATIC_IMAGE_TYPES, ...GIF_TYPES, ...VIDEO_TYPES].join(",");

export function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

export type UploadCheck =
  | { ok: true; kind: UploadKind }
  | { ok: false; code: "convert-first" | "unsupported" | "too-large"; message: string };

function extensionOf(name: string | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Classify a picked file. Never throws; the message is user-facing. */
export function checkUpload(file: { type: string; size: number; name?: string }): UploadCheck {
  const type = file.type || "";
  const ext = extensionOf(file.name);
  if ((CONVERT_FIRST_TYPES as readonly string[]).includes(type) || ext === "heic" || ext === "heif") {
    return {
      ok: false,
      code: "convert-first",
      message: "HEIC / HEIF はそのままでは使えません。JPG か PNG に変換してから、もう一度選んでください。",
    };
  }
  let kind: UploadKind | null = null;
  if ((STATIC_IMAGE_TYPES as readonly string[]).includes(type)) kind = "image";
  else if ((GIF_TYPES as readonly string[]).includes(type)) kind = "gif";
  else if ((VIDEO_TYPES as readonly string[]).includes(type)) kind = "video";
  if (!kind) {
    return {
      ok: false,
      code: "unsupported",
      message: `対応形式は 画像（${UPLOAD_LABELS.image.formats}）、GIF、動画（${UPLOAD_LABELS.video.formats}）です。別のファイルを選んでください。`,
    };
  }
  if (file.size > UPLOAD_LIMITS[kind]) {
    const what = kind === "image" ? "画像" : kind === "gif" ? "GIF" : "動画";
    return { ok: false, code: "too-large", message: `${what}は ${UPLOAD_LABELS[kind].limit} 以下のファイルを選んでください。` };
  }
  return { ok: true, kind };
}
