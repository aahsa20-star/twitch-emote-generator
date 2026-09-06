"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { ImageIcon, Film, Video } from "lucide-react";
import { checkUpload, UPLOAD_ACCEPT_ATTR, UPLOAD_LABELS, type UploadKind } from "@/lib/upload/accept";
import { createSampleFile } from "@/lib/sampleImage";
import { primaryBtn, secondaryBtn } from "@/components/ui/classes";

interface UploadPanelProps {
  /** A file passed validation. `kind` tells the parent which pipeline it enters. */
  onFileAccepted: (file: File, kind: UploadKind) => void;
  /** The bundled sample was chosen (already transparent). */
  onSampleSelected: (file: File) => void;
  /** True while an image is already loaded (copy switches to 「変更」). */
  hasImage: boolean;
  /** Extra entry points rendered under the main area (video face extraction). */
  children?: ReactNode;
}

/**
 * Step 1 「画像を選ぶ」 (09 §1): one primary action, drag & drop, the accepted
 * formats and limits rendered from the definition, a sample to try with, and
 * errors that stay until the next choice or an explicit close.
 */
export default function UploadPanel({ onFileAccepted, onSampleSelected, hasImage, children }: UploadPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return; // picker cancelled: keep whatever is loaded
      const r = checkUpload(file);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setError(null);
      onFileAccepted(file, r.kind);
    },
    [onFileAccepted],
  );

  const handleSample = async () => {
    setSampleBusy(true);
    try {
      const f = await createSampleFile();
      setError(null);
      onSampleSelected(f);
    } catch {
      setError("サンプル画像を用意できませんでした。もう一度お試しください。");
    } finally {
      setSampleBusy(false);
    }
  };

  const limits = (["image", "gif", "video"] as UploadKind[]).map((k) => UPLOAD_LABELS[k]);

  return (
    <section aria-labelledby="upload-title" className="max-w-[980px] mx-auto text-center">
      <p className="text-[10px] tracking-[.15em] font-semibold text-studio-accent mb-2">01 / START WITH AN IMAGE</p>
      <h1 id="upload-title" className="text-[26px] md:text-[35px] font-bold leading-tight">
        {hasImage ? "別の画像に変える。" : "まずは、主役を選ぼう。"}
      </h1>
      <p className="text-[12px] md:text-[13px] text-studio-muted mt-3 mb-6 md:mb-8">
        {hasImage ? "新しい画像を読み込むまで、今の画像と設定はそのまま残ります。" : "写真もイラストも。背景はあとから整えられます。"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 md:gap-6 text-left">
        {/* Drop zone = the primary action */}
        <div
          className={`relative flex flex-col items-center justify-center gap-3 min-h-[250px] md:min-h-[315px] p-6 md:p-10 rounded-studio border-[1.5px] border-dashed transition-colors ${
            dragging ? "border-studio-accent bg-[#31283d]" : "border-[#7c668c] bg-[#201c29]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_ACCEPT_ATTR}
            className="sr-only"
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
          <div className="flex items-center gap-5 text-studio-muted" aria-hidden>
            <ImageIcon className="w-7 h-7" strokeWidth={1.5} />
            <Film className="w-7 h-7" strokeWidth={1.5} />
            <Video className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className={`${primaryBtn} min-w-[200px]`}>
            {hasImage ? "画像を選び直す" : "画像を選ぶ"}
          </button>
          <p className="text-[12px] text-[#bcb4c9] hidden md:block">または、ここにドラッグ＆ドロップ</p>
          <p className="text-[10px] md:text-[11px] text-studio-muted text-center leading-relaxed">
            {limits.map((l, i) => (
              <span key={l.formats} className="inline-block whitespace-nowrap">
                {i > 0 && <span className="mx-1.5" aria-hidden>·</span>}
                {l.formats} {l.limit}まで
              </span>
            ))}
          </p>
          <p className="text-[11px] text-[#bcb4c9]">GIF・動画を選ぶと、その動きをそのまま使えます。</p>
        </div>

        {/* Sample */}
        <div className="bg-[#1e1d24] border border-[#37333e] rounded-studio p-5 md:p-6 grid grid-cols-[80px_1fr] md:grid-cols-1 gap-x-4 gap-y-1 items-center md:text-center">
          <div className="row-span-3 md:row-span-1 w-20 h-20 md:w-[130px] md:h-[130px] md:mx-auto md:mb-2 rounded-2xl checkerboard grid place-items-center">
            <SampleThumb />
          </div>
          <h2 className="text-[12px] md:text-[14px] font-bold">画像がなくても大丈夫。</h2>
          <p className="text-[10px] md:text-[11px] text-studio-muted md:mb-4">サンプルで操作を試せます。</p>
          <button type="button" onClick={handleSample} disabled={sampleBusy} className={`${secondaryBtn} md:mx-auto min-h-[38px] md:min-h-[46px] text-[11px] md:text-[13px]`}>
            サンプルで試す →
          </button>
        </div>
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className="mt-4 mx-auto max-w-[640px] flex items-start gap-3 text-left text-[12px] leading-relaxed text-studio-danger bg-[#3a2326] border border-[#6b3a3f] rounded-[10px] px-4 py-3"
        >
          <span aria-hidden className="text-[16px] leading-none mt-0.5">!</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="min-h-[32px] px-2 text-studio-text/80 hover:text-studio-text" aria-label="エラーを閉じる">
            ×
          </button>
        </div>
      )}

      {children && <div className="mt-6 max-w-[640px] mx-auto text-left">{children}</div>}
    </section>
  );
}

function SampleThumb() {
  // Static SVG of the same subject as the sample file (no canvas needed here).
  return (
    <svg viewBox="0 0 100 100" className="w-[72%] h-[72%]" aria-hidden>
      <circle cx="50" cy="50" r="38" fill="#9147ff" />
      <polygon points="50,31 55.6,44.5 70,45.5 59,54.8 62.3,69 50,61.5 37.7,69 41,54.8 30,45.5 44.4,44.5" fill="#fff" />
    </svg>
  );
}
