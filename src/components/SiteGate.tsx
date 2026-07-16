"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

/**
 * fix14: サイト全体ロックのゲート画面。
 *
 * page.tsx (Server Component) が evaluateAccess で未解放と判定した場合に
 * ツール本体の代わりにこれを描画する。解放経路は 2 つ:
 *
 *  1. 合言葉（メイン経路）: POST /api/auth が HttpOnly cookie
 *     `emote-subscriber=1` を set → router.refresh() で Server Component を
 *     再評価 → ツール本体が描画される
 *  2. Twitch フォロー（併用経路）: signIn("twitch") でログイン後、
 *     useSession().update({ trigger: "follower-recheck" }) で jwt callback の
 *     再判定を起動（fix7.2 確定フロー、getToken 不使用）→ isFollower=true
 *     なら router.refresh()
 *
 * 判定はサーバー側レンダリングで行われるため、未解放ユーザーには
 * ツール本体の HTML 自体が配信されない（client-only gating より強い）。
 */

const TWITCH_CHANNEL = "datsusara_aki";

interface SiteGateProps {
  /** Twitch セッションが有効か（server 判定を props で受ける）。 */
  isLoggedIn: boolean;
  /** 旧 scope セッション（user:read:follows 無し）で再ログインが必要か。 */
  needsReauth: boolean;
}

type Feedback =
  | { kind: "success"; text: string }
  | { kind: "warning"; text: string; offerSignin?: boolean }
  | { kind: "error"; text: string };

export default function SiteGate({ isLoggedIn, needsReauth }: SiteGateProps) {
  const router = useRouter();
  const { update } = useSession();

  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckFeedback, setRecheckFeedback] = useState<Feedback | null>(null);

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setPassphraseError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: passphrase.trim() }),
      });
      if (res.ok) {
        // 既存 UI（EmoteGenerator の特典セクション等）は localStorage も
        // 見るため、cookie と並行して legacy フラグも set しておく。
        try {
          localStorage.setItem("emote-subscriber", "true");
        } catch {
          // ignore (private mode etc.)
        }
        router.refresh();
      } else {
        setPassphraseError("合言葉が違います");
      }
    } catch {
      setPassphraseError("通信に失敗しました。少し時間を置いて再試行してください。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTwitchSignin = () => {
    void signIn("twitch", { callbackUrl: "/", redirect: true });
  };

  /**
   * フォロー済み確認。FollowGateModal.handleReauth と同じ fix7.2 フロー
   * （update() → jwt callback trigger === "update" → Twitch API 再叩き）。
   * 成功時はモーダルを閉じる代わりに router.refresh() でゲートを再評価する。
   */
  const handleFollowRecheck = async () => {
    if (recheckLoading) return;
    setRecheckLoading(true);
    setRecheckFeedback(null);
    try {
      const newSession = await update({ trigger: "follower-recheck" });
      const userExt = newSession?.user as
        | { isFollower?: boolean; error?: string }
        | undefined;
      const isFollower = userExt?.isFollower === true;
      const error = userExt?.error;

      if (error === "RefreshTokenError") {
        setRecheckFeedback({
          kind: "warning",
          text: "Twitch のログインが切れています。下のボタンで再ログインしてください。",
          offerSignin: true,
        });
        return;
      }

      if (isFollower) {
        setRecheckFeedback({
          kind: "success",
          text: "✨ フォローを確認しました。ツールを開きます…",
        });
        setTimeout(() => router.refresh(), 800);
        return;
      }

      if (error === "FollowCheckError") {
        setRecheckFeedback({
          kind: "error",
          text: "確認に失敗しました。少し時間を置いて再度お試しください。",
        });
        return;
      }

      setRecheckFeedback({
        kind: "warning",
        text: "フォローが確認できませんでした。Twitch でフォロー後、数秒待ってから再度お試しください。",
      });
    } catch {
      setRecheckFeedback({
        kind: "error",
        text: "通信エラーが発生しました。しばらく待ってから再度お試しください。",
      });
    } finally {
      setRecheckLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-100">
            Twitch Emote Generator
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            エモート制作の面倒を全部省く
          </p>
        </div>

        <div className="bg-gray-900 border border-purple-700/50 rounded-lg shadow-2xl p-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-3xl" aria-hidden>
              🔑
            </p>
            <h2 className="text-base font-bold text-white">
              このツールは合言葉で開きます
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              合言葉を入力するか、Twitch で @{TWITCH_CHANNEL} を
              フォローすると使えるようになります。
            </p>
          </div>

          {/* Passphrase (primary) */}
          <form onSubmit={handlePassphraseSubmit} className="space-y-2">
            <label
              htmlFor="site-gate-passphrase"
              className="text-xs text-gray-400 block"
            >
              合言葉を入力
            </label>
            <div className="flex items-center gap-2">
              <input
                id="site-gate-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-purple-500"
                placeholder="合言葉"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || passphrase.trim() === ""}
                className="px-4 py-2.5 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "確認中…" : "開く"}
              </button>
            </div>
            {passphraseError && (
              <p className="text-xs text-red-300" role="alert">
                {passphraseError}
              </p>
            )}
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex-1 h-px bg-gray-800" />
            または
            <span className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Twitch follow (secondary path) */}
          <div className="space-y-2">
            {!isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={handleTwitchSignin}
                  className="block w-full text-center px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded transition-colors"
                >
                  <span className="text-purple-400 mr-1">💜</span>
                  Twitch でログインして解放（フォロワー向け）
                </button>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Twitch で{" "}
                  <a
                    href={`https://www.twitch.tv/${TWITCH_CHANNEL}?utm_source=emote_generator&utm_medium=site_gate`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    @{TWITCH_CHANNEL}
                  </a>{" "}
                  をフォローしている方は、ログインするだけで使えます。
                </p>
              </>
            ) : needsReauth ? (
              <>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  ログイン情報が古い形式のため、フォロー確認には Twitch での
                  再ログインが必要です。
                </p>
                <button
                  type="button"
                  onClick={handleTwitchSignin}
                  className="block w-full text-center px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded transition-colors"
                >
                  Twitch で再ログイン
                </button>
              </>
            ) : (
              <>
                <a
                  href={`https://www.twitch.tv/${TWITCH_CHANNEL}?utm_source=emote_generator&utm_medium=site_gate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2.5 bg-purple-600/80 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
                >
                  Twitch で @{TWITCH_CHANNEL} をフォローする →
                </a>
                <button
                  type="button"
                  onClick={handleFollowRecheck}
                  disabled={recheckLoading}
                  className="w-full text-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {recheckLoading ? (
                    <>
                      <span
                        className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-100 rounded-full animate-spin"
                        aria-hidden
                      />
                      確認中…
                    </>
                  ) : (
                    "フォロー済みを確認"
                  )}
                </button>
                {recheckFeedback && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={
                      recheckFeedback.kind === "success"
                        ? "px-3 py-2 rounded text-xs bg-green-900/40 border border-green-700/50 text-green-200"
                        : recheckFeedback.kind === "warning"
                          ? "px-3 py-2 rounded text-xs bg-amber-900/30 border border-amber-700/40 text-amber-100"
                          : "px-3 py-2 rounded text-xs bg-red-900/30 border border-red-700/40 text-red-200"
                    }
                  >
                    <p className="leading-snug">{recheckFeedback.text}</p>
                    {recheckFeedback.kind === "warning" &&
                      recheckFeedback.offerSignin && (
                        <button
                          type="button"
                          onClick={handleTwitchSignin}
                          className="mt-2 px-2.5 py-1 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-white rounded transition-colors"
                        >
                          Twitch で再ログイン
                        </button>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-6">
          合言葉は配信・Discord でお知らせしています ·{" "}
          <a
            href="/privacy"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            プライバシーポリシー
          </a>
        </p>
      </main>
    </div>
  );
}
