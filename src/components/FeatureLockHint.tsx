"use client";

import { useEffect, useState } from "react";

/**
 * 軽い解説モーダル — 鍵マーククリック時 (trial ユーザー) に表示。
 *
 * 制御:
 *  - 同一セッション内 (localStorage) で表示回数 N=5 を超えたら以降は表示しない
 *    (代わりに親が tooltip 等にフォールバックさせる)
 *  - "今フォローする" → 親側で本格誘導モーダル (FollowGateModal) に遷移
 *  - "後で" → 閉じる
 *
 * 設計: FOLLOWER_AUTH_DESIGN.md §7.2
 *
 * @prop open / onClose         モーダル制御
 * @prop featureLabel           ロックされた機能の表示名（例「ネオン」）
 * @prop onPromoteToFullModal   "今フォローする" 押下時のコールバック
 *                              (親で FollowGateModal を起動)
 */
interface FeatureLockHintProps {
  open: boolean;
  onClose: () => void;
  featureLabel: string;
  onPromoteToFullModal: () => void;
}

const STORAGE_KEY = "featureLockHintCount";
const MAX_SHOWS_PER_SESSION = 5;

/**
 * Helper: should the hint modal be shown again?
 * Returns false once the session counter reaches MAX_SHOWS_PER_SESSION.
 * Caller can use this to fall back to a tooltip after the limit.
 */
export function canShowFeatureLockHint(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const count = parseInt(
      localStorage.getItem(STORAGE_KEY) ?? "0",
      10,
    );
    return Number.isFinite(count) && count < MAX_SHOWS_PER_SESSION;
  } catch {
    return true;
  }
}

function bumpHintCount() {
  if (typeof window === "undefined") return;
  try {
    const cur = parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
    const next = (Number.isFinite(cur) ? cur : 0) + 1;
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore
  }
}

export default function FeatureLockHint({
  open,
  onClose,
  featureLabel,
  onPromoteToFullModal,
}: FeatureLockHintProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open && !mounted) {
      bumpHintCount();
      setMounted(true);
    }
    if (!open) {
      setMounted(false);
    }
  }, [open, mounted]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-lock-hint-title"
    >
      <div
        className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="feature-lock-hint-title"
          className="text-base font-bold text-white flex items-center gap-2"
        >
          <span aria-hidden>🔒</span>
          「{featureLabel}」はフォロー特典です
        </h3>

        <p className="text-sm text-gray-300 leading-relaxed">
          Twitch で{" "}
          <span className="font-semibold text-purple-300">@datsusara_aki</span>{" "}
          をフォローすると使えるようになります。
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            後で
          </button>
          <button
            onClick={() => {
              onClose();
              onPromoteToFullModal();
            }}
            className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
          >
            今フォローする
          </button>
        </div>
      </div>
    </div>
  );
}
