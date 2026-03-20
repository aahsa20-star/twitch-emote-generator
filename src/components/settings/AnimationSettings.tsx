"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  EmoteConfig,
  PartialEmoteConfig,
  AnimationType,
  ANIMATION_OPTIONS,
  ANIMATION_SPEED_OPTIONS,
} from "@/types/emote";
import PublishAnimationModal from "@/components/PublishAnimationModal";

const DAILY_LIMIT = 5;

interface CustomAnimation {
  id: string;
  user_id: string;
  user_name: string;
  user_login: string;
  user_image: string | null;
  name: string;
  description: string;
  code: string;
  likes_count: number;
  liked_by_me?: boolean;
  created_at: string;
}

interface AnimationSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  isSubscriber: boolean;
  isLoggedIn: boolean;
  onLoginRequired?: () => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
}

export default function AnimationSettings({
  config,
  onConfigChange,
  isSubscriber,
  isLoggedIn,
  onLoginRequired,
  bgRemovedCanvas,
}: AnimationSettingsProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiGeneratedCode, setAiGeneratedCode] = useState<string | null>(null);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiRemainingLoading, setAiRemainingLoading] = useState(false);

  // Publish modal & toasts
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishToast, setPublishToast] = useState(false);
  const [deleteToast, setDeleteToast] = useState(false);

  // Community animations
  const [communityAnimations, setCommunityAnimations] = useState<CustomAnimation[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityOffset, setCommunityOffset] = useState(0);
  const [communityHasMore, setCommunityHasMore] = useState(true);
  const [communityLoaded, setCommunityLoaded] = useState(false);

  // Clean up object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    };
  }, [aiPreviewUrl]);

  // Fetch remaining count when AI panel opens (logged in only)
  useEffect(() => {
    if (showAiPanel && isLoggedIn && aiRemaining === null && !aiRemainingLoading) {
      setAiRemainingLoading(true);
      fetch("/api/generate-animation")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setAiRemaining(data.remaining);
        })
        .catch(() => {})
        .finally(() => setAiRemainingLoading(false));
    }
  }, [showAiPanel, isLoggedIn, aiRemaining, aiRemainingLoading]);

  // Fetch community animations when logged in (once)
  useEffect(() => {
    if (isLoggedIn && !communityLoaded) {
      setCommunityLoaded(true);
      setCommunityLoading(true);
      fetch("/api/custom-animations?sort=popular&limit=20&offset=0")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: CustomAnimation[]) => {
          setCommunityAnimations(data);
          setCommunityOffset(data.length);
          setCommunityHasMore(data.length >= 20);
        })
        .catch(() => {})
        .finally(() => setCommunityLoading(false));
    }
  }, [isLoggedIn, communityLoaded]);

  const loadMoreCommunity = useCallback(async () => {
    if (communityLoading || !communityHasMore) return;
    setCommunityLoading(true);
    try {
      const res = await fetch(`/api/custom-animations?sort=popular&limit=20&offset=${communityOffset}`);
      if (res.ok) {
        const data: CustomAnimation[] = await res.json();
        setCommunityAnimations((prev) => [...prev, ...data]);
        setCommunityOffset((prev) => prev + data.length);
        setCommunityHasMore(data.length >= 20);
      }
    } catch {}
    setCommunityLoading(false);
  }, [communityLoading, communityHasMore, communityOffset]);

  const handleCommunityDelete = useCallback(async (animationId: string) => {
    if (!confirm("このアニメーションを削除しますか？")) return;
    const res = await fetch(`/api/custom-animations/${animationId}`, { method: "DELETE" });
    if (res.ok) {
      setCommunityAnimations((prev) => prev.filter((a) => a.id !== animationId));
      setDeleteToast(true);
      setTimeout(() => setDeleteToast(false), 3000);
    }
  }, []);

  const handleCommunityLike = useCallback(async (animationId: string) => {
    const res = await fetch(`/api/custom-animations/${animationId}/like`, { method: "POST" });
    if (res.ok) {
      const { liked, likes_count } = await res.json();
      setCommunityAnimations((prev) =>
        prev.map((a) => (a.id === animationId ? { ...a, liked_by_me: liked, likes_count } : a))
      );
    }
  }, []);

  const handleCommunityReport = useCallback(async (animationId: string) => {
    if (!confirm("このアニメーションを通報しますか？")) return;
    const res = await fetch(`/api/custom-animations/${animationId}/report`, { method: "POST" });
    if (res.ok) {
      setCommunityAnimations((prev) => prev.filter((a) => a.id !== animationId));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "通報に失敗しました");
    }
  }, []);

  const handleCommunityUse = useCallback(
    (animation: CustomAnimation) => {
      onConfigChange({
        animation: {
          type: "ai-custom" as AnimationType,
          speed: config.animation.speed,
          aiAnimationCode: animation.code,
        },
      });
    },
    [config.animation.speed, onConfigChange]
  );

  const handleAiGenerate = useCallback(async () => {
    if (!aiDescription.trim() || !bgRemovedCanvas) return;

    setAiLoading(true);
    setAiError(null);
    if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    setAiPreviewUrl(null);
    setAiGeneratedCode(null);

    try {
      // Step 1: Call API to generate code
      setAiStatus("AIが考え中...");
      const res = await fetch("/api/generate-animation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "エラーが発生しました" }));
        if (res.status === 429) {
          throw new Error("本日の生成回数（5回）を超えました。明日また試してください");
        } else if (res.status === 401) {
          throw new Error("ログインが必要です");
        }
        throw new Error(data.error || "生成に失敗しました。もう一度お試しください");
      }

      const { code } = await res.json();
      setAiGeneratedCode(code);

      // Step 2: Extract 256x256 ImageData from bgRemovedCanvas
      setAiStatus("フレームを生成中...");
      const extractCanvas = document.createElement("canvas");
      extractCanvas.width = 256;
      extractCanvas.height = 256;
      const extractCtx = extractCanvas.getContext("2d")!;
      extractCtx.drawImage(bgRemovedCanvas, 0, 0, 256, 256);
      const baseImageData = extractCtx.getImageData(0, 0, 256, 256);
      extractCanvas.width = 0;
      extractCanvas.height = 0;

      // Step 3: Generate all frames in sandbox
      const { generateAllFrames, framesToGif } = await import("@/lib/animationSandbox");
      const frames = await generateAllFrames(code, baseImageData, 20);

      // Step 4: Convert to GIF
      setAiStatus("GIFを生成中...");
      const gifBlob = await framesToGif(frames, 256, 50);
      const url = URL.createObjectURL(gifBlob);
      setAiPreviewUrl(url);
      setAiStatus(null);

      // Decrement remaining count
      setAiRemaining((prev) => (prev !== null ? prev - 1 : null));
    } catch (err) {
      if (err instanceof Error && err.message.includes("アニメーションの実行")) {
        setAiError("アニメーションの実行に失敗しました。別の説明で試してください");
      } else {
        setAiError(err instanceof Error ? err.message : "生成に失敗しました。もう一度お試しください");
      }
      setAiStatus(null);
    } finally {
      setAiLoading(false);
    }
  }, [aiDescription, bgRemovedCanvas, aiPreviewUrl]);

  const handleAiApply = useCallback(() => {
    if (!aiGeneratedCode) return;
    onConfigChange({
      animation: {
        type: "ai-custom" as AnimationType,
        speed: config.animation.speed,
        aiAnimationCode: aiGeneratedCode,
      },
    });
  }, [aiGeneratedCode, config.animation.speed, onConfigChange]);

  const handleAiToggle = useCallback(() => {
    setShowAiPanel((v) => !v);
  }, []);

  const handlePublishSuccess = useCallback(() => {
    setShowPublishModal(false);
    setPublishToast(true);
    setTimeout(() => setPublishToast(false), 4000);
    // Refresh community list
    setCommunityLoaded(false);
  }, []);

  // Helper: select a normal animation (clears aiAnimationCode)
  const selectAnimation = useCallback(
    (type: AnimationType) => {
      onConfigChange({ animation: { type, aiAnimationCode: undefined } });
    },
    [onConfigChange]
  );

  const isAiCustomActive = config.animation.type === "ai-custom";

  return (
    <div>
      {/* Toasts */}
      {deleteToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-fade-in">
          削除しました
        </div>
      )}
      {publishToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-cyan-600/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-fade-in">
          公開しました! みんなのアニメーションに追加されました
        </div>
      )}

      <h3 className="text-sm font-semibold text-gray-300 mb-2">
        アニメーション
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {ANIMATION_OPTIONS.filter((o) => !o.subscriberOnly && !o.loginOnly).map((opt) => (
          <button
            key={opt.value}
            onClick={() => selectAnimation(opt.value)}
            className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors truncate ${
              config.animation.type === opt.value
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Login-only animations */}
      {ANIMATION_OPTIONS.some((o) => o.loginOnly) && (
        <>
          <p className="text-xs text-gray-500 mt-3 mb-1">ログイン限定</p>
          <div className="grid grid-cols-2 gap-2">
            {ANIMATION_OPTIONS.filter((o) => o.loginOnly).map((opt) => {
              const unlocked = isLoggedIn || isSubscriber;
              const isActiveFromTemplate = !unlocked && config.animation.type === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (unlocked) {
                      selectAnimation(opt.value);
                    } else {
                      onLoginRequired?.();
                    }
                  }}
                  className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors truncate ${
                    isActiveFromTemplate
                      ? "bg-purple-900 text-purple-300 border border-purple-500 cursor-not-allowed"
                      : unlocked && config.animation.type === opt.value
                      ? "bg-purple-600 text-white"
                      : unlocked
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}
                  title={isActiveFromTemplate ? "テンプレートから適用中。ログインすると変更できます" : !unlocked ? "Twitchログインで解放" : undefined}
                >
                  {isActiveFromTemplate ? `🔒 ${opt.label}` : opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Subscriber-only animations */}
      {ANIMATION_OPTIONS.some((o) => o.subscriberOnly) && (
        <>
          <p className="text-xs text-gray-500 mt-3 mb-1">限定</p>
          <div className="grid grid-cols-2 gap-2">
            {ANIMATION_OPTIONS.filter((o) => o.subscriberOnly).map((opt) => {
              const locked = !isSubscriber;
              const isActiveFromTemplate = locked && config.animation.type === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => !locked && selectAnimation(opt.value)}
                  className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors truncate ${
                    isActiveFromTemplate
                      ? "bg-purple-900 text-purple-300 border border-purple-500 cursor-not-allowed"
                      : locked
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : config.animation.type === opt.value
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  title={isActiveFromTemplate ? "テンプレートから適用中。変更するには合言葉が必要です" : locked ? "合言葉を入力すると解放されます" : undefined}
                >
                  {isActiveFromTemplate ? `🔒 ${opt.label}` : opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* AI Animation Generator (Beta) */}
      <div className="mt-3">
        <button
          onClick={handleAiToggle}
          className={`w-full px-3 py-2 rounded text-sm transition-colors border ${
            isAiCustomActive
              ? "border-cyan-400 bg-cyan-600/30 text-cyan-200"
              : showAiPanel
              ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
              : "border-gray-600 bg-gray-800 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400"
          }`}
        >
          {isAiCustomActive ? "AIアニメーション適用中" : "AIで作る（ベータ）"}
        </button>

        {showAiPanel && (
          <div className="mt-2 p-3 bg-gray-800/80 rounded-lg border border-gray-700 space-y-2">
            {!isLoggedIn ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-300">
                  テキストで説明するだけで、AIがオリジナルアニメーションを生成します。
                </p>
                <p className="text-xs text-yellow-400">
                  Twitchログインが必要です。ログイン後に画像をアップロードしてください。
                </p>
                <button
                  onClick={() => onLoginRequired?.()}
                  className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-500 transition-colors"
                >
                  Twitchでログイン
                </button>
              </div>
            ) : (
              <>
                {isAiCustomActive && (
                  <div className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-600/10 px-2 py-1 rounded">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    AI生成アニメーション適用中
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  アニメーションの動きを説明してください（日本語OK）
                </p>
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="例: 虹色に光りながら左右にバウンドする"
                  maxLength={200}
                  rows={2}
                  className="w-full px-2 py-1.5 rounded bg-gray-700 text-gray-100 text-sm placeholder-gray-500 border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {aiDescription.length}/200
                  </span>
                  {aiRemaining !== null && (
                    <span className={`text-xs ${aiRemaining > 0 ? "text-gray-500" : "text-red-400"}`}>
                      残り {aiRemaining}/{DAILY_LIMIT} 回（本日）
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAiGenerate}
                  disabled={aiLoading || !aiDescription.trim() || !bgRemovedCanvas || aiRemaining === 0}
                  className="w-full px-3 py-1.5 rounded bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiLoading
                    ? "生成中..."
                    : aiPreviewUrl
                    ? `再生成${aiRemaining !== null ? `（残り${aiRemaining}回）` : ""}`
                    : "生成する"}
                </button>
                {!bgRemovedCanvas && (
                  <p className="text-xs text-yellow-400">
                    先に画像をアップロードしてください
                  </p>
                )}
              </>
            )}
            {aiStatus && (
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
                {aiStatus}
              </div>
            )}
            {aiError && (
              <p className="text-xs text-red-400">{aiError}</p>
            )}
            {aiPreviewUrl && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-gray-400">プレビュー:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={aiPreviewUrl}
                  alt="AI生成アニメーション"
                  className="w-32 h-32 rounded border border-gray-600 bg-gray-900"
                />
                <div className="flex flex-col gap-1.5 w-full">
                  <button
                    onClick={handleAiApply}
                    className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                      isAiCustomActive
                        ? "bg-cyan-700 text-cyan-200 cursor-default"
                        : "bg-cyan-600 text-white hover:bg-cyan-500"
                    }`}
                  >
                    {isAiCustomActive ? "適用済み" : "このアニメーションを使う"}
                  </button>
                  <button
                    onClick={() => setShowPublishModal(true)}
                    className="w-full px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    公開する
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Community Animations — logged in only */}
      {isLoggedIn && communityAnimations.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">みんなのアニメーション</p>
          <div className="space-y-2">
            {communityAnimations.map((anim) => (
              <div
                key={anim.id}
                className="p-2.5 bg-gray-800 rounded-lg border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm text-gray-200 font-medium truncate">
                    {anim.name}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {currentUserId === anim.user_id && (
                      <button
                        onClick={() => handleCommunityDelete(anim.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                        title="削除する"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    {currentUserId !== anim.user_id && (
                      <button
                        onClick={() => handleCommunityReport(anim.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                        title="通報する"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <a
                    href={`https://twitch.tv/${anim.user_login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-400 transition-colors truncate"
                  >
                    {anim.user_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={anim.user_image} alt="" className="w-6 h-6 rounded-full shrink-0" />
                    )}
                    {anim.user_name}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCommunityLike(anim.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      anim.liked_by_me
                        ? "bg-pink-600/20 text-pink-400"
                        : "bg-gray-700 text-gray-400 hover:text-pink-400"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill={anim.liked_by_me ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {anim.likes_count}
                  </button>
                  <button
                    onClick={() => handleCommunityUse(anim)}
                    className="flex-1 px-2 py-1 rounded text-xs bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 transition-colors text-center"
                  >
                    使う
                  </button>
                </div>
              </div>
            ))}
          </div>
          {communityHasMore && (
            <button
              onClick={loadMoreCommunity}
              disabled={communityLoading}
              className="w-full mt-2 px-3 py-1.5 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {communityLoading ? "読み込み中..." : "もっと見る"}
            </button>
          )}
        </div>
      )}

      {/* Animation speed — always rendered to prevent layout shift */}
      <div
        className={`mt-3 transition-opacity duration-150 ${
          config.animation.type !== "none"
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={config.animation.type === "none"}
      >
        <label className="text-xs text-gray-400 block mb-1">速度</label>
        <div className="grid grid-cols-3 gap-2">
          {ANIMATION_SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onConfigChange({ animation: { speed: opt.value } })}
              tabIndex={config.animation.type === "none" ? -1 : 0}
              className={`px-3 py-1.5 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                config.animation.speed === opt.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Publish Modal */}
      {showPublishModal && aiGeneratedCode && (
        <PublishAnimationModal
          description={aiDescription}
          code={aiGeneratedCode}
          onClose={() => setShowPublishModal(false)}
          onSuccess={handlePublishSuccess}
        />
      )}
    </div>
  );
}
