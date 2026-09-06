"use client";

import { useId, useState } from "react";
import { passphraseErrorMessage, useAccess } from "@/components/providers/AccessProvider";
import { inputCls, secondaryBtn } from "@/components/ui/classes";

/**
 * Shared passphrase form (SiteGate / FollowGateModal / AccessStatusPanel).
 * password input, double-submit guard, non-empty, server-side validation.
 * Always operable — never disabled by Twitch state (仕様書 §4 / §7).
 * The error stays next to the field until the next attempt (09 §入口).
 */
export default function PassphraseForm({
  onUnlocked,
  compact = false,
  autoFocus = false,
  label = "合言葉で開く",
}: {
  onUnlocked?: () => void;
  compact?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const { submitPassphrase } = useAccess();
  const id = useId();
  const errorId = `${id}-error`;
  const [value, setValue] = useState("");
  const [error, setError] = useState<{ text: string; kind: "mismatch" | "wait" | "other" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || value.trim() === "") return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await submitPassphrase(value);
      if (r.ok) {
        setValue("");
        onUnlocked?.();
      } else {
        setError({
          text: passphraseErrorMessage(r),
          kind: r.reason === "mismatch" || r.reason === "invalid" ? "mismatch" : r.reason === "rate-limited" ? "wait" : "other",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2" aria-busy={submitting}>
      <label htmlFor={id} className={`block text-studio-text ${compact ? "text-[12px]" : "text-[12px] font-medium"}`}>
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          maxLength={512}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputCls} flex-1 min-w-0 ${error ? "border-[#8d4b50]" : ""}`}
          placeholder="合言葉"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || value.trim() === ""}
          className={`${secondaryBtn} min-h-[44px] px-4 whitespace-nowrap`}
        >
          {submitting ? "確認中…" : "開く →"}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-[12px] leading-relaxed text-studio-danger">
          <span aria-hidden className="mt-px">{error.kind === "wait" ? "⏱" : "!"}</span>
          <span>{error.text}</span>
        </p>
      )}
    </form>
  );
}
