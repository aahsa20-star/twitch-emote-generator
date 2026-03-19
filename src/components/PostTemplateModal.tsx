"use client";

import { useState } from "react";
import { EmoteConfig, TEMPLATE_TAGS } from "@/types/emote";
import { configToSummary } from "@/lib/templateUtils";

interface PostTemplateModalProps {
  config: EmoteConfig;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PostTemplateModal({ config, onClose, onSuccess }: PostTemplateModalProps) {
  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (selectedTags.length === 0) {
      setError("タグを1つ以上選択してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), tags: selectedTags, config }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "投稿に失敗しました");
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
          テンプレートを投稿する
        </p>

        {/* Config summary */}
        <div className="bg-gray-800 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-gray-400">設定内容</p>
          <p className="text-sm text-gray-200 mt-1">{configToSummary(config)}</p>
        </div>

        {/* Title input */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 block mb-1">タイトル（30文字以内）</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={30}
            placeholder="例: シンプル白フチ + 揺れ"
            className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-100 text-sm placeholder-gray-500 border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1 text-right">{title.length}/30</p>
        </div>

        {/* Tag selection */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 block mb-2">タグ（1つ以上選択）</label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-600"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "投稿中..." : "投稿する"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
