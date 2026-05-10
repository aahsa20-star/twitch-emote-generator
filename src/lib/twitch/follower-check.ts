/**
 * Twitch /helix/channels/followed wrapper.
 *
 * Pure function (no JWT read/write side effects). The caller (auth.ts) is
 * responsible for reading the stale-cache from JWT and persisting the
 * fresh result back. Keeping this side-effect-free makes unit testing
 * trivial and avoids confusing fetch/JWT coupling.
 *
 * Failure handling (FOLLOWER_AUTH_DESIGN.md §3.1):
 * - 401 → token failed; result.error = "unauthorized"
 *         caller should mark needsReauth on the JWT
 * - 429 → rate-limited; up to 3 retries with backoff [1s, 3s, 10s]
 *         after exhausting retries, fall back to staleCache (24h window)
 * - 5xx / network → same cache-fallback path, error="server" / "network"
 *
 * Result fields:
 * - isFollower: boolean | null (null only on unauthorized)
 * - source: "fresh" | "stale-cache" | "fail-safe"
 *   "stale-cache" means we returned cache.isFollower because the API
 *   was temporarily unreachable; "fail-safe" means cache was missing
 *   or expired (24h+ old) so we returned false to be safe.
 */

export type FollowerCheckError =
  | "unauthorized"
  | "rate-limited"
  | "network"
  | "server";

export interface FollowerCheckResult {
  isFollower: boolean | null;
  followedAt?: string;
  error?: FollowerCheckError;
  source: "fresh" | "stale-cache" | "fail-safe";
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const BACKOFFS_MS = [1000, 3000, 10000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cacheFallback(
  cache: { isFollower: boolean; checkedAt: number } | undefined,
  error: FollowerCheckError,
): FollowerCheckResult {
  if (cache && Date.now() - cache.checkedAt < TWENTY_FOUR_HOURS_MS) {
    return { isFollower: cache.isFollower, error, source: "stale-cache" };
  }
  return { isFollower: false, error, source: "fail-safe" };
}

/**
 * Check whether `userId` follows `broadcasterId` on Twitch.
 *
 * @param userAccessToken  User access token (must include `user:read:follows`)
 * @param userId           Twitch user id (numeric string) to check
 * @param broadcasterId    Twitch broadcaster id (numeric string) — Aki's channel
 * @param staleCache       Optional previous { isFollower, checkedAt } for 24h fallback
 *                         (caller pulls this from JWT, e.g., token.isFollower +
 *                         token.followCheckedAt).
 */
export async function checkIsFollower(
  userAccessToken: string,
  userId: string,
  broadcasterId: string,
  staleCache?: { isFollower: boolean; checkedAt: number },
): Promise<FollowerCheckResult> {
  const url =
    "https://api.twitch.tv/helix/channels/followed?user_id=" +
    encodeURIComponent(userId) +
    "&broadcaster_id=" +
    encodeURIComponent(broadcasterId);
  const headers = {
    Authorization: `Bearer ${userAccessToken}`,
    "Client-Id": process.env.AUTH_TWITCH_ID ?? "",
  };

  let lastError: FollowerCheckError | undefined;

  for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
    try {
      const res = await fetch(url, { headers });

      if (res.status === 401) {
        // Token failed (revoked, scope missing, etc.) — caller marks needsReauth
        return { isFollower: null, error: "unauthorized", source: "fail-safe" };
      }

      if (res.status === 429) {
        if (attempt < BACKOFFS_MS.length) {
          await sleep(BACKOFFS_MS[attempt]);
          lastError = "rate-limited";
          continue;
        }
        return cacheFallback(staleCache, "rate-limited");
      }

      if (res.status >= 500) {
        if (attempt < BACKOFFS_MS.length) {
          await sleep(BACKOFFS_MS[attempt]);
          lastError = "server";
          continue;
        }
        return cacheFallback(staleCache, "server");
      }

      if (!res.ok) {
        // 4xx other than 401/429 — non-retryable
        return cacheFallback(staleCache, "server");
      }

      const json = await res.json();
      const isFollower = (json?.data?.length ?? 0) > 0;
      const followedAt = json?.data?.[0]?.followed_at as string | undefined;
      return { isFollower, followedAt, source: "fresh" };
    } catch {
      lastError = "network";
      if (attempt < BACKOFFS_MS.length) {
        await sleep(BACKOFFS_MS[attempt]);
        continue;
      }
      return cacheFallback(staleCache, "network");
    }
  }

  // Unreachable in practice — TypeScript wants an explicit return
  return cacheFallback(staleCache, lastError ?? "network");
}
