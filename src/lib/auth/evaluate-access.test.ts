import { describe, expect, it } from "vitest";
import { FOLLOW_GRACE_MS, FOLLOW_TTL_MS, evaluateAccess, type EvaluateAccessInput } from "./evaluate-access";
import type { FeatureFlags } from "@/types/auth";

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0); // Mon 12:00
const H = 60 * 60 * 1000;
const BID = "12345";

const flags = (o: Partial<FeatureFlags> = {}): FeatureFlags => ({
  SITE_LOCK_ENABLED: true,
  TRIAL_MODE_ENABLED: true,
  FOLLOW_AUTH_ENABLED: true,
  PREMIUM_LOCK_ENABLED: true,
  DOWNLOAD_LOCK_ENABLED: true,
  ...o,
});

const base = (o: Partial<EvaluateAccessInput> = {}): EvaluateAccessInput => ({
  flags: flags(),
  now: NOW,
  passphrase: { valid: false },
  identity: { status: "anonymous" },
  follower: {},
  expectedBroadcasterId: BID,
  ...o,
});

const authed = (scope = "openid user:read:email user:read:follows") =>
  ({ status: "authenticated", userId: "u1", scope } as const);

const following = (checkedAgo: number, extra: Partial<EvaluateAccessInput["follower"]> = {}) => ({
  lastOutcome: "following" as const,
  checkedAt: NOW - checkedAgo,
  attemptedAt: NOW - checkedAgo,
  broadcasterId: BID,
  userId: "u1",
  lastAttemptOutcome: "following" as const,
  ...extra,
});

describe("evaluateAccess — grants", () => {
  it("anonymous + no passphrase → locked gate", () => {
    const s = evaluateAccess(base());
    expect(s.isUnlocked).toBe(false);
    expect(s.tier).toBe("locked");
    expect(s.followerPending).toBe(false);
  });

  it("anonymous + valid passphrase → unlocked without Twitch", () => {
    const s = evaluateAccess(base({ passphrase: { valid: true, expiresAt: NOW + H } }));
    expect(s.grants).toEqual(["passphrase"]);
    expect(s.identityStatus).toBe("anonymous");
  });

  it("logged-in follower (fresh) → follower grant", () => {
    const s = evaluateAccess(base({ identity: authed(), follower: following(H) }));
    expect(s.grants).toEqual(["follower"]);
    expect(s.followerStatus).toBe("following");
    expect(s.followerRecheckDue).toBe(false);
    expect(s.followerPending).toBe(false);
  });

  it("logged-in non-follower → locked; passphrase unlocks (OR)", () => {
    const nf = { ...following(H), lastOutcome: "not-following" as const, lastAttemptOutcome: "not-following" as const };
    expect(evaluateAccess(base({ identity: authed(), follower: nf })).isUnlocked).toBe(false);
    const s = evaluateAccess(base({ identity: authed(), follower: nf, passphrase: { valid: true, expiresAt: NOW + H } }));
    expect(s.grants).toEqual(["passphrase"]);
  });

  it("both grants are reported when both are valid", () => {
    const s = evaluateAccess(base({ identity: authed(), follower: following(H), passphrase: { valid: true, expiresAt: NOW + H } }));
    expect(s.grants).toEqual(["follower", "passphrase"]);
  });

  it("expired passphrase evidence is ignored", () => {
    expect(evaluateAccess(base({ passphrase: { valid: true, expiresAt: NOW - 1 } })).isUnlocked).toBe(false);
  });
});

describe("evaluateAccess — 24h / 48h rules (04 指示)", () => {
  it("24h boundary: 1 minute before → granted; exactly 24h → pending, not granted", () => {
    const fresh = evaluateAccess(base({ identity: authed(), follower: following(FOLLOW_TTL_MS - 60_000) }));
    expect(fresh.isUnlocked).toBe(true);
    expect(fresh.followerRecheckDue).toBe(false);

    const stale = evaluateAccess(base({ identity: authed(), follower: following(FOLLOW_TTL_MS) }));
    expect(stale.isUnlocked).toBe(false);
    expect(stale.followerPending).toBe(true);
    expect(stale.followerRecheckDue).toBe(true);
    expect(stale.followerStatus).toBe("following");
  });

  it("stale success + server-confirmed temporary failure AFTER the success → grace until 48h", () => {
    const inGrace = evaluateAccess(base({
      identity: authed(),
      follower: following(FOLLOW_TTL_MS + H, { lastAttemptOutcome: "temporary-error", attemptedAt: NOW - 10 * 60_000 }),
    }));
    expect(inGrace.isUnlocked).toBe(true);
    expect(inGrace.followerStatus).toBe("temporary-error");
    expect(inGrace.followerPending).toBe(false);
    expect(inGrace.followerRecheckDue).toBe(true);
    expect(inGrace.followerGraceUntil).toBe(NOW - (FOLLOW_TTL_MS + H) + FOLLOW_GRACE_MS);
  });

  it("48h boundary: 1 minute before ends with grace; exactly 48h → no grant, not pending", () => {
    const before = evaluateAccess(base({
      identity: authed(),
      follower: following(FOLLOW_GRACE_MS - 60_000, { lastAttemptOutcome: "temporary-error", attemptedAt: NOW - 1000 }),
    }));
    expect(before.isUnlocked).toBe(true);
    const at = evaluateAccess(base({
      identity: authed(),
      follower: following(FOLLOW_GRACE_MS, { lastAttemptOutcome: "temporary-error", attemptedAt: NOW - 1000 }),
    }));
    expect(at.isUnlocked).toBe(false);
    expect(at.followerPending).toBe(false);
    expect(at.followerRecheckDue).toBe(true);
  });

  it("a temporary failure recorded BEFORE the last success does not extend", () => {
    const s = evaluateAccess(base({
      identity: authed(),
      follower: following(FOLLOW_TTL_MS + H, { lastAttemptOutcome: "temporary-error", attemptedAt: NOW - FOLLOW_TTL_MS - 2 * H }),
    }));
    expect(s.isUnlocked).toBe(false);
    expect(s.followerPending).toBe(true);
  });

  it("failures never move the grace end: end = last success + 48h regardless of attempt time", () => {
    const s = evaluateAccess(base({
      identity: authed(),
      follower: following(FOLLOW_GRACE_MS - 1, { lastAttemptOutcome: "temporary-error", attemptedAt: NOW - 10 }),
    }));
    expect(s.followerGraceUntil).toBe(NOW - (FOLLOW_GRACE_MS - 1) + FOLLOW_GRACE_MS);
  });

  it("confirmed not-following revokes immediately, even 1 minute after a following result", () => {
    const s = evaluateAccess(base({
      identity: authed(),
      follower: { lastOutcome: "not-following", checkedAt: NOW - 60_000, attemptedAt: NOW - 60_000, broadcasterId: BID, userId: "u1", lastAttemptOutcome: "not-following" },
    }));
    expect(s.isUnlocked).toBe(false);
    expect(s.followerStatus).toBe("not-following");
    expect(s.followerPending).toBe(false);
  });

  it("unauthorized attempt → reauth-required, no grace, no pending", () => {
    const s = evaluateAccess(base({
      identity: authed(),
      follower: following(H, { lastAttemptOutcome: "unauthorized", attemptedAt: NOW - 1000 }),
    }));
    expect(s.isUnlocked).toBe(false);
    expect(s.followerStatus).toBe("reauth-required");
  });

  it("revoked identity: no follower grant, passphrase still works", () => {
    const s = evaluateAccess(base({
      identity: { status: "reauth-required", userId: "u1", scope: "", error: "RefreshTokenError" },
      follower: following(H),
      passphrase: { valid: true, expiresAt: NOW + H },
    }));
    expect(s.grants).toEqual(["passphrase"]);
    expect(s.needsReauth).toBe(true);
  });

  it("identity unavailable (Twitch outage) keeps the passphrase grant", () => {
    const s = evaluateAccess(base({ identity: { status: "unavailable" }, passphrase: { valid: true, expiresAt: NOW + H } }));
    expect(s.isUnlocked).toBe(true);
  });

  it("pending is cleared by a valid passphrase (OR)", () => {
    const s = evaluateAccess(base({ identity: authed(), follower: following(FOLLOW_TTL_MS + H), passphrase: { valid: true, expiresAt: NOW + H } }));
    expect(s.isUnlocked).toBe(true);
    expect(s.followerPending).toBe(false);
  });

  it("evidence for another broadcaster / user / missing ids is ignored", () => {
    expect(evaluateAccess(base({ identity: authed(), follower: following(H, { broadcasterId: "999" }) })).isUnlocked).toBe(false);
    expect(evaluateAccess(base({ identity: authed(), follower: following(H, { userId: "u2" }) })).isUnlocked).toBe(false);
    expect(evaluateAccess(base({ identity: authed(), follower: following(H, { userId: undefined }) })).isUnlocked).toBe(false);
    expect(evaluateAccess(base({ identity: { status: "authenticated", scope: "user:read:follows" }, follower: following(H) })).isUnlocked).toBe(false);
  });

  it("future-dated evidence is treated as absent", () => {
    const s = evaluateAccess(base({ identity: authed(), follower: following(-(10 * 60_000)) }));
    expect(s.isUnlocked).toBe(false);
    expect(s.followerRecheckDue).toBe(true);
    const skew = evaluateAccess(base({ identity: authed(), follower: following(-30_000) }));
    expect(skew.isUnlocked).toBe(true); // within 60s skew
  });

  it("missing follows scope → needsReauth", () => {
    const s = evaluateAccess(base({ identity: authed("openid user:read:email"), follower: {} }));
    expect(s.needsReauth).toBe(true);
  });
});

describe("evaluateAccess — flags (A17)", () => {
  it("FOLLOW_AUTH_ENABLED=false ignores follower evidence and stops rechecks", () => {
    const s = evaluateAccess(base({ flags: flags({ FOLLOW_AUTH_ENABLED: false }), identity: authed(), follower: following(H) }));
    expect(s.isUnlocked).toBe(false);
    expect(s.followerRecheckDue).toBe(false);
    expect(s.followerPending).toBe(false);
    expect(s.needsReauth).toBe(false);
  });

  it("TRIAL_MODE_ENABLED=false → emergency grant only", () => {
    const s = evaluateAccess(base({ flags: flags({ TRIAL_MODE_ENABLED: false }) }));
    expect(s.grants).toEqual(["emergency"]);
  });

  it("SITE_LOCK_ENABLED=false without grant → trial tier", () => {
    expect(evaluateAccess(base({ flags: flags({ SITE_LOCK_ENABLED: false }) })).tier).toBe("trial");
  });
});
