"use client";

import { useEffect, useState } from "react";
import { EmoteConfig, Template } from "@/types/emote";
import { configToSummary } from "@/lib/templateUtils";

interface PopularTemplatesProps {
  onApply: (config: EmoteConfig) => void;
}

export default function PopularTemplates({ onApply }: PopularTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("/api/templates?sort=popular&limit=3")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {});
  }, []);

  if (templates.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        人気テンプレート
      </h3>
      <div className="space-y-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="bg-gray-800/60 border border-gray-700 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-200 truncate">
                {t.title}
              </span>
              <span className="text-xs text-gray-500 ml-2 shrink-0">
                ♥ {t.likes_count}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              {t.user_image && (
                <img
                  src={t.user_image}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              <a
                href={`https://twitch.tv/${t.user_login ?? t.user_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-[#9147FF] transition-colors"
              >
                {t.user_name}
              </a>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {configToSummary(t.config)}
            </p>
            <button
              onClick={() => onApply(t.config)}
              className="w-full px-3 py-1.5 rounded text-xs bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              このテンプレートを使う
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
