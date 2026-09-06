"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmoteConfig, PartialEmoteConfig, AnimationType, ANIMATION_SPEED_OPTIONS, TRIAL_ANIMATIONS } from "@/types/emote";
import { ANIMATION_LIST, ANIMATION_CATEGORIES, ANIMATION_COUNT, filterAnimations, type CatalogEntry, type AnimationCategory, type AnimationId } from "@/lib/animations/catalog";
import { loadFavorites, saveFavorites } from "@/lib/animations/favorites";
import { MAX_CONCURRENT_PREVIEWS, PREVIEW_SIZE, _previewCacheStats, acquirePreview, disposeCanvas, renderStaticFrame } from "@/lib/animations/preview";
import { _encodeQueueStats } from "@/lib/gif/encode";

/**
 * Fixed-animation picker (コミット C): 100 presets, categories, search,
 * favorites (browser-local), live preview only for the selected card and the
 * card being hovered / focused (max 2 players, paused when hidden / offscreen /
 * prefers-reduced-motion).
 */
interface AnimationSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  isPremium: boolean;
  onTrialLockClick?: (featureLabel: string) => void;
  /** Source for previews (null → label-only cards). */
  bgRemovedCanvas?: HTMLCanvasElement | null;
}

type Cat = AnimationCategory | "all" | "favorites";

export default function AnimationSettings({ config, onConfigChange, isPremium, onTrialLockClick, bgRemovedCanvas }: AnimationSettingsProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Cat>("all");
  const [favorites, setFavorites] = useState<Set<AnimationId>>(() => new Set());
  const [hovered, setHovered] = useState<AnimationId | null>(null);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Favorites live in localStorage (external system): read after mount so the
  // server and first client render agree (no hydration mismatch).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // dev-only diagnostics for the preview cache (R2 §2 verification)
      const w = window as unknown as { __previewCacheStats?: typeof _previewCacheStats; __encodeQueueStats?: typeof _encodeQueueStats };
      w.__previewCacheStats = _previewCacheStats;
      w.__encodeQueueStats = _encodeQueueStats;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(loadFavorites());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onMq);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const toggleFavorite = useCallback((id: AnimationId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const selectAnimation = useCallback(
    (type: AnimationType) => onConfigChange({ animation: { type } }),
    [onConfigChange],
  );

  const isTrialAllowed = (id: string) => (TRIAL_ANIMATIONS as readonly string[]).includes(id);
  const isLocked = (entry: CatalogEntry) => !isPremium && !isTrialAllowed(entry.id);

  const visible = useMemo(() => filterAnimations({ query, category, favorites }), [query, category, favorites]);
  const availableCount = isPremium ? ANIMATION_COUNT : TRIAL_ANIMATIONS.length;

  // Which cards animate: the selected one + the hovered/focused one (max 2).
  const players = useMemo(() => {
    if (!pageVisible || reducedMotion || !bgRemovedCanvas) return new Set<AnimationId>();
    const set = new Set<AnimationId>();
    if (config.animation.type !== "none") set.add(config.animation.type as AnimationId);
    if (hovered && set.size < MAX_CONCURRENT_PREVIEWS) set.add(hovered);
    return set;
  }, [pageVisible, reducedMotion, bgRemovedCanvas, config.animation.type, hovered]);

  const selectedEntry = config.animation.type === "none" ? null : ANIMATION_LIST.find((a) => a.id === config.animation.type) ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">アニメーション</h3>
        <span className="text-[11px] text-gray-500">
          表示 {visible.length} / 利用可能 {availableCount} / 全 {ANIMATION_COUNT}
        </span>
      </div>

      {/* Search */}
      <label className="sr-only" htmlFor="anim-search">アニメーションを検索</label>
      <input
        id="anim-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="検索（例: ハート、登場、bow）"
        className="w-full mb-2 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
      />

      {/* Categories */}
      <div className="flex flex-wrap gap-1 mb-2" role="tablist" aria-label="カテゴリ">
        {([{ id: "all", label: "すべて" }, { id: "favorites", label: `★ お気に入り${favorites.size ? ` ${favorites.size}` : ""}` }, ...ANIMATION_CATEGORIES] as { id: Cat; label: string }[]).map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`px-2 py-1 rounded text-[11px] transition-colors ${category === c.id ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Current selection */}
      <div className="flex items-center gap-2 mb-2 text-xs">
        <button
          type="button"
          onClick={() => selectAnimation("none")}
          aria-pressed={config.animation.type === "none"}
          className={`px-2.5 py-1.5 rounded transition-colors ${config.animation.type === "none" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
        >
          なし（静止画）
        </button>
        <span className="text-gray-400 truncate">
          {selectedEntry ? `選択中: ${selectedEntry.label}` : "選択中: なし"}
        </span>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">
          {category === "favorites" ? "お気に入りはまだありません。カードの ★ で追加できます。" : "該当するアニメーションがありません"}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="アニメーション一覧">
          {visible.map((entry) => (
            <AnimationCard
              key={entry.id}
              entry={entry}
              selected={config.animation.type === entry.id}
              locked={isLocked(entry)}
              favorite={favorites.has(entry.id)}
              playing={players.has(entry.id)}
              base={bgRemovedCanvas ?? null}
              onSelect={() => (isLocked(entry) ? onTrialLockClick?.(entry.label) : selectAnimation(entry.id as AnimationType))}
              onToggleFavorite={() => toggleFavorite(entry.id)}
              onHover={(on) => setHovered(on ? entry.id : (h) => (h === entry.id ? null : h))}
            />
          ))}
        </div>
      )}

      {/* Speed */}
      <div
        className={`mt-3 transition-opacity duration-150 ${config.animation.type !== "none" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden={config.animation.type === "none"}
      >
        <label className="text-xs text-gray-400 block mb-1">速度</label>
        <div className="grid grid-cols-3 gap-2">
          {ANIMATION_SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onConfigChange({ animation: { speed: opt.value } })}
              tabIndex={config.animation.type === "none" ? -1 : 0}
              aria-pressed={config.animation.speed === opt.value}
              className={`px-3 py-1.5 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${config.animation.speed === opt.value ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {reducedMotion && (
        <p className="text-[11px] text-gray-500 mt-2">OS の「視差効果を減らす」設定に従い、カードの自動再生を止めています。</p>
      )}
    </div>
  );
}

interface CardProps {
  entry: CatalogEntry;
  selected: boolean;
  locked: boolean;
  favorite: boolean;
  playing: boolean;
  base: HTMLCanvasElement | null;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onHover: (on: boolean) => void;
}

function AnimationCard({ entry, selected, locked, favorite, playing, base, onSelect, onToggleFavorite, onHover }: CardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inView, setInView] = useState(false);

  // Only render previews for cards on screen.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { rootMargin: "64px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Static representative frame when not playing (R2 §3: entrance animations
  // are empty on frame 0, so each catalog entry names a frame that shows the
  // content); pinned frame loop (~12 fps) when playing (R2 §2).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !base || !inView) return;
    const ctx = el.getContext("2d")!;
    const draw = (frame: HTMLCanvasElement) => {
      ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      ctx.drawImage(frame, 0, 0);
    };
    if (!playing) {
      const f = renderStaticFrame(base, entry.id as AnimationType, entry.previewFrame ?? 0);
      draw(f);
      disposeCanvas(f);
      return;
    }
    const handle = acquirePreview(base, entry.id as AnimationType);
    let raf = 0;
    let last = 0;
    let idx = 0;
    const tick = (now: number) => {
      if (now - last >= 80) {
        const frame = handle.frames[idx % handle.frames.length];
        if (frame && frame.width > 0) draw(frame);
        idx++;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      handle.release();
    };
  }, [base, inView, playing, entry.id, entry.previewFrame]);

  return (
    <div
      className={`relative rounded border text-left transition-colors ${
        selected ? "border-purple-500 bg-purple-900/40" : locked ? "border-gray-800 bg-gray-800/60" : "border-gray-700 bg-gray-800 hover:bg-gray-700"
      }`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <button
        type="button"
        role="option"
        aria-selected={selected}
        aria-disabled={locked || undefined}
        onClick={onSelect}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        title={locked ? "フォローまたは合言葉で解放" : entry.label}
        className="w-full p-1.5 flex flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded"
      >
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          className={`w-10 h-10 md:w-12 md:h-12 rounded checkerboard ${locked ? "opacity-40" : ""}`}
          aria-hidden
        />
        <span className={`text-[11px] leading-tight text-center truncate w-full ${locked ? "text-gray-500" : selected ? "text-white" : "text-gray-300"}`}>
          {locked ? "🔒 " : ""}{entry.label}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={favorite ? `${entry.label} をお気に入りから外す` : `${entry.label} をお気に入りに追加`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`absolute top-0.5 right-0.5 text-sm leading-none px-1 rounded ${favorite ? "text-yellow-300" : "text-gray-600 hover:text-gray-300"}`}
      >
        {favorite ? "★" : "☆"}
      </button>
    </div>
  );
}
