import { cookies } from "next/headers";
import Link from "next/link";
import { auth } from "@/auth";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/passphrase-token";
import { resolveAccess } from "@/lib/auth/resolve-access";
import AccountPanel from "@/components/AccountPanel";

/**
 * /account — アカウント・データ管理.
 * NOT behind the site gate. コミット A 以降、サーバー側に削除対象の
 * ユーザーデータは存在しない（旧投稿データはアプリから操作不可 — 画面に明記）。
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "アカウント・データ管理 | Twitch Emote Generator" };

export default async function AccountPage() {
  const cookieStore = await cookies();
  const access = await resolveAccess({
    accessCookie: cookieStore.get(ACCESS_COOKIE_NAME)?.value,
    getSession: auth,
  });
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <main className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">アカウント・データ管理</h1>
          <p className="text-xs text-gray-400 mt-1">
            Twitch ログインと合言葉認証の状態を確認・解除できます。フォローや合言葉がなくても開けます。
          </p>
        </div>
        <AccountPanel initialAccess={access} />
        <p className="text-[11px] text-gray-600 text-center space-x-1">
          <Link href="/" className="text-gray-500 hover:text-gray-300">ツールへ戻る</Link>
          <span>·</span>
          <Link href="/privacy" className="text-gray-500 hover:text-gray-300">プライバシーポリシー</Link>
        </p>
      </main>
    </div>
  );
}
