import { useCallback, useRef, useState } from "react";

interface UploadPanelProps {
  onImageSelected: (file: File) => void;
  hasImage: boolean;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function UploadPanel({
  onImageSelected,
  hasImage,
}: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert("PNG, JPG, WEBP形式の画像を選択してください。");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("10MB以下の画像を選択してください。");
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onImageSelected(file);
    },
    [onImageSelected, previewUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-purple-400 bg-purple-400/10"
          : hasImage
          ? "border-gray-600 bg-gray-800/50"
          : "border-gray-600 hover:border-gray-400 bg-gray-800/30"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />

      {previewUrl ? (
        <div className="space-y-3">
          <img
            src={previewUrl}
            alt="アップロード画像"
            className="mx-auto max-h-40 object-contain rounded"
          />
          <p className="text-sm text-gray-400">
            クリックまたはD&Dで画像を変更
          </p>
        </div>
      ) : (
        <div className="space-y-3 py-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16l1.106-4.424A2 2 0 017.048 10h9.904a2 2 0 011.942 1.576L20 16M4 16a2 2 0 002 2h12a2 2 0 002-2M4 16V8a2 2 0 012-2h2.93a2 2 0 011.664.89l.812 1.22A2 2 0 0013.07 9H18a2 2 0 012 2v5"
            />
          </svg>
          <div>
            <p className="text-gray-300">画像をドラッグ&ドロップ</p>
            <p className="text-sm text-gray-500 mt-1">
              またはクリックして選択（PNG / JPG / WEBP）
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
