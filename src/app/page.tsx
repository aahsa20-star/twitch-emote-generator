"use client";

import EmoteGenerator from "@/components/EmoteGenerator";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-4 px-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-gray-100">
          Twitch Emote Generator
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          画像をアップロードするだけでエモートを自動生成
        </p>
      </header>

      <EmoteGenerator />

      <Footer />
    </div>
  );
}
