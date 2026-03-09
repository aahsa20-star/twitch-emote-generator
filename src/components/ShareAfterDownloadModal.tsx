interface ShareAfterDownloadModalProps {
  onClose: () => void;
}

const SHARE_URL =
  "https://twitter.com/intent/tweet?text=Twitch%20Emote%20Generator%E3%81%A7%E3%82%A8%E3%83%A2%E3%83%BC%E3%83%88%E4%BD%9C%E3%81%A3%E3%81%9F%EF%BC%81%20%40akiissamurai%20%23TwitchEmote%20%23%E3%82%A8%E3%83%A2%E3%83%BC%E3%83%88&url=https%3A%2F%2Ftwitch-emote-generator.vercel.app";

export default function ShareAfterDownloadModal({ onClose }: ShareAfterDownloadModalProps) {
  const handleShare = () => {
    window.open(SHARE_URL, "_blank", "noopener,noreferrer");
    onClose();
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
        <p className="text-gray-400 text-sm mb-5">作ったエモートをXでシェアしませんか？</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
          >
            スキップ
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium border border-gray-600 hover:bg-gray-800 transition-colors"
          >
            X（Twitter）でシェアする
          </button>
        </div>
      </div>
    </div>
  );
}
