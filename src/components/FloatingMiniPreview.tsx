"use client";

import { EmoteVariant, ProcessingStage } from "@/types/emote";

interface FloatingMiniPreviewProps {
  variants: EmoteVariant[];
  stage: ProcessingStage;
}

const CHECK = 5;

function SpinnerOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
      <svg className="animate-spin h-5 w-5 text-purple-300" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
      </svg>
    </div>
  );
}

export default function FloatingMiniPreview({
  variants,
  stage,
}: FloatingMiniPreviewProps) {
  const show =
    variants.length > 0 &&
    (stage === "ready" || stage === "processing" || stage === "generating-preview");

  if (!show) return null;

  const largest = variants.reduce((a, b) => (a.size > b.size ? a : b));

  const handleTap = () => {
    const el = document.getElementById("preview-area");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      onClick={handleTap}
      className="fixed bottom-20 right-4 z-50 w-[90px] h-[90px] rounded-xl shadow-lg border border-gray-600 overflow-hidden active:scale-95 transition-transform md:hidden"
      style={{
        backgroundImage: `repeating-conic-gradient(#2a2a2a 0% 25%, #3a3a3a 0% 50%)`,
        backgroundSize: `${CHECK * 2}px ${CHECK * 2}px`,
      }}
    >
      <img
        src={largest.staticDataUrl}
        alt="preview"
        className="w-full h-full object-contain"
      />
      {(stage === "processing" || stage === "generating-preview") && (
        <SpinnerOverlay />
      )}
    </button>
  );
}
