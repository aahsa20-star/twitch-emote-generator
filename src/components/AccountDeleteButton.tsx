"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/**
 * アカウント全データ削除ボタン + 確認モーダル。
 *
 * Gallery.tsx のログイン状態ブロック内、ログアウトボタンの隣に配置する。
 * 押下 → 警告モーダル表示 → ユーザー確認 → POST /api/account/delete
 * → 成功: signOut() でセッション破棄 + ホームへ
 * → 失敗: エラー表示（モーダル内に残る）
 */
export default function AccountDeleteButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        setError(
          "削除中にエラーが発生しました。時間をおいて再度お試しください。問題が続く場合は X DM @akiissamurai までお知らせください。",
        );
        setIsDeleting(false);
        return;
      }
      // セッションを破棄してトップへ。callbackUrl で再ログインを誘発しないようルートへ。
      await signOut({ callbackUrl: "/" });
    } catch {
      setError(
        "ネットワークエラーが発生しました。接続を確認して再度お試しください。",
      );
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return; // 削除中はクローズさせない
    setIsOpen(false);
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-gray-500 hover:text-red-400 transition-colors ml-2 underline-offset-2 hover:underline"
        aria-label="アカウント削除"
      >
        アカウント削除
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md bg-gray-900 border border-red-700/50 rounded-lg shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-lg font-bold text-white">アカウント削除</h3>
                <p className="text-xs text-red-300">この操作は取り消せません。</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-300">
              <p>削除すると以下のデータがすべて消去されます：</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400 text-xs pl-1">
                <li>投稿したテンプレート</li>
                <li>投稿したカスタムアニメーション</li>
                <li>テンプレート・アニメへの「いいね」履歴</li>
                <li>通報履歴</li>
                <li>AI アニメーション生成履歴</li>
                <li>Twitch アカウント連携情報（セッショントークン）</li>
              </ul>
              <p className="text-xs text-gray-500 pt-2">
                ローカル PC 上にダウンロード済みの画像は影響を受けません。
              </p>
            </div>

            {error && (
              <div className="text-xs text-red-300 bg-red-950/40 border border-red-800/40 rounded p-2">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={handleClose}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
