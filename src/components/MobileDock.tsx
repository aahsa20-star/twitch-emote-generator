"use client";

import { useEffect, useState } from "react";
import { primaryBtn } from "@/components/ui/classes";

interface MobileDockProps {
  /** Small image for the dock (largest output, static or animated URL). */
  previewSrc: string | null;
  onPreview: () => void;
  onExport: () => void;
}

/**
 * Phone-only fixed bar under the editor (09 §3 スマホ): 「できあがりを見る」 and
 * 「保存へ」. Hidden while a text field has focus so the OS keyboard never
 * fights with it; respects the safe area.
 */
export default function MobileDock({ previewSrc, onPreview, onExport }: MobileDockProps) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: Element | null) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") && (el as HTMLInputElement).type !== "range";
    const onFocusIn = (e: FocusEvent) => setTyping(isField(e.target as Element));
    const onFocusOut = () => setTyping(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  if (typing) return null;
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2.5 px-4 pt-2.5 pb-safe bg-[#1b1922f5] backdrop-blur-xl border-t border-[#51425d]">
      <button type="button" onClick={onPreview} className="flex items-center gap-2 min-h-[44px] text-[11px] text-studio-text">
        <span className="w-[35px] h-[35px] rounded-[8px] checkerboard-fine grid place-items-center overflow-hidden" aria-hidden>
          {previewSrc && <img src={previewSrc} alt="" className="w-full h-full object-contain" />}
        </span>
        できあがりを見る
      </button>
      <button type="button" onClick={onExport} className={`${primaryBtn} min-w-[120px] min-h-[44px] text-[12px]`}>
        保存へ →
      </button>
    </div>
  );
}
