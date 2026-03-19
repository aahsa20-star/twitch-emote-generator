"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Heart, Trash2 } from "lucide-react";
import { Template, EmoteConfig, TEMPLATE_TAGS } from "@/types/emote";
import { configToSummary } from "@/lib/templateUtils";
import LoginPromptModal from "./LoginPromptModal";

interface GalleryProps {
  onApplyTemplate: (config: EmoteConfig, credit?: { userName: string; userLogin?: string | null }) => void;
  onGoToCreator: () => void;
}

type SortMode = "new" | "popular";

export default function Gallery({ onApplyTemplate, onGoToCreator }: GalleryProps) {
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sort, setSort] = useState<SortMode>("new");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const fetchTemplates = useCallback(async (reset: boolean) => {
    setLoading(true);
    const p = reset ? 0 : page;
    const params = new URLSearchParams({ sort, page: String(p) });
    if (activeTag) params.set("tag", activeTag);

    try {
      const res = await fetch(`/api/templates?${params}`);
      const json = await res.json();
      const data: Template[] = Array.isArray(json) ? json : [];

      if (reset) {
        setTemplates(data);
        setPage(1);
      } else {
        setTemplates((prev) => [...prev, ...data]);
        setPage((prev) => prev + 1);
      }
      setHasMore(data.length >= 20);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [sort, activeTag, page]);

  // Refetch when sort or tag changes
  useEffect(() => {
    fetchTemplates(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, activeTag]);

  const handleLike = async (templateId: string) => {
    if (!session?.user) {
      setShowLoginModal(true);
      return;
    }

    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id !== templateId) return t;
        const wasLiked = t.liked_by_me;
        return {
          ...t,
          liked_by_me: !wasLiked,
          likes_count: wasLiked ? t.likes_count - 1 : t.likes_count + 1,
        };
      })
    );

    try {
      const res = await fetch(`/api/templates/${templateId}/like`, { method: "POST" });
      const data = await res.json();
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateId
            ? { ...t, liked_by_me: data.liked, likes_count: data.likes_count }
            : t
        )
      );
    } catch {
      // Revert on error
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== templateId) return t;
          const wasLiked = t.liked_by_me;
          return {
            ...t,
            liked_by_me: !wasLiked,
            likes_count: wasLiked ? t.likes_count - 1 : t.likes_count + 1,
          };
        })
      );
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("このテンプレートを削除しますか？")) return;

    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-6">
      {/* Login status */}
      <div className="mb-6 flex items-center justify-between bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
        {session?.user ? (
          <div className="flex items-center gap-2">
            {session.user.image && (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
            )}
            <span className="text-sm text-gray-300">{session.user.name}</span>
            <button
              onClick={() => signOut()}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-2"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => signIn("twitch")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-500 transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              Twitchでログイン
            </button>
            <span className="text-xs text-gray-500">ログインすると投稿・いいねができます</span>
          </div>
        )}
      </div>

      {/* Description (always visible when templates exist) */}
      {templates.length > 0 && (
        <p className="text-xs text-gray-500 mb-4">
          他のユーザーの設定をワンクリックで自分のエモートに適用できます。
          {!session?.user && " ログインすると投稿・いいねができます。"}
        </p>
      )}

      {/* Sort tabs */}
      <div className="flex gap-2 mb-4">
        {([["new", "新着"], ["popular", "人気"]] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sort === value
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTag(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTag === null
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700"
          }`}
        >
          すべて
        </button>
        {TEMPLATE_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTag === tag
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {templates.length === 0 && !loading ? (
        <div className="py-8 space-y-8">
          {/* What is a template? */}
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-bold text-lg">テンプレートとは？</h2>
            <div className="space-y-2.5">
              <p className="text-gray-300 text-sm">
                あなたのエモート設定を共有できる機能です。
              </p>
              <p className="text-gray-400 text-sm">
                画像は共有されません。フチ・アニメーション・テキストなどの設定値だけが共有されます。
              </p>
              <p className="text-gray-400 text-sm">
                他のユーザーがあなたの設定を自分の画像にワンクリックで適用できます。
              </p>
            </div>
          </div>

          {/* What you can do */}
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 space-y-2.5">
            <h3 className="text-white font-bold text-sm mb-3">できること</h3>
            <p className="text-gray-300 text-sm">
              ログインなしでもエモート作成・テンプレート閲覧・適用は無料で使えます。
            </p>
            <p className="text-gray-400 text-sm">
              Twitchログインするとテンプレートの投稿といいねができます。
            </p>
          </div>

          {/* How to post */}
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6">
            <h3 className="text-white font-bold text-sm mb-4">投稿方法</h3>
            <div className="space-y-3">
              {[
                { step: "1", text: "エモートを作る" },
                { step: "2", text: "気に入ったら「テンプレートとして投稿」ボタンをクリック" },
                { step: "3", text: "タイトルとタグをつけて投稿" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                    {step}
                  </span>
                  <p className="text-gray-300 text-sm pt-0.5">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={onGoToCreator}
              className="px-6 py-3 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors"
            >
              エモートを作ってテンプレートを投稿する
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onApply={onApplyTemplate}
              onLike={handleLike}
              onDelete={handleDelete}
              currentUserId={session?.user?.id}
            />
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && templates.length > 0 && (
        <div className="flex justify-center py-6">
          <button
            onClick={() => fetchTemplates(false)}
            className="px-6 py-2.5 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors border border-gray-700"
          >
            もっと見る
          </button>
        </div>
      )}

      {showLoginModal && <LoginPromptModal onClose={() => setShowLoginModal(false)} />}
    </div>
  );
}

// --- TemplateCard (inline) ---

interface TemplateCardProps {
  template: Template;
  onApply: (config: EmoteConfig, credit?: { userName: string; userLogin?: string | null }) => void;
  onLike: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  currentUserId?: string;
}

function TemplateCard({ template, onApply, onLike, onDelete, currentUserId }: TemplateCardProps) {
  const summary = configToSummary(template.config);

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-100 truncate">{template.title}</h3>
          {template.likes_count >= 5 && (
            <span className="shrink-0 text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5">🏆 殿堂入り</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {template.user_image && (
            <a href={`https://twitch.tv/${template.user_login ?? template.user_name}`} target="_blank" rel="noopener noreferrer">
              <img src={template.user_image} alt="" className="w-5 h-5 rounded-full" />
            </a>
          )}
          <p className="text-xs text-gray-500">by <a href={`https://twitch.tv/${template.user_login ?? template.user_name}`} target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">{template.user_name}</a></p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 text-xs"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Config summary */}
      <p className="text-xs text-gray-400 leading-relaxed">{summary}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-700">
        <button
          onClick={() => onApply(template.config, { userName: template.user_name, userLogin: template.user_login })}
          className="flex-1 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-500 transition-colors whitespace-nowrap"
        >
          このテンプレートを使う
        </button>
        <button
          onClick={() => onLike(template.id)}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors border ${
            template.liked_by_me
              ? "bg-pink-600/20 border-pink-500/50 text-pink-400"
              : "bg-gray-800 border-gray-600 text-gray-400 hover:text-gray-200"
          }`}
        >
          <Heart className="w-3.5 h-3.5" fill={template.liked_by_me ? "currentColor" : "none"} />
          {template.likes_count}
        </button>
        {currentUserId === template.user_id && (
          <button
            onClick={() => onDelete(template.id)}
            className="px-2 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 transition-colors"
            title="削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
