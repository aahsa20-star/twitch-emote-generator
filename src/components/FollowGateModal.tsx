"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

/**
 * 本格誘導モーダル — DL クリック時 (trial ユーザー) に表示。
 *
 * 役割:
 *  - フォロー誘導をメイン経路にし、合言葉は inline 展開でセカンダリ提示
 *  - utm パラメータ付き Twitch URL を別タブで開く
 *  - 「フォロー済み・解除を確認」ボタン: fix7.2 で getToken() 経由を撤廃。
 *    useSession().update() を直接呼び、jwt callback の trigger === "update"
 *    分岐内で Twitch API を再叩きする一発フローに集約。fix7.1 で間に挟んで
 *    いた /api/follower-recheck エンドポイントは Auth.js v5 の getToken()
 *    が App Router の NextRequest と非互換でログイン中ユーザーでも null を
 *    返す問題に当たり、salt 削除でも解消しなかったため完全撤廃。
 *
 * 設計: FOLLOWER_AUTH_DESIGN.md §7.1 + fix7.1 / fix7.2 修正
 *
 * @prop open / onClose      モーダル制御
 * @prop variant             utm_medium 計測用 (lock_modal / key_icon / onboarding)
 * @prop previewSrc          DL 試行時の生成プレビュー画像 dataURL (28x28)
 * @prop onSubscribed        合言葉認証成功時のコールバック (PASSPHRASE state を上げる)
 */
export type FollowGateVariant = "lock_modal" | "key_icon" | "onboarding";

interface FollowGateModalProps {
  open: boolean;
  onClose: () => void;
  variant?: FollowGateVariant;
  previewSrc?: string;
  onSubscribed?: () => void;
}

const TWITCH_CHANNEL = "datsusara_aki";

function buildTwitchUrl(variant: FollowGateVariant): string {
  const params = new URLSearchParams({
    utm_source: "emote_generator",
    utm_medium: variant,
  });
  return `https://www.twitch.tv/${TWITCH_CHANNEL}?${params.toString()}`;
}

type ReauthFeedback =
  | { kind: "success"; text: string }
  | { kind: "warning"; text: string; offerSignin?: boolean }
  | { kind: "error"; text: string };

export default function FollowGateModal({
  open,
  onClose,
  variant = "lock_modal",
  previewSrc,
  onSubscribed,
}: FollowGateModalProps) {
  const { update } = useSession();
  const [showPassphraseInput, setShowPassphraseInput] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthFeedback, setReauthFeedback] = useState<ReauthFeedback | null>(
    null,
  );

  if (!open) return null;

  const handleReauth = async () => {
    if (reauthLoading) return;
    setReauthLoading(true);
    setReauthFeedback(null);
    try {
      // Trigger jwt callback's `trigger === "update"` branch directly.
      // The callback in src/auth.ts re-fetches isFollower from Twitch API
      // using token.access_token (no getToken needed) and writes the
      // result back into the JWT. update() resolves with the new Session.
      // The hint object below is intentionally read-only on the server —
      // auth.ts ignores client-supplied values for security.
      const newSession = await update({ trigger: "follower-recheck" });

      // session.user.isFollower / session.user.error are exposed by
      // session() callback in src/auth.ts:160-178.
      const userExt = newSession?.user as
        | { isFollower?: boolean; error?: string }
        | undefined;
      const isFollower = userExt?.isFollower === true;
      const error = userExt?.error;

      if (error === "RefreshTokenError") {
        setReauthFeedback({
          kind: "warning",
          text: "Twitch のログインが切れています。下のボタンで再ログインしてください。",
          offerSignin: true,
        });
        return;
      }

      if (isFollower) {
        setReauthFeedback({
          kind: "success",
          text: "✨ フォロー特典が有効になりました",
        });
        // Close after a brief success animation.
        setTimeout(() => onClose(), 1500);
        return;
      }

      if (error === "FollowCheckError") {
        // jwt callback fell back to fail-safe (Twitch API down or rate
        // limited beyond retry). Surface as transient — retry later.
        setReauthFeedback({
          kind: "error",
          text: "確認に失敗しました。少し時間を置いて再度お試しください。",
        });
        return;
      }

      // Fresh "no follow" — Twitch returned a definitive negative.
      // Could be propagation lag right after a follow, or simply not
      // following yet. Single message covers both cases.
      setReauthFeedback({
        kind: "warning",
        text: "フォローが確認できませんでした。Twitch でフォロー後、数秒待ってから再度お試しください。",
      });
    } catch {
      setReauthFeedback({
        kind: "error",
        text: "通信エラーが発生しました。しばらく待ってから再度お試しください。",
      });
    } finally {
      setReauthLoading(false);
    }
  };

  // Fallback path: only when token is revoked, fall back to a full signIn.
  // Outside of that branch we never trigger a page reload anymore.
  //
  // fix7.1.1: explicit `callbackUrl` and `redirect: true`. The previous
  // bare `signIn("twitch")` call was reported as "no response" in
  // production — likely because the implicit window.location-based
  // callback resolution was being suppressed under certain redirect
  // chains. Forcing `redirect: true` + an explicit URL makes Auth.js v5
  // do a full top-level navigation unconditionally.
  const handleSigninFallback = () => {
    void signIn("twitch", { callbackUrl: "/", redirect: true });
  };

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setPassphraseError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: passphrase.trim() }),
      });
      if (res.ok) {
        try {
          localStorage.setItem("emote-subscriber", "true");
        } catch {
          // ignore
        }
        onSubscribed?.();
        onClose();
      } else {
        setPassphraseError("合言葉が違います");
      }
    } catch {
      setPassphraseError("通信に失敗しました。少し時間を置いて再試行してください。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-gate-title"
    >
      <div
        className="w-full max-w-md bg-gray-900 border border-purple-700/50 rounded-lg shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2
            id="follow-gate-title"
            className="text-base font-bold text-white flex items-center gap-2"
          >
            <span className="text-purple-400">💜</span>
            Twitch でフォローしてダウンロード
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-sm text-gray-300">
          {/* Preview */}
          {previewSrc && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="bg-checker bg-gray-800 p-2 rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt="生成中のエモート"
                  width={28}
                  height={28}
                  className="block"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <p className="text-xs text-gray-500">
                28px プレビュー（56px / 112px はフォローで解放）
              </p>
            </div>
          )}

          {/* Main copy */}
          <p className="leading-relaxed">
            開発者への応援のお礼にダウンロードを開放してます。
            Twitchで{" "}
            <span className="font-semibold text-purple-300">
              @{TWITCH_CHANNEL}
            </span>{" "}
            をフォローして、作品を受け取ってください。
          </p>

          {/* Aki profile */}
          <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3 space-y-1 text-xs text-gray-400">
            <p>• 個人で色々作ってる人</p>
            <p>• Twitchで配信もしてます</p>
            <p>• 最近ゲーム作りました（爆走！ランデブー）</p>
            <a
              href={`https://www.twitch.tv/${TWITCH_CHANNEL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-1 text-purple-400 hover:text-purple-300 transition-colors"
            >
              twitch.tv/{TWITCH_CHANNEL} →
            </a>
          </div>

          {/* Primary CTAs */}
          <div className="space-y-2 pt-1">
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
              onClick={handleReauth}
              disabled={reauthLoading}
              className="block w-full text-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {reauthLoading ? (
                <>
                  <span
                    className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-100 rounded-full animate-spin"
                    aria-hidden
                  />
                  確認中…
                </>
              ) : (
                "フォロー済み・解除を確認"
              )}
            </button>
            {reauthFeedback && (
              <div
                role="status"
                aria-live="polite"
                className={
                  reauthFeedback.kind === "success"
                    ? "px-3 py-2 rounded text-xs bg-green-900/40 border border-green-700/50 text-green-200"
                    : reauthFeedback.kind === "warning"
                      ? "px-3 py-2 rounded text-xs bg-amber-900/30 border border-amber-700/40 text-amber-100"
                      : "px-3 py-2 rounded text-xs bg-red-900/30 border border-red-700/40 text-red-200"
                }
              >
                <p className="leading-snug">{reauthFeedback.text}</p>
                {reauthFeedback.kind === "warning" &&
                  reauthFeedback.offerSignin && (
                    <button
                      type="button"
                      onClick={handleSigninFallback}
                      className="mt-2 px-2.5 py-1 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-white rounded transition-colors"
                    >
                      Twitch で再ログイン
                    </button>
                  )}
              </div>
            )}
          </div>

          {/* Passphrase secondary path */}
          <div className="pt-3 border-t border-gray-800">
            {!showPassphraseInput ? (
              <button
                onClick={() => setShowPassphraseInput(true)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline-offset-2 hover:underline"
              >
                合言葉をお持ちの方はこちら
              </button>
            ) : (
              <form onSubmit={handlePassphraseSubmit} className="space-y-2">
                <label className="text-xs text-gray-400 block">合言葉を入力</label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoFocus
                    className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-purple-500"
                    placeholder="合言葉"
                    disabled={submitting}
                  />
                  <button
                    type="submit"
                    disabled={submitting || passphrase.trim() === ""}
                    className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    送信
                  </button>
                </div>
                {passphraseError && (
                  <p className="text-xs text-red-300">{passphraseError}</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
