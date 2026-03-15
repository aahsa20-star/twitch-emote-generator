"use client";

import { useState } from "react";

interface ShareAfterDownloadModalProps {
  onClose: () => void;
  imageDataUrl: string | null;
}

export default function ShareAfterDownloadModal({ onClose, imageDataUrl }: ShareAfterDownloadModalProps) {
  const [toast, setToast] = useState(false);

  const handleShare = () => {
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

    // 2. Copy 112px image to clipboard (async, runs after popup opens)
    if (imageDataUrl && navigator.clipboard?.write) {
      (async () => {
        try {
          const res = await fetch(imageDataUrl);
          const blob = await res.blob();
          const pngBlob = new Blob([blob], { type: "image/png" });
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": pngBlob }),
          ]);
          setToast(true);
          setTimeout(() => {
            setToast(false);
            onClose();
          }, 3000);
        } catch {
          onClose();
        }
      })();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-bold text-base mb-1">ダウンロード完了！</p>
        <p className="text-gray-400 text-sm mb-5">作ったエモートをXでシェアしませんか？するよね？みんなしてますよ？え？無料だったんだよ？わかる？</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
          >
            罪悪感はあるが静かに立ち去る
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium border border-gray-600 hover:bg-gray-800 transition-colors"
          >
            X（Twitter）でシェアする（制作者は泣いて喜びます）
          </button>
        </div>
        {toast && (
          <div className="mt-3 text-center">
            <p className="text-purple-400 text-sm animate-fade-in">
              画像をクリップボードにコピーしました。ツイートに貼り付けてください📋
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
