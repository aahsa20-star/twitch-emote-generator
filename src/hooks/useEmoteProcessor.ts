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
import { processEmote } from "@/lib/canvasPipeline";
import { generateGif } from "@/lib/gifEncoder";
import { exportAsZip } from "@/lib/zipExporter";

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
  });
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState(0);
  const [variants, setVariants] = useState<EmoteVariant[]>([]);

  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgRemovalCancelledRef = useRef(false);

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

  // Effect 1: Background removal (or skip) when source changes
  useEffect(() => {
    if (!sourceFile) return;
    bgRemovalCancelledRef.current = false;
    let cancelled = false;

    async function process() {
      setVariants([]);

      // Store original blob for BrushEditor restore brush
      const origBlob = new Blob([await sourceFile!.arrayBuffer()], {
        type: sourceFile!.type,
      });
      if (!cancelled) setOriginalBlob(origBlob);

      if (skipBgRemoval) {
        // Skip: use original image directly
        setStage("processing");
        try {
          const canvas = await fileToCanvas(sourceFile!);
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
          setStage("idle");
        }
      }
    }

    process();
    return () => {
      cancelled = true;
    };
  }, [sourceFile, skipBgRemoval, bgRemovalQuality, fileToCanvas]);

  // Effect 2: Render previews when bgRemovedCanvas or config changes
  useEffect(() => {
    if (!bgRemovedCanvas) return;

    // Debounce rendering
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = setTimeout(() => {
      let cancelled = false;

      async function render() {
        // Delay showing "processing" spinner by 300ms to avoid layout shift on quick re-renders
        if (stageDelayRef.current) clearTimeout(stageDelayRef.current);
        stageDelayRef.current = setTimeout(() => {
          if (!cancelled) setStage("processing");
        }, 300);

        const newVariants: EmoteVariant[] = [];

        try {
          // Ensure fonts are loaded before Canvas text rendering
          await document.fonts.ready;

          const sizes =
            exportMode === "discord" || exportMode === "ffz" ? DISCORD_SIZES :
            exportMode === "7tv" ? SEVENTV_SIZES :
            EMOTE_SIZES; // twitch, bttv
          for (const size of sizes) {
            const canvas = processEmote(bgRemovedCanvas!, size, config, subCanvas ?? undefined);
            const staticDataUrl = canvas.toDataURL("image/png");

            let animatedBlob: Blob | null = null;
            if (config.animation.type !== "none") {
              if (!cancelled) setStage("generating-preview");
              animatedBlob = await generateGif(canvas, config.animation.type, size, config.animation.speed);
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

          if (!cancelled) {
            if (stageDelayRef.current) clearTimeout(stageDelayRef.current);
            setVariants(newVariants);
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
  }, [bgRemovedCanvas, config, sourceFile, exportMode, subCanvas]);

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
  };
}
