"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  EmoteConfig,
  PartialEmoteConfig,
  EmoteVariant,
  ProcessingStage,
  ExportMode,
  BgRemovalQuality,
  EMOTE_SIZES,
  DISCORD_SIZES,
  SEVENTV_SIZES,
  TEXT_PRESETS,
  DEFAULT_BADGE_SETTINGS,
} from "@/types/emote";
import { removeBackground } from "@/lib/backgroundRemoval";
import { processEmote, processEmoteWithHiRes, processFrameWithBounds, computeUnionBounds, type Bounds } from "@/lib/canvasPipeline";
import { generateGif } from "@/lib/gifEncoder";
import { exportAsZip } from "@/lib/zipExporter";
import { decodeGif, releaseDecodedGif, MAX_FRAMES, type DecodedGif } from "@/lib/gif/decoder";
import { encodeAnimatedGif } from "@/lib/gif/animatedEncoder";
import { releaseDecodedVideo, type DecodedVideo } from "@/lib/video/decoder";

export function useEmoteProcessor(exportMode: ExportMode = "twitch", subCanvas: HTMLCanvasElement | null = null) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [bgRemovedCanvas, setBgRemovedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [skipBgRemoval, setSkipBgRemoval] = useState(false);
  const [bgRemovalQuality, setBgRemovalQuality] = useState<BgRemovalQuality>("speed");
  const [bgRemovedBlob, setBgRemovedBlob] = useState<Blob | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [config, setConfig] = useState<EmoteConfig>({
    outline: { style: "none", width: 4, color: "#ffffff" },
    frame: { type: "none" },
    subImage: { mode: "none", scale: 38, offsetX: 0, offsetY: 0 },
    text: {
      preset: null,
      customText: "",
      font: "Noto Sans JP",
      fillColor: "#ffffff",
      strokeColor: "#000000",
      position: "bottom",
      fontSize: 20,
      offsetX: 0,
      offsetY: 0,
      outlineWidth: 3,
    },
    animation: { type: "none", speed: "normal" },
    badge: { ...DEFAULT_BADGE_SETTINGS },
    padding: 0.05,
    contentOffsetX: 0,
    contentOffsetY: 0,
    contentScale: 1.0,
  });
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState(0);
  const [variants, setVariants] = useState<EmoteVariant[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gifSource, setGifSourceState] = useState<DecodedGif | null>(null);
  const [gifNotice, setGifNotice] = useState<string | null>(null);
  const [videoSource, setVideoSourceState] = useState<DecodedVideo | null>(null);

  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variantsRef = useRef<EmoteVariant[]>([]);
  const bgRemovalCancelledRef = useRef(false);
  const gifSourceRef = useRef<DecodedGif | null>(null);
  const videoSourceRef = useRef<DecodedVideo | null>(null);

  // Load image as canvas (shared helper)
  const fileToCanvas = useCallback(async (file: File): Promise<HTMLCanvasElement> => {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return canvas;
  }, []);

  /** Replace gifSource state and free the previous one. */
  const setGifSource = useCallback((next: DecodedGif | null) => {
    if (gifSourceRef.current && gifSourceRef.current !== next) {
      releaseDecodedGif(gifSourceRef.current);
    }
    gifSourceRef.current = next;
    setGifSourceState(next);
  }, []);

  /** Replace videoSource state and free the previous one. Caller should
   *  also set bgRemovedCanvas to a copy of frame 0 so the render effect
   *  fires (it keys off bgRemovedCanvas). */
  const setVideoSource = useCallback((next: DecodedVideo | null) => {
    if (videoSourceRef.current && videoSourceRef.current !== next) {
      releaseDecodedVideo(videoSourceRef.current);
    }
    videoSourceRef.current = next;
    setVideoSourceState(next);
  }, []);

  /** Hand a freshly-decoded video to the hook: clears any conflicting
   *  source, sets bgRemovedCanvas to a copy of frame 0 (so the existing
   *  render effect fires), and stores the frames for the per-frame
   *  pipeline. Used by VideoTrimmer's onConfirm. */
  const ingestVideoSource = useCallback((decoded: DecodedVideo) => {
    setGifSource(null);
    setGifNotice(null);
    setVideoSource(decoded);

    const first = decoded.frames[0];
    const firstCopy = document.createElement("canvas");
    firstCopy.width = first.width;
    firstCopy.height = first.height;
    firstCopy.getContext("2d")!.drawImage(first, 0, 0);
    setBgRemovedCanvas(firstCopy);
  }, [setGifSource, setVideoSource]);

  // Effect 1: Background removal (or skip) when source changes
  useEffect(() => {
    if (!sourceFile) return;
    bgRemovalCancelledRef.current = false;
    let cancelled = false;

    async function process() {
      setVariants([]);
      variantsRef.current = [];

      // Video source: VideoTrimmer owns the decode (it needs user trim/fps
      // input first), so the hook just parks here. The trimmer calls
      // ingestVideoSource() once frames are ready, which sets bgRemovedCanvas
      // and unblocks the render effect.
      if (sourceFile!.type.startsWith("video/")) {
        setGifSource(null);
        setGifNotice(null);
        setVideoSource(null);
        setBgRemovedCanvas(null);
        setStage("idle");
        return;
      }

      // GIF source: decode all frames and route to the animated pipeline.
      // Skip bg removal entirely (running it per-frame is too slow for
      // animated input, and most GIFs already have transparency).
      // Single-frame GIFs fall through to the static path so users still
      // get bg removal + brush editing — the file extension lies about its
      // animated-ness.
      let staticBlobOverride: Blob | null = null;
      if (sourceFile!.type === "image/gif") {
        setGifNotice(null);
        setStage("processing");
        try {
          const decoded = await decodeGif(sourceFile!);
          if (cancelled) {
            releaseDecodedGif(decoded);
            return;
          }

          if (decoded.frames.length > 1) {
            setGifSource(decoded);
            // Set bgRemovedCanvas to a copy of the first frame so any UI that
            // depends on it (preview thumbnails, gallery hover) has something
            // to render. The animated pipeline ignores this canvas.
            const first = decoded.frames[0];
            const firstCopy = document.createElement("canvas");
            firstCopy.width = first.width;
            firstCopy.height = first.height;
            firstCopy.getContext("2d")!.drawImage(first, 0, 0);
            setBgRemovedCanvas(firstCopy);

            if (decoded.originalFrameCount > decoded.frames.length) {
              setGifNotice(`${decoded.originalFrameCount}フレーム → ${decoded.frames.length}フレームに削減しました（Twitch上限対応）`);
            }
            return;
          }

          // Single-frame GIF → snapshot frame as a PNG and feed it through
          // the static pipeline (so bg removal + brush still work).
          const onlyFrame = decoded.frames[0];
          staticBlobOverride = await new Promise<Blob>((resolve, reject) => {
            onlyFrame.toBlob(
              (b) => b ? resolve(b) : reject(new Error("toBlob returned null")),
              "image/png"
            );
          });
          releaseDecodedGif(decoded);
          if (cancelled) return;
        } catch (err) {
          console.error("GIF decode failed:", err);
          if (!cancelled) {
            setErrorMessage("GIFの読み込みに失敗しました。別のファイルをお試しください");
            setTimeout(() => setErrorMessage(null), 5000);
            setStage("idle");
          }
          return;
        }
      }

      // Non-GIF path (or single-frame GIF flattened to PNG): clear any previous
      // animated sources, fall through to the existing static-image flow.
      setGifSource(null);
      setGifNotice(null);
      setVideoSource(null);

      // Store original blob for BrushEditor restore brush. For single-frame
      // GIFs we use the flattened PNG so the brush editor sees the same pixels
      // the user sees on screen.
      const origBlob = staticBlobOverride
        ?? new Blob([await sourceFile!.arrayBuffer()], { type: sourceFile!.type });
      if (!cancelled) setOriginalBlob(origBlob);

      if (skipBgRemoval) {
        // Skip: use original image directly (or the flattened PNG for single-frame GIF)
        setStage("processing");
        try {
          const canvasFile = staticBlobOverride
            ? new File([staticBlobOverride], "frame.png", { type: "image/png" })
            : sourceFile!;
          const canvas = await fileToCanvas(canvasFile);
          if (!cancelled && !bgRemovalCancelledRef.current) {
            setBgRemovedCanvas(canvas);
          }
        } catch (err) {
          console.error("Image loading failed:", err);
          if (!cancelled) setStage("idle");
        }
        return;
      }

      setStage("removing-background");
      setProgress(0);

      try {
        const resultBlob = await removeBackground(origBlob, (p) => {
          if (!cancelled && !bgRemovalCancelledRef.current) setProgress(p);
        }, bgRemovalQuality);
        if (cancelled || bgRemovalCancelledRef.current) return;

        // Store bg-removed blob for BrushEditor, transition to brush-editing
        setBgRemovedBlob(resultBlob);
        setStage("brush-editing");
      } catch (err) {
        console.error("Background removal failed:", err);
        if (!cancelled && !bgRemovalCancelledRef.current) {
          setErrorMessage("背景透過に失敗しました。別の画像をお試しください");
          setTimeout(() => setErrorMessage(null), 5000);
          setStage("idle");
        }
      }
    }

    process();
    return () => {
      cancelled = true;
    };
  }, [sourceFile, skipBgRemoval, bgRemovalQuality, fileToCanvas, setGifSource, setVideoSource]);

  // Effect 2: Render previews when bgRemovedCanvas or config changes
  useEffect(() => {
    if (!bgRemovedCanvas) return;

    // Debounce rendering
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // 150ms debounce: prevents excessive re-renders during drag/scroll adjustments
    renderTimeoutRef.current = setTimeout(() => {
      let cancelled = false;

      async function render() {
        // Only show "processing" spinner on initial render (no existing variants).
        // Re-renders from config changes (drag, slider) keep existing preview visible to prevent layout shift.
        if (stageDelayRef.current) clearTimeout(stageDelayRef.current);
        if (variantsRef.current.length === 0) {
          stageDelayRef.current = setTimeout(() => {
            if (!cancelled) setStage("processing");
          }, 300);
        }

        const newVariants: EmoteVariant[] = [];

        try {
          // Ensure fonts are loaded before Canvas text rendering
          await document.fonts.ready;

          const sizes =
            exportMode === "discord" || exportMode === "ffz" ? DISCORD_SIZES :
            exportMode === "7tv" ? SEVENTV_SIZES :
            EMOTE_SIZES; // twitch, bttv

          // Animated source (GIF or video): process every decoded frame through
          // the pipeline and re-encode at each output size. The configured
          // `animation.type` is intentionally ignored here — the source *is*
          // the animation.
          const animated = gifSource ?? videoSource;
          if (animated) {
            // Compute the union content bounds once so every frame shares the
            // same center/scale transform (no jitter as the subject moves).
            const bounds: Bounds = computeUnionBounds(animated.frames);

            for (const size of sizes) {
              if (cancelled) return;
              setStage("generating-preview");

              // Run pipeline on each frame at output size.
              const processedFrames: HTMLCanvasElement[] = [];
              for (const frame of animated.frames) {
                processedFrames.push(processFrameWithBounds(frame, size, config, bounds));
              }
              if (cancelled) {
                for (const f of processedFrames) { f.width = 0; f.height = 0; }
                return;
              }

              const animatedBlob = await encodeAnimatedGif(processedFrames, animated.delays, size);

              // Static preview = first processed frame as PNG data URL.
              const staticDataUrl = processedFrames[0].toDataURL("image/png");

              // Free per-frame canvases now that they're encoded into the blob.
              for (const f of processedFrames) { f.width = 0; f.height = 0; }

              newVariants.push({
                size,
                staticDataUrl,
                animatedBlob,
                filename: `emote_${size}px.gif`,
              });
            }

            if (!cancelled) {
              if (stageDelayRef.current) clearTimeout(stageDelayRef.current);
              setVariants(newVariants);
              variantsRef.current = newVariants;
              setStage("ready");
            }
            return;
          }

          // If animation enabled, build a shared hi-res canvas for GIF frame generation
          const needsAnimation = config.animation.type !== "none";
          let sharedHiRes: HTMLCanvasElement | null = null;
          if (needsAnimation) {
            // Generate a 256px hi-res canvas for animation frames (separate from PNG pipeline)
            const hiResResult = processEmoteWithHiRes(bgRemovedCanvas!, 256, config, subCanvas ?? undefined);
            sharedHiRes = hiResResult.hiRes;
            // Release the downscaled output (we don't need it; PNG uses processEmote at HI_RES=224)
            if (hiResResult.output !== hiResResult.hiRes) {
              hiResResult.output.width = 0;
              hiResResult.output.height = 0;
            }
          }

          for (const size of sizes) {
            const canvas = processEmote(bgRemovedCanvas!, size, config, subCanvas ?? undefined);
            const staticDataUrl = canvas.toDataURL("image/png");

            let animatedBlob: Blob | null = null;
            if (needsAnimation) {
              if (!cancelled) setStage("generating-preview");
              animatedBlob = await generateGif(canvas, config.animation.type, size, config.animation.speed, sharedHiRes ?? undefined, config.animation.aiAnimationCode);
            }

            if (cancelled) return;

            const ext = animatedBlob ? "gif" : "png";

            newVariants.push({
              size,
              staticDataUrl,
              animatedBlob,
              filename: `emote_${size}px.${ext}`,
            });
          }

          // Release shared hi-res canvas after all sizes are generated
          if (sharedHiRes) {
            sharedHiRes.width = 0;
            sharedHiRes.height = 0;
            sharedHiRes = null;
          }

          if (!cancelled) {
            if (stageDelayRef.current) clearTimeout(stageDelayRef.current);
            setVariants(newVariants);
            variantsRef.current = newVariants;
            setStage("ready");
          }
        } catch (err) {
          console.error("Rendering failed:", err);
          if (!cancelled) {
            if (stageDelayRef.current) clearTimeout(stageDelayRef.current);
            setStage("ready");
          }
        }
      }

      render();

      return () => {
        cancelled = true;
      };
    }, 150);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      if (stageDelayRef.current) {
        clearTimeout(stageDelayRef.current);
      }
    };
  }, [bgRemovedCanvas, config, sourceFile, exportMode, subCanvas, gifSource, videoSource]);

  // Convert blob to canvas helper
  const blobToCanvas = useCallback(async (blob: Blob): Promise<HTMLCanvasElement> => {
    const file = new File([blob], "temp.png", { type: "image/png" });
    return fileToCanvas(file);
  }, [fileToCanvas]);

  // BrushEditor confirm: use adjusted blob
  const handleBrushConfirm = useCallback(async (adjustedBlob: Blob) => {
    try {
      const canvas = await blobToCanvas(adjustedBlob);
      setBgRemovedCanvas(canvas);
    } catch (err) {
      console.error("Brush confirm failed:", err);
      setStage("idle");
    }
  }, [blobToCanvas]);

  // BrushEditor skip: use bg-removed result as-is
  const handleBrushSkip = useCallback(async () => {
    if (!bgRemovedBlob) return;
    try {
      const canvas = await blobToCanvas(bgRemovedBlob);
      setBgRemovedCanvas(canvas);
    } catch (err) {
      console.error("Brush skip failed:", err);
      setStage("idle");
    }
  }, [bgRemovedBlob, blobToCanvas]);

  // Cancel ongoing background removal
  const cancelBgRemoval = useCallback(async () => {
    bgRemovalCancelledRef.current = true;
    if (!sourceFile) return;

    // Fall back to original image
    try {
      const canvas = await fileToCanvas(sourceFile);
      setBgRemovedCanvas(canvas);
      setSkipBgRemoval(true);
    } catch {
      setStage("idle");
    }
  }, [sourceFile, fileToCanvas]);

  // Retry background removal
  const retryBgRemoval = useCallback(() => {
    if (!sourceFile) return;
    setSkipBgRemoval(false);
    setBgRemovedCanvas(null);
    // Force re-trigger by setting source file again
    setSourceFile(Object.assign(new File([sourceFile], sourceFile.name, { type: sourceFile.type }), {}));
  }, [sourceFile]);

  // Use original image (skip bg removal after it was already done)
  const useOriginalImage = useCallback(async () => {
    if (!sourceFile) return;
    setSkipBgRemoval(true);
    try {
      const canvas = await fileToCanvas(sourceFile);
      setBgRemovedCanvas(canvas);
    } catch {
      setStage("idle");
    }
  }, [sourceFile, fileToCanvas]);

  const handleExport = useCallback(async () => {
    if (variants.length === 0) return;
    setStage("exporting");
    try {
      const zipName =
        exportMode === "discord" ? "discord_emotes.zip" :
        exportMode === "7tv" ? "7tv_emotes.zip" :
        exportMode === "bttv" ? "bttv_emotes.zip" :
        exportMode === "ffz" ? "ffz_emotes.zip" :
        "emotes.zip";
      await exportAsZip(variants, zipName);
    } catch (err) {
      console.error("Export failed:", err);
      setErrorMessage("書き出しに失敗しました。もう一度お試しください");
      setTimeout(() => setErrorMessage(null), 5000);
    }
    setStage("ready");
  }, [variants, exportMode]);

  const updateConfig = useCallback((partial: PartialEmoteConfig) => {
    setConfig((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(partial) as (keyof EmoteConfig)[]) {
        const val = partial[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          // One-level deep merge for grouped config objects
          (next as Record<string, unknown>)[key] = { ...(prev[key] as unknown as Record<string, unknown>), ...(val as unknown as Record<string, unknown>) };
        } else if (val !== undefined) {
          // Primitive values (e.g. padding)
          (next as Record<string, unknown>)[key] = val;
        }
      }
      return next;
    });
  }, []);

  return {
    sourceFile,
    setSourceFile,
    bgRemovedCanvas,
    config,
    updateConfig,
    stage,
    progress,
    variants,
    handleExport,
    skipBgRemoval,
    setSkipBgRemoval,
    bgRemovalQuality,
    setBgRemovalQuality,
    cancelBgRemoval,
    retryBgRemoval,
    useOriginalImage,
    bgRemovedBlob,
    originalBlob,
    handleBrushConfirm,
    handleBrushSkip,
    fileToCanvas,
    errorMessage,
    isGifSource: gifSource !== null,
    gifFrameCount: gifSource?.frames.length ?? 0,
    gifOriginalFrameCount: gifSource?.originalFrameCount ?? 0,
    gifNotice,
    maxGifFrames: MAX_FRAMES,
    isVideoSource: videoSource !== null,
    videoFrameCount: videoSource?.frames.length ?? 0,
    ingestVideoSource,
  };
}
