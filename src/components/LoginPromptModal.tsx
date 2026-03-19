"use client";

import { signIn } from "next-auth/react";

interface LoginPromptModalProps {
  onClose: () => void;
}

export default function LoginPromptModal({ onClose }: LoginPromptModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-bold text-base mb-2">
          Twitchログインが必要です
        </p>
        <p className="text-gray-400 text-sm mb-5">
          テンプレートの投稿やいいねにはTwitchアカウントでのログインが必要です。
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => signIn("twitch")}
            className="w-full px-4 py-3 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            Twitchでログイン
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 text-xs hover:text-gray-300 transition-colors py-1"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
