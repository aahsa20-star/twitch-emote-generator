# Twitchフォロワー認証 詳細設計書（Phase 1 MVP）

**目的**: `FOLLOWER_AUTH_RESEARCH.md` の調査結果と Aki との確定仕様に基づき、Phase 1 MVP の実装設計を確定する。
**スコープ**: 設計のみ・コード変更ゼロ。実装は次セッションで `FOLLOWER_AUTH_IMPL_PROMPT.md` を起点に実施。
**作成者**: Claude (Sonnet)
**日付**: 2026-05-09

---

## 実装着手前の Aki 確認項目（最重要・先頭配置）

設計書全文を読まなくてもここだけ見れば判断できるよう、**Aki が答えるべき残課題**を先頭にまとめる。実装着手の blocker。

| # | 状態 | 項目 | 確定内容 / 必要アクション | 影響箇所 |
|---|---|---|---|---|
| **A** | ✅ **確定** | お試し版で残すアニメ2種 | **`bounce` + `shake`**（§11 で確定。候補B〜E は履歴として残す） | §11 / §7 / 実装順序 |
| **B** | ⏸ 未確定 | 「使えるアニメ X/Y」表現 | §7 の文言 4 案から選ぶ。**実装は default で案 D（数字なし）** にして、後日切替可能な構造で進める | §7 |
| **C** | ⏸ 未確定 | Aki の Twitch broadcaster_id 取得 | §6.4 の curl 手順を実行して `.env` / Vercel 環境変数に設定（**実装直前に Aki が実行**） | §6 / 実装着手前 |
| **D** | ⛔ 未確定 (production blocker) | プライバシーポリシー本文起草 | 既存 PP の場所確認 → §7.6 の必須項目を Aki が文章化（法務範疇） | §7 / リリース前 |
| **E** | ⛔ 未確定 (production blocker) | DSA 原文確認 | https://legal.twitch.com/legal/developer-agreement で「follow」「engagement」「incentivize」を検索して問題ないこと確認 | リリース前 blocker |
| **F** | ⏸ 未確定 | テスト用副 Twitch アカウント準備 | フォロー済み / フォロー無しの 2 アカ準備（信頼できる仲間に協力依頼可、テスト時に実施） | §8 |
| **G** | ✅ **確定** | Aki 3行プロフィール本文 | §7.4 で確定（脱力型 3 行） | §7 |
| **H** | 📦 Phase 2 へ | 最新配信リンクの取得方針 | **Phase 1 では Aki チャンネル URL リンクのみ**、配信状態取得は Phase 2 | §3 / §7 |
| **I** | ⏸ 未確定 | 旧 scope ログイン者の再ログイン誘導バナー文言 | §7.3 の 2 案から選ぶ（**実装時に default 採用 + 文言 swap で対応**） | §7 |
| **J** | ⏸ 未確定 | 既存サブスク (PASSPHRASE) 機能の継続期限 | 「無期限継続」/ 「N か月後 deprecated」（実装後・運用中に決定） | §6 |

**マーク凡例**: ✅ 確定 ／ ⏸ 未確定（実装中決定可） ／ ⛔ production 前 blocker ／ 📦 Phase 2 移行

**実装着手の blocker**: §C のみ（broadcaster_id 取得、Aki が curl 実行で完了）。
**production 反映の blocker**: §D（プライバシーポリシー）+ §E（DSA 原文確認）。

---

## 0. ドキュメントマップ

```
FOLLOWER_AUTH_RESEARCH.md   ← 調査（API仕様・規約・キャッシュ戦略）
FOLLOWER_AUTH_DESIGN.md     ← 本文書：Phase 1 MVP 詳細設計
FOLLOWER_AUTH_IMPL_PROMPT.md ← 次セッション用の実装指示書
```

依存関係: 本文書は Research の §1〜6 と Aki との対話で確定した仕様（trial mode + 9 件の論点確定）に基づく。実装プロンプトは本文書の §2〜10 を機械化したもの。

---

## 1. アーキテクチャ図

### 1.1 ログインフロー（access_token 永続化 + isFollower 判定）

```
[user clicks "Twitchでログイン"]
        ↓
[Twitch OAuth dialog]
        ↓ (scope: openid user:read:email user:read:follows)
[redirect with code]
        ↓
[Auth.js token endpoint exchange]
        ↓ (account.access_token, refresh_token, expires_in)
[callbacks.jwt 初回 sign-in]
        ├─ /helix/users → user.id, name, login, image
        ├─ /helix/channels/followed?user_id=X&broadcaster_id=AKI_ID
        │       ↓
        │   data[] 長さで isFollower 判定 + followed_at 記録
        ├─ JWT に保存:
        │   { sub, name, login, picture,
        │     access_token, refresh_token, expires_at,
        │     scope, isFollower, followCheckedAt, followedAt }
        ↓
[session callback で session.user に展開]
        ↓
[front-end: useSession() で isFollower 取得 → ロック判定]
```

### 1.2 ロック判定フロー（client side）

```
[ユーザーが UI 操作]
        ↓
[premium.ts: evaluateAccess(session, killswitches)]
        ├─ TRIAL_MODE_ENABLED = false → 全機能解放（緊急 killswitch）
        ├─ FOLLOW_AUTH_ENABLED = false → PASSPHRASE のみ評価
        ├─ isPremium = isFollower || isSubscribed (PASSPHRASE) || (account scope-only path)
        └─ 戻り値: {
            isPremium: boolean,
            tier: "trial" | "premium",
            reason: "follower" | "passphrase" | "trial",
            needsReauth: boolean (旧 scope)
          }
        ↓
[各 UI コンポーネントで tier に応じた表示]
```

### 1.3 ダウンロード実行フロー

```
[user clicks DL ボタン]
        ↓
[client side check: tier === "premium" ?]
        ├─ NO → 本格誘導モーダルを表示（DL は実行しない）
        └─ YES → API Route POST /api/download (or server action)
                ↓
        [server side: evaluateAccess(session, killswitches) 再評価]
                ├─ DOWNLOAD_LOCK_ENABLED = false → 即時許可
                ├─ tier !== "premium" → 403 (改竄対策)
                └─ tier === "premium" → 許可
        ↓
[client が canvas blob を生成 → ファイル DL]
```

**重要**: ファイル生成自体はクライアントサイドで完結（既存設計を維持・サーバーに画像送らない原則）。サーバー再検証は **権限チェックのみ**、blob 配信はしない。

### 1.4 Twitch API 障害時 fail-safe + 24h キャッシュ

```
[checkIsFollower() called]
        ↓
[fetch /helix/channels/followed]
        ├─ 200 OK → 結果を返す + 結果を JWT 内 followCachedAt と共に保存
        ├─ 401 (token 失効) → null + needsReauth=true
        ├─ 429 (rate) → 1s/3s/10s リトライ → 失敗ならキャッシュフォールバック
        ├─ 500 系 / network → キャッシュフォールバック
        └─ キャッシュフォールバック条件:
            - JWT に prevIsFollower あり
            - prevCheckedAt + 24h > now
            - → prevIsFollower 値を採用 + UI バナー「Twitch APIに一時障害」
            - キャッシュも無いなら fail-safe で false
```

---

## 2. ファイル変更計画

実コードを grep で全特定。変更対象を**実コード根拠**で列挙。

### 2.1 既存 isSubscriber 判定箇所（OR 結合に置き換え対象）

| ファイル | 行 | 内容 | 移行方針 |
|---|---|---|---|
| `src/components/EmoteGenerator.tsx:98` | `const [isSubscriber, setIsSubscriber] = useState(false);` | localStorage 読み込みベース | **変更**: state は維持、判定は premium.ts 経由で `isPremium` を一緒に評価 |
| `src/components/EmoteGenerator.tsx:286,598` | UI 分岐 | `isSubscriber ? ... : ...` | **変更**: `isPremium` に置換 |
| `src/components/EmoteGenerator.tsx:332` | passphrase input UI | 既存の合言葉入力 | **維持**: 現在の場所は撤去せず、ロック解除モーダル内 inline 展開先として残す |
| `src/components/SettingsPanel.tsx:22,39,55,99,108,135,155,165,188,259` | props と分岐 | `isSubscriber` prop 経由 | **変更**: prop を `tier: "trial" \| "premium"` に置換 or `isPremium` を渡す |
| `src/components/settings/AnimationSettings.tsx:33,42,308,345` | アニメ選択 UI | `isLoggedIn || isSubscriber` 等 | **変更**: trial では `loginOnly` も locked、premium で全アンロック |
| `src/types/emote.ts:90,241,249,263,268-273,286,301-336+` | `subscriberOnly: true` メタデータ | テンプレート・border・frame・animation | **維持**: フィールド名は保持、評価側で `subscriberOnly && !isPremium → locked` |

### 2.2 新規ロック対象（Phase 1 で新たにロックする領域）

| 既存ファイル | 行 | 現状 | 新ロック設計 |
|---|---|---|---|
| `src/components/PreviewCard.tsx:123-144,153-155,324,335` | DL ボタン handler | 全ユーザー DL 可能 | trial: 28px PNG のみ可、56/112 と全 GIF ロック |
| `src/components/PreviewArea.tsx:234-262` | バッジ DL | 全ユーザー DL 可能 | trial: ロック（バッジはサブスク特典） |
| `src/components/DownloadButton.tsx` | iOS step DL | 全ユーザー DL 可能 | trial: 28px PNG のみ通過 |
| `src/hooks/useEmoteProcessor.ts:378` | `generateGif` 呼び出し | 全ユーザー GIF 生成可能 | trial: GIF 生成自体は可（プレビューで見える）、DL のみ blocked |

### 2.3 新規ファイル

| パス | 役割 | 主要 export |
|---|---|---|
| `src/lib/twitch/follower-check.ts` | フォロー判定 API ラッパー | `checkIsFollower(token, userId, broadcasterId)` |
| `src/lib/auth/premium.ts` | premium 判定統一関数 | `evaluateAccess(session, flags) → AccessState` |
| `src/lib/auth/feature-flags.ts` | 環境変数 killswitch 評価 | `getFeatureFlags() → Flags`（server-only） |
| `src/components/FollowGateModal.tsx` | 本格誘導モーダル（DL 押下時） | `<FollowGateModal open onClose />` |
| `src/components/FeatureLockHint.tsx` | 軽い解説モーダル（鍵マーク押下時） | `<FeatureLockHint feature label />` |
| `src/components/TrialBadge.tsx` | 上部「お試し版で使用中」バッジ | `<TrialBadge />` |
| `src/components/ReauthBanner.tsx` | 旧 scope ログイン者向け再ログイン誘導 | `<ReauthBanner />` |
| `src/app/api/download-check/route.ts` | DL 権限のサーバー再検証 API | `POST` で 200 / 403 |

### 2.4 変更対象ファイル（既存）

| パス | 変更内容 |
|---|---|
| `src/auth.ts` | scope 追加、JWT に access_token / refresh_token / expires_at / isFollower 永続化、refresh ロジック |
| `src/types/emote.ts` | `BorderOption.subscriberOnly` 等の意味論は維持、コメントで「premium = follower OR subscriber」明記 |
| `src/components/EmoteGenerator.tsx` | premium.ts 経由の判定、TrialBadge / ReauthBanner 配置、PASSPHRASE 入力 UI を FollowGateModal の inline 展開対象として参照 |
| `src/components/SettingsPanel.tsx` | prop を `isPremium` ベースに、鍵マーク UI 追加 |
| `src/components/settings/AnimationSettings.tsx` | trial mode で loginOnly + subscriberOnly が両方ロック |
| `src/components/PreviewCard.tsx` | DL 前に `evaluateDownload()` ガード、ロック時は `<FollowGateModal>` 起動 |
| `src/components/RecommendedPatterns.tsx` | 一部パターンが trial で locked になる |
| `next.config.ts` | 必要なら環境変数公開設定 (`NEXT_PUBLIC_*` は使わない、サーバー側のみ) |
| `.env.example` | 新環境変数 4 つ追記 |

### 2.5 認証関連の型拡張

```typescript
// src/types/auth.ts (新規)
export interface AccessState {
  isPremium: boolean;
  tier: "trial" | "premium";
  reason: "follower" | "passphrase" | "trial" | "killswitch-disabled";
  needsReauth: boolean;
  isLoggedIn: boolean;
  isFollower: boolean;
  isSubscribed: boolean;
}

export interface FeatureFlags {
  TRIAL_MODE_ENABLED: boolean;
  FOLLOW_AUTH_ENABLED: boolean;
  PREMIUM_LOCK_ENABLED: boolean;
  DOWNLOAD_LOCK_ENABLED: boolean;
}
```

JWT 型拡張:

```typescript
// 拡張 next-auth JWT
declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    name?: string;
    login?: string;
    picture?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    scope?: string;
    isFollower?: boolean;
    followCheckedAt?: number;
    followedAt?: string;
    error?: "RefreshTokenError" | "FollowCheckError";
  }
}
```

---

## 3. API ラッパー設計

### 3.1 `src/lib/twitch/follower-check.ts`

```typescript
import type { TwitchFollowResult } from "@/types/auth";

/**
 * Returns whether `userId` follows `broadcasterId` on Twitch.
 *
 * Failure modes:
 * - 401 → token failed; result.error = "unauthorized" (caller should mark needsReauth)
 * - 429 → rate-limited; up to 3 retries with backoff [1s, 3s, 10s]
 * - 5xx / network → result.fellBackTo = "stale-cache" if available, else "fail-safe"
 *
 * The caller is responsible for persisting result to JWT and reading the
 * stale cache (we don't read JWT here to keep this pure).
 */
export async function checkIsFollower(
  userAccessToken: string,
  userId: string,
  broadcasterId: string,
  staleCache?: { isFollower: boolean; checkedAt: number }
): Promise<{
  isFollower: boolean | null;
  followedAt?: string;
  error?: "unauthorized" | "rate-limited" | "network" | "server";
  source: "fresh" | "stale-cache" | "fail-safe";
}> {
  const url = `https://api.twitch.tv/helix/channels/followed?user_id=${encodeURIComponent(userId)}&broadcaster_id=${encodeURIComponent(broadcasterId)}`;
  const headers = {
    Authorization: `Bearer ${userAccessToken}`,
    "Client-Id": process.env.AUTH_TWITCH_ID!,
  };

  const backoffs = [1000, 3000, 10000];
  let lastError: "rate-limited" | "network" | "server" | undefined;

  for (let i = 0; i < 1 + backoffs.length; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 401) {
        return { isFollower: null, error: "unauthorized", source: "fail-safe" };
      }
      if (res.status === 429) {
        if (i < backoffs.length) {
          await sleep(backoffs[i]);
          lastError = "rate-limited";
          continue;
        }
        return cacheFallback(staleCache, "rate-limited");
      }
      if (res.status >= 500) {
        if (i < backoffs.length) {
          await sleep(backoffs[i]);
          lastError = "server";
          continue;
        }
        return cacheFallback(staleCache, "server");
      }
      if (!res.ok) {
        return cacheFallback(staleCache, "server");
      }

      const json = await res.json();
      const isFollower = (json.data?.length ?? 0) > 0;
      const followedAt = json.data?.[0]?.followed_at;
      return { isFollower, followedAt, source: "fresh" };
    } catch {
      lastError = "network";
      if (i < backoffs.length) {
        await sleep(backoffs[i]);
        continue;
      }
      return cacheFallback(staleCache, "network");
    }
  }

  return cacheFallback(staleCache, lastError ?? "network");
}

function cacheFallback(
  cache: { isFollower: boolean; checkedAt: number } | undefined,
  error: "rate-limited" | "network" | "server"
): { isFollower: boolean | null; error: typeof error; source: "stale-cache" | "fail-safe" } {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  if (cache && Date.now() - cache.checkedAt < TWENTY_FOUR_HOURS) {
    return { isFollower: cache.isFollower, error, source: "stale-cache" };
  }
  return { isFollower: false, error, source: "fail-safe" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
```

**設計思想**:
- 副作用ゼロ（JWT 読み書きしない）→ pure function、テスト容易
- リトライ上限 3 回（1s / 3s / 10s）→ 最悪 14 秒で確定
- 24h cache fallback で fail-safe を緩和（API 障害時に follower がロックされない）
- error と source を分けて返す → UI で「障害です」表示の根拠に使える

### 3.2 unit test 想定

```typescript
// src/lib/twitch/__tests__/follower-check.test.ts (Phase 2 で実装、Phase 1 では手動テスト)
- 200 + data 1 件 → isFollower=true
- 200 + data 0 件 → isFollower=false
- 401 → error="unauthorized", source="fail-safe"
- 429 1回 → リトライ後成功
- 429 4回 → cacheFallback
- 5xx → cacheFallback
- network error → cacheFallback
- cacheFallback でキャッシュあり (< 24h) → cache 値返す
- cacheFallback でキャッシュなし → false
- cacheFallback でキャッシュ古い (> 24h) → false
```

---

## 4. サーバーサイド再検証

### 4.1 設計方針：JWT 信用（軽量パス）を採用

研究 doc §6 + 9 件論点確定 #C で **JWT 信用方式** を採用。理由：
- JWT は HttpOnly cookie + Auth.js 署名済みでクライアント改竄不可
- 「DL 押下時に毎回 Twitch API」は遅延 + レート消費 + 障害伝播
- セキュリティ上のメリット少ない

### 4.2 `src/app/api/download-check/route.ts`

```typescript
import { auth } from "@/auth";
import { evaluateAccess } from "@/lib/auth/premium";
import { getFeatureFlags } from "@/lib/auth/feature-flags";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { size, format } = await req.json(); // 28/56/112, "png"/"gif"
  const session = await auth();
  const flags = getFeatureFlags();
  const access = evaluateAccess(session, flags);

  // killswitch: download lock 自体が無効
  if (!flags.DOWNLOAD_LOCK_ENABLED) {
    return NextResponse.json({ allowed: true });
  }

  // trial mode 制限: 28px PNG だけ通過
  if (access.tier === "trial") {
    if (size === 28 && format === "png") {
      return NextResponse.json({ allowed: true });
    }
    return NextResponse.json(
      { allowed: false, reason: "trial-restriction", tier: "trial" },
      { status: 403 }
    );
  }

  return NextResponse.json({ allowed: true });
}
```

### 4.3 クライアント側からの呼び出し

```typescript
// PreviewCard.tsx の handleDownload 改修
const handleDownload = async () => {
  const ok = await fetch("/api/download-check", {
    method: "POST",
    body: JSON.stringify({ size: variant.size, format: variant.isGif ? "gif" : "png" }),
  });
  if (!ok.ok) {
    setShowFollowGate(true); // モーダル起動
    return;
  }
  // 既存の DL ロジック
};
```

### 4.4 不正改竄ケースの保護

クライアント側の `tier === "trial"` を `"premium"` に書き換え → 確認モーダル迂回 → 直接 DL 関数実行を試みる場合、`/api/download-check` で 403。本来の blob 生成は完全クライアントサイドで行われるが、**チェック API を必ず経由する設計**にすることで、ユーザーは「フェイク tier では blob 生成できない」状態を作る。

完全な迂回防止は不可能（賢い人は devtools で fetch を skip する）が、**95% のユーザーには有効な防御**。

---

## 5. 既存ユーザーマイグレーション

### 5.1 課題

scope 追加（`user:read:follows`）により、既存セッションは旧 scope のままで:
- access_token は JWT に未保存（現行 `src/auth.ts`）
- 新 scope で再認可していないので `/helix/channels/followed` を叩けない
- 結果: 既存ログインユーザーは「お試し版」でも「スタンダード版」でもない宙吊り状態

### 5.2 検出ロジック

`evaluateAccess()` で:

```typescript
function evaluateAccess(session, flags): AccessState {
  // ...
  const hasAccessToken = !!session?.access_token;
  const hasFollowsScope = (session?.scope ?? "").includes("user:read:follows");
  const isStaleSession = session?.user && (!hasAccessToken || !hasFollowsScope);

  return {
    // ...
    needsReauth: isStaleSession,
    // 旧 scope 者は trial 扱い + needsReauth フラグで UI 誘導
    tier: isFollower || isSubscribed ? "premium" : "trial",
  };
}
```

### 5.3 UI 誘導：`<ReauthBanner />`

旧 scope セッションを持つユーザー（`needsReauth === true`）に対して:

**1 回目（初回 mount 時）**: 上部に目立つバナー表示
```
🔄 Twitch ログインを更新するとフォロー特典が自動で有効化されます
[Twitch でログインし直す] [×]
```

**× で閉じた後**: localStorage で記憶 → 以降は **小さい控えめな表示**（ヘッダー右の警告アイコン等）に切替。完全に消すのは不可（特典を見逃す原因）。

### 5.4 既存サブスク (PASSPHRASE) 者の扱い

PASSPHRASE で localStorage `emote-subscriber=true` が立っている既存ユーザーは:
- `isSubscribed = true` → `isPremium = true`
- ReauthBanner は表示するが、**特典は既に有効**なので緊急性なし
- バナー文言を分岐: 「Twitch ログインで特典を有効化できます（合言葉も継続して使えます）」

### 5.5 マイグレーション期間中の状態マトリクス

| 状態 | isLoggedIn | hasFollowsScope | isFollower | isSubscribed (PASS) | tier | needsReauth | banner |
|---|---|---|---|---|---|---|---|
| 未ログイン | false | - | false | false | trial | false | なし |
| 未ログイン + 合言葉 | false | - | false | true | premium | false | なし |
| 旧ログイン | true | false | (不明) | false | trial | true | 目立つ |
| 旧ログイン + 合言葉 | true | false | (不明) | true | premium | true | 控えめ |
| 新ログイン (フォロー無) | true | true | false | false | trial | false | なし |
| 新ログイン (フォロー有) | true | true | true | false | premium | false | なし |
| 新ログイン (フォロー有) + 合言葉 | true | true | true | true | premium | false | なし |

---

## 6. 環境変数 killswitch

### 6.1 環境変数一覧

| 変数 | 値 | 役割 | 緊急時の使い方 |
|---|---|---|---|
| `AUTH_TWITCH_BROADCASTER_ID` | 数値文字列 | Aki のチャンネル ID（固定） | 不変 |
| `TRIAL_MODE_ENABLED` | `true`/`false` | お試し版制限自体の有無 | `false` で全ユーザー premium 扱い |
| `FOLLOW_AUTH_ENABLED` | `true`/`false` | フォロー判定機能 | `false` で API 呼び出し全停止、PASSPHRASE のみ |
| `PREMIUM_LOCK_ENABLED` | `true`/`false` | 既存サブスク特典のロック | `false` で全機能解放 |
| `DOWNLOAD_LOCK_ENABLED` | `true`/`false` | DL 制限 | `false` で全 DL 解放 |

### 6.2 評価優先順位（`feature-flags.ts` + `premium.ts`）

```typescript
export function evaluateAccess(session, flags): AccessState {
  const isLoggedIn = !!session?.user;
  const isSubscribed = session?.isSubscribed ?? false;  // PASSPHRASE
  const isFollower = flags.FOLLOW_AUTH_ENABLED ? (session?.isFollower ?? false) : false;

  // killswitch 1: TRIAL_MODE_ENABLED = false → 全員 premium
  if (!flags.TRIAL_MODE_ENABLED) {
    return { isPremium: true, tier: "premium", reason: "killswitch-disabled", ... };
  }

  // 通常評価: OR 結合
  const isPremium = isFollower || isSubscribed;
  const tier = isPremium ? "premium" : "trial";

  return { isPremium, tier, reason: ..., ... };
}
```

各 UI 側でさらに:
- `PREMIUM_LOCK_ENABLED = false` → 既存サブスク特典の locked 表示を全部解除
- `DOWNLOAD_LOCK_ENABLED = false` → DL チェック skip

### 6.3 緊急時の段階的縮退

| シナリオ | 操作 | 効果 |
|---|---|---|
| 軽い炎上 | `DOWNLOAD_LOCK_ENABLED=false` | DL は全員可、ただし特典機能はロック維持 |
| 中程度 | + `PREMIUM_LOCK_ENABLED=false` | 全機能解放、follower 判定は継続 |
| 大炎上 | + `TRIAL_MODE_ENABLED=false` | 完全に「フォロー認証を試みている形跡」を消す |
| Twitch API 停止 | `FOLLOW_AUTH_ENABLED=false` | フォロー判定機能を完全停止、PASSPHRASE のみ受け付け |

### 6.4 broadcaster_id 取得手順（`AUTH_TWITCH_BROADCASTER_ID`）

実装着手前に Aki が 1 度だけ実行:

```bash
# 1. App access token を取得
TOKEN=$(curl -s -X POST \
  "https://id.twitch.tv/oauth2/token" \
  -d "client_id=$AUTH_TWITCH_ID" \
  -d "client_secret=$AUTH_TWITCH_SECRET" \
  -d "grant_type=client_credentials" \
  | jq -r .access_token)

# 2. ユーザー ID を取得
curl -s "https://api.twitch.tv/helix/users?login=datsusara_aki" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Client-Id: $AUTH_TWITCH_ID" \
  | jq .data[0].id

# 出力例: "123456789"
# → Vercel 環境変数 AUTH_TWITCH_BROADCASTER_ID に設定
# → ローカル .env.local にも同様に
```

---

## 7. 文言・UI コピー全集

### 7.1 ロック解除モーダル（DL クリック時 = 本格誘導）

**確定済みメインコピー**:
> 開発者への応援のお礼にダウンロードを開放してます。
> Twitchで @datsusara_aki をフォローして、作品を受け取ってください。

**モーダル構成**:
```
┌─────────────────────────────────────┐
│ [×]                                  │
│                                      │
│  💜 Twitch でフォローしてダウンロード │
│                                      │
│  [プレビュー大表示: 28x28 のみ]      │
│  56/112: 「フォローで解放」プレース   │
│                                      │
│  開発者への応援のお礼に DL を開放...   │
│                                      │
│  ┌─ Aki プロフィール ─────────────┐  │
│  │ • {Aki 自己紹介行 1}             │  │
│  │ • {Aki 自己紹介行 2}             │  │
│  │ • {Aki 自己紹介行 3}             │  │
│  │ {最新配信リンク or チャンネル URL}│  │
│  └────────────────────────────────┘  │
│                                      │
│  [Twitchでフォローする →]             │
│  [フォロー済み・解除を確認 →]         │
│                                      │
│  ───────                             │
│  合言葉をお持ちの方はこちら           │
│  [合言葉を入力 ▼]                    │
│  (展開時) [_________] [送信]         │
│                                      │
└─────────────────────────────────────┘
```

### 7.2 軽い解説モーダル（鍵マーク押下時 = 軽量）

**用途**: trial 中のユーザーが limited animation や locked border style の鍵マークをクリックした時

```
┌────────────────────────────────────┐
│ 🔒 「{機能名}」はフォロー特典です    │
│                                     │
│ Twitch で @datsusara_aki をフォロー  │
│ すると使えるようになります。          │
│                                     │
│ [今フォローする]  [後で]             │
└────────────────────────────────────┘
```

`今フォローする` クリック → §7.1 の本格誘導モーダルに遷移
`後で` クリック → 閉じる

**頻度制御**: 同一セッション内の表示回数を `localStorage.featureLockHintCount` でカウント。閾値（提案: **5 回**）を超えたら以降は tooltip のみ表示。

### 7.3 旧 scope ログイン者向け再ログインバナー（ReauthBanner）

**初回表示（目立つ）**:

案 I-1（推奨）: 「特典の有効化」を主目的に
```
🔄 Twitch ログインを更新すると、フォロー特典が有効になります
   [Twitch でログインし直す]  [×]
```

案 I-2: 「フォロー認識の問題」を主目的に
```
⚠️  既にフォロー済みでも認識されない場合があります。Twitch ログインを更新してください。
   [ログインし直す]  [×]
```

→ §A 確認項目 (I) に登録、Aki が選ぶ

**2 回目以降（控えめ）**:
ヘッダー右の警告アイコン:
```
⚠️ (hover で「フォロー特典の有効化が必要です」)
```

クリックで初回バナーを再表示。

### 7.4 Aki 3行プロフィール（モーダル内）✅ 確定

**確定文言**（脱力型・親しみやすさ優先）:
```
• 個人で色々作ってる人
• Twitchで配信もしてます
• 最近ゲーム作りました（爆走！ランデブー）
```

実装時はそのままハードコードでOK。後日トーン調整したくなったら同所を編集するだけ。

### 7.5 「お試し版で使用中」バッジ + 数字表記（#5 宙吊り）

**バッジ位置**: ヘッダー左下 or ロゴ右
```
[お試し版で使用中]
```

**数字表記の 4 候補（§A 確認項目 B）**:

- 案 A（直球）: `使えるアニメ: 2/52`
- 案 B（ポジ）: `フォロー特典: あと 50 種のアニメ`
- 案 C（中立）: `基本 2 種利用中・全 52 種はフォロー特典`
- 案 D（数字なし）: バッジのみ表示、各機能の鍵マークで暗黙的に伝える

**Aki が後日選択**。実装は**案 D を default**にして、文言追加だけで案 A/B/C に切替できるよう汎用化。

### 7.6 プライバシーポリシー追記項目（Aki が本文起草、§A 確認項目 D）

最低限カバーすべき項目:

```
■ Twitch 連携について

本サービスは Twitch のフォロー判定機能を使用しています。

【取得する情報】
- Twitch ユーザー ID
- 表示名 / ユーザー名
- メールアドレス
- プロフィール画像 URL
- @datsusara_aki チャンネルへのフォロー有無
  （他の配信者へのフォロー情報は取得しません）
- フォロー日時（表示用）

【利用目的】
- アカウント識別と表示
- 一部機能（ダウンロード等）の利用権限判定

【保存場所と期間】
- Cookie 内のセッショントークンに保存
- セッション期間中（最大 30 日）のみ
- 永続データベースには保存しません

【第三者提供】
- 行いません

【削除請求】
- ログアウトでセッショントークンと共に消去されます
- Twitch 側でアプリ連携を解除すると、本サービスは Twitch に
  問い合わせることができなくなります
```

### 7.7 エラー文言

| シーン | 文言 |
|---|---|
| Twitch API 一時障害 (cache fallback) | 「Twitch 側のシステムで一時的な問題が発生しています。フォロー特典が一時的に保護されない場合は、しばらくしてから再度お試しください。」 |
| 旧 scope 401 | 「フォロー判定が更新できませんでした。Twitch ログインを更新してください。」+ 再ログインボタン |
| Refresh token 失効 | 「セッションの期限が切れました。Twitch でログインし直してください。」 |
| フォロー判定 false かつ 直前にフォロー済 | 「フォローはまだ反映されていない可能性があります。数分待ってから [再確認] してください。」 |

### 7.8 成功文言

| シーン | 文言 |
|---|---|
| フォロー再認証 → premium 化 | 「✨ フォロー特典が有効になりました。28/56/112px すべてダウンロードできます。」 |
| PASSPHRASE 通過 | 「合言葉を確認しました。全機能を利用できます。」 |
| Twitch 初回ログイン → premium | 「ようこそ！フォロー特典が利用可能です。」 |

### 7.9 「Twitchでフォローする」ボタンの URL（utm 計測）

| ボタン位置 | URL |
|---|---|
| 本格誘導モーダル | `https://twitch.tv/datsusara_aki?utm_source=emote_generator&utm_medium=lock_modal` |
| 軽い解説モーダル | `https://twitch.tv/datsusara_aki?utm_source=emote_generator&utm_medium=key_icon` |
| 初回オンボーディング系 | `https://twitch.tv/datsusara_aki?utm_source=emote_generator&utm_medium=onboarding` |

→ Aki が Twitch ダッシュボードで「どの導線が効いてるか」を後から測定可能に。

---

## 8. テスト計画

### 8.1 自動テスト（Phase 1 ではスキップ可、Phase 2 で追加）

- `follower-check.ts` の error 分岐
- `premium.ts` の OR 結合と killswitch 評価
- `feature-flags.ts` の env 読み込み

### 8.2 手動テスト（Phase 1 必須）

| # | シナリオ | 期待動作 |
|---|---|---|
| 1 | 未ログイン状態で 28px PNG DL | 成功 |
| 2 | 未ログイン状態で 112px PNG DL | FollowGateModal 表示、DL なし |
| 3 | 未ログイン状態で アニメ「sparkle」(subscriberOnly) クリック | 鍵マーク → FeatureLockHint 表示 |
| 4 | フォロー無し新ログインで 112px DL | FollowGateModal 表示 |
| 5 | フォロー有り新ログインで 112px DL | DL 成功 |
| 6 | フォロー有り新ログインで 限定アニメ 全 45 種 | 全部選択可、DL も GIF も成功 |
| 7 | 旧ログイン (PASSPHRASE 無し) で UI 開く | ReauthBanner 表示 + trial UI |
| 8 | 旧ログイン (PASSPHRASE 有り) で UI 開く | ReauthBanner 表示（控えめ） + premium UI |
| 9 | フォロー後に「フォロー済み・解除を確認」ボタン | signOut → signIn → premium 化 |
| 10 | 合言葉入力 (inline 展開) で premium 化 | 旧挙動どおり全機能解放 |
| 11 | DOWNLOAD_LOCK_ENABLED=false 切替 | trial でも全 DL 通る |
| 12 | TRIAL_MODE_ENABLED=false 切替 | 全機能解放、UI から trial badge 消える |
| 13 | FOLLOW_AUTH_ENABLED=false 切替 | API 呼び出し停止、PASSPHRASE のみ機能 |
| 14 | フォロー後 → アンフォロー → 同セッションで DL | DL 成功（次回ログインまで猶予、仕様通り） |
| 15 | フォロー後 → アンフォロー → 再ログイン → DL | FollowGateModal 表示（再判定で false に） |
| 16 | Twitch API 障害シミュレーション (api.twitch.tv DNS block) | cache fallback 動作、24h 内なら follower 値維持 |
| 17 | クライアント devtools で `tier="premium"` に書換 → DL | サーバー側 403、blob 生成不可 |

### 8.3 副アカウントの準備（§A 確認項目 F）

Aki 本人は自分自身をフォローできない（broadcaster 制約）→ テスト用副アカ:
- アカウント A: `datsusara_aki_test_follower`（フォロー済み）
- アカウント B: `datsusara_aki_test_nonfollower`（フォロー無し）

または信頼できる仲間 1〜2 名に「テスト協力依頼」。

---

## 9. ロールアウト計画

### 9.1 Phase 1 段階的公開フロー

```
Step 0: 環境変数準備（実装着手前）
  - AUTH_TWITCH_BROADCASTER_ID 取得（§6.4 手順）
  - Vercel に上記 + 4 つの killswitch 環境変数を設定
  - すべて TRIAL_MODE_ENABLED=true で投入準備

Step 1: feature branch で実装
  - branch: fix7-follower-auth
  - §FOLLOWER_AUTH_IMPL_PROMPT.md の段階的コミット

Step 2: preview deploy（feature branch push）
  - Vercel が preview URL を生成
  - Aki + 副アカ A/B でテスト計画 §8.2 を全件実行
  - 知人数名にも preview URL 共有して挙動確認

Step 3: Aki と Claude で再確認
  - §8.2 全件 pass
  - SNS 文言・モーダル文言の最終確認
  - DSA 確認（§A 確認項目 E）完了

Step 4: main FF マージ → production
  - 環境変数を main 用 Vercel project に設定済みであることを再確認
  - main FF push → Vercel が自動デプロイ

Step 5: production smoke test（10 分以内）
  - production URL で §8.2 から #1, #5, #11 だけ即実行
  - bundle marker 検証（ビルド一致確認）

Step 6: 告知 + 監視（24-48h）
  - Twitch 配信での告知（タイミング: 配信中の自然な流れで）
  - X / Discord 告知（タイミング: Aki 判断）
  - Umami / SNS / Discord での反応モニタリング

Step 7: 1 週間後の振り返り
  - フォロー数推移
  - DL 試行率の変動
  - クレーム件数
  - 問題なければ継続、悪評発生で §10.4 インシデント対応
```

### 9.2 ロールバック判断基準

| メトリクス | 緊急切替 |
|---|---|
| SNS 言及で「炎上」「最悪」「不快」が短時間で 5 件以上 | `DOWNLOAD_LOCK_ENABLED=false` |
| Discord で 3 件以上のクレーム | `DOWNLOAD_LOCK_ENABLED=false` |
| Umami で DL 試行 → 完了率の急減（80% → 30% など） | `DOWNLOAD_LOCK_ENABLED=false` |
| Twitch から API 利用警告メール | 全 killswitch 無効化 + 即 revert |
| Aki 自身の判断で「これは続けたくない」 | 任意 |

---

## 10. リスクモニタリング + インシデント対応 playbook

### 10.1 監視項目（24-48h 重点期間）

| 項目 | 観察方法 | 異常閾値 |
|---|---|---|
| SNS 反応 | X 検索 ｢エモジェネ｣｢twitch-emote-generator｣｢Aki エモート｣｢#エモジェネ｣ 等を 1〜2h おきに巡回 | ネガティブ言及 5+ |
| Discord 言及 | Aki の Discord サーバ + ゲーム関連 Discord を確認 | クレーム 3+ |
| Twitch チャット | 配信中のチャットの言及 | 不満コメント 2+ |
| DL 完了率 | Umami の DL イベント `start` vs `complete` の比率 | start比 完了率が 50% を切る |
| フォロー数推移 | Twitch ダッシュボード | 0 増 or マイナス |
| エラー率 | Vercel Functions ログ | /api/download-check 5xx が 1%超 |
| Twitch API rate | `Ratelimit-Remaining` ヘッダー | 残 200 を切る |

### 10.2 utm 計測による導線分析

§7.9 で仕込んだ utm パラメータで、Twitch ダッシュボードの「Acquisition」or 「Insights」から:
- `utm_medium=lock_modal` 経由のフォロー: DL ロック誘導の効果
- `utm_medium=key_icon` 経由: 軽量モーダル経由のコンバージョン
- `utm_medium=onboarding` 経由: 初回バナー経由のコンバージョン

→ 「DL ロックは効くが key_icon は弱い」のような知見が出れば Phase 2 で改善。

### 10.3 1 週間後の振り返り KPI

- フォロー数: 増加幅と速度（前週比、急増 → イベント効果、緩急 → 自然増）
- DAU: 維持 / 減少（離脱率の変動）
- DL 完了率: trial 28px DL がどれくらい使われているか（多い = trial に価値ある証拠）
- 競合への流出兆候: 競合ツール (makeemotes 等) の Twitter 言及数の急増を観察

### 10.4 インシデント対応 playbook（独立セクション）

**前提**: 環境変数切替は Vercel 経由 → 約 1〜2 分で反映

**Tier 1 軽症（数件のクレーム）**
- Aki が応答 (X / Discord)
- 様子見、変更なし

**Tier 2 中症（10 件以上のネガ言及 / DL 完了率低下）**
- Step1: Vercel ダッシュボードで `DOWNLOAD_LOCK_ENABLED=false` に
- Step2: Vercel が auto deploy → 1〜2 分で反映
- Step3: SNS で「設定を一時調整しました」アナウンス
- Step4: その間に原因分析（どの導線で離脱しているか）
- Step5: 修正版設計を Claude Code に依頼

**Tier 3 重症（炎上・100+ 件のネガ・拡散）**
- Step1: 全 killswitch を一気に false 化
   - `TRIAL_MODE_ENABLED=false`
   - `DOWNLOAD_LOCK_ENABLED=false`
   - `PREMIUM_LOCK_ENABLED=false`
- Step2: SNS で「ご迷惑をおかけしました、機能制限を撤回します」アナウンス
- Step3: コードレベルでの roll back を検討
   - 即 revert: `git revert {fix7 commit hash}` → push
   - main を fix6 まで戻す: `git reset --hard {fix6 hash} && git push --force-with-lease origin main`
   - 後者は force push なので慎重に
- Step4: Twitter 等で謝罪 + 後日改善を約束

**Tier 4 緊急（Twitch から警告メール / API revoke 兆候）**
- Step1: 全 killswitch を即時 false 化
- Step2: Twitch サポートに状況確認 (`developer-support@twitch.tv`)
- Step3: API 利用を一時停止（FOLLOW_AUTH_ENABLED=false）
- Step4: 根本原因解決まで再開しない

### 10.5 緊急連絡用 SOP

```bash
# Vercel 環境変数切替（CLI 想定、Aki が事前に vercel CLI 設定済み）
vercel env add DOWNLOAD_LOCK_ENABLED production
# value: false

# 即時反映確認
curl -sI https://twitch-emote-generator.vercel.app/

# 緊急 revert（最終手段）
git -C "/path/to/repo" reset --hard 2e2f71e  # fix5 の前の安定 hash
git -C "/path/to/repo" push --force-with-lease origin main
```

---

## 11. お試し版で残すアニメ2種 ✅ 確定: `bounce` + `shake`

**確定**: お試し版で利用可能なアニメは **`bounce`（ぴょこぴょこ）+ `shake`（震える）** の 2 種。

### 確定理由

- 親しみ系（bounce）+ 感情表現系（shake）の補完的な組み合わせ
- Twitch チャットでよく使われる「喜び」「驚き・笑い」の動きをカバー
- 試した瞬間に「動き」が分かりやすく、無料体験としての満足度が立つ
- 派手すぎず、「フォローでもっと欲しい」の心理に綺麗に繋がる温度感

### 実装メモ

- `src/types/emote.ts` に新規定数 `TRIAL_ANIMATIONS = ["bounce", "shake"] as const` を export
- `src/components/settings/AnimationSettings.tsx` で `tier === "trial" && !TRIAL_ANIMATIONS.includes(opt.value)` を locked 判定
- ロックされたアニメをクリック → `<FeatureLockHint feature="アニメ" label={opt.label} />` 起動

### 検討した候補（履歴として保持・後日変更検討用）

実装後に「やっぱり違う組み合わせを試したい」となったときの参考として、初回検討した 5 候補を残す:

| # | 組み合わせ | 推奨度（当時） | 理由 |
|---|---|---|---|
| **A** ✅ | `bounce` + `shake` | ★★★★ | **採用**：親しみ + コミカル。喜怒の動きの定番カバー |
| B | `bounce` + `hearts` | ★★★★★ | 親しみ + 推し文化（Twitch 視聴者層と相性最強） |
| C | `blink` + `bounce` | ★★★★ | 注目度（チャット視認性高） + 親しみ。実用度重視 |
| D | `shake` + `zoomin` | ★★★ | 強調系で派手目。「ツールの実力」を見せたいなら |
| E | `bounce` + `spin` | ★★★ | 派手で印象強い。trial 価値が下がる懸念 |

**変更時の手順**: `TRIAL_ANIMATIONS` 定数を 1 行書き換えて再デプロイすれば即切替可能。

---

## 12. 実装着手前の Aki 確認項目（再掲・一覧）

冒頭の表を blocker 度順 + 確定状況で整理:

### ✅ 確定済み（実装で参照すれば良い）

- **A** ✅ お試し版アニメ2種：**`bounce` + `shake`**（§11）
- **G** ✅ Aki 3行プロフィール：脱力型 3 行で確定（§7.4）

### ⛔ 実装直前 blocker（実装着手前に Aki が実行）

- **C** broadcaster_id 取得（§6.4 の curl 手順 → Vercel + `.env.local` 設定）

### ⏸ 実装中に決定可（default 採用 + 後日 swap）

- **B** 数字表記の 4 案選択（§7.5）— **default 案 D（数字なし）で実装、後日 props で切替**
- **F** テスト用副アカウント準備（§8.3）— テスト時に実施
- **I** 旧 scope 再ログインバナー文言（§7.3）— **default 案 I-1（推奨）で実装、後日変更可**
- **J** PASSPHRASE 機能の継続期限（§6）— 運用開始後に決定

### ⛔ Production 反映前 blocker（main FF 前に Aki が完了）

- **D** プライバシーポリシー本文起草（§7.6）— 既存 PP 場所確認 + 必須項目を文章化
- **E** DSA (Twitch Developer Service Agreement) 原文確認 — https://legal.twitch.com/legal/developer-agreement

### 📦 Phase 2 に持ち越し（Phase 1 では実装しない）

- **H** 最新配信リンク取得方針 — Phase 1 では Aki チャンネル URL リンクのみ。配信状態取得は Phase 2 で検討

---

## 付録 A: 関連ドキュメント

- [`FOLLOWER_AUTH_RESEARCH.md`](./FOLLOWER_AUTH_RESEARCH.md) — Phase 0 調査
- [`FOLLOWER_AUTH_IMPL_PROMPT.md`](./FOLLOWER_AUTH_IMPL_PROMPT.md) — Phase 1 実装プロンプト
- [`CLAUDE.md`](./CLAUDE.md) — プロジェクト全体の文脈
- [`QUALITY_AUDIT.md`](./QUALITY_AUDIT.md) — 既存の修正履歴

## 付録 B: 用語集

| 用語 | 意味 |
|---|---|
| trial | お試し版（ログイン不要、機能制限あり） |
| premium | スタンダード版（フォロー or PASSPHRASE で解放） |
| isPremium | premium tier の boolean |
| isFollower | Twitch フォロー有無の boolean |
| isSubscribed | PASSPHRASE 入力済みの boolean（既存仕様の互換語） |
| needsReauth | 旧 scope セッションで再認可が必要な状態 |
| killswitch | 環境変数で機能を緊急停止できる仕組み |
| stale-cache | 24h 以内の前回フォロー判定結果のキャッシュ（API 障害時 fallback 用） |
| fail-safe | API 失敗時に「premium 不可」側に倒す方針（攻撃面を最小化） |

---

**設計完了。次は `FOLLOWER_AUTH_IMPL_PROMPT.md` の作成に進む。**
