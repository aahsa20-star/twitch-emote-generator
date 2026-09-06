"use client";

import { useRef } from "react";
import { useAccess } from "@/components/providers/AccessProvider";
import { primaryBtn } from "@/components/ui/classes";

/**
 * Studio header (09 §実装構造 HomeClient): brand, current access state and a
 * short "how it works" dialog. The product name stays "Twitch Emote Generator".
 */
export default function StudioHeader({ onBrandClick }: { onBrandClick?: () => void }) {
  const { access } = useAccess();
  const helpRef = useRef<HTMLDialogElement>(null);

  const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "");
  let pill: { text: string; tone: "good" | "warn" | "muted" };
  if (access.isUnlocked && access.grants.includes("follower")) pill = { text: "フォローで利用中", tone: "good" };
  else if (access.isUnlocked && access.grants.includes("passphrase"))
    pill = { text: `合言葉で利用中${access.passphraseExpiresAt ? `（${fmt(access.passphraseExpiresAt)} まで）` : ""}`, tone: "good" };
  else if (access.isUnlocked) pill = { text: "利用中", tone: "good" };
  else if (access.followerPending) pill = { text: "フォロー確認中", tone: "warn" };
  else if (access.tier === "trial") pill = { text: "お試し版", tone: "muted" };
  else pill = { text: "未解放", tone: "muted" };

  return (
    <header className="flex items-center justify-between gap-3 px-4 md:px-10 py-4 border-b border-[#26272e]">
      <button type="button" onClick={onBrandClick} className="flex items-center gap-2.5 md:gap-3 text-left min-h-[44px]" aria-label="画像選択へ戻る">
        <span
          aria-hidden
          className="w-[33px] h-[33px] md:w-[41px] md:h-[41px] rounded-[10px] md:rounded-[13px] bg-studio-accent text-studio-accent-ink font-serif font-bold text-[30px] md:text-[38px] leading-[29px] md:leading-[35px] text-center -rotate-6"
        >
          e
        </span>
        <span className="leading-tight">
          <span className="block text-[17px] md:text-[20px] font-bold tracking-tight">Twitch Emote Generator</span>
          <span className="block text-[9px] md:text-[10px] text-studio-muted tracking-wide">エモート制作の面倒を全部省く</span>
        </span>
      </button>
      <div className="flex items-center gap-2.5 md:gap-4">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] md:text-[11px] max-w-[140px] md:max-w-none leading-snug ${
            pill.tone === "good" ? "text-[#d1d5d0]" : pill.tone === "warn" ? "text-studio-warn" : "text-studio-muted"
          }`}
          role="status"
        >
          <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${pill.tone === "good" ? "bg-studio-good" : pill.tone === "warn" ? "bg-studio-warn" : "bg-studio-muted"}`} />
          {pill.text}
        </span>
        <button
          type="button"
          onClick={() => helpRef.current?.showModal()}
          className="w-9 h-9 md:w-11 md:h-11 rounded-full border border-studio-stroke grid place-items-center text-[16px] hover:bg-studio-raised transition-colors"
          aria-label="使い方"
        >
          ?
        </button>
      </div>

      <dialog
        ref={helpRef}
        className="bg-[#221f2a] text-studio-text border border-[#665271] rounded-[22px] w-[calc(100%-32px)] max-w-[470px] p-8 backdrop:bg-[#050408bd]"
        aria-labelledby="studio-help-title"
      >
        <h2 id="studio-help-title" className="text-[21px] md:text-[23px] font-bold mb-3.5">4つの流れで作れます。</h2>
        <p className="text-[13px] leading-[1.9] text-studio-muted mb-5">
          ① 画像を選ぶ<br />② 使う範囲と背景を整える<br />③ 動き・文字・飾りを選ぶ<br />④ 用途に合わせて保存
        </p>
        <p className="text-[13px] leading-[1.9] text-studio-muted mb-5">
          編集中は、いつでも前の手順に戻れます。画像と設定はブラウザの中だけで扱い、サーバーには送りません。
        </p>
        <form method="dialog">
          <button type="submit" className={`${primaryBtn} w-full`}>閉じる</button>
        </form>
      </dialog>
    </header>
  );
}
