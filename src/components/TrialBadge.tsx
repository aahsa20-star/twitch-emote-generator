"use client";

/**
 * お試し版バッジ — trial ユーザーの画面上部に「お試し版で使用中」を控えめに表示。
 *
 * 設計: FOLLOWER_AUTH_DESIGN.md §7.5
 *
 * variant 候補（§B 数字表記、Aki が後日選定）:
 *  - "badge-only"  (default, 案 D): バッジのみ、数字なし
 *  - "raw"          (案 A): 「使えるアニメ: 2/52」のような直球表示
 *  - "positive"     (案 B): 「フォロー特典: あと 50 種のアニメ」ポジ提示
 *  - "neutral"      (案 C): 「基本 2 種利用中・全 52 種はフォロー特典」中立
 *
 * Phase 1 default は案 D (badge-only)。後日切替する際は app 側で variant prop
 * を渡すだけ。
 */

export type TrialBadgeVariant = "badge-only" | "raw" | "positive" | "neutral";

interface TrialBadgeProps {
  variant?: TrialBadgeVariant;
  /** 数値表示用 (案 A/B/C のとき使用)。Phase 1 default は固定で 2/52 想定 */
  trialAnimCount?: number;
  totalAnimCount?: number;
  className?: string;
}

export default function TrialBadge({
  variant = "badge-only",
  trialAnimCount = 2,
  totalAnimCount = 52,
  className = "",
}: TrialBadgeProps) {
  const baseStyle =
    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800/70 border border-gray-700 text-gray-400";

  let label: React.ReactNode;
  switch (variant) {
    case "raw":
      label = (
        <>
          お試し版（使えるアニメ: {trialAnimCount}/{totalAnimCount}）
        </>
      );
      break;
    case "positive":
      label = (
        <>
          フォロー特典: あと {totalAnimCount - trialAnimCount} 種のアニメ
        </>
      );
      break;
    case "neutral":
      label = (
        <>
          基本 {trialAnimCount} 種利用中・全 {totalAnimCount} 種はフォロー特典
        </>
      );
      break;
    case "badge-only":
    default:
      label = "お試し版で使用中";
      break;
  }

  return (
    <span className={`${baseStyle} ${className}`} aria-label="お試し版で使用中">
      <span aria-hidden className="text-purple-400">●</span>
      {label}
    </span>
  );
}
