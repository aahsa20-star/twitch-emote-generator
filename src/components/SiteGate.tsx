"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { AccessSnapshot } from "@/types/auth";
import AccessProvider, { followerRecheckMessage, useAccess } from "@/components/providers/AccessProvider";
import PassphraseForm from "@/components/PassphraseForm";
import TwitchIcon from "@/components/TwitchIcon";
import { ANIMATION_COUNT } from "@/lib/animations/catalog";
import { primaryBtn, secondaryBtn } from "@/components/ui/classes";

/**
 * Site-wide gate (仕様書 §4, 09 §入口). Rendered by page.tsx when
 * SITE_LOCK_ENABLED and the request is not unlocked. The tool's HTML is not
 * delivered until then.
 *
 * Left (top on phones): what the tool does. Right (bottom): how to open it —
 * Twitch login + follow (primary, when FOLLOW_AUTH_ENABLED) and the passphrase
 * (always available, never blocked by Twitch state). Nothing heavy is
 * generated here.
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
    setFeedback({ kind: "success", text: "解放されました。ツールを開きます…" });
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
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-4 md:px-10 py-4 border-b border-[#26272e]">
        <span aria-hidden className="w-[33px] h-[33px] rounded-[10px] bg-studio-accent text-studio-accent-ink font-serif font-bold text-[30px] leading-[29px] text-center -rotate-6">e</span>
        <span className="text-[17px] md:text-[20px] font-bold tracking-tight">Twitch Emote Generator</span>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-16 items-center max-w-[1100px] w-full mx-auto px-4 md:px-10 py-8 lg:py-16">
        <section aria-label="このツールでできること">
          <p className="text-[10px] tracking-[.15em] font-semibold text-studio-accent mb-2">YOUR REACTION, YOUR EMOTE.</p>
          <h1 className="text-[29px] lg:text-[40px] font-bold leading-[1.5] lg:leading-[1.7] tracking-wide">
            いつもの表情を、<br />
            <em className="not-italic text-studio-accent">配信のリアクションに。</em>
          </h1>
          <p className="text-[12px] lg:text-[14px] text-studio-muted leading-[2] mt-3 lg:mt-5">
            画像を1枚。好きな動きをひとつ。<br />
            あなたらしいエモートを、ブラウザで。画像はサーバーに送りません。
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-5 text-[10px] lg:text-[11px] text-[#bbb3c5]">
            <li>{ANIMATION_COUNT}種類の動き</li>
            <li className="border-l border-[#514758] pl-3">背景を透過</li>
            <li className="border-l border-[#514758] pl-3">Twitch / Discord / 7TV などのサイズ</li>
            <li className="border-l border-[#514758] pl-3">GIF・動画からも</li>
          </ul>
        </section>

        <section className="bg-[#1e1c24] border border-[#514158] rounded-[24px] p-6 lg:p-8 shadow-[0_18px_60px_#0004]" aria-label="エモートを作りはじめる">
          <p className="text-[10px] tracking-[.15em] font-semibold text-studio-accent mb-2">LET&apos;S MAKE IT</p>
          <h2 className="text-[21px] lg:text-[23px] font-bold mb-2.5">エモートを作りはじめる</h2>
          <p className="text-[12px] text-studio-muted leading-[1.9] mb-6">
            {followEnabled ? (
              <>
                Twitch で <span className="text-studio-accent font-semibold">@{TWITCH_CHANNEL}</span> をフォロー、または合言葉で、作成から保存まで使えます。
              </>
            ) : (
              <>合言葉を入力すると、作成から保存まで使えます。</>
            )}
          </p>

          {followEnabled && (
            <div className="space-y-2" role="group" aria-label="Twitchフォローで開く">
              {!loggedIn ? (
                <>
                  <button type="button" onClick={handleSignin} className={`${primaryBtn} w-full`}>
                    <TwitchIcon className="w-4 h-4" />
                    Twitchでログインして確認
                    <span className="ml-auto" aria-hidden>↗</span>
                  </button>
                  <p className="text-[11px] text-studio-muted text-center">@{TWITCH_CHANNEL} のフォローを確認します</p>
                  <a href={TWITCH_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="block text-center text-[12px] text-studio-accent hover:underline min-h-[36px] leading-[36px]">
                    Twitchでフォローする →
                  </a>
                </>
              ) : (
                <>
                  {access.user && (
                    <p className="text-[11px] text-studio-muted text-center">{access.user.name ?? access.user.login} としてログイン中</p>
                  )}
                  {access.needsReauth || access.identityStatus === "reauth-required" ? (
                    <div className="px-3 py-2.5 rounded-[10px] text-[12px] bg-[#3a3322] border border-[#6b5a2c] text-studio-warn space-y-2">
                      <p>Twitchへの再ログインが必要です。再ログインするか、下の合言葉で開いてください。</p>
                      <button type="button" onClick={handleSignin} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>
                        Twitchで再ログイン
                      </button>
                    </div>
                  ) : (
                    <>
                      <a href={TWITCH_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className={`${primaryBtn} w-full`}>
                        Twitchでフォローする <span className="ml-auto" aria-hidden>↗</span>
                      </a>
                      <button type="button" onClick={handleRecheck} disabled={busy} className={`${secondaryBtn} w-full`}>
                        {busy ? (
                          <>
                            <span className="inline-block w-3.5 h-3.5 border-2 border-[#8a8395] border-t-studio-text rounded-full animate-spin" aria-hidden />
                            確認中…
                          </>
                        ) : (
                          "フォローを確認"
                        )}
                      </button>
                      <p className="text-[11px] text-studio-muted text-center leading-relaxed">別タブでフォローした後、このボタンで確認してください（自動では反映されません）</p>
                    </>
                  )}
                </>
              )}
              {feedback && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`px-3 py-2.5 rounded-[10px] text-[12px] leading-relaxed border ${
                    feedback.kind === "success"
                      ? "bg-[#1f3328] border-[#2f6b47] text-studio-good"
                      : feedback.kind === "warning"
                        ? "bg-[#3a3322] border-[#6b5a2c] text-studio-warn"
                        : "bg-[#3a2326] border-[#6b3a3f] text-studio-danger"
                  }`}
                >
                  <p>{feedback.text}</p>
                  {feedback.offerSignin && (
                    <button type="button" onClick={handleSignin} className={`${secondaryBtn} mt-2 min-h-[40px] text-[12px]`}>
                      Twitchで再ログイン
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={followEnabled ? "relative border-t border-[#403546] mt-6 pt-6" : ""}>
            {followEnabled && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 bg-[#1e1c24] text-[11px] text-studio-muted">合言葉をお持ちの方</span>
            )}
            <PassphraseForm onUnlocked={goToCreator} autoFocus={!followEnabled} label={followEnabled ? "合言葉" : "合言葉を入力"} />
            <p className="text-[10px] text-studio-muted leading-relaxed mt-3">
              Twitch の障害中やログインできないときも、合言葉だけで開けます。合言葉は配信・Discord でお知らせしています。
            </p>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-2 px-4 md:px-10 py-5 border-t border-[#29272f] text-[10px] text-[#97909e]">
        <span>画像はこのブラウザ内で扱います。</span>
        <span className="space-x-2">
          <a href="/privacy" className="hover:text-studio-text">プライバシーポリシー</a>
          <span aria-hidden>·</span>
          <a href="/account" className="hover:text-studio-text">アカウント・データ管理</a>
        </span>
      </footer>
    </div>
  );
}
