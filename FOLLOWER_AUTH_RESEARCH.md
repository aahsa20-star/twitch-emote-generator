# Twitchフォロワー認証 事前調査レポート

**目的**: エモジェネのサブスク限定機能（合言葉 `PASSPHRASE`）を Twitch フォロワー判定に置き換える計画の前段調査。実装ゼロ・調査のみ。
**対象チャンネル**: Aki（`datsusara_aki`）の Twitch チャンネル
**調査者**: Claude (Sonnet)
**日付**: 2026-05-09
**スコープ**: Twitch API 仕様・認証フロー・規約・キャッシュ戦略・エッジケース

---

## 設計判断のための重要発見 TOP 3

### 🔑 #1. エンドポイント・スコープは1個追加で完結する

`GET /helix/channels/followed?user_id={USER}&broadcaster_id={AKI_ID}`

- 必要 scope: **`user:read:follows`** を 1 つ追加するだけ
- 現状 Auth.js v5 の Twitch provider のデフォルトは `"openid user:read:email"`。これに `user:read:follows` を足す
- レスポンスの `data` 配列が **空配列ならフォロー無し、1件以上なら有り**（`broadcaster_id` 指定時の絞り込み挙動）
- `followed_at` (ISO 8601) も含まれるので「フォロー歴◯日」UIも可能
- 1 ユーザートークン + 1 user_id 指定で完結 → 実装コスト最小

→ **設計**: ログイン時に 1 回 fetch し、結果（`isFollower: boolean` + `followedAt`）を JWT/session に保存する。

### 🔑 #2. access_token の JWT 永続化と refresh 機構が必須（現状未実装）

現状の `src/auth.ts` は access_token を**初回サインイン時の `/helix/users` 1回呼び出しにだけ**使っており、JWT には保存していない。フォロー判定を「ログイン時の1回限り」にするなら現状構造のままでも実装可能。だが**継続再判定**したい場合：

- access_token は OAuth Auth Code Flow で取得可能（next-auth が内部で行っている）
- expires_in は **token 取得時に Twitch が個別に返す**（4時間〜数日まで例によって幅あり、`expires_in` を信用する）
- refresh_token の rotation あり（新しい refresh_token も一緒に返るので保存し直す必要）
- Auth.js v5 公式パターンの `RefreshTokenError` を使った再ログイン誘導が標準
- **既存ユーザーへの影響**: 新 scope 追加後、既存セッションは古い scope のままなので、追加 API を呼ぶと 401 になる → 「次回ログイン時に再認可」を促す UI が必要

→ **設計**: 「ログイン時 1 回判定」案（追加実装最小、UX 良、フォロー解除後も次回ログインまで猶予）を**第一候補**に。継続検証は将来必要時に refresh 機構を足す。

### 🔑 #3. フォロー解除リアルタイム検知は **不可**（channel.unfollow EventSub は存在しない）

- `channel.follow` v2 EventSub はあり（必要 scope: `moderator:read:followers`）
- **`channel.unfollow` は存在しない**（フォロー履歴データの公開停止 2022〜の影響）
- リアルタイムでフォロー解除を検知する公式な方法 = **無い**
- 代替: 定期 polling（Get Followed Channels をN時間ごと再判定）
- WebSocket EventSub の制限: `max_total_cost = 10` per (client_id, user_id)、cost 1 の event で実質 10 件まで
- フォロー判定だけなら polling で十分、EventSub 投資は ROI 低

→ **設計**: 「ログイン時 1 回 + ユーザー操作で再判定ボタン」が現実解。リアルタイム監視は実装しない。

---

## 1. エンドポイント仕様

### 1.1 Get Followed Channels（**採用候補**）

| 項目 | 値 |
|---|---|
| URL | `GET https://api.twitch.tv/helix/channels/followed` |
| Token 種別 | **User access token** |
| 必要 scope | **`user:read:follows`** |
| 必須クエリパラメータ | `user_id`（ユーザー自身の ID） |
| 任意クエリ | `broadcaster_id`（特定の配信者のフォロー有無を確認）／`first`／`after` |
| レスポンス schema | `data[]` 配列、各要素に `broadcaster_id`, `broadcaster_login`, `broadcaster_name`, `followed_at` (ISO 8601) |
| ページネーション | あり（`pagination.cursor`） |
| 廃止予定 | **なし**（Get User Follows 旧 API は 2023 廃止だがこれが正規後継） |
| 公式 doc | https://dev.twitch.tv/docs/api/reference/#get-followed-channels |

**判定ロジック**:
```typescript
const res = await fetch(
  `https://api.twitch.tv/helix/channels/followed?user_id=${userId}&broadcaster_id=${AKI_ID}`,
  { headers: { Authorization: `Bearer ${userAccessToken}`, "Client-Id": CLIENT_ID } }
);
const json = await res.json();
const isFollower = (json.data?.length ?? 0) > 0;
const followedAt = json.data?.[0]?.followed_at; // 表示UI用、null可
```

**注意点**:
- token のユーザー ID と `user_id` パラメータは一致しなければならない（自分以外を確認できない）
- `broadcaster_id` を指定する形なら 1 件しか返らないのでページネーション不要
- スコープ不足なら HTTP 401 + `{"error":"Unauthorized","message":"Missing scope: user:read:follows"}`

### 1.2 Get Channel Followers（**今回不採用**、参考情報）

| 項目 | 値 |
|---|---|
| URL | `GET https://api.twitch.tv/helix/channels/followers` |
| Token 種別 | User access token (broadcaster 本人 or moderator 権限のあるユーザーのもの) |
| 必要 scope | **`moderator:read:followers`** |
| 必須クエリ | `broadcaster_id` |
| 任意クエリ | `user_id`（特定ユーザーがフォローしているかピンポイント確認） |
| 制約 | scope 不足時は **総フォロワー数のみ**返り、follower 個別情報は返らない |
| 公式 doc | https://dev.twitch.tv/docs/api/reference/#get-channel-followers |

**今回不採用の理由**:
- broadcaster 側（Aki本人）の token が必要 → エンドユーザー判定には使えない
- ユーザー視点で「自分が Aki をフォローしているか」を知るには #1.1 のほうが正攻法

ただしサーバー側で「フォロワー総数のサンプリング」「特定ユーザーが follower か検証する管理 API」用途では候補になる。

### 1.3 不明点

- Helix の per-endpoint cost（`/channels/followed` の point 消費は default の 1 と想定したが明示記載は確認できず → **不明**）

---

## 2. レートリミット

### 2.1 token 種別ごとの上限

| token 種別 | 上限（1 分あたり） | bucket 単位 |
|---|---|---|
| User access token | **800 リクエスト** | client_id × user_id × 分 |
| App access token (client credentials) | **800 リクエスト** | client_id × 分 |
| Client-Id のみ（token なし） | 30 リクエスト | client_id × 分 |

公式 doc: https://dev.twitch.tv/docs/api/guide#twitch-rate-limits

**バケットアルゴリズム**: token-bucket。各エンドポイントに point cost が割り当てられ（既定 1）、リクエストごとに減算。1 分以内にバケットを使い切ると 429 を返す。

### 2.2 レスポンスヘッダー

| ヘッダー | 意味 | 単位 |
|---|---|---|
| `Ratelimit-Limit` | バケットの最大ポイント数（≒ 800） | ポイント |
| `Ratelimit-Remaining` | 現時点の残ポイント | ポイント |
| `Ratelimit-Reset` | 補充までの timestamp | **Unix epoch（秒）** |

実装メモ: `Ratelimit-Reset` を見て `Date.now()/1000` との差で再試行 sleep 時間を計算。

### 2.3 超過時の挙動

- HTTP **429 Too Many Requests**
- レスポンスボディの正確な構造は doc に明示なし → **不明**（一般的には `{"error":"Too Many Requests","status":429,"message":"..."}` 形式と推定）

### 2.4 推奨リトライ戦略

公式 doc に明記なし → **不明**。一般的なベストプラクティス:
- 429 を検出したら `Ratelimit-Reset - Date.now()/1000` 秒待機
- 3 回リトライまで（指数バックオフ 1s / 2s / 4s）
- リトライ失敗なら 503 相当のエラーをユーザーに返す

### 2.5 今回ユースケースでの想定

ユーザー 1 ログインごとに 1 回 `/helix/channels/followed` を叩く想定なら、**1 ユーザーあたり 1 リクエスト/分** 以下。bucket は 800/min なので、同じ client_id で同じユーザーが連打しない限り絶対に枯渇しない。

ログイン同時多発（イベント時など）でも「client_id × user_id × 分」がバケット単位なので、ユーザー間で衝突しない。**実質レートリミット問題は発生しない**設計。

### 2.6 不明点

- リトライ戦略の Twitch 公式推奨（明記なし）→ 自社で標準化する必要

---

## 3. 認証フロー

### 3.1 既存実装の確認

`src/auth.ts`:
```typescript
import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Twitch],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        // /helix/users を 1 回呼んで user 情報を JWT に保存
      }
      return token;
    },
    // session callback で token から session に展開
  },
});
```

**観察**:
- access_token は `account` 経由で取得しているが **JWT に保存していない**
- 初回サインイン時にしか account は来ない（next-auth の仕様）
- セッション中の access_token への参照はゼロ → 後続 API 呼び出しはできない構造

### 3.2 必要な追加 scope

```typescript
Twitch({
  clientId: process.env.AUTH_TWITCH_ID!,
  clientSecret: process.env.AUTH_TWITCH_SECRET!,
  authorization: {
    params: {
      scope: "openid user:read:email user:read:follows",
    },
  },
})
```

next-auth Twitch provider のデフォルト scope は `"openid user:read:email"`（[ソース](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/providers/twitch.ts)）。`user:read:follows` を追加で 1 つだけ。

### 3.3 既存ユーザーの再認証フロー

**問題**: 既存セッションを持つユーザーは古い scope（`openid user:read:email` のみ）で発行された access_token を持つ。新しい `user:read:follows` API を叩くと 401。

**Twitch / OAuth 2.0 の仕様**:
- scope を増やしても既存 access_token は invalidate されない
- 新 scope の access_token を得るには **再ログイン（再認可）** が必要
- ユーザーには Twitch の認可画面で「追加の権限を求めています」と表示される

**Auth.js の挙動**:
- scope を変えただけでは既存セッションは生き続ける（token は old のまま）
- 強制的に再ログインさせるには `signOut` → `signIn` を誘導する必要

**移行設計案**:
1. Aki が新 scope をデプロイ
2. 既存ログイン済みユーザーは旧 scope の JWT を持つ
3. フォロー判定時に「access_token あり、scope 不足の可能性あり」を検出 → 401 ハンドルで再ログイン誘導 UI
4. 新規ユーザーは最初から新 scope で認可される

### 3.4 access_token の JWT 永続化（必要な変更）

```typescript
callbacks: {
  async jwt({ token, account }) {
    // 初回サインイン時のみ
    if (account?.access_token) {
      token.access_token = account.access_token;
      token.refresh_token = account.refresh_token;
      token.expires_at = account.expires_at; // unix epoch (秒)
      // ... 既存の user info 取得
    }

    // 以降のリクエストで expiry チェック
    if (token.expires_at && Date.now() >= (token.expires_at as number) * 1000) {
      // refresh
      try {
        const r = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_TWITCH_ID!,
            client_secret: process.env.AUTH_TWITCH_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refresh_token as string,
          }),
        });
        const j = await r.json();
        token.access_token = j.access_token;
        token.refresh_token = j.refresh_token; // rotation あり、必ず差し替え
        token.expires_at = Math.floor(Date.now() / 1000) + j.expires_in;
      } catch {
        token.error = "RefreshTokenError";
      }
    }
    return token;
  },
}
```

公式パターン: https://authjs.dev/guides/refresh-token-rotation

### 3.5 「ログイン時 1 回判定」最小実装案

JWT 永続化を**省略**して、サインイン時の `account.access_token` だけで `/helix/channels/followed` を 1 回呼び、結果 (`isFollower: boolean`) を JWT に保存して終わり。再判定なし。

```typescript
async jwt({ token, account }) {
  if (account?.access_token) {
    // 既存の /helix/users 呼び出し
    // ... 追加で:
    const fr = await fetch(
      `https://api.twitch.tv/helix/channels/followed?user_id=${user.id}&broadcaster_id=${AKI_ID}`,
      { headers: { Authorization: `Bearer ${account.access_token}`, "Client-Id": CLIENT_ID } }
    );
    const fj = await fr.json();
    token.isFollower = (fj.data?.length ?? 0) > 0;
    token.followedAt = fj.data?.[0]?.followed_at ?? null;
  }
  return token;
}
```

**長所**: 追加実装が token 保存に比べて 1/3 程度。refresh も不要。
**短所**: フォロー解除されてもセッション中は premium 維持される（最大セッション TTL 分）。

### 3.6 PKCE / state

next-auth Twitch provider は OAuth 2.0 Authorization Code Flow を使用。state は next-auth が自動管理、PKCE は OIDC 経由なので有効化されている（要 Twitch 側対応の確認 → next-auth provider のデフォルト挙動を信用する）。

### 3.7 不明点

- next-auth v5 beta が将来 Twitch refresh token rotation を自動化する計画があるか（現状は手動実装が必要）

---

## 4. プライバシー・利用規約

### 4.1 Twitch Developer Service Agreement の確認状況

公式 URL: https://legal.twitch.com/legal/developer-agreement
WebFetch では本文の自動抽出に失敗（ページが JavaScript 描画ベースで static HTML にコンテンツが含まれていない）→ **本文の精読は人間（Aki）による確認が必要**。

以下、Twitch dev forum + コミュニティガイドライン + 慣行から判断できる範囲:

### 4.2 follow gating（フォローによる機能解除）の許諾度

| ケース | 判定 |
|---|---|
| 外部 web app で「フォロー = premium 機能解除」 | **慣例上 OK**（StreamElements 等同様の事例多数）|
| Twitch Extensions（Twitch 内部 widget）で同じことをやる | **NG 寄り**：「Encouraging or rewarding users for taking specific actions outside Twitch/Amazon properties must not be a principal use case of the Extension」。Extensionsガイドラインに明記。エモジェネは Extension ではないので影響なし |
| 「フォロー数を金銭で買う」「fake follow を提供」 | **NG 明確**（dev forum で言及）|
| ユーザーをだまして無断でフォローさせる | **NG 明確** |

→ **エモジェネのケース（外部 web app + ユーザーが任意でフォロー → 機能解除）は慣行上 OK** と判断。ただし**条文を Aki が直接読んで再確認**することを推奨。

### 4.3 ユーザーへの開示義務（プライバシーポリシー記載必須事項）

OAuth + データ取得を行うアプリの一般的義務:
- Twitch でログインすること（OAuth provider の明示）
- 取得するデータ: ユーザー ID、表示名、メール、プロフィール画像、**フォロー先一覧**
- データの利用目的: フォロー有無の確認、premium 機能解除判定
- データの保持期間: セッション期間中のみ／永続保存しない／DB 保存する場合は期間明記
- 第三者提供: しない／するならその範囲
- 削除請求方法: ユーザーが要求した場合の削除フロー

エモジェネは現状 Supabase に Twitch user_id を保存（templates の作者紐付け等）。新たに「フォロー判定結果」を保存するなら、それも開示対象。

→ **プライバシーポリシー本文の更新が必須**（今回タスクの範囲外）。

### 4.4 データ保持期間

GDPR・CCPA・改正個人情報保護法（日本）視点での一般指針:
- 「目的達成に必要な期間」のみ保持
- フォロー判定結果は **セッション中のみ** か、最長でも数日が穏当
- 永続キャッシュ（DB に書く）すると削除請求対応の負担が増える
- Twitch DSA 自体に「N日以内に削除」のような明文ルールはない（推定、未確認）

→ **JWT に乗せてセッション期限切れで自動消滅、DB には書かない設計**が法務上もシンプル。

### 4.5 違反時のペナルティ

dev forum・公式 doc から推定:
- API key revocation（Client ID の利用停止）
- 警告 → アクセス制限 → 停止 のエスカレーション
- "false follows" を提供した bot は dev community で警告事例あり

エモジェネのケースで違反するシナリオ:
- ユーザーに無断で複数フォロー要求 / fake follow を売る → 該当しない
- フォロー強要を spam 的に行う → 該当しない
- データを第三者に売る → やらない

→ **正常運用なら違反リスクは極小**。

### 4.6 不明点（Aki が原文確認必要）

- Developer Service Agreement の本文に「forced engagement」を禁ずる明文があるか
- 「フォロー = premium 機能解除」を明示禁止する条項があるか

これは原文を読んで判断する必要がある。短い時間で WebFetch で取れなかったので Aki が直接 https://legal.twitch.com/legal/developer-agreement にアクセスして「follow」「engagement」「incentivize」を検索して確認することを推奨。

---

## 5. キャッシュ戦略

### 5.1 公式の Cache-Control ヘッダー

`/helix/channels/followed` のレスポンスヘッダーに公式推奨キャッシュ期間が指定されているか → 公式 doc に明記なし → **不明**。

### 5.2 推奨パターン

エモジェネのユースケースに合致するもの:

| パターン | 実装 | 鮮度 | コスト |
|---|---|---|---|
| **A. ログイン時 1 回判定（推奨）** | サインイン時に 1 回 fetch、結果を JWT に焼き込む。次の signIn まで再判定なし | セッション TTL 分 stale | API 1 回/login |
| B. N 時間ごと再判定 | JWT に `lastCheckedAt` を持ち、access_token refresh と同時に再判定 | N 時間 stale | API 1 回/N時間 |
| C. アクセス毎チェック | リクエストごとに fetch | 即時 | API 大量、レート枯渇可能性 |
| D. EventSub `channel.follow` 監視 | サーバ側で follow event 受信 → DB 反映 | 即時（フォロー側）／追跡不能（解除側） | EventSub セットアップコスト + DB |

**推奨は A**。理由:
- フォロー解除は EventSub で検知不能なので、どの設計でも「最大 N 時間遅延」は避けられない
- A はフォロー解除後も次回ログインまで premium 維持 → ユーザー体験的にむしろ親切
- 実装最小、追加 DB スキーマ不要

### 5.3 セッション TTL の調整

next-auth のデフォルトセッション TTL は 30 日。フォロー解除後の猶予期間が長すぎるなら、`session.maxAge` を短く（7 日 等）に設定する余地あり。

### 5.4 EventSub をリアルタイム監視に使う場合のコスト

仮に Aki がサーバ側で `channel.follow` を監視するなら:
- WebSocket 1 接続 + subscription 1（cost 1）
- max_total_cost 10 のうち 1 を使う → 余裕
- ただし unfollow が監視できないので「フォロー有り → DB 反映」しかできず、解除検知は別仕組み必要
- DB 比較ロジックも必要（前回の DB 状態との差分検出）

→ **複雑化に対して効果限定的、不要**と判断。

### 5.5 不明点

- `Cache-Control` ヘッダーの実値（実測必要）

---

## 6. エッジケース

### 6.1 Twitch アカウント BAN ユーザー

- BAN されると access_token は revoke される
- 既存 JWT で API 呼び出し → 401（token invalid）
- refresh も失敗する
- **JWT に保持済みの `isFollower` は維持されるが、再判定する機会がないまま session 切れ**
- 設計影響: 「JWT に保存した結果は session TTL の間だけ信頼」というスタンスで OK

### 6.2 broadcaster チャンネル消失（Aki のチャンネル削除）

通常起こりえないが理論上:
- `broadcaster_id` が無効になり、API は data: [] を返す（推定）
- 全ユーザーが `isFollower: false` 判定 → premium 機能アクセス不可になる
- 設計影響: AKI_ID を環境変数に持つので「BROADCASTER_ID 未設定 or 無効時は subscribe フラグだけ既存どおり`PASSPHRASE`で動く」フォールバックを残せると安全

### 6.3 フォロー直後の判定遅延

- フォローボタンを押してからエモジェネで再ログイン → 即時反映
- 公式 doc に「N分以内に反映」のような遅延記述なし
- 実測ベースでは即時（数秒以内）と思われる
- 設計影響: 「フォロー直後は更新が遅れることがあります、再ログインで反映されます」の UI ヒント程度で十分

### 6.4 サブアカウント（複数フォロー）による回避リスク

- 1 ユーザーが複数 Twitch アカウントを作って全部でフォロー → 1 アカウントだけフォロー解除しても他で premium 維持
- これは Twitch 側で根本的に防げない（複数アカウント許容ルールゆえ）
- 設計影響: **許容**。回避コストが「複数アカウント運用」と高めなのでビジネス上のリスクは小さい
- 既存の `PASSPHRASE` 方式も「合言葉が広まれば全員アクセス可」なので、フォロワー認証のほうが**むしろ網が固い**

### 6.5 Twitch 側の OAuth 認可キャンセル

- ユーザーが Twitch 設定から「アプリを連携解除」した場合、access_token は revoke される
- 既存セッションの JWT は生きているが、新しい API 呼び出しは全部 401
- 設計影響: 「次回 access_token を使うタイミングで 401 → 再ログイン誘導 UI」で対応

### 6.6 不明点

- フォロー直後の Helix API 反映遅延の実測値（公式記載なし）

---

## 7. 設計提案サマリ（実装は別タスク）

### 7.1 段階的ロールアウト（推奨）

**Phase 1: フォロワー認証 MVP**（**最小実装**）
- Auth.js scope に `user:read:follows` 追加
- サインイン時に 1 回判定 → JWT に `isFollower: boolean` 保存
- session に `isFollower` 展開
- 既存の `PASSPHRASE` 経由 `isSubscriber` と論理和（`isPremium = isSubscriber || isFollower`）
- 既存の `PASSPHRASE` 機能は**残す**（既存ユーザー保護 + フォールバック）

**Phase 2: UX 改善**
- ログイン UI に「Akiの Twitch をフォローすると premium 機能が使える」を明示
- フォローボタンへのリンク埋め込み
- フォロー後の再判定ボタン（手動 force refresh）
- プライバシーポリシー更新

**Phase 3（後日検討）**: refresh token 機構を入れて N 時間ごと再判定

### 7.2 環境変数追加

```
AUTH_TWITCH_BROADCASTER_ID=<Akiのチャンネルuser_id（数字）>
```

Aki の数字 ID は `https://api.twitch.tv/helix/users?login=datsusara_aki` で取得（要 token）。固定値なので一度取って環境変数にハードコード。

### 7.3 既存ユーザー移行

- 既存ログイン済みユーザーは旧 scope の JWT を持つ → 「フォロー特典を使うには再ログインが必要」案内 UI
- `PASSPHRASE` 既存 sub ユーザーはそのまま継続（disrupt しない）
- 新規ユーザーには最初から新 scope で認可される

### 7.4 プライバシーポリシー更新項目

- Twitch でログインする旨の明示
- 取得データ: ID、display_name、login、email、profile image、**フォロー先一覧（特定 broadcaster のみ確認）**
- 利用目的: premium 機能アクセス権の判定
- 保持期間: JWT セッション中のみ、DB 永続化なし
- ユーザー削除請求方法

---

## 8. 実装に向けて Aki が判断すべき項目

| # | 項目 | 選択肢 |
|---|---|---|
| 1 | フォロー判定タイミング | A. ログイン時のみ ／ B. N 時間ごと ／ C. リクエスト毎 |
| 2 | フォロー解除の猶予期間 | session TTL 全部 ／ N 日固定 ／ ログアウト即時 |
| 3 | `PASSPHRASE` 機能の存続 | 残す（OR で繋ぐ）／ 廃止（フォロー必須に） |
| 4 | データの DB 保存 | しない（JWT のみ）／ する（filter UI 用に） |
| 5 | UI 上の文言 | 「フォロー特典」／「フォロワー限定」／「サポーター機能」等 |
| 6 | フォロー解除検知ポリシー | 検知しない（セッションTTLで自然消滅）／ refresh時に再確認 |
| 7 | 未フォローユーザーへのアフォーダンス | 機能をグレーアウト ／ クリック時にフォロー誘導 ／ 完全非表示 |
| 8 | DSA 本文確認 | Aki が原文を https://legal.twitch.com/legal/developer-agreement で読んで判断 |

---

## 9. 不明点まとめ（再調査・実測が必要なもの）

1. **`/helix/channels/followed` の正確な point cost**（既定 1 と推定、公式記載確認できず）
2. **429 レスポンスボディの正確な schema**（推定で書いたが要実測）
3. **Twitch 推奨リトライ戦略**（公式記載なし、業界標準で代用）
4. **Twitch Developer Service Agreement の follow gating に関する明文条項**（WebFetch で取れず、Aki 原文確認必要）
5. **`Cache-Control` ヘッダーの実値**（実測必要）
6. **フォロー直後の API 反映遅延**（公式記載なし、実測推奨）
7. **次回 next-auth v5 リリースで Twitch refresh token 自動化が入るか**（roadmap 確認必要）

---

## 10. 参考リンク

### Twitch 公式
- [Get Followed Channels](https://dev.twitch.tv/docs/api/reference/#get-followed-channels)
- [Get Channel Followers](https://dev.twitch.tv/docs/api/reference/#get-channel-followers)
- [Twitch API Concepts (rate limits)](https://dev.twitch.tv/docs/api/guide#twitch-rate-limits)
- [Authentication: Refreshing Access Tokens](https://dev.twitch.tv/docs/authentication/refresh-tokens/)
- [OAuth Scopes](https://dev.twitch.tv/docs/authentication/scopes/)
- [EventSub Subscription Types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/)
- [EventSub Manage Subscriptions](https://dev.twitch.tv/docs/eventsub/manage-subscriptions/)
- [Twitch Developer Service Agreement](https://legal.twitch.com/legal/developer-agreement) ← Aki 原文確認推奨

### Auth.js / next-auth
- [Twitch Provider](https://authjs.dev/getting-started/providers/twitch)
- [Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation)
- [next-auth Twitch provider source](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/providers/twitch.ts)

### コミュニティ参考
- [About Twitch API request limits (Twitch dev forum)](https://discuss.dev.twitch.com/t/about-twitch-api-request-limits/46195)
- [Deprecation of Create and Delete Follows API Endpoints](https://discuss.dev.twitch.com/t/deprecation-of-create-and-delete-follows-api-endpoints/32351)
- [Follows endpoints and EventSub subscription type are now available in open beta](https://discuss.dev.twitch.com/t/follows-endpoints-and-eventsub-subscription-type-are-now-available-in-open-beta/43322)

---

## 11. 追加で気づいたこと

### 11.1 既存の `service_role` key 露出リスクとの衝突なし

エモジェネは Supabase の `SUPABASE_SERVICE_ROLE_KEY` をサーバーサイドのみで使用している（CLAUDE.md 記載）。フォロー判定はサーバーサイド callbacks（`jwt`）で完結するので、フロントエンドに access_token を露出させない構造が自然に成立する。

### 11.2 `templates` の `subscriber-only` 機能との接続

`templates` テーブルでサブスク限定テンプレートを `subscriberOnly: true` で運用している場合、フォロワー認証導入時に意味論を統一する必要：
- A: `subscriberOnly` フィールド名はそのままで、`isSubscriber || isFollower` で判定
- B: フィールド名を `premiumOnly` に rename（DB マイグレーション必要）

A が破壊的変更ゼロで楽。Phase 1 では A を推奨。

### 11.3 既存の `合言葉（PASSPHRASE）` 機能は残すべきか

**残すことを推奨**。理由:
- 既存ユーザーが急に premium 機能を失うと UX 悪化
- フォロワー認証のバックアップパスとして「Twitch アカウント持ってない人」「OAuth に抵抗ある人」向けに残せる
- `isPremium = isSubscriber || isFollower` の論理和で運用すれば両立可能
- いずれ `PASSPHRASE` を deprecated にしたい場合は段階的に：「合言葉認証は X 年後に終了します」案内 → N 月後に廃止

### 11.4 broadcaster_id 取得の自動化

`AUTH_TWITCH_BROADCASTER_ID` を環境変数で持つ提案をしたが、login 名が変わったら ID は不変なので一度取れば固定。app access token で `/helix/users?login=datsusara_aki` を 1 回叩いて取得 → `.env` に書き込み。これは setup スクリプト or README に手順記載で対応。

### 11.5 「フォロー」のゲーミング動機づけが UI で重要

技術的には実装可能だが、「フォロー = premium」の UX 文言設計でユーザー受容度が大きく変わる：
- ❌「フォローしないと使えません」（強制感）
- ⚠️「フォローでアンロック」（普通）
- ✅「Akiを応援するとお礼に premium 機能が使えます」（共感ベース）
- ✅「サポーター（無料）になると...」（コミュニティ感）

Phase 1 でも UI 文言は最終版を Aki と一緒に決めるべき。技術的にはどれも同じ実装。

### 11.6 セキュリティ上の懸念ゼロ

OAuth 経由でユーザーから取得する権限は read-only なので、悪用リスクゼロ。Twitch アカウントに副作用を与える操作（フォロー操作・配信操作・投稿）は今回スコープ外。

---

**調査完了。**

このドキュメントに基づいて Phase 1 実装計画を立てる場合は、§7.1 と §8 の判断項目を Aki 確認の上、別タスクで実装プロンプトに落とし込む。
