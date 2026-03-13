"use client";

import { useState, useEffect, useRef } from "react";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

export default function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent when config changes externally (e.g. preset applied)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setLocal(newColor);
    // Debounce parent update so preview refreshes during drag without excessive re-renders
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(newColor);
    }, 200);
  };

  return (
    <div className="flex-1">
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={local}
          onChange={handleInput}
          className="w-10 h-10 rounded border border-gray-600 bg-transparent cursor-pointer"
        />
        <span className="text-xs text-gray-400 font-mono">{local}</span>
      </div>
    </div>
  );
}
