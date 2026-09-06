"use client";

import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import type { AccessSnapshot } from "@/types/auth";
import AccessProvider, { useAccess } from "@/components/providers/AccessProvider";
import TwitchIcon from "@/components/TwitchIcon";

export default function AccountPanel({ initialAccess }: { initialAccess: AccessSnapshot }) {
  return (
    <AccessProvider initialAccess={initialAccess}>
      <AccountPanelInner />
    </AccessProvider>
  );
}

function AccountPanelInner() {
  const { access, busy, clearPassphrase, refresh } = useAccess();
  const loggedIn = access.identityStatus === "authenticated" || access.identityStatus === "reauth-required";

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-200">Twitch ログイン</h2>
        {loggedIn ? (
          <div className="flex items-center gap-2 flex-wrap">
            {access.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={access.user.image} alt="" className="w-7 h-7 rounded-full" />
            )}
            <span className="text-sm text-gray-300">{access.user?.name ?? access.user?.login}</span>
            {access.identityStatus === "reauth-required" && (
              <span className="text-[11px] text-amber-300">再ログインが必要です</span>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                await refresh();
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-2"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn("twitch", { callbackUrl: "/account" })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-500 transition-colors"
          >
            <TwitchIcon className="w-3.5 h-3.5" />
            Twitchでログイン
          </button>
        )}
        <p className="text-[11px] text-gray-500 leading-snug">
          ログアウトすると、この端末の Twitch セッション Cookie（トークンとフォロー確認結果）が消えます。Twitch 側の連携自体を解除するには、Twitch の「接続」設定から本アプリを取り消してください。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-200">この端末の合言葉認証</h2>
        {access.grants.includes("passphrase") ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-300">有効</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => clearPassphrase()}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              解除する
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">この端末では合言葉認証は有効ではありません。</p>
        )}
        <p className="text-[11px] text-gray-500 leading-snug">
          解除しても Twitch のログイン状態は変わりません。UI の設定（お気に入り等）はブラウザ内にだけ保存されており、ブラウザのサイトデータ削除で消去できます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-200">サーバー上のアカウントデータ</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          テンプレート共有・AI アニメーション生成は 2026 年 9 月の更新で終了し、本サービスはユーザーの投稿データをサーバーに保存しなくなりました。この画面から削除できるサーバー上のデータはありません。
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          終了前に投稿したテンプレート・アニメーションのデータは、現在アプリから閲覧・削除できません。削除を希望する場合は、
          <Link href="/privacy" className="text-purple-400 hover:text-purple-300">プライバシーポリシー</Link>
          記載の連絡先までお知らせください。
        </p>
      </section>
    </div>
  );
}
