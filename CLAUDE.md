# CLAUDE.md

## プロジェクト概要
Twitch Emote Generator - ブラウザだけでTwitchエモートを作成できるツール。
画像アップロード → 背景透過 → フチ取り/テキスト/アニメーション → 3サイズPNG/GIF出力。
すべての画像処理はクライアントサイドで完結（サーバーに画像は送信しない）。

## 技術スタック
- **フレームワーク**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v3
- **認証**: Auth.js v5 (next-auth@beta) + Twitch OAuth (JWT戦略)
- **DB**: Supabase (PostgreSQL, service_role keyでRLSバイパス)
- **AI**: Anthropic SDK (@anthropic-ai/sdk) + Claude Sonnet
- **画像処理**: @imgly/background-removal (WASM), gif.js, MediaPipe (顔検出)
- **デプロイ**: Vercel (GitHub pushで自動デプロイ)

## 開発ルール
- **REPORT.md**: 機能追加・バグ修正時は必ず同コミットで更新する
- **既存機能の非破壊**: 変更時は既存の50種アニメーション・サブスク機能に影響がないことを確認
- **サーバーに画像を送らない**: 画像処理はすべてクライアントサイド。この原則を破る変更は不可
- **コミットメッセージ**: 日本語で簡潔に。Co-Authored-Byを付ける
- **Turbopackキャッシュ破損**: `next build` 後に `npm run dev` するとキャッシュが壊れる。`.next` を削除して再起動。それでもダメなら `rm -rf .next node_modules && npm install`

## 環境変数
```
PASSPHRASE                 # 合言葉（特典解放のレガシー経路）
AUTH_SECRET                # Auth.jsセッション暗号化キー
AUTH_TWITCH_ID             # Twitch OAuthアプリID
AUTH_TWITCH_SECRET         # Twitch OAuthシークレット
AUTH_TWITCH_BROADCASTER_ID # フォロー判定対象 (@datsusara_aki の Twitch user id、fix7)
SUPABASE_URL               # SupabaseプロジェクトURL
SUPABASE_SERVICE_ROLE_KEY  # Supabase service_role JWT
ANTHROPIC_API_KEY          # Claude APIキー
```

### killswitch 5 種（fix7 + fix14、`src/lib/auth/feature-flags.ts`）
段階的縮退用。Vercel 環境変数で false に設定すると即座に無効化される。
```
SITE_LOCK_ENABLED     # fix14: サイト全体ロック on/off（false で旧 trial/premium 挙動に縮退）
TRIAL_MODE_ENABLED    # false で全員 premium（最後の retreat）
FOLLOW_AUTH_ENABLED   # フォロー判定 path on/off（fix14.1 で default false に反転、true 明示で復活）
PREMIUM_LOCK_ENABLED  # 既存 subscriberOnly 機能 lock on/off
DOWNLOAD_LOCK_ENABLED # DL ガード on/off（緊急時の最初の手）
```

## 機能の階層（fix14 でサイト全体ロック導入、fix7 の trial/premium は縮退時のみ）

解放判定: `evaluateAccess({ session, isSubscribed, flags })`（`src/lib/auth/premium.ts`）が
`isFollower OR isSubscribed (PASSPHRASE) OR !TRIAL_MODE_ENABLED` の OR 結合で resolve。

### サイト全体ロック（fix14 / fix14.1、通常運用時）
- `app/page.tsx` が Server Component として毎リクエスト evaluateAccess を評価
- 未解放（合言葉未入力）→ `SiteGate` 画面のみ配信（ツール本体の HTML は届かない）
- 解放経路: **合言葉のみ**（fix14.1 でフォロー解放を撤去。`/api/auth` → cookie → `router.refresh()`）
- FOLLOW_AUTH_ENABLED は default false に反転（env で true 明示すればフォロー解放が復活）
- ロック中は `/api/download-check` の trial 許可（28px PNG）も無効（`site-locked` 403）
- `/privacy` はゲート対象外（公開のまま）
- Twitch ログイン自体は残存（テンプレート投稿・AI アニメ生成などログイン必須機能用）

### お試し版（trial、SITE_LOCK_ENABLED=false 縮退時のみ、ログイン不要）
- アニメ 2 種（`bounce` / `shake`、`TRIAL_ANIMATIONS` で定義、types/emote.ts:80）
- フチは白黒のみ
- テキスト色変更不可
- DL は 28px PNG のみ（56/112px と全 GIF は `/api/download-check` で 403）

### 無料機能（誰でも使える）
- 画像/GIF/動画アップロード、背景透過、ブラシ補正
- 5 プラットフォーム同時出力（Twitch / Discord / 7TV / BTTV / FFZ）
- ログイン限定 3 種（`gaming` / `glitch` / `neon`）
- フチスタイル 7 種（fix6: `neon` / `double` / `sticker` / `outline-only` / `gradient` / `chrome` / `dotted`、全部無料）
- フォント 22 種

### 特典機能（Twitch フォロー or 合言葉で解放、fix10 で UI 文言を「特典」に統一）
- 限定アニメーション 42 種（fix10 で 45→42 に実数訂正、ANIMATION_OPTIONS 53 - none 1 - free 7 - loginOnly 3）
- エモートフレーム 16 種（fix9 で 6→16、stars/hearts/gaming/sparkles/rainbow/dots + neon/pixel/gold/silver/comic/cat/sakura/hologram/fire/coin）
- カスタムフチ色
- 2 画像合成（右下重ねる / 左下重ねる / 左右に並べる）
- サブスクバッジ作成（Twitch サブスクバッジの作成、機能名そのまま）

## DBテーブル（Supabase）
- `templates` — ユーザー投稿テンプレート
- `likes` — テンプレートいいね（UNIQUE: user_id + template_id）
- `custom_animations` — AI生成アニメーション（code上限5000文字）
- `animation_likes` — アニメーションいいね
- `animation_reports` — 通報（3件で自動非公開、DBトリガー）
- `ai_animation_logs` — AI生成レート制限（5回/日/ユーザー）

## アニメーションシステム
- `FrameGenerator`: `(baseCanvas, frameIndex, totalFrames) => HTMLCanvasElement`
- 52種のアニメーション（basic/effects/motion/reactions）+ AI-custom
- AI-custom: iframe sandbox (`allow-scripts`) + postMessage通信で安全実行
- GIF: 20フレーム、256px生成 → マルチステップ縮小 → gif.js
- 速度: slow=80ms / normal=50ms / fast=25ms

## Canvas処理パイプライン
```
画像アップロード → 背景透過 → ブラシ補正 → 224px中間Canvas
→ 2画像合成 → フチ取り → フレーム装飾 → テキスト(strokeText)
→ マルチステップ縮小(224→112→56→28) → USMシャープニング(≤56px)
→ PNG出力 / GIF出力
```

## API Routes
- `POST /api/auth` — 合言葉認証 → HttpOnly cookie `emote-subscriber=1` を 30 日 set
- `DELETE /api/auth` — 合言葉解除（cookie クリア、fix7）
- `POST /api/download-check` — DL 権限の server-side 再検証（fix7、`evaluateAccess` で判定）
- `POST /api/account/delete` — 全テーブル横断削除（fix8、Supabase 6 テーブル順次削除 + ログ）
- `GET/POST /api/templates` — テンプレートCRUD
- `DELETE /api/templates/[id]` — テンプレート削除（本人のみ）
- `POST /api/templates/[id]/like` — いいねトグル
- `GET /api/generate-animation` — 残り生成回数取得
- `POST /api/generate-animation` — AIアニメーション生成
- `GET/POST /api/custom-animations` — カスタムアニメーションCRUD
- `DELETE /api/custom-animations/[id]` — 削除（本人のみ）
- `POST /api/custom-animations/[id]/like` — いいねトグル
- `POST /api/custom-animations/[id]/report` — 通報

## 認証・権限アーキテクチャ（fix7 / fix7.1 / fix7.2）

- **認証**: Auth.js v5 (next-auth@beta) + Twitch OAuth、JWT 戦略
- **JWT 内容** (`types/auth.ts:59-83`): access_token / refresh_token / expires_at / scope / isFollower / followCheckedAt / followedAt
- **scope**: `openid user:read:email user:read:follows`（fix7 で `user:read:follows` 追加）
- **フォロー判定**: `src/lib/twitch/follower-check.ts` の純関数 `checkIsFollower` が `/helix/channels/followed` を 1s/3s/10s リトライ + 24h stale-cache フォールバック付きで叩く
- **フォロー再検証フロー**（fix7.2 確定）:
  1. client が `useSession().update({ trigger: "follower-recheck" })` を呼ぶ
  2. Auth.js が jwt callback を `trigger === "update"` で起動
  3. callback が `token.access_token` を直接使い Twitch API を再叩き（**`getToken` は使わない**、後述）
  4. 結果を token に書き戻し、5 秒スロットリングで連打抑制
  5. `session` 引数の client 供給値は **完全に無視**（elevation-of-privilege 対策）
- **PASSPHRASE 経路**: `/api/auth POST` で HttpOnly cookie `emote-subscriber=1` を set、`evaluateAccess` が cookie を読んで `isSubscribed` 判定
- **DL ガード**: `/api/download-check` POST が trial / premium / size を見て 200 / 403 を返す
- **アカウント削除フロー**（fix8）: `/api/account/delete` POST が Supabase 6 テーブル横断削除 + サーバーログに steps 記録 + 14 日 SLA の手動削除請求受付（`ADMIN_DELETION_SOP.md`、機密 SQL は `.admin-sop-private.md`）
- **CASCADE 設定**: `supabase-cascades.sql` で templates → likes 等の自動削除を保証（fix8、Aki が Supabase 管理画面で適用）

## やらないと決めたこと
- サブスク限定の差別化（みんなのアニメーション）— 投稿が増えてから判断
- 管理者ダッシュボード — 投稿が増えてから
- `likes_count` のDBトリガー移行 — 現状はアプリ側+1/-1で十分
- カスタムアニメーションカードのGIFプレビュー — 「使う」ボタンで即確認可能

## 注意事項
- Supabaseは `service_role` key使用（RLSバイパス）。フロントに露出させないこと
- Anthropic APIの月額上限をダッシュボードで設定すること
- 通報3件自動非公開は複数アカウントで悪用可能（許容中）
- Twitch `user_login` はユーザーが変更可能（許容中）
- **`getToken` は使わない**（fix7.2 で完全排除）— Auth.js v5 の `getToken` は App Router の `NextRequest` と非互換、認証済みユーザーに対しても `null` を返すバグあり。フォロー再 verify は必ず `useSession().update()` + jwt callback の `trigger === "update"` 経路を通す
- **session.user に `access_token` を出さない**（types/auth.ts:57 の方針）— server-only。client 露出は XSS 経由の token 流出リスク
- **REPORT.md 更新ルール**: feature / bug fix / design 変更は **同 commit で REPORT.md 更新**。entry は changelog 形式、新しいリリースは時系列の上部に追加
