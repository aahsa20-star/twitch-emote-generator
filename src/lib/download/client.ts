/**
 * Browser-side helper for POST /api/download-check (R1c).
 * Maps HTTP outcomes to a discriminated result with user-facing copy.
 * The emote bytes never leave the browser; only sizes/formats are sent.
 */
import type { DownloadDenyReason, DownloadRequest } from "./profiles";

export type DownloadPermission =
  | { allowed: true }
  | {
      allowed: false;
      reason: DownloadDenyReason | "network" | "unknown";
      status?: number;
      retryAfter?: number;
      message: string;
    };

export type DownloadDenial = DownloadDenyReason | "network" | "unknown";

export function describeDenial(reason: DownloadDenial, retryAfter?: number): string {
  switch (reason) {
    case "access-required":
    case "site-locked":
      return "保存にはフォローまたは合言葉での解放が必要です";
    case "invalid-output":
    case "invalid-body":
      return "この出力サイズは保存できません（アプリ側の不整合です。フィードバックからお知らせください）";
    case "rate-limited":
      return retryAfter
        ? `操作が多すぎます。約${Math.ceil(retryAfter / 60)}分後にもう一度お試しください`
        : "操作が多すぎます。少し待ってからもう一度お試しください";
    case "origin-mismatch":
      return "このページからは保存できません。ページを再読み込みしてください";
    case "temporarily-unavailable":
      return "保存の確認が一時的にできません。少し待ってからもう一度お試しください";
    case "network":
      return "通信に失敗しました。接続を確認して、もう一度お試しください";
    default:
      return "保存の確認に失敗しました。もう一度お試しください";
  }
}

export async function requestDownloadPermission(req: DownloadRequest): Promise<DownloadPermission> {
  let res: Response;
  try {
    res = await fetch("/api/download-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(req),
    });
  } catch {
    return { allowed: false, reason: "network", message: describeDenial("network") };
  }
  if (res.ok) return { allowed: true };
  const data = (await res.json().catch(() => ({}))) as { reason?: string; retryAfter?: number };
  const known: ReadonlyArray<string> = [
    "invalid-body", "invalid-output", "access-required", "site-locked", "rate-limited", "temporarily-unavailable", "origin-mismatch",
  ];
  let reason: DownloadDenyReason | "unknown" = known.includes(data.reason ?? "") ? (data.reason as DownloadDenyReason) : "unknown";
  if (reason === "unknown") {
    if (res.status === 403) reason = "access-required";
    else if (res.status === 429) reason = "rate-limited";
    else if (res.status >= 500) reason = "temporarily-unavailable";
    else if (res.status === 400) reason = "invalid-body";
  }
  return { allowed: false, reason, status: res.status, retryAfter: data.retryAfter, message: describeDenial(reason, data.retryAfter) };
}

/** Trigger a browser download for an already-generated URL (no network). */
export function triggerAnchorDownload(url: string, filename: string, revoke = false) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    if (revoke) URL.revokeObjectURL(url);
  }, 1000);
}
