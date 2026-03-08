import { EmoteVariant, TextPosition } from "@/types/emote";
import PreviewCard from "./PreviewCard";

interface PreviewAreaProps {
  variants: EmoteVariant[];
  hasText?: boolean;
  textPosition?: TextPosition;
}

export default function PreviewArea({ variants, hasText = false, textPosition = "bottom" }: PreviewAreaProps) {
  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500">
        <p>画像をアップロードするとプレビューが表示されます</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {[...variants].reverse().map((variant) => (
        <PreviewCard key={variant.size} variant={variant} hasText={hasText} textPosition={textPosition} />
      ))}
    </div>
  );
}
