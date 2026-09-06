"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { followerRecheckMessage, useAccess } from "@/components/providers/AccessProvider";
import PassphraseForm from "@/components/PassphraseForm";
import TwitchIcon from "@/components/TwitchIcon";
import { TWITCH_CHANNEL, TWITCH_CHANNEL_URL } from "@/components/SiteGate";

/**
 * Re-authentication panel inside the editor (仕様書 §8).
 *
 * Shown when a save is refused with `access-required`, or when the user
 * clicks a locked feature. Uses the same AccessProvider state and passphrase
 * form as SiteGate. Never reloads the page except for the explicit Twitch
 * (re)login button, which warns that unsaved edits may be lost.
 */
export type FollowGateVariant = "lock_modal" | "key_icon" | "onboarding";

interface FollowGateModalProps {
  open: boolean;
  onClose: () => void;
  variant?: FollowGateVariant;
  previewSrc?: string;
}

function buildTwitchUrl(variant: FollowGateVariant): string {
  const params = new URLSearchParams({ utm_source: "emote_generator", utm_medium: variant });
  return `${TWITCH_CHANNEL_URL}?${params.toString()}`;
}

type Feedback = { kind: "success" | "warning" | "error"; text: string; offerSignin?: boolean };

export default function FollowGateModal({ open, onClose, variant = "lock_modal", previewSrc }: FollowGateModalProps) {
  const { access, busy, recheckFollower } = useAccess();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!open) return null;

  const followEnabled = access.followEnabled;
  const loggedIn = access.identityStatus === "authenticated" || access.identityStatus === "reauth-required";
  const reauth = access.needsReauth || access.identityStatus === "reauth-required";

  const handleSignin = () => {
    void signIn("twitch", { callbackUrl: "/", redirect: true });
  };

  const handleRecheck = async () => {
    if (busy) return;
    setFeedback(null);
    const r = await recheckFollower("manual");
    if (r.unlocked) {
      setFeedback({ kind: "success", text: "✨ フォローを確認しました。保存できます" });
      setTimeout(() => onClose(), 1200);
      return;
    }
    setFeedback(followerRecheckMessage(r, access.needsReauth));
  };

  const handleUnlocked = () => {
    setFeedback({ kind: "success", text: "✨ 合言葉で解放されました" });
    setTimeout(() => onClose(), 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-gate-title"
    >
      <div className="w-full max-w-md bg-gray-900 border border-purple-700/50 rounded-lg shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 id="follow-gate-title" className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-purple-400">{followEnabled ? "💜" : "🔑"}</span>
            {followEnabled ? "フォロー、または合言葉で保存できます" : "合言葉で保存できます"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors text-xl leading-none" aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-gray-300">
          {previewSrc && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="bg-checker bg-gray-800 p-2 rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewSrc} alt="生成中のエモート" width={28} height={28} className="block" style={{ imageRendering: "pixelated" }} />
              </div>
              <p className="text-xs text-gray-500">28px プレビュー — 素材と設定はこのまま保持されます</p>
            </div>
          )}

          {followEnabled ? (
            <p className="leading-relaxed">
              Twitchで <span className="font-semibold text-purple-300">@{TWITCH_CHANNEL}</span> をフォローすると、作成と保存が使えます。合言葉をお持ちの方はそのまま入力してください。
            </p>
          ) : (
            <p className="leading-relaxed">保存には合言葉での解放が必要です。</p>
          )}

          {followEnabled && (
            <div className="space-y-2">
              {!loggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={handleSignin}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
                  >
                    <TwitchIcon />
                    Twitchでログインして確認
                  </button>
                  <p className="text-[11px] text-amber-200/80 leading-snug">
                    ログインでページが切り替わるため、未保存の編集が失われる場合があります。合言葉なら、この場で続けられます。
                  </p>
                </>
              ) : reauth ? (
                <div className="px-3 py-2 rounded text-xs bg-amber-900/30 border border-amber-700/40 text-amber-100 space-y-2">
                  <p>Twitchへの再ログインが必要です。再ログイン（未保存の編集が失われる場合があります）か、合言葉で続けてください。</p>
                  <button type="button" onClick={handleSignin} className="px-2.5 py-1 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-white rounded transition-colors">
                    Twitchで再ログイン
                  </button>
                </div>
              ) : (
                <>
                  <a
                    href={buildTwitchUrl(variant)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
                  >
                    Twitch でフォローする →
                  </a>
                  <button
                    type="button"
                    onClick={handleRecheck}
                    disabled={busy}
                    className="w-full text-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-100 rounded-full animate-spin" aria-hidden />
                        確認中…
                      </>
                    ) : (
                      "フォローを確認"
                    )}
                  </button>
                </>
              )}
              {feedback && (
                <div
                  role="status"
                  aria-live="polite"
                  className={
                    feedback.kind === "success"
                      ? "px-3 py-2 rounded text-xs bg-green-900/40 border border-green-700/50 text-green-200"
                      : feedback.kind === "warning"
                        ? "px-3 py-2 rounded text-xs bg-amber-900/30 border border-amber-700/40 text-amber-100"
                        : "px-3 py-2 rounded text-xs bg-red-900/30 border border-red-700/40 text-red-200"
                  }
                >
                  <p className="leading-snug">{feedback.text}</p>
                  {feedback.offerSignin && (
                    <button type="button" onClick={handleSignin} className="mt-2 px-2.5 py-1 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-white rounded transition-colors">
                      Twitch で再ログイン
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={followEnabled ? "pt-3 border-t border-gray-800" : ""}>
            <PassphraseForm compact onUnlocked={handleUnlocked} label="合言葉をお持ちの方はこちら" />
          </div>
          {!followEnabled && feedback && (
            <p className="text-xs text-green-200">{feedback.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
