"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * fix14: サイト全体ロックのゲート画面。
 *
 * page.tsx (Server Component) が evaluateAccess で未解放と判定した場合に
 * ツール本体の代わりにこれを描画する。
 *
 * fix14.1: 解放経路を合言葉のみに変更（Twitch フォロー解放を撤去）。
 * 合言葉: POST /api/auth が HttpOnly cookie `emote-subscriber=1` を set →
 * router.refresh() で Server Component を再評価 → ツール本体が描画される。
 *
 * 判定はサーバー側レンダリングで行われるため、未解放ユーザーには
 * ツール本体の HTML 自体が配信されない（client-only gating より強い）。
 */
export default function SiteGate() {
  const router = useRouter();

  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
              合言葉を入力すると使えるようになります。
            </p>
          </div>

          {/* Passphrase */}
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
