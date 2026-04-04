"use client";

import { useState, useCallback } from "react";

const isIOS = typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
);

interface ShareButtonProps {
  imageDataUrl: string | null;
}

export default function ShareButton({ imageDataUrl }: ShareButtonProps) {
  const [toast, setToast] = useState<string | null>(null);

  const handleShare = useCallback(() => {
    // 1. Open X share window FIRST (must be synchronous for popup blocker)
    const text = encodeURIComponent(
      "Twitchエモートが30秒で作れた！ブラウザだけで完結、背景透過も自動 ✨ @akiissamurai #TwitchEmote #配信者グッズ"
    );
    const url = encodeURIComponent("https://twitch-emote-generator.vercel.app/");
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer,width=550,height=420"
    );

    // 2. iOS: clipboard.write not supported — show alternative guidance
    if (isIOS) {
      setToast("スクリーンショットを撮ってツイートに添付してください📸");
      setTimeout(() => setToast(null), 4000);
      return;
    }

    // 3. Non-iOS: Copy 112px image to clipboard (async, runs after popup opens)
    if (imageDataUrl && navigator.clipboard?.write) {
      (async () => {
        try {
          const res = await fetch(imageDataUrl);
          const blob = await res.blob();
          const pngBlob = new Blob([blob], { type: "image/png" });
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": pngBlob }),
          ]);
          setToast("画像をクリップボードにコピーしました。ツイートに貼り付けてください📋");
          setTimeout(() => setToast(null), 3000);
        } catch {
          // Clipboard API permission denied or other error — skip silently
        }
      })();
    }
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-purple-600/90 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg animate-fade-in backdrop-blur-sm">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
