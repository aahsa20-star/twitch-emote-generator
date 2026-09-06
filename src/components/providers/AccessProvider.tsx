"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { AccessSnapshot, FollowerStatus } from "@/types/auth";

/**
 * Client-side access state (実装設計 §6).
 *
 * - Source of truth is the server (`GET /api/access`); the initial snapshot
 *   comes from the Server Component so the first paint has no flicker.
 * - Never reads localStorage for authentication.
 * - Follower re-verification goes through `useSession().update({trigger})`
 *   (the only path that persists the refreshed JWT cookie), then re-fetches
 *   the snapshot.
 * - Losing access mid-edit only updates state; it never unmounts the editor.
 */

export type PassphraseSubmitResult =
  | { ok: true; expiresAt?: number }
  | { ok: false; reason: "mismatch" | "invalid" | "rate-limited" | "unavailable" | "network" | "origin"; retryAfter?: number };

export type RecheckResult = {
  status: FollowerStatus | "throttled";
  unlocked: boolean;
};

export interface AccessContextValue {
  access: AccessSnapshot;
  /** A refresh / recheck is in flight. */
  busy: boolean;
  /** Last refresh failed; `access` may be stale. */
  stale: boolean;
  refresh: () => Promise<AccessSnapshot | null>;
  submitPassphrase: (passphrase: string) => Promise<PassphraseSubmitResult>;
  clearPassphrase: () => Promise<void>;
  recheckFollower: (mode: "manual" | "ttl") => Promise<RecheckResult>;
  /**
   * Make sure follower evidence is fresh before a protected operation.
   * Single-flight with backoff; resolves to the latest snapshot (or null on
   * network failure). Does nothing when a recheck is not due.
   */
  ensureFollowerFresh: () => Promise<AccessSnapshot | null>;
}

const AccessContext = createContext<AccessContextValue | null>(null);

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used inside <AccessProvider>");
  return ctx;
}

export default function AccessProvider({
  initialAccess,
  children,
}: {
  initialAccess: AccessSnapshot;
  children: React.ReactNode;
}) {
  const { update } = useSession();
  const [access, setAccess] = useState<AccessSnapshot>(initialAccess);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const inflight = useRef<Promise<AccessSnapshot | null> | null>(null);

  const refresh = useCallback(async (): Promise<AccessSnapshot | null> => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const res = await fetch("/api/access", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(`access ${res.status}`);
        const snap = (await res.json()) as AccessSnapshot;
        setAccess(snap);
        setStale(false);
        return snap;
      } catch {
        setStale(true);
        return null;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  const recheckFollower = useCallback(
    async (mode: "manual" | "ttl"): Promise<RecheckResult> => {
      setBusy(true);
      try {
        const before = access.followerCheckedAt;
        const beforeAttempt = (access as AccessSnapshot & { followerAttemptedAt?: number }).followerAttemptedAt;
        try {
          await update({ trigger: mode === "manual" ? "follower-recheck" : "follower-ttl" });
        } catch {
          // fall through: the snapshot refresh below reports the real state
        }
        const snap = await refresh();
        if (!snap) return { status: "temporary-error", unlocked: access.isUnlocked };
        const throttled =
          mode === "manual" &&
          snap.followerCheckedAt === before &&
          snap.followerStatus === access.followerStatus &&
          beforeAttempt !== undefined;
        return { status: throttled ? "throttled" : snap.followerStatus, unlocked: snap.isUnlocked };
      } finally {
        setBusy(false);
      }
    },
    [access, refresh, update],
  );

  const submitPassphrase = useCallback(
    async (passphrase: string): Promise<PassphraseSubmitResult> => {
      setBusy(true);
      try {
        let res: Response;
        try {
          res = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ passphrase }),
          });
        } catch {
          return { ok: false, reason: "network" };
        }
        if (res.ok) {
          const j = (await res.json().catch(() => ({}))) as { expiresAt?: number };
          await refresh();
          return { ok: true, expiresAt: j.expiresAt };
        }
        const j = (await res.json().catch(() => ({}))) as { reason?: string; retryAfter?: number };
        if (res.status === 401) return { ok: false, reason: "mismatch" };
        if (res.status === 429) return { ok: false, reason: "rate-limited", retryAfter: j.retryAfter };
        if (res.status === 400) return { ok: false, reason: "invalid" };
        if (res.status === 403) return { ok: false, reason: "origin" };
        return { ok: false, reason: "unavailable" };
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const clearPassphrase = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  // ---- TTL scheduling (04 指示: 24h 超過・タブ復帰の検出、多重照会と再試行ループの防止) ----
  const accessRef = useRef(access);
  accessRef.current = access;
  const recheckInflight = useRef<Promise<AccessSnapshot | null> | null>(null);
  const lastAttemptRef = useRef<{ at: number; failed: boolean }>({ at: 0, failed: false });

  const recheckDue = useCallback((snap: AccessSnapshot): boolean => {
    if (!snap.followEnabled || snap.identityStatus !== "authenticated") return false;
    if (snap.followerPending || snap.followerRecheckDue) return true;
    // Local clock: the snapshot may be old (tab left open); 24h since the last success → due.
    return typeof snap.followerCheckedAt === "number" && Date.now() - snap.followerCheckedAt >= 24 * 60 * 60 * 1000;
  }, []);

  const ensureFollowerFresh = useCallback(async (): Promise<AccessSnapshot | null> => {
    const snap = accessRef.current;
    if (!recheckDue(snap)) return snap;
    if (recheckInflight.current) return recheckInflight.current;
    const now = Date.now();
    const minGap = lastAttemptRef.current.failed ? 5 * 60_000 : 60_000;
    if (now - lastAttemptRef.current.at < minGap) return snap;
    lastAttemptRef.current = { at: now, failed: false };
    const p = (async () => {
      try {
        await update({ trigger: "follower-ttl" });
      } catch {
        // the snapshot refresh below reports the real state
      }
      const next = await refresh();
      if (!next || next.followerStatus === "temporary-error" || (next.followerPending && !next.isUnlocked)) {
        lastAttemptRef.current.failed = true;
      }
      return next;
    })();
    recheckInflight.current = p;
    try {
      return await p;
    } finally {
      recheckInflight.current = null;
    }
  }, [recheckDue, refresh, update]);

  // On mount: fill in identity (page.tsx may skip the session for passphrase
  // users) and run the TTL re-verification when due.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
      await ensureFollowerFresh();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab shown again / long-lived page: re-evaluate expiry.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void ensureFollowerFresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void ensureFollowerFresh();
    }, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [ensureFollowerFresh]);

  const value = useMemo<AccessContextValue>(
    () => ({ access, busy, stale, refresh, submitPassphrase, clearPassphrase, recheckFollower, ensureFollowerFresh }),
    [access, busy, stale, refresh, submitPassphrase, clearPassphrase, recheckFollower, ensureFollowerFresh],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/** Human-readable messages shared by SiteGate / FollowGateModal. */
export function passphraseErrorMessage(r: Exclude<PassphraseSubmitResult, { ok: true }>): string {
  switch (r.reason) {
    case "mismatch":
      return "合言葉が違います";
    case "invalid":
      return "合言葉を入力してください（512文字まで）";
    case "rate-limited":
      return r.retryAfter
        ? `試行回数が多すぎます。約${Math.ceil(r.retryAfter / 60)}分後にもう一度お試しください`
        : "試行回数が多すぎます。しばらく待ってからもう一度お試しください";
    case "unavailable":
      return "サーバー側の設定の問題で確認できません。時間をおいて再試行してください";
    case "origin":
      return "このページからは送信できません。ページを再読み込みしてください";
    case "network":
      return "通信に失敗しました。少し時間を置いて再試行してください";
  }
}

export function followerRecheckMessage(r: RecheckResult, needsReauth: boolean): { kind: "success" | "warning" | "error"; text: string; offerSignin?: boolean } {
  if (r.unlocked && r.status === "following") return { kind: "success", text: "✨ フォローを確認しました" };
  if (needsReauth || r.status === "reauth-required") {
    return { kind: "warning", text: "Twitchへの再ログインが必要です。再ログインするか、合言葉で開いてください。", offerSignin: true };
  }
  switch (r.status) {
    case "not-following":
      return { kind: "warning", text: "フォローを確認できませんでした。Twitchでフォローしてから、もう一度お試しください。" };
    case "throttled":
      return { kind: "warning", text: "確認の間隔が短すぎます。数秒待ってからもう一度お試しください。" };
    case "temporary-error":
    case "unknown":
    default:
      return { kind: "error", text: "Twitchの確認が一時的にできません。再試行するか、合言葉で開いてください。" };
  }
}
