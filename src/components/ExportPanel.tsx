"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetType } from "@/lib/download/profiles";
import { BADGE_PROFILE, PLATFORMS, type DownloadGate } from "@/lib/download/profiles";
import { ANIMATION_LIST } from "@/lib/animations/catalog";
import { buildExportPlan, dataUrlBytes, defaultExportFormat, formatBytes, PLATFORM_LABELS, type ExportFormat } from "@/lib/ui/export-plan";
import { savePlanKey, type OutputCondition } from "@/lib/ui/save-state";
import { renderBadge } from "@/lib/canvasPipeline";
import type { BadgeSettings, EmoteVariant, ExportMode } from "@/types/emote";
import SaveActions, { type SaveOutcome } from "./DownloadButton";
import { useIsIOS } from "@/lib/ui/platform";
import { fieldLabel, inputCls, secondaryBtn, textBtn } from "@/components/ui/classes";

interface ExportPanelProps {
  variants: EmoteVariant[];
  /** Whether `variants` are the outputs of the current settings (12 §1). */
  condition: OutputCondition;
  /** Generation of the settings currently requested — advances on every change (13 §1). */
  requestedGen: number;
  onRetryRender: () => void;
  exportMode: ExportMode;
  onExportModeChange: (mode: ExportMode) => void;
  selectionLabel: string;
  animationType: string;
  isAnimatedSource: boolean;
  badgeSettings: BadgeSettings;
  bgRemovedCanvas: HTMLCanvasElement | null;
  onBeforeDownload?: DownloadGate;
  onBack: () => void;
}

const TWITCH_GIF_LIMIT = 1024 * 1024;

/**
 * Step 4 「保存する」 (09 §4): destination → format → sizes → primary action.
 * Sizes and formats come from the download profiles (shared with the server
 * guard). Byte sizes are shown only when the output exists. Old outputs may
 * stay visible while new ones are generated, but they are labelled 更新中 and
 * cannot be saved as the current settings' result (12 §1). Badges are always
 * Twitch plans and their preview is the same render as the saved file (12 §2).
 */
export default function ExportPanel(p: ExportPanelProps) {
  const isIOS = useIsIOS();
  const hasAnimatedOutput = p.variants.some((v) => !!v.animatedBlob);
  const [formatChoice, setFormatChoice] = useState<ExportFormat | null>(null);
  const [assetType, setAssetType] = useState<AssetType>("emote");
  const [statusFor, setStatusFor] = useState<{ key: string; text: string } | null>(null);
  const [savedFor, setSavedFor] = useState<{ key: string; outcome: SaveOutcome } | null>(null);

  // GIF can only be chosen while animated output exists; a stale GIF choice
  // (animation switched to 動きなし) falls back to PNG instead of a dead end.
  const format: ExportFormat = formatChoice === "gif" ? (hasAnimatedOutput ? "gif" : "png") : formatChoice ?? defaultExportFormat(hasAnimatedOutput);
  const effectiveAsset: AssetType = assetType === "badge" && p.badgeSettings.enabled ? "badge" : "emote";

  const plan = useMemo(
    () =>
      buildExportPlan({
        platform: p.exportMode,
        assetType: effectiveAsset,
        format,
        variants: p.variants.map((v) => ({ size: v.size, gifBytes: v.animatedBlob?.size ?? null, pngBytes: dataUrlBytes(v.staticDataUrl) })),
      }),
    [p.exportMode, effectiveAsset, format, p.variants],
  );

  const largest = useMemo(() => (p.variants.length ? p.variants.reduce((a, b) => (a.size > b.size ? a : b)) : null), [p.variants]);

  // Badge preview = the same render the save uses (largest badge size).
  const badgePreview = useMemo(() => {
    if (plan.assetType !== "badge" || !p.bgRemovedCanvas) return null;
    const size = Math.max(...BADGE_PROFILE.sizes);
    const c = renderBadge(p.bgRemovedCanvas, p.badgeSettings, size as 72);
    return c.toDataURL("image/png");
  }, [plan.assetType, p.bgRemovedCanvas, p.badgeSettings]);

  const preview = useMemo(() => {
    if (plan.assetType === "badge") return badgePreview ? { url: badgePreview, revoke: false } : null;
    if (!largest) return null;
    if (plan.format === "gif" && largest.animatedBlob) return { url: URL.createObjectURL(largest.animatedBlob), revoke: true };
    return { url: largest.staticDataUrl, revoke: false };
  }, [plan.assetType, plan.format, badgePreview, largest]);
  useEffect(() => () => {
    if (preview?.revoke) URL.revokeObjectURL(preview.url);
  }, [preview]);
  const previewUrl = preview?.url ?? null;

  // Result card and status line belong to the plan + generation that is current
  // when they are set (a ref, so an abort message produced *after* a change is
  // stored under the new key and stays visible, while a stale 「準備できました」
  // from before the change is hidden) — 12 §1.
  // Keyed by the *requested* generation: a text / animation / badge change with
  // the same destination and format drops prepared state and result cards at
  // once, before the new outputs exist.
  const planKey = savePlanKey(plan, p.requestedGen, plan.files);
  const planKeyRef = useRef(planKey);
  useEffect(() => {
    planKeyRef.current = planKey;
  }, [planKey]);
  const saved = savedFor && savedFor.key === planKey ? savedFor.outcome : null;
  const status = statusFor && statusFor.key === planKey ? statusFor.text : null;
  const setSaved = (o: SaveOutcome | null) => setSavedFor(o === null ? null : { key: planKeyRef.current, outcome: o });
  const setStatus = (text: string | null) => setStatusFor(text === null ? null : { key: planKeyRef.current, text });

  const gifTooBig = plan.assetType === "emote" && plan.format === "gif" && plan.platform === "twitch" && plan.files.some((f) => f.bytes !== null && f.bytes > TWITCH_GIF_LIMIT);
  const title = plan.assetType === "badge" ? "サブスクバッジ" : p.selectionLabel;
  const animEntry = ANIMATION_LIST.find((a) => a.id === p.animationType);
  const shareImage = plan.assetType === "badge" ? badgePreview : largest?.staticDataUrl ?? null;

  return (
    <section aria-labelledby="export-title">
      <div className="flex items-start justify-between gap-3 mb-4 md:mb-6">
        <div>
          <p className="text-[10px] tracking-[.15em] font-semibold text-studio-accent mb-1">04 / READY TO REACT</p>
          <h1 id="export-title" className="text-[23px] md:text-[27px] font-bold leading-tight">あとは、保存するだけ。</h1>
          <p className="text-[12px] md:text-[13px] text-studio-muted mt-2">使う場所に合わせて、サイズを選びます。</p>
        </div>
        <button type="button" onClick={p.onBack} className={`${secondaryBtn} min-h-[36px] md:min-h-[46px] text-[10px] md:text-[13px] px-3 whitespace-nowrap`}>← 編集に戻る</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-7 max-w-[1030px] mx-auto">
        {/* preview + summary */}
        <div className="bg-studio-surface border border-studio-stroke rounded-studio overflow-hidden self-start flex md:block items-center">
          <div className="w-[42%] md:w-auto aspect-square checkerboard grid place-items-center p-[6%] md:p-[18%] shrink-0">
            {previewUrl ? (
              <img src={previewUrl} alt={`${title} の保存プレビュー`} className="w-full h-full object-contain" style={{ imageRendering: "auto" }} draggable={false} />
            ) : (
              <span className="text-[12px] text-studio-muted">出力を準備中…</span>
            )}
          </div>
          <div className="p-4 md:p-6">
            <span
              className={`flex items-center gap-1.5 text-[10px] ${p.condition === "current" ? "text-studio-good" : p.condition === "failed" ? "text-studio-danger" : "text-studio-warn"}`}
              role="status"
              aria-live="polite"
            >
              <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${p.condition === "current" ? "bg-studio-good" : p.condition === "failed" ? "bg-studio-danger" : "bg-studio-warn animate-pulse"}`} />
              {p.condition === "current" ? "設定を確認" : p.condition === "failed" ? "出力の更新に失敗しました" : "出力を更新中"}
            </span>
            {p.condition === "failed" && (
              <button type="button" onClick={p.onRetryRender} className={textBtn}>もう一度生成する</button>
            )}
            <h2 className="text-[15px] md:text-[17px] font-bold my-2">{title}</h2>
            <p className="text-[10px] md:text-[12px] text-studio-muted">
              {plan.assetType === "badge" ? "エモートの設定はそのまま残ります。" : "編集に戻っても、設定はそのまま。"}
              {animEntry && plan.assetType === "emote" && ` 動き: ${animEntry.label}`}
            </p>
            {plan.assetType === "badge" && <p className="text-[10px] text-studio-muted mt-1">見本は保存されるファイルと同じ描画（{Math.max(...BADGE_PROFILE.sizes)}px）です。</p>}
          </div>
        </div>

        {/* controls */}
        <div className="bg-studio-surface border border-studio-stroke rounded-studio p-5 md:p-6">
          {p.badgeSettings.enabled && (
            <>
              <span className={fieldLabel} id="asset-label">何を保存しますか？</span>
              <div className="flex gap-2.5 mb-5" role="group" aria-labelledby="asset-label">
                {([
                  { id: "emote", label: "エモート" },
                  { id: "badge", label: "サブスクバッジ" },
                ] as { id: AssetType; label: string }[]).map((a) => (
                  <button key={a.id} type="button" aria-pressed={effectiveAsset === a.id} onClick={() => setAssetType(a.id)} className={`flex-1 min-h-[44px] rounded-[10px] border text-[12px] ${effectiveAsset === a.id ? "border-studio-accent bg-[#342940]" : "border-[#504557]"}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className={fieldLabel} htmlFor="export-destination">どこで使いますか？</label>
          <select
            id="export-destination"
            value={plan.platform}
            onChange={(e) => p.onExportModeChange(e.target.value as ExportMode)}
            disabled={plan.assetType === "badge"}
            className={`${inputCls} min-h-[48px] text-[14px]`}
          >
            {PLATFORMS.map((m) => (
              <option key={m} value={m}>{PLATFORM_LABELS[m]}</option>
            ))}
          </select>
          {plan.assetType === "badge" && (
            <p className="text-[11px] text-studio-muted mt-1">
              バッジは Twitch 用（{[...BADGE_PROFILE.sizes].sort((a, b) => b - a).join(" / ")}px、PNG）です。エモートの保存先（{PLATFORM_LABELS[p.exportMode]}）は「エモート」に戻すと復元されます。
            </p>
          )}

          <span className={`${fieldLabel} mt-6`} id="format-label">保存する形式</span>
          <div className="flex gap-2.5" role="group" aria-labelledby="format-label">
            {(["gif", "png"] as ExportFormat[]).map((f) => {
              const disabled = f === "gif" ? !plan.gifOffered || !hasAnimatedOutput : false;
              const on = plan.format === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => setFormatChoice(f)}
                  className={`flex-1 flex items-center gap-2 min-h-[52px] px-3.5 rounded-[10px] border text-left ${on ? "border-studio-accent bg-[#342940]" : "border-[#504557]"} disabled:opacity-45`}
                >
                  <b className="text-[13px]">{f.toUpperCase()}</b>
                  <span className="text-[11px] text-studio-muted">{f === "gif" ? "動き付き" : p.isAnimatedSource || hasAnimatedOutput ? "静止画（最初のコマ）" : "静止画"}</span>
                </button>
              );
            })}
          </div>
          {!hasAnimatedOutput && plan.assetType === "emote" && (
            <p className="text-[11px] text-studio-muted mt-1.5">
              動きなしのため、GIF は選べません{formatChoice === "gif" ? "（PNG に切り替えました）" : ""}。「編集する」で動きを選ぶと GIF になります。
            </p>
          )}
          {plan.assetType === "badge" && <p className="text-[11px] text-studio-muted mt-1.5">バッジは PNG のみです。</p>}
          {gifTooBig && (
            <p className="text-[11px] text-studio-warn mt-1.5">Twitch の上限（1MB）を超えるサイズがあります。フチを細くする・文字を短くするなどで軽くしてください。</p>
          )}

          <div className="mt-5">
            <SaveActions
              plan={plan}
              planKey={planKey}
              condition={p.condition}
              variants={p.variants}
              badgeSettings={p.badgeSettings}
              bgRemovedCanvas={p.bgRemovedCanvas}
              onBeforeDownload={p.onBeforeDownload}
              onStatus={setStatus}
              onSaved={(o) => {
                setSaved(o);
                setStatus(null);
              }}
            />
          </div>
          {status && (
            <p className="mt-3 text-[12px] leading-relaxed text-studio-text bg-[#2a2833] border border-[#45404f] rounded-[10px] px-3 py-2.5" role="status" aria-live="polite">
              {status}
            </p>
          )}
          {saved && (
            <div className="mt-3 rounded-[10px] border border-[#2f6b47] bg-[#1f3328] px-3.5 py-3" role="status" aria-live="polite">
              <p className="text-[12px] text-studio-good leading-relaxed">{saved.text}</p>
              {!isIOS && <p className="text-[10px] text-studio-muted mt-1">ブラウザのダウンロード欄で保存先を確認できます。</p>}
              <ShareRow imageDataUrl={shareImage} />
            </div>
          )}

          <details className="mt-5 pt-4 border-t border-[#3b3543] text-[12px]">
            <summary className="cursor-pointer min-h-[34px] text-[#ddd5e8]">iPhone での保存方法</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-studio-muted">
              <li>保存ボタンでファイルを準備します（保存の権限を確認します）。</li>
              <li>ボタンが「開く」に変わったら、もう一度タップ。</li>
              <li>新しいタブで開いた画像を長押しして「写真に追加」。</li>
            </ol>
            <p className="text-[11px] text-studio-muted mt-2">全サイズは 1 枚ずつ順番に開きます。設定を変えると準備はやり直しになります。保存先やメニューの表記は端末によって異なります。</p>
          </details>
          {plan.files.length > 0 && plan.files.every((f) => f.bytes !== null) && (
            <p className="text-[10px] text-studio-muted mt-3">合計 {formatBytes(plan.files.reduce((n, f) => n + (f.bytes ?? 0), 0))}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Optional share actions after a save (09 §4: no automatic modal). */
function ShareRow({ imageDataUrl }: { imageDataUrl: string | null }) {
  const isIOS = useIsIOS();
  const [note, setNote] = useState<string | null>(null);
  const share = () => {
    const text = encodeURIComponent("Twitchエモートが30秒で作れた！ブラウザだけで完結、背景透過も自動 ✨ @akiissamurai #TwitchEmote #配信者グッズ");
    const url = encodeURIComponent("https://twitch-emote-generator.vercel.app/");
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer,width=550,height=420");
    if (isIOS) {
      setNote("スクリーンショットを撮ってポストに添付してください");
      return;
    }
    if (imageDataUrl && navigator.clipboard?.write) {
      (async () => {
        try {
          const blob = await (await fetch(imageDataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([blob], { type: "image/png" }) })]);
          setNote("画像をクリップボードにコピーしました。ポストに貼り付けてください");
        } catch {
          /* clipboard denied: nothing to do */
        }
      })();
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className={`${secondaryBtn} min-h-[38px] text-[12px]`}>
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        X でシェア（任意）
      </button>
      <a href="https://www.twitch.tv/datsusara_aki" target="_blank" rel="noopener noreferrer" className="text-[11px] text-studio-accent hover:underline min-h-[38px] inline-flex items-center">
        作者の Twitch →
      </a>
      {note && <span className="text-[11px] text-studio-muted w-full">{note}</span>}
    </div>
  );
}
