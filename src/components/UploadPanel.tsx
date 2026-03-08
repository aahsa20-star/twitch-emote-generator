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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 4000);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        showError("PNG, JPG, WEBP形式の画像を選択してください");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError("10MB以下の画像を選択してください");
        return;
      }

      setError(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onImageSelected(file);
    },
    [onImageSelected, previewUrl, showError]
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
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {/* Error toast */}
      {error && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-red-900/90 text-red-200 text-xs px-3 py-2 rounded-md border border-red-700 flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {previewUrl ? (
        <div className="space-y-3">
          <img
            src={previewUrl}
            alt="アップロード画像"
            className="mx-auto max-h-40 object-contain rounded"
          />
          <p className="text-sm text-gray-400 hidden md:block">
            クリックまたはD&Dで画像を変更
          </p>
          <p className="text-sm text-gray-400 md:hidden">
            タップして画像を変更
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
            <p className="text-gray-300 hidden md:block">画像をドラッグ&ドロップ</p>
            <p className="text-gray-300 md:hidden">タップして画像を選択</p>
            <p className="text-sm text-gray-500 mt-1">
              PNG / JPG / WEBP
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
