import type { FeatureFlags } from "@/types/auth";

/**
 * Read the current killswitch state from environment variables (server-only).
 *
 * Defaults are tuned so omitting the variables is **safe (locked)**:
 * - SITE_LOCK_ENABLED     default true  (fix14: site-wide gate active)
 * - TRIAL_MODE_ENABLED    default true  (false = explicit emergency release)
 * - FOLLOW_AUTH_ENABLED   default false (R1b: 段階公開。本番で "true" を明示して有効化)
 * - PREMIUM_LOCK_ENABLED  default true  (deprecated / no effect, kept for compat)
 * - DOWNLOAD_LOCK_ENABLED default true  (DL 権限ゲート active; 入力検証は常に有効)
 *
 * Accepted values: "true" / "1" / "yes" / "on" and "false" / "0" / "no" / "off"
 * (case-insensitive). Anything else is logged once and treated as the default —
 * 誤った値を黙って true にしない (R1b).
 */
const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off"]);
const warned = new Set<string>();

export function parseBoolEnv(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "") return fallback;
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[feature-flags] ${name}="${value}" is not a boolean; using default ${fallback}`);
  }
  return fallback;
}

export function getFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    SITE_LOCK_ENABLED: parseBoolEnv("SITE_LOCK_ENABLED", env.SITE_LOCK_ENABLED, true),
    TRIAL_MODE_ENABLED: parseBoolEnv("TRIAL_MODE_ENABLED", env.TRIAL_MODE_ENABLED, true),
    FOLLOW_AUTH_ENABLED: parseBoolEnv("FOLLOW_AUTH_ENABLED", env.FOLLOW_AUTH_ENABLED, false),
    PREMIUM_LOCK_ENABLED: parseBoolEnv("PREMIUM_LOCK_ENABLED", env.PREMIUM_LOCK_ENABLED, true),
    DOWNLOAD_LOCK_ENABLED: parseBoolEnv("DOWNLOAD_LOCK_ENABLED", env.DOWNLOAD_LOCK_ENABLED, true),
  };
}
