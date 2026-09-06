"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetType, DownloadFile, DownloadGate, Platform } from "@/lib/download/profiles";
import { triggerAnchorDownload } from "@/lib/download/client";
import { BADGE_SIZES, type BadgeSettings, type BadgeSize, type EmoteVariant } from "@/types/emote";
import { renderBadge } from "@/lib/canvasPipeline";
import type { ExportPlan, ExportPlanFile } from "@/lib/ui/export-plan";
import { canSaveAll, canSaveFile, type OutputCondition } from "@/lib/ui/save-state";
import { useIsIOS } from "@/lib/ui/platform";
import { primaryBtn, secondaryBtn } from "@/components/ui/classes";

export type SaveOutcome = { kind: "started" | "opened" | "opened-all" | "started-all"; text: string };

interface SaveActionsProps {
  plan: ExportPlan;
  /** Identity of plan + output generation (12 §1): every prepared / pending
   *  state is bound to it and dropped when it changes. */
  planKey: string;
  condition: OutputCondition;
  variants: EmoteVariant[];
  badgeSettings?: BadgeSettings;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  onBeforeDownload?: DownloadGate;
  /** Short status for the panel: 認証の確認 / ファイルの準備 / 開始. */
  onStatus: (text: string | null) => void;
  /** A browser download or a new tab was actually started. */
  onSaved: (outcome: SaveOutcome) => void;
}

/**
 * Save actions of the save screen (09 §4, R1c gate kept): one primary button
 * for the largest size, a secondary for every size (ZIP on PC, one-by-one on
 * iOS), plus a small per-size save in the file list. Every path goes through
 * /api/download-check first, and every async step re-checks that the outputs
 * it was started for are still the current ones (12 §1). iOS keeps the two
 * taps: 「準備する」 (permission) → 「開く」 (synchronous window.open).
 */
export default function SaveActions({ plan, planKey, condition, variants, badgeSettings, bgRemovedCanvas, onBeforeDownload, onStatus, onSaved }: SaveActionsProps) {
  const isIOS = useIsIOS();
  const latestKey = useRef(planKey);
  useEffect(() => {
    latestKey.current = planKey;
  }, [planKey]);

  type Armed = { key: string; action: "primary" | "all" | `file:${number}`; step: number };
  const [armed, setArmed] = useState<Armed | null>(null);
  const iosArmed = armed && armed.key === planKey ? armed : null; // a changed plan / generation disarms
  const [busy, setBusy] = useState(false);

  const filesOf = (list: ExportPlanFile[]): DownloadFile[] => list.map((f) => ({ size: f.size, format: f.format }));
  const stillCurrent = (snapshot: string) => latestKey.current === snapshot;
  const abortChanged = () => onStatus("設定または出力が変わったため中止しました。もう一度押してください");

  /** Permission gate + generation guard (outputs changed while the server answered → abort). */
  const gate = useCallback(
    async (files: DownloadFile[], assetType: AssetType, platform: Platform, snapshot: string): Promise<boolean> => {
      onStatus("保存の権限を確認しています…");
      setBusy(true);
      try {
        if (onBeforeDownload && !(await onBeforeDownload(files, assetType, platform))) {
          onStatus(null);
          return false;
        }
        if (!stillCurrent(snapshot)) {
          abortChanged();
          return false;
        }
        return true;
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onBeforeDownload, onStatus],
  );

  /** URL for one planned file (blob for GIF, data URL for PNG / badge). */
  const urlFor = useCallback(
    (f: ExportPlanFile): { url: string; revoke: boolean } | null => {
      if (plan.assetType === "badge") {
        if (!bgRemovedCanvas || !badgeSettings || !(BADGE_SIZES as readonly number[]).includes(f.size)) return null;
        const c = renderBadge(bgRemovedCanvas, badgeSettings, f.size as BadgeSize);
        return { url: c.toDataURL("image/png"), revoke: false };
      }
      const v = variants.find((x) => x.size === f.size);
      if (!v) return null;
      if (f.format === "gif") return v.animatedBlob ? { url: URL.createObjectURL(v.animatedBlob), revoke: true } : null;
      return { url: v.staticDataUrl, revoke: false };
    },
    [plan.assetType, variants, bgRemovedCanvas, badgeSettings],
  );

  const openOnIos = useCallback(
    (url: string, revoke: boolean): boolean => {
      const w = window.open(url, "_blank"); // synchronous: still inside the tap
      if (!w) {
        onStatus("新しいタブを開けませんでした。Safari のポップアップ設定を変えるか、ファイルごとの「保存」で 1 つずつ開いてください");
        if (revoke) URL.revokeObjectURL(url);
        return false;
      }
      if (revoke) setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    },
    [onStatus],
  );

  const saveOne = useCallback(
    async (f: ExportPlanFile, action: Armed["action"]) => {
      if (!canSaveFile(f, condition)) return;
      const snapshot = planKey;
      onStatus(null);
      if (isIOS) {
        if (!iosArmed || iosArmed.action !== action) {
          if (!(await gate([{ size: f.size, format: f.format }], plan.assetType, plan.platform, snapshot))) return;
          setArmed({ key: snapshot, action, step: 0 });
          onStatus(`準備できました。もう一度押すと ${f.size}px を開きます`);
          return;
        }
        const u = urlFor(f);
        if (!u) return;
        if (!openOnIos(u.url, u.revoke)) return;
        setArmed(null);
        onSaved({ kind: "opened", text: `${f.size}px を新しいタブで開きました。画像を長押し →「写真に追加」で保存できます` });
        return;
      }
      if (!(await gate([{ size: f.size, format: f.format }], plan.assetType, plan.platform, snapshot))) return;
      const u = urlFor(f);
      if (!u) return;
      onStatus("ファイルを準備しています…");
      triggerAnchorDownload(u.url, f.filename, u.revoke);
      onSaved({ kind: "started", text: `${f.filename} のダウンロードを開始しました` });
    },
    [condition, gate, iosArmed, isIOS, onSaved, onStatus, openOnIos, plan.assetType, plan.platform, planKey, urlFor],
  );

  const saveAll = useCallback(async () => {
    if (!canSaveAll(plan, condition)) return;
    const files = plan.files;
    const snapshot = planKey;
    onStatus(null);
    if (isIOS) {
      if (!iosArmed || iosArmed.action !== "all") {
        if (!(await gate(filesOf(files), plan.assetType, plan.platform, snapshot))) return;
        setArmed({ key: snapshot, action: "all", step: 0 });
        onStatus(`準備できました。もう一度押すと最初のサイズ（${files[0].size}px）を開きます`);
        return;
      }
      const f = files[iosArmed.step];
      if (!f) return;
      const u = urlFor(f);
      if (!u) return;
      if (!openOnIos(u.url, u.revoke)) return;
      if (iosArmed.step < files.length - 1) {
        setArmed({ ...iosArmed, step: iosArmed.step + 1 });
        onStatus(`${f.size}px を開きました。長押しで保存後、戻ってもう一度押すと次（${files[iosArmed.step + 1].size}px）を開きます`);
      } else {
        setArmed(null);
        onSaved({ kind: "opened-all", text: "すべてのサイズを開きました。それぞれ長押し →「写真に追加」で保存できます" });
      }
      return;
    }
    if (!(await gate(filesOf(files), plan.assetType, plan.platform, snapshot))) return;
    onStatus("ZIP を作っています…");
    setBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const f of files) {
        const u = urlFor(f);
        if (!u) continue;
        if (u.url.startsWith("data:")) zip.file(f.filename, u.url.split(",")[1], { base64: true });
        else {
          const v = variants.find((x) => x.size === f.size);
          if (v?.animatedBlob) zip.file(f.filename, v.animatedBlob);
          if (u.revoke) URL.revokeObjectURL(u.url);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      if (!stillCurrent(snapshot)) {
        abortChanged();
        return;
      }
      const zipName = plan.assetType === "badge" ? "badge.zip" : `${plan.platform}_emotes.zip`;
      triggerAnchorDownload(URL.createObjectURL(blob), zipName, true);
      onSaved({ kind: "started-all", text: `${zipName} のダウンロードを開始しました` });
    } catch (e) {
      console.error("zip failed:", e);
      onStatus("まとめて保存できませんでした。ファイルごとの「保存」をお試しください");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition, gate, iosArmed, isIOS, onSaved, onStatus, openOnIos, plan, planKey, urlFor, variants]);

  const primary = plan.primary;
  const primaryAvailable = !!primary && canSaveFile(primary, condition);
  const allAvailable = canSaveAll(plan, condition);
  const primaryLabel =
    condition === "failed"
      ? "出力の更新に失敗しました"
      : condition !== "current"
        ? "出力を更新中…"
        : isIOS
          ? iosArmed?.action === "primary"
            ? `${primary?.size}px を開く`
            : `${plan.primaryLabel} を準備する`
          : `${plan.primaryLabel} を保存`;
  const allLabel = isIOS
    ? iosArmed?.action === "all"
      ? `${plan.files[iosArmed.step]?.size ?? ""}px を開く（${iosArmed.step + 1} / ${plan.files.length}）`
      : "各サイズを順番に保存（準備する）"
    : plan.assetType === "badge"
      ? "全サイズをZIPで保存（バッジ）"
      : "全サイズをZIPで保存";

  return (
    <div className="space-y-2.5">
      <button type="button" onClick={() => primary && saveOne(primary, "primary")} disabled={!primaryAvailable || busy} className={`${primaryBtn} w-full`}>
        {primaryLabel} <span className="ml-auto" aria-hidden>↓</span>
      </button>
      <button type="button" onClick={saveAll} disabled={!allAvailable || busy} className={`${secondaryBtn} w-full`}>
        {allLabel}
      </button>
      {condition === "current" && !allAvailable && plan.files.some((f) => f.available) && (
        <p className="text-[11px] text-studio-muted">一部のサイズにこの形式の出力がないため、まとめて保存はできません。あるサイズは下から 1 つずつ保存できます。</p>
      )}
      {isIOS && iosArmed && (
        <button type="button" onClick={() => { setArmed(null); onStatus(null); }} className="w-full min-h-[36px] text-[11px] text-studio-muted hover:text-studio-text">
          準備をやり直す
        </button>
      )}
      <ul className="divide-y divide-[#38313e] border-t border-[#38313e] mt-3" aria-label="ファイル一覧">
        {plan.files.map((f) => (
          <li key={f.size} className="flex items-center justify-between gap-3 py-2.5 text-[12px]">
            <span>
              <b>{f.size} × {f.size}px</b>
              <small className="block text-[10px] text-studio-muted">
                {f.filename}
                {f.bytes !== null ? ` · ${formatBytes(f.bytes)}` : ""}
                {!f.available && condition === "current" ? " · この形式の出力はありません" : ""}
              </small>
            </span>
            <button
              type="button"
              onClick={() => saveOne(f, `file:${f.size}`)}
              disabled={!canSaveFile(f, condition) || busy}
              className="min-h-[36px] px-3 rounded-[7px] text-[11px] border border-[#504557] text-studio-text disabled:opacity-40"
            >
              {isIOS ? (iosArmed?.action === `file:${f.size}` ? "開く" : "準備") : "保存"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
}
