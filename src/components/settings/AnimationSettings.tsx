"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { EmoteConfig, PartialEmoteConfig, AnimationType, ANIMATION_SPEED_OPTIONS, TRIAL_ANIMATIONS } from "@/types/emote";
import { ANIMATION_LIST, ANIMATION_CATEGORIES, ANIMATION_COUNT, type CatalogEntry, type AnimationCategory, type AnimationId } from "@/lib/animations/catalog";
import { resolvePicker, type PickerMode } from "@/lib/animations/picker";
import { loadFavorites, saveFavorites } from "@/lib/animations/favorites";
import { MAX_CONCURRENT_PREVIEWS, PREVIEW_SIZE, _previewCacheStats, acquirePreview, disposeCanvas, renderStaticFrame } from "@/lib/animations/preview";
import { _encodeQueueStats } from "@/lib/gif/encode";
import { inputCls, secondaryBtn, segmented, segmentedBtn, segmentedBtnActive } from "@/components/ui/classes";

/**
 * 「動き」 tab (09 §アニメーション選択): おすすめ 12 → すべて / お気に入り,
 * search over all 100 (never trapped inside おすすめ), category filter in the
 * detail row, 「動きなし」 always outside the list, live preview only for the
 * selected card + the hovered / focused one (max 2), paused offscreen, on a
 * hidden tab and under prefers-reduced-motion. Catalog ids, favorites storage
 * key, representative frames and pin/release are unchanged.
 */
interface AnimationSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  isPremium: boolean;
  onTrialLockClick?: (featureLabel: string) => void;
  /** Source for previews (null → label-only cards). */
  bgRemovedCanvas?: HTMLCanvasElement | null;
  /** False while the tab is hidden: no card plays. */
  active?: boolean;
}

export default function AnimationSettings({ config, onConfigChange, isPremium, onTrialLockClick, bgRemovedCanvas, active = true }: AnimationSettingsProps) {
  const [mode, setMode] = useState<PickerMode>("recommended");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AnimationCategory | "all">("all");
  const [favorites, setFavorites] = useState<Set<AnimationId>>(() => new Set());
  const [hovered, setHovered] = useState<AnimationId | null>(null);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const searchId = useId();
  const categoryId = useId();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
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

  const selectAnimation = useCallback((type: AnimationType) => onConfigChange({ animation: { type } }), [onConfigChange]);

  const isTrialAllowed = (id: string) => (TRIAL_ANIMATIONS as readonly string[]).includes(id);
  const isLocked = (entry: CatalogEntry) => !isPremium && !isTrialAllowed(entry.id);

  const picker = useMemo(() => resolvePicker({ mode, query, category, favorites }), [mode, query, category, favorites]);
  const availableCount = isPremium ? ANIMATION_COUNT : TRIAL_ANIMATIONS.length;

  const players = useMemo(() => {
    if (!active || !pageVisible || reducedMotion || !bgRemovedCanvas) return new Set<AnimationId>();
    const set = new Set<AnimationId>();
    // Both present and different → the last interaction (hover / focus) wins.
    if (hovered) set.add(hovered);
    if (config.animation.type !== "none" && set.size < MAX_CONCURRENT_PREVIEWS) set.add(config.animation.type as AnimationId);
    return set;
  }, [active, pageVisible, reducedMotion, bgRemovedCanvas, config.animation.type, hovered]);

  const selectedEntry = config.animation.type === "none" ? null : ANIMATION_LIST.find((a) => a.id === config.animation.type) ?? null;
  const hasQuery = query.trim().length > 0;
  const noneSelected = config.animation.type === "none";

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] md:text-[17px] font-bold">好きなリアクションを選ぶ</h2>
          <p className="text-[11px] md:text-[12px] text-studio-muted mt-1">迷ったら、おすすめから。</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-[6px] bg-[#2d2739] text-[#d3c3ee] whitespace-nowrap">
          {isPremium ? `${ANIMATION_COUNT}種類` : `利用可能 ${availableCount} / ${ANIMATION_COUNT}`}
        </span>
      </div>

      {/* scope */}
      <div className="flex gap-4 md:gap-5 mb-3.5 border-b border-[#35313c]" role="group" aria-label="表示する範囲">
        {([
          { id: "recommended", label: "おすすめ" },
          { id: "all", label: "すべて" },
          { id: "favorites", label: `☆ お気に入り${favorites.size ? ` (${favorites.size})` : ""}` },
        ] as { id: PickerMode; label: string }[]).map((m) => {
          const on = picker.scope === m.id && !(m.id === "all" && picker.widenedToAll && mode === "recommended");
          const pressed = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                setMode(m.id);
                resetFilters();
              }}
              className={`min-h-[40px] pb-2 text-[12px] md:text-[13px] border-b-2 -mb-px transition-colors ${
                pressed || on ? "text-studio-text border-studio-accent font-semibold" : "text-studio-muted border-transparent hover:text-studio-text"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* search + category */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">アニメーションを検索</label>
          <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-studio-muted text-[18px] leading-none">⌕</span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前や気分で検索：ハート、喜ぶ…"
            className={`${inputCls} pl-9 text-[12px]`}
          />
        </div>
        <div>
          <label htmlFor={categoryId} className="sr-only">アニメーションの分類</label>
          <select
            id={categoryId}
            value={category}
            onChange={(e) => setCategory(e.target.value as AnimationCategory | "all")}
            className={`${inputCls} sm:w-[130px] text-[11px] py-1.5`}
          >
            <option value="all">すべての分類</option>
            {ANIMATION_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* selection summary */}
      <div className="flex items-center justify-between gap-2 mb-3 text-[10px] md:text-[11px] text-studio-muted">
        <button
          type="button"
          onClick={() => selectAnimation("none")}
          aria-pressed={noneSelected}
          className={`min-h-[31px] px-3 py-1 rounded-[7px] border text-[10px] md:text-[11px] ${noneSelected ? "border-studio-accent text-studio-accent" : "border-[#504755] text-studio-text"}`}
        >
          動きなし
        </button>
        <span className="text-right" aria-live="polite">
          {picker.summary}
          {picker.widenedToAll && mode === "recommended" && <span className="block text-[#bdb1d6]">検索中は全 {ANIMATION_COUNT} 種類から探しています</span>}
        </span>
      </div>
      <p className="text-[11px] text-studio-muted mb-2 truncate">
        選択中: <span className="text-studio-text">{selectedEntry ? selectedEntry.label : "動きなし"}</span>
      </p>

      {/* grid */}
      {picker.entries.length === 0 ? (
        <div className="text-center py-7 px-2">
          <span aria-hidden className="text-[30px] text-studio-accent">⌕</span>
          {mode === "favorites" && favorites.size === 0 ? (
            <>
              <h3 className="text-[14px] font-bold mt-1">お気に入りを集めよう</h3>
              <p className="text-[12px] text-studio-muted my-2">カードの ☆ を押すと、ここにまとめられます。</p>
              <button type="button" onClick={() => setMode("recommended")} className={`${secondaryBtn} mt-2 min-h-[40px] text-[12px]`}>おすすめを見る</button>
            </>
          ) : (
            <>
              <h3 className="text-[14px] font-bold mt-1">見つかりませんでした</h3>
              <p className="text-[12px] text-studio-muted my-2">{mode === "favorites" ? "お気に入りの中には、この条件に合う動きがありません。" : "別の名前や気分で探してみてください。"}</p>
              <div className="flex justify-center gap-2 mt-2">
                {mode === "favorites" && hasQuery && (
                  <button type="button" onClick={() => setMode("all")} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>全 {ANIMATION_COUNT} 種類から探す</button>
                )}
                <button type="button" onClick={resetFilters} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>検索条件をリセット</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2" role="list" aria-label="アニメーション一覧">
          {picker.entries.map((entry) => (
            <AnimationCard
              key={entry.id}
              entry={entry}
              selected={config.animation.type === entry.id}
              locked={isLocked(entry)}
              favorite={favorites.has(entry.id)}
              playing={players.has(entry.id)}
              base={active ? bgRemovedCanvas ?? null : null}
              onSelect={() => (isLocked(entry) ? onTrialLockClick?.(entry.label) : selectAnimation(entry.id as AnimationType))}
              onToggleFavorite={() => toggleFavorite(entry.id)}
              onHover={(on) => setHovered(on ? entry.id : (h) => (h === entry.id ? null : h))}
            />
          ))}
        </div>
      )}

      {/* speed — keeps the selection; disabled (not hidden) for 動きなし */}
      <div className="flex flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-studio-stroke">
        <label className="text-[11px] md:text-[12px]" id="anim-speed-label">動きの速さ</label>
        <div className={segmented} role="group" aria-labelledby="anim-speed-label">
          {ANIMATION_SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onConfigChange({ animation: { speed: opt.value } })}
              disabled={noneSelected}
              aria-pressed={config.animation.speed === opt.value}
              className={`${segmentedBtn} min-h-[37px] px-2.5 md:px-3 ${config.animation.speed === opt.value ? segmentedBtnActive : ""}`}
            >
              {opt.value === "slow" ? "ゆっくり" : opt.value === "normal" ? "ふつう" : "はやい"}
            </button>
          ))}
        </div>
      </div>
      {reducedMotion && (
        <p className="text-[10px] text-studio-muted mt-2">OS の「視差効果を減らす」設定に従い、カードの自動再生を止めています。選ぶと「できあがり」で確認できます。</p>
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
      role="listitem"
      className={`relative rounded-[12px] border transition-colors ${
        selected ? "border-studio-accent bg-[#342c45]" : locked ? "border-[#2e2c36] bg-[#1f1f27]" : "border-[#373540] bg-[#24242d] hover:bg-[#302b39] hover:border-[#8e7ba6]"
      }`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {selected && <span aria-hidden className="absolute left-2 top-1 text-[10px] text-studio-accent">✓</span>}
      <button
        type="button"
        aria-pressed={selected}
        aria-disabled={locked || undefined}
        aria-label={locked ? `${entry.label}（フォローまたは合言葉で解放）` : entry.label}
        onClick={onSelect}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className="w-full min-h-[104px] md:min-h-[112px] px-1 pt-4 pb-2 flex flex-col items-center gap-1 rounded-[12px]"
      >
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          className={`w-[54px] h-[54px] rounded-[6px] checkerboard-fine ${locked ? "opacity-40" : ""}`}
          aria-hidden
        />
        <span className={`text-[11px] md:text-[12px] leading-tight text-center truncate w-full ${locked ? "text-studio-muted" : selected ? "text-studio-text" : "text-[#d8d1e2]"}`}>
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
        className={`absolute top-0 right-0 w-11 h-11 md:w-9 md:h-9 grid place-items-center text-[16px] rounded-[6px] ${favorite ? "text-[#ebce79]" : "text-[#96909e] hover:text-studio-text"}`}
      >
        {favorite ? "★" : "☆"}
      </button>
    </div>
  );
}
