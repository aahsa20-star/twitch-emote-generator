"use client";

import { useState } from "react";

interface ShareAfterDownloadModalProps {
  onClose: () => void;
  imageDataUrl: string | null;
}

const STAGES = [
  {
    title: "ダウンロード完了！",
    subtitle: "Xでシェアする、それも技術のうち",
    followText: "このツールを作った人をフォローすると泣いて喜びます",
    skipText: "罪悪感はあるが静かに立ち去る",
  },
  {
    title: "ダウンロード完了！",
    subtitle: "もっと思いっきりシェアしてみて",
    followText: "きちんとフォローすること、それも技術のうち",
    skipText: "聞こえないフリをして立ち去る",
  },
  {
    title: "ダウンロード完了！",
    subtitle: "俺思いっきりシェアしろって言ったんだよ？ナメてない？",
    followText: "こういうフォローが抜きのフォロー。力抜いて相手に効かなきゃ意味がない",
    skipText: "般若の顔を見る覚悟で立ち去る",
  },
  {
    title: "ダウンロード完了！",
    subtitle: "俺が思いっきりシェアしろって言ったら思いっきりシェアしないと。ナメてんのか？それが思いっきりか！ああ゛？",
    followText: "これを自分たちでやって欲しいの、自分でアドレナリンをあげていく",
    skipText: "元ネタは佐山サトル氏シューティング合宿、わかりました（閉じる）",
  },
];

export default function ShareAfterDownloadModal({ onClose, imageDataUrl }: ShareAfterDownloadModalProps) {
  const [toast, setToast] = useState(false);
  const [stage, setStage] = useState(0);

  const current = STAGES[stage];
  const isLastStage = stage >= STAGES.length - 1;

  const handleShare = () => {
    const text = encodeURIComponent(
      "Twitchエモートが30秒で作れた！ブラウザだけで完結、背景透過も自動 @akiissamurai #TwitchEmote #配信者グッズ"
    );
    const url = encodeURIComponent("https://twitch-emote-generator.vercel.app/");
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer,width=550,height=420"
    );

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

  const handleSkip = () => {
    if (isLastStage) {
      onClose();
    } else {
      setStage((s) => s + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={isLastStage ? onClose : undefined}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-bold text-base mb-1">{current.title}</p>
        <p className="text-gray-400 text-sm mb-5">{current.subtitle}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full px-4 py-3 rounded-lg bg-black text-white text-sm font-medium border border-gray-600 hover:bg-gray-800 transition-colors"
          >
            X（Twitter）でシェアする
          </button>

          {/* Follow section */}
          <div className="pt-3 border-t border-gray-700">
            {current.followText && (
              <p className="text-gray-400 text-xs mb-3">{current.followText}</p>
            )}
            <div className="flex gap-2">
              <a
                href="https://x.com/akiissamurai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-black text-white text-xs font-medium border border-gray-600 hover:bg-gray-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                X
              </a>
              <a
                href="https://www.twitch.tv/akiissamurai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600/20 text-purple-300 text-xs font-medium border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                Twitch
              </a>
              <a
                href="https://www.youtube.com/@%E3%83%80%E3%83%84%E7%9A%BF%E3%82%A2%E3%82%AD"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 text-xs font-medium border border-red-500/30 hover:bg-red-600/30 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </a>
            </div>
          </div>

          <button
            onClick={handleSkip}
            className="text-gray-500 text-xs hover:text-gray-300 transition-colors py-1"
          >
            {current.skipText}
          </button>
        </div>
        {toast && (
          <div className="mt-3 text-center">
            <p className="text-purple-400 text-sm animate-fade-in">
              画像をクリップボードにコピーしました。ツイートに貼り付けてください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
