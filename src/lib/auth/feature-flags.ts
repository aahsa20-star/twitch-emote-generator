import type { FeatureFlags } from "@/types/auth";

/**
 * Read the current killswitch state from environment variables.
 *
 * Server-only — must not be exposed to the client (importing this file
 * from a client component triggers a "process.env undefined" warning).
 *
 * Defaults are tuned so omitting the variables is **safe (locked)**:
 * - TRIAL_MODE_ENABLED defaults to true (gating active)
 * - FOLLOW_AUTH_ENABLED defaults to true (judgement active)
 * - PREMIUM_LOCK_ENABLED defaults to true (legacy gating preserved)
 * - DOWNLOAD_LOCK_ENABLED defaults to true (DL ガード active)
 *
 * To "release" a gate, set the variable explicitly to "false".
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    SITE_LOCK_ENABLED: parseBoolEnv(process.env.SITE_LOCK_ENABLED, true),
    TRIAL_MODE_ENABLED: parseBoolEnv(process.env.TRIAL_MODE_ENABLED, true),
    FOLLOW_AUTH_ENABLED: parseBoolEnv(process.env.FOLLOW_AUTH_ENABLED, true),
    PREMIUM_LOCK_ENABLED: parseBoolEnv(process.env.PREMIUM_LOCK_ENABLED, true),
    DOWNLOAD_LOCK_ENABLED: parseBoolEnv(
      process.env.DOWNLOAD_LOCK_ENABLED,
      true,
    ),
  };
}

/**
 * Parse a boolean-ish env value: "false" / "0" / "" → false, else default.
 *
 * Matches Vercel UI behavior where users tend to write "false" for off.
 */
function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "") return false;
  return true;
}
