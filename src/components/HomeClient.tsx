"use client";

import EmoteGenerator from "@/components/EmoteGenerator";
import Footer from "@/components/Footer";
import type { AccessSnapshot } from "@/types/auth";
import AccessProvider from "@/components/providers/AccessProvider";

/**
 * Creator shell. page.tsx (Server Component) renders this only when the
 * request is unlocked (or SITE_LOCK_ENABLED=false).
 *
 * コミット A: テンプレート共有タブを撤去。単一画面になったため、タブ切替による
 * 作成コンポーネントのアンマウント（分析 B05）は発生しなくなった。
 */
export default function HomeClient({ initialAccess }: { initialAccess: AccessSnapshot }) {
  return (
    <AccessProvider initialAccess={initialAccess}>
      <div className="min-h-screen flex flex-col">
        <header className="py-4 px-6 border-b border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-gray-100">Twitch Emote Generator</h1>
            <p className="text-sm text-gray-400 mt-1">エモート制作の面倒を全部省く</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            視聴者の<span className="text-gray-400 italic">{'"'}スタンプが作れるツールが欲しい{'"'}</span>の一言から生まれました。
          </p>
        </header>

        <EmoteGenerator />

        <Footer />
      </div>
    </AccessProvider>
  );
}
