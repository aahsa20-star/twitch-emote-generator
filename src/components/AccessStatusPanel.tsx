"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useAccess } from "@/components/providers/AccessProvider";

/**
 * 解放状態の表示・終了 (仕様書 §8). Lives in the editor sidebar.
 *
 * - shows every active grant ("フォローで解放中" / "合言葉で解放中（期限）")
 * - "この端末の合言葉認証を解除" and "Twitchからログアウト" are separate actions;
 *   neither touches the other credential
 * - warns before an action that would remove the last grant
 */
export default function AccessStatusPanel({ onOpenGate }: { onOpenGate: () => void }) {
  const { access, busy, clearPassphrase, refresh } = useAccess();
  const [confirm, setConfirm] = useState<"passphrase" | "twitch" | null>(null);

  const hasFollower = access.grants.includes("follower");
  const hasPassphrase = access.grants.includes("passphrase");
  const hasEmergency = access.grants.includes("emergency");
  const loggedIn = access.identityStatus === "authenticated" || access.identityStatus === "reauth-required";

  const fmt = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "";

  const doClearPassphrase = async () => {
    setConfirm(null);
    await clearPassphrase();
  };

  const doTwitchLogout = async () => {
    setConfirm(null);
    await signOut({ redirect: false });
    await refresh();
  };

  if (!access.isUnlocked && access.followerPending) {
    return (
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-1.5" role="status" aria-live="polite">
        <p className="text-xs text-gray-200 font-medium flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-500 border-t-purple-300 rounded-full animate-spin" aria-hidden />
          フォロー状態を確認中…
        </p>
        <p className="text-[11px] text-gray-500 leading-snug">
          前回の確認から 24 時間が経過しました。確認が終わるまで保存は待機します。編集中の素材と設定はそのまま保持されます。
        </p>
      </div>
    );
  }

  if (!access.isUnlocked) {
    return (
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-300 font-medium">
          {access.tier === "trial" ? "お試し版で使用中" : "解放が必要です"}
        </p>
        <p className="text-[11px] text-gray-500 leading-snug">
          {access.followEnabled
            ? "Twitch で @datsusara_aki をフォロー、または合言葉で作成・保存が使えます。編集中の素材と設定はそのまま保持されます。"
            : "合言葉で作成・保存が使えます。編集中の素材と設定はそのまま保持されます。"}
        </p>
        <button
          type="button"
          onClick={onOpenGate}
          className="w-full px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
        >
          解放する
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/40 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {hasFollower && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-700/50 text-purple-200">
            💜 フォローで解放中
            {access.followerStatus === "temporary-error" && "（確認保留）"}
          </span>
        )}
        {hasPassphrase && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-200">
            🔑 合言葉で解放中{access.passphraseExpiresAt ? `（${fmt(access.passphraseExpiresAt)} まで）` : ""}
          </span>
        )}
        {hasEmergency && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">全員解放中</span>
        )}
      </div>

      {confirm ? (
        <div className="text-[11px] text-amber-100 bg-amber-900/30 border border-amber-700/40 rounded p-2 space-y-1.5">
          <p>
            {confirm === "passphrase"
              ? "この端末の合言葉認証を解除します。"
              : "Twitch からログアウトします（合言葉の認証は残ります）。"}
            {((confirm === "passphrase" && !hasFollower && !hasEmergency) || (confirm === "twitch" && !hasPassphrase && !hasEmergency)) &&
              " 利用には再認証が必要です。"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={confirm === "passphrase" ? doClearPassphrase : doTwitchLogout}
              className="px-2 py-1 rounded bg-amber-700/70 hover:bg-amber-700 text-white disabled:opacity-50"
            >
              実行
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {hasPassphrase && (
            <button type="button" onClick={() => setConfirm("passphrase")} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
              この端末の合言葉認証を解除
            </button>
          )}
          {loggedIn && (
            <button type="button" onClick={() => setConfirm("twitch")} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
              Twitchからログアウト
            </button>
          )}
        </div>
      )}
    </div>
  );
}
