"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import EmoteGenerator from "@/components/EmoteGenerator";
import Gallery from "@/components/Gallery";
import Footer from "@/components/Footer";
import { EmoteConfig } from "@/types/emote";

type ActiveTab = "creator" | "gallery";

export default function Home() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("creator");
  const [templateOverride, setTemplateOverride] = useState<EmoteConfig | null>(null);

  const handleApplyTemplate = (config: EmoteConfig) => {
    setTemplateOverride(config);
    setActiveTab("creator");
  };

  const handleTemplateApplied = () => {
    setTemplateOverride(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-4 px-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-100">
              Twitch Emote Generator
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              エモート制作の面倒を全部省く
            </p>
          </div>

          {/* Twitch login */}
          <div className="flex items-center gap-3">
            {session?.user ? (
              <div className="flex items-center gap-2">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-7 h-7 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-300 hidden sm:inline">{session.user.name}</span>
                <button
                  onClick={() => signOut()}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("twitch")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-500 transition-colors whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                </svg>
                Twitchでログイン
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          視聴者の<span className="text-gray-400 italic">{'"'}スタンプが作れるツールが欲しい{'"'}</span>の一言から生まれました。
        </p>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-4 bg-gray-800 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setActiveTab("creator")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "creator"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            エモートを作る
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "gallery"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            テンプレート
          </button>
        </div>
      </header>

      {activeTab === "creator" ? (
        <EmoteGenerator
          templateOverride={templateOverride}
          onTemplateApplied={handleTemplateApplied}
        />
      ) : (
        <Gallery onApplyTemplate={handleApplyTemplate} />
      )}

      <Footer />
    </div>
  );
}
