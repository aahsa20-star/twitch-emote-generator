"use client";

import { useState } from "react";
import EmoteGenerator from "@/components/EmoteGenerator";
import Gallery from "@/components/Gallery";
import Footer from "@/components/Footer";
import { EmoteConfig } from "@/types/emote";

type ActiveTab = "creator" | "gallery";

interface TemplateCredit {
  userName: string;
  userLogin?: string | null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("creator");
  const [templateOverride, setTemplateOverride] = useState<EmoteConfig | null>(null);
  const [templateCredit, setTemplateCredit] = useState<TemplateCredit | null>(null);

  const handleApplyTemplate = (config: EmoteConfig, credit?: TemplateCredit) => {
    setTemplateOverride(config);
    setTemplateCredit(credit ?? null);
    setActiveTab("creator");
  };

  const handleTemplateApplied = () => {
    setTemplateOverride(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-4 px-6 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-gray-100">
            Twitch Emote Generator
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            エモート制作の面倒を全部省く
          </p>
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
          templateCredit={templateCredit}
          onTemplateApplied={handleTemplateApplied}
        />
      ) : (
        <Gallery onApplyTemplate={handleApplyTemplate} onGoToCreator={() => setActiveTab("creator")} />
      )}

      <Footer />
    </div>
  );
}
