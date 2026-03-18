"use client";

import { useRef, useState, useCallback } from "react";

interface SubImageUploadProps {
  onSubImageSelected: (file: File) => void;
  currentFile: File | null;
}

export default function SubImageUpload({ onSubImageSelected, currentFile }: SubImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    onSubImageSelected(file);
    const url = URL.createObjectURL(file);
    setThumbUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
  }, [onSubImageSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
        dragging ? "border-purple-500 bg-purple-600/10" : "border-gray-600 bg-gray-800/40"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {currentFile && thumbUrl ? (
        <div className="flex items-center gap-3">
          <img
            src={thumbUrl}
            alt="サブ画像"
            className="w-16 h-16 rounded object-contain bg-gray-900"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 truncate">{currentFile.name}</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="mt-1 text-xs px-2 py-1 min-h-[44px] md:min-h-0 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              変更
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-2 min-h-[44px] md:min-h-0 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          サブ画像をアップロード
        </button>
      )}
    </div>
  );
}
