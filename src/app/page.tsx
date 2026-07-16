import { cookies } from "next/headers";
import { auth } from "@/auth";
import { evaluateAccess } from "@/lib/auth/premium";
import { getFeatureFlags } from "@/lib/auth/feature-flags";
import HomeClient from "@/components/HomeClient";
import SiteGate from "@/components/SiteGate";

/**
 * fix14: サイト全体ロック。
 *
 * page.tsx を Server Component 化し、リクエストごとにサーバー側で
 * evaluateAccess（follower OR PASSPHRASE-cookie OR killswitch）を評価する。
 * 未解放なら SiteGate（合言葉入力画面）だけを返し、ツール本体の HTML は
 * 一切配信しない。解放済みなら従来 UI（HomeClient）を返す。
 *
 * これは fix11 コメントで推奨されていた「Option A: Server Component で
 * flags 評価 → props 流し」の実装でもある。client 側で killswitch 環境
 * 変数を読めない fix7 の設計欠陥はこの層で解消される。
 *
 * 解除手順（緊急時）: Vercel で SITE_LOCK_ENABLED=false → ゲート撤去
 * （trial/premium の旧 2 階層挙動に戻る）。TRIAL_MODE_ENABLED=false は
 * 従来どおり全員 premium の full retreat。
 */
export default async function Home() {
  const flags = getFeatureFlags();
  const session = await auth();

  // PASSPHRASE-cookie based isSubscribed (set by /api/auth POST)
  const cookieStore = await cookies();
  const isSubscribed = cookieStore.get("emote-subscriber")?.value === "1";

  const access = evaluateAccess({
    session: session ?? null,
    isSubscribed,
    flags,
  });

  if (flags.SITE_LOCK_ENABLED && !access.isPremium) {
    return (
      <SiteGate
        isLoggedIn={access.isLoggedIn}
        needsReauth={access.needsReauth}
      />
    );
  }

  return <HomeClient />;
}
