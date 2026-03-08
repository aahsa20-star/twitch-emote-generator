"use client";

import { useState, useCallback } from "react";

interface ShareButtonProps {
  imageDataUrl: string | null;
}

export default function ShareButton({ imageDataUrl }: ShareButtonProps) {
  const [toast, setToast] = useState(false);

  const handleShare = useCallback(async () => {
    // 1. Copy 112px image to clipboard
    if (imageDataUrl) {
      try {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        const pngBlob = new Blob([blob], { type: "image/png" });
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        setToast(true);
        setTimeout(() => setToast(false), 3000);
      } catch {
        // Clipboard API not supported or permission denied — still open X
      }
    }

    // 2. Open X share window
    const text = encodeURIComponent(
      "Twitchエモートを作ったよ！ #TwitchEmote #Twitch配信者 #エモート生成ツール #ダツ皿アキ"
    );
    const url = encodeURIComponent("https://twitch-emote-generator.vercel.app/");
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer,width=550,height=420"
    );
  }, [imageDataUrl]);

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="w-full py-3 px-6 rounded-lg font-semibold text-sm transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 flex items-center justify-center gap-2"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Xでシェア
      </button>
      {toast && (
        <div className="absolute -top-12 left-0 right-0 text-center">
          <span className="inline-block text-xs bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg shadow-lg animate-fade-in">
            エモート画像をコピーしました！Xで貼り付けてください
          </span>
        </div>
      )}
    </div>
  );
}
