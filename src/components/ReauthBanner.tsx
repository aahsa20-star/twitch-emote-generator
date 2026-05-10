"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

/**
 * 旧 scope ログイン者向け再ログイン誘導バナー。
 *
 * 表示条件: 親が evaluateAccess() で `needsReauth=true` を検出して open=true
 * を渡したときに表示。
 *
 * 動線:
 *  - 初回 (× で閉じる前): 上部に目立つバナーで誘目
 *  - × で閉じた後 (localStorage 記憶): ヘッダー右の控えめな警告アイコンに切替
 *  - 控えめアイコンクリックで再度バナー表示
 *
 * 設計: FOLLOWER_AUTH_DESIGN.md §7.3 / §5.5
 *
 * Phase 1 default 文言: 案 I-1 (特典の有効化を主目的)
 *   "Twitch ログインを更新すると、フォロー特典が有効になります"
 *
 * @prop variant  "default" / "subscriber"
 *   - default: 通常（フォロー特典の有効化）
 *   - subscriber: 既に PASSPHRASE で premium 化済みのユーザー向け控えめ文言
 */

export type ReauthBannerVariant = "default" | "subscriber";

interface ReauthBannerProps {
  variant?: ReauthBannerVariant;
}

const DISMISS_KEY = "reauthBannerDismissed";

export default function ReauthBanner({
  variant = "default",
}: ReauthBannerProps) {
  // SSR-safe: open is null until client mount, then resolves to localStorage state
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY) === "true";
      setOpen(!dismissed);
    } catch {
      setOpen(true);
    }
  }, []);

  const handleSignIn = () => {
    // signIn redirects to Twitch with the up-to-date scope.
    // After redirect-back, JWT callback re-runs and isFollower is computed.
    signIn("twitch");
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const handleReopen = () => {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      // ignore
    }
    setOpen(true);
  };

  if (open === null) return null; // pre-mount, avoid hydration mismatch

  const message =
    variant === "subscriber"
      ? "Twitch ログインを更新すると、フォロー特典も追加で有効化できます（合言葉は引き続きご利用いただけます）"
      : "Twitch ログインを更新すると、フォロー特典が有効になります";

  if (open) {
    // Prominent banner
    return (
      <div className="w-full bg-purple-900/40 border-b border-purple-700/50 text-purple-100">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
          <p className="flex-1 leading-snug">
            <span className="mr-1.5" aria-hidden>🔄</span>
            {message}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSignIn}
              className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors whitespace-nowrap"
            >
              Twitch でログインし直す
            </button>
            <button
              onClick={handleDismiss}
              className="px-2 py-1 text-purple-200 hover:text-white transition-colors text-base leading-none"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Subdued state — small warning icon (e.g., placed in a header right corner)
  return (
    <button
      onClick={handleReopen}
      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
      title={message}
      aria-label="フォロー特典の有効化が必要です"
    >
      <span aria-hidden>⚠️</span>
      <span className="hidden sm:inline">フォロー特典 未有効</span>
    </button>
  );
}
