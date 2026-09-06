"use client";

import { useId, useState } from "react";
import { passphraseErrorMessage, useAccess } from "@/components/providers/AccessProvider";

/**
 * Shared passphrase form (SiteGate / FollowGateModal / AccessStatusPanel).
 * password input, double-submit guard, non-empty, server-side validation.
 * Always operable — never disabled by Twitch state (仕様書 §4 / §7).
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
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
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
        setError(passphraseErrorMessage(r));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2" aria-busy={submitting}>
      <label htmlFor={id} className={`block text-gray-300 ${compact ? "text-xs" : "text-sm font-medium"}`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          maxLength={512}
          className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-purple-500"
          placeholder="合言葉"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || value.trim() === ""}
          className="px-4 py-2.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {submitting ? "確認中…" : "開く"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
