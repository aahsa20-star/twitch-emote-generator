"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { AccessSnapshot } from "@/types/auth";
import AccessProvider, { followerRecheckMessage, useAccess } from "@/components/providers/AccessProvider";
import PassphraseForm from "@/components/PassphraseForm";
import TwitchIcon from "@/components/TwitchIcon";

/**
 * Site-wide gate (仕様書 §4). Rendered by page.tsx when SITE_LOCK_ENABLED and
 * the request is not unlocked. The tool's HTML is not delivered until then.
 *
 * Paths: Twitch login + follow (primary, when FOLLOW_AUTH_ENABLED) and the
 * passphrase (always visible, never blocked by Twitch state).
 * After unlocking, `router.refresh()` re-evaluates the Server Component in
 * the same tab.
 */
export const TWITCH_CHANNEL = "datsusara_aki";
export const TWITCH_CHANNEL_URL = `https://www.twitch.tv/${TWITCH_CHANNEL}`;

export default function SiteGate({ initialAccess }: { initialAccess: AccessSnapshot }) {
  return (
    <AccessProvider initialAccess={initialAccess}>
      <SiteGateInner />
    </AccessProvider>
  );
}

type Feedback = { kind: "success" | "warning" | "error"; text: string; offerSignin?: boolean };

function SiteGateInner() {
  const router = useRouter();
  const { access, busy, recheckFollower } = useAccess();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const followEnabled = access.followEnabled;
  const loggedIn = access.identityStatus === "authenticated" || access.identityStatus === "reauth-required";

  const goToCreator = () => {
    setFeedback({ kind: "success", text: "✨ 解放されました。ツールを開きます…" });
    setTimeout(() => router.refresh(), 500);
  };

  const handleSignin = () => {
    void signIn("twitch", { callbackUrl: "/", redirect: true });
  };

  const handleRecheck = async () => {
    if (busy) return;
    setFeedback(null);
    const r = await recheckFollower("manual");
    if (r.unlocked) {
      goToCreator();
      return;
    }
    setFeedback(followerRecheckMessage(r, access.needsReauth));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-100">Twitch Emote Generator</h1>
          <p className="text-sm text-gray-400 mt-2">エモート制作の面倒を全部省く</p>
        </div>

        <div className="bg-gray-900 border border-purple-700/50 rounded-lg shadow-2xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-3xl" aria-hidden>
              {followEnabled ? "💜" : "🔑"}
            </p>
            <h2 className="text-base font-bold text-white">
              {followEnabled ? "フォロー、または合言葉で使えます" : "このツールは合言葉で開きます"}
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              {followEnabled ? (
                <>
                  Twitchで <span className="text-purple-300 font-semibold">@{TWITCH_CHANNEL}</span> をフォローすると、エモートの作成・保存が使えます。
                  合言葉をお持ちの方は、Twitchログインなしでも利用できます。
                </>
              ) : (
                <>合言葉を入力すると使えるようになります。</>
              )}
            </p>
          </div>

          {followEnabled && (
            <section className="space-y-2" aria-label="Twitchフォローで開く">
              {!loggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={handleSignin}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
                  >
                    <TwitchIcon className="w-4 h-4" />
                    Twitchでログインして確認
                  </button>
                  <a
                    href={TWITCH_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Twitchでフォローする →
                  </a>
                </>
              ) : (
                <>
                  {access.user && (
                    <p className="text-xs text-gray-400 text-center">
                      {access.user.name ?? access.user.login} としてログイン中
                    </p>
                  )}
                  {access.needsReauth || access.identityStatus === "reauth-required" ? (
                    <div className="px-3 py-2 rounded text-xs bg-amber-900/30 border border-amber-700/40 text-amber-100 space-y-2">
                      <p>Twitchへの再ログインが必要です。再ログインするか、下の合言葉で開いてください。</p>
                      <button
                        type="button"
                        onClick={handleSignin}
                        className="px-2.5 py-1 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-white rounded transition-colors"
                      >
                        Twitchで再ログイン
                      </button>
                    </div>
                  ) : (
                    <>
                      <a
                        href={TWITCH_CHANNEL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
                      >
                        Twitchでフォローする →
                      </a>
                      <button
                        type="button"
                        onClick={handleRecheck}
                        disabled={busy}
                        className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                      <p className="text-[11px] text-gray-500 text-center">
                        別タブでフォローした後、このボタンで確認してください（自動では反映されません）
                      </p>
                    </>
                  )}
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
                    <button
                      type="button"
                      onClick={handleSignin}
                      className="mt-2 px-2.5 py-1 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-white rounded transition-colors"
                    >
                      Twitchで再ログイン
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          <section className={followEnabled ? "pt-4 border-t border-gray-800" : ""} aria-label="合言葉で開く">
            <PassphraseForm onUnlocked={goToCreator} autoFocus={!followEnabled} label={followEnabled ? "合言葉で開く" : "合言葉を入力"} />
          </section>
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-6 space-x-1">
          <span>合言葉は配信・Discord でお知らせしています</span>
          <span>·</span>
          <a href="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors">プライバシーポリシー</a>
          <span>·</span>
          <a href="/account" className="text-gray-500 hover:text-gray-300 transition-colors">アカウント・データ管理</a>
        </p>
      </main>
    </div>
  );
}
