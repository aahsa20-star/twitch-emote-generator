"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  EmoteConfig,
  EmoteVariant,
  ProcessingStage,
  EMOTE_SIZES,
  TEXT_PRESETS,
} from "@/types/emote";
import { removeBackground } from "@/lib/backgroundRemoval";
import { processEmote } from "@/lib/canvasPipeline";
import { generateGif } from "@/lib/gifEncoder";
import { exportAsZip } from "@/lib/zipExporter";

export function useEmoteProcessor() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [bgRemovedCanvas, setBgRemovedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [config, setConfig] = useState<EmoteConfig>({
    border: "none",
    textPreset: null,
    text: {
      customText: "",
      font: "Noto Sans JP",
      fillColor: "#ffffff",
      strokeColor: "#000000",
      position: "bottom",
    },
    animation: "none",
  });
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState(0);
  const [variants, setVariants] = useState<EmoteVariant[]>([]);

  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effect 1: Background removal when source changes
  useEffect(() => {
    if (!sourceFile) return;
    let cancelled = false;

    async function process() {
      setStage("removing-background");
      setProgress(0);
      setVariants([]);

      try {
        const blob = new Blob([await sourceFile!.arrayBuffer()], {
          type: sourceFile!.type,
        });
        const resultBlob = await removeBackground(blob, (p) => {
          if (!cancelled) setProgress(p);
        });
        if (cancelled) return;

        // Convert to canvas via Image
        const url = URL.createObjectURL(resultBlob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load processed image"));
          img.src = url;
        });
        URL.revokeObjectURL(url);

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        if (!cancelled) {
          setBgRemovedCanvas(canvas);
        }
      } catch (err) {
        console.error("Background removal failed:", err);
        if (!cancelled) {
          setStage("idle");
        }
      }
    }

    process();
    return () => {
      cancelled = true;
    };
  }, [sourceFile]);

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
        setStage("processing");
        const newVariants: EmoteVariant[] = [];

        try {
          // Ensure fonts are loaded before Canvas text rendering
          await document.fonts.ready;

          for (const size of EMOTE_SIZES) {
            const canvas = processEmote(bgRemovedCanvas!, size, config);
            const staticDataUrl = canvas.toDataURL("image/png");

            let animatedBlob: Blob | null = null;
            if (config.animation !== "none") {
              if (!cancelled) setStage("generating-preview");
              animatedBlob = await generateGif(canvas, config.animation, size);
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
            setVariants(newVariants);
            setStage("ready");
          }
        } catch (err) {
          console.error("Rendering failed:", err);
          if (!cancelled) setStage("ready");
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
    };
  }, [bgRemovedCanvas, config, sourceFile]);

  const handleExport = useCallback(async () => {
    if (variants.length === 0) return;
    setStage("exporting");
    try {
      await exportAsZip(variants);
    } catch (err) {
      console.error("Export failed:", err);
    }
    setStage("ready");
  }, [variants, sourceFile]);

  const updateConfig = useCallback((partial: Partial<EmoteConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
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
  };
}
