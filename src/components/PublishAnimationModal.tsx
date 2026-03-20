"use client";

import { useState } from "react";

interface PublishAnimationModalProps {
  description: string;
  code: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PublishAnimationModal({
  description,
  code,
  onClose,
  onSuccess,
}: PublishAnimationModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("アニメーション名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/custom-animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          code,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "公開に失敗しました");
        return;
      }

      onSuccess();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-bold text-base mb-4">
          アニメーションを公開する
        </p>

        {/* Description summary */}
        <div className="bg-gray-800 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-gray-400">アニメーションの説明</p>
          <p className="text-sm text-gray-200 mt-1">{description}</p>
        </div>

        {/* Name input */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 block mb-1">
            アニメーション名（20文字以内）
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="例: 炎の揺らぎ"
            className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-100 text-sm placeholder-gray-500 border border-gray-600 focus:border-cyan-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1 text-right">
            {name.length}/20
          </p>
        </div>

        {/* Error */}
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "公開中..." : "公開する"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-3">
          公開したアニメーションは「みんなのアニメーション」に表示されます。不適切な投稿は通報により非公開になります。
        </p>
      </div>
    </div>
  );
}
