# CLAUDE.md

## プロジェクト概要
Twitch Emote Generator - ブラウザだけでTwitchエモートを作成できるツール。
画像アップロード → 背景透過 → フチ取り/テキスト/アニメーション → 3サイズPNG/GIF出力。
すべての画像処理はクライアントサイドで完結（サーバーに画像は送信しない）。

## 技術スタック
- **フレームワーク**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v3
- **認証**: Auth.js v5 (next-auth@beta) + Twitch OAuth (JWT戦略)
- **DB / 外部 AI API**: なし（2026-09 コミット A で Supabase・Anthropic を撤去。復活させない）
- **画像処理**: @imgly/background-removal (WASM), gif.js, MediaPipe (顔検出)
- **デプロイ**: Vercel (GitHub pushで自動デプロイ)

## 開発ルール
- **REPORT.md**: 機能追加・バグ修正時は必ず同コミットで更新する
- **既存機能の非破壊**: 変更時は既存 52 種アニメーション（ID 保持）・解放機能に影響がないことを確認
- **Supabase / Anthropic / 任意コード実行を再導入しない**: 固定アニメーションのみ。実装コード文字列の保存・評価は禁止
- **サーバーに画像を送らない**: 画像処理はすべてクライアントサイド。この原則を破る変更は不可
- **コミットメッセージ**: 日本語で簡潔に。Co-Authored-Byを付ける
- **Turbopackキャッシュ破損**: `next build` 後に `npm run dev` するとキャッシュが壊れる。`.next` を削除して再起動。それでもダメなら `rm -rf .next node_modules && npm install`

## 環境変数
```
PASSPHRASE                 # 合言葉（解放経路の一つ。サーバーのみで照合）
PASSPHRASE_COOKIE_SECRET   # R1b: 合言葉 Cookie の署名鍵（32 文字以上）。変更で全 Cookie 失効
APP_ORIGIN                 # R1b（任意）: 変更系 API の Origin 検証で追加許可するオリジン
AUTH_SECRET                # Auth.jsセッション暗号化キー
AUTH_TWITCH_ID             # Twitch OAuthアプリID
AUTH_TWITCH_SECRET         # Twitch OAuthシークレット
AUTH_TWITCH_BROADCASTER_ID # フォロー判定対象 (@datsusara_aki の Twitch user id、fix7)
```

### killswitch 5 種（fix7 + fix14 + R1b、`src/lib/auth/feature-flags.ts`）
値は true/1/yes/on・false/0/no/off のみ。それ以外は警告ログ + 既定値（黙って true にしない）。
```
SITE_LOCK_ENABLED     # サイト全体ロック（default true）。false で trial 縮退（未解放でも編集可、保存は Twitch 28px PNG のみ）
TRIAL_MODE_ENABLED    # false で解放を全許可（emergency grant）。投稿・AI・削除の本人認証は外れない
FOLLOW_AUTH_ENABLED   # フォロー経路（コード default false、本番で true 明示）。false でフォロー照会・CTA も停止
PREMIUM_LOCK_ENABLED  # deprecated: 実効なし（互換のため読むだけ）
DOWNLOAD_LOCK_ENABLED # false で保存の権限ゲートのみ解除（入力検証は維持）
```
問題時は FOLLOW_AUTH_ENABLED=false → DOWNLOAD_LOCK_ENABLED=false → SITE_LOCK_ENABLED=false → TRIAL_MODE_ENABLED=false の順。署名なし Cookie を信頼する旧コードへの rollback は復旧策にしない。

## 機能の階層（R1b: フォロー解放 + 合言葉併用、fix7 の trial は縮退時のみ）

解放判定: `resolveAccess()`（`src/lib/auth/resolve-access.ts`、server-only）→ `evaluateAccess()`（`src/lib/auth/evaluate-access.ts`、純関数）が
`follower OR passphrase OR emergency(TRIAL_MODE_ENABLED=false)` で `AccessSnapshot`（`src/types/auth.ts`）を返す。
クライアントは `AccessProvider`（`useAccess()`）経由でのみ解放状態を知る。localStorage は認証に使わない。

### サイト全体ロック（通常運用時）
- `app/page.tsx` が Server Component として毎リクエスト `resolveAccess` を評価（合言葉 Cookie を先に、Twitch session は必要時のみ）
- 未解放 → `SiteGate`（「フォロー、または合言葉で使えます」）のみ配信
- 解放経路: **Twitch ログイン + @datsusara_aki フォロー**（FOLLOW_AUTH_ENABLED=true 時）**または合言葉**。両方は要求しない
- 合言葉 Cookie `emote-access-v1` は HMAC 署名付き・30 日固定（`src/lib/auth/passphrase-token.ts`）。旧 `emote-subscriber=1` は信頼しない
- フォロー結果は成功から 24h 有効、Twitch 一時障害時は最後の成功から 48h まで猶予。非フォロー確定・token 失効は即時失効
- フォロー再確認は `useSession().update({ trigger: "follower-recheck" | "follower-ttl" })` のみ（RSC では Cookie を書き戻せないため）
- `/privacy` と `/account` はゲート対象外
- Twitch ログインは本人認証（投稿・いいね・通報・AI・削除）用。合言葉は本人 ID を発行しない

### API 権限（`src/lib/auth/api-guards.ts`）
| API | 必要条件 |
|---|---|
| `/api/auth` POST/DELETE | 不要（Origin 検証 + 試行制限 10 回/15 分/送信元） |
| `/api/access` GET, `/api/download-check` POST | 解放権限（フォロー or 合言葉）。download-check は入力検証が先（400 は入力エラー） |
| テンプレート/アニメの GET | 公開 |
| （廃止）投稿・いいね・通報・AI・削除 | ルート自体を削除（404） |

### お試し版（trial、SITE_LOCK_ENABLED=false 縮退時のみ、ログイン不要）
（`isPremium = access.isUnlocked` が false のときの UI 制限。fix11 の固定 true は撤去済み）
- アニメ 2 種（`bounce` / `shake`、`TRIAL_ANIMATIONS` で定義、types/emote.ts:80）
- フチは白黒のみ
- テキスト色変更不可
- DL は 28px PNG のみ（56/112px と全 GIF は `/api/download-check` で 403）

### 無料機能（誰でも使える）
- 画像/GIF/動画アップロード、背景透過、ブラシ補正
- 5 プラットフォーム同時出力（Twitch / Discord / 7TV / BTTV / FFZ）
- フチスタイル 7 種（fix6: `neon` / `double` / `sticker` / `outline-only` / `gradient` / `chrome` / `dotted`、全部無料）
- フォント 22 種

### 特典機能（フォロー or 合言葉で解放 = `access.isUnlocked`）
- アニメーション 100 種（trial は bounce / shake の 2 種、残り 98 種はフォロー or 合言葉）
- エモートフレーム 16 種（fix9 で 6→16、stars/hearts/gaming/sparkles/rainbow/dots + neon/pixel/gold/silver/comic/cat/sakura/hologram/fire/coin）
- カスタムフチ色
- 2 画像合成（右下重ねる / 左下重ねる / 左右に並べる）
- サブスクバッジ作成（Twitch サブスクバッジの作成、機能名そのまま）

## 画面構成（UI/UX 刷新、feat/uiux-refresh）

4 工程を `EmoteGenerator`（常設の親。source / config / variants / processing / access を保持）が切り替える。工程・タブは `hidden` で表示を切り替えるだけで、状態を持つ子をアンマウントしない。PC とスマホで別エディタを二重 mount しない。

| 工程 | 主なファイル | 要点 |
|------|-------------|------|
| 入口 | `SiteGate.tsx` / `PassphraseForm.tsx` | フォロー（主）と合言葉（代替）。401 は欄の近くに常設、認証処理は既存のまま |
| 1 画像を選ぶ | `UploadPanel.tsx` / `lib/upload/accept.ts` / `lib/sampleImage.ts` | 主ボタン + D&D、形式・上限は定義から表示、HEIC は変換案内、エラーは閉じるまで残す、同梱サンプル |
| 2 画像を整える | `AdjustView.tsx` / `ImageAdjustEditor.tsx` / `VideoTrimmer.tsx` | 切り取りは draft（元画像 `originalFile` から再調整）、背景の扱い（そのまま / 自動で消す + 精度）。「この範囲で使う / 調整せず使う」「変更を適用 / 変更せず戻る」 |
| 3 編集する | `PreviewArea.tsx`（できあがり） / `SettingsPanel.tsx`（動き・文字・飾り・その他） / `settings/*` / `MobileDock.tsx` | 拡大見本（実寸とは呼ばない）+ 実寸列。動き: `lib/animations/picker.ts` の おすすめ 12 / すべて / お気に入り。GIF・動画は「再生」タブ。スマホは下部 dock |
| 4 保存する | `ExportPanel.tsx` / `DownloadButton.tsx`（SaveActions） / `lib/ui/export-plan.ts` | 目的地 → 形式 → サイズ。サイズは download profiles から。全経路 `/api/download-check`。iOS は 準備する → 開く の 2 段階。共有は完了カードの任意ボタン |

補助: `StepNav.tsx`（工程ナビ、`lib/ui/steps.ts` の `canEnterStep`。未確定の候補があると工程 3/4 は不可）、素材の候補/確定は `lib/ui/source-state.ts` の reducer、保存可否は `lib/ui/save-state.ts`（hook の `requestedGen` / `outputGen` / `failedGen` が一致したときだけ current）、`StudioHeader.tsx`（ブランド・利用状態・使い方ダイアログ）、`components/ui/classes.ts`（共通クラス）、デザイントークンは `globals.css` の `--studio-*` と Tailwind の `studio.*`。

## DB テーブル
なし。2026-09（コミット A）で Supabase を撤去。旧テーブル（templates / likes / custom_animations / animation_likes / animation_reports / ai_animation_logs）のデータは旧プロジェクトに残存している可能性があるが、アプリからは接続しない。

## アニメーションシステム
- `FrameGenerator`: `(baseCanvas, frameIndex, totalFrames) => HTMLCanvasElement`
- 固定アニメーション 100 種（既存 52 + v2 48）。定義は `src/lib/animations/catalog.ts`（型付き）、実装は `generators: Record<AnimationId, FrameGenerator>`（不一致は型エラー）
- 追加手順: catalog に entry → generator 実装 → index.ts の generators に登録 → `npm test`（100 件・一意性を検査）
- お気に入りは localStorage `emote-animation-favorites-v1`（端末内のみ）。プレビューは `preview.ts`（gif.js 不使用、最大 2 件同時、LRU 12）
- dev ページ: `/dev/animations`（100 種のフレーム帯 + GIF 検証）、`/dev/gif-check`（B12）。本番では 404
- GIF: 20フレーム、256px生成 → マルチステップ縮小 → `src/lib/gif/encoder-core.ts`（gif.js の GIFEncoder を直接駆動し、量子化後にアルファマスクでインデックスを書き換える。Worker `encode.worker.ts`）。gif.js の `transparent` オプションだけに頼らない（不透明画像が透明化される）
- 速度: slow=80ms / normal=50ms / fast=25ms

## Canvas処理パイプライン
```
画像アップロード → 背景透過 → ブラシ補正 → 224px中間Canvas
→ 2画像合成 → フチ取り → フレーム装飾 → テキスト(strokeText)
→ マルチステップ縮小(224→112→56→28) → USMシャープニング(≤56px)
→ PNG出力 / GIF出力
```

## API Routes
- `POST /api/auth` — 合言葉認証 → 署名付き HttpOnly cookie `emote-access-v1`（30 日）。400/401/403(origin)/429/503
- `DELETE /api/auth` — 合言葉 Cookie（新旧）削除。Twitch session には触らない
- `GET /api/access` — 公開 `AccessSnapshot`（no-store）。`auth(handler)` ラッパーで JWT 書き戻し
- `POST /api/download-check` — `{platform, assetType, files[]}` を共通仕様（`src/lib/download/profiles.ts`）で検証 → 解放権限判定
- 廃止（404）: `/api/templates*`、`/api/custom-animations*`、`/api/generate-animation`、`/api/account/delete`

## 認証・権限アーキテクチャ（fix7 → R1b で再設計）

- **認証**: Auth.js v5 (next-auth@beta) + Twitch OAuth、JWT 戦略
- **JWT 内容** (`types/auth.ts`): access_token / refresh_token / expires_at / scope / tokenValidatedAt / isFollower（最後の成功結果）/ followCheckedAt（成功時のみ更新）/ followAttemptedAt / followAttemptOutcome / followBroadcasterId / followedAt / error
- **scope**: `openid user:read:email user:read:follows`（fix7 で `user:read:follows` 追加）
- **フォロー判定**: `src/lib/twitch/follower-check.ts` の `checkIsFollower` が `/helix/channels/followed` を 1 fetch 3 秒・最大 2 回・全体 8 秒 deadline で叩き、`following / not-following / unauthorized / temporary-error` を返す（一時失敗を「非フォロー」に潰さない）。`validateTwitchToken` で 1 時間ごとに `/oauth2/validate`
- **フォロー再検証フロー**（R1b）:
  1. client（`AccessProvider.recheckFollower`）が `useSession().update({ trigger: "follower-recheck" | "follower-ttl" })` を呼ぶ
  2. jwt callback が `trigger === "update"` で起動。`session` 引数は trigger 文字列以外 **完全に無視**
  3. 順序: 期限切れ refresh → validate（1h）→ scope 確認 → フォロー照会。照会 401 は refresh 1 回 + 再照会
  4. 成功時のみ `followCheckedAt` 更新。失敗は `followAttemptOutcome` に記録し最後の成功結果を保持
  5. 手動は 5 秒スロットル（JWT + 共有 RPC）、TTL は 24h 未満なら照会しない
  6. `/api/access` は `auth(handler)` ラッパーで JWT を Cookie に書き戻す（RSC の `auth()` は書き戻せない）
- **PASSPHRASE 経路**: `/api/auth POST` が署名付き Cookie `emote-access-v1` を発行、`resolveAccess` が HMAC 検証（DB・Twitch 不要）
- **試行制限**: `src/lib/auth/rate-limit.ts`。インスタンス内メモリのみ（上限 10,000 バケット、絶対期限付き）。複数インスタンス横断・再起動後の持続はしない
- **DL ガード**: `/api/download-check` POST が入力検証 → 解放権限で 200 / 400 / 403 を返す
- **アカウント削除**: 廃止（コミット A）。サーバーに削除対象データが無い。旧投稿データの削除請求は PP §10 の連絡先で手動対応

## やらないと決めたこと
- サブスク限定の差別化（みんなのアニメーション）— 投稿が増えてから判断
- 管理者ダッシュボード — 投稿が増えてから
- `likes_count` のDBトリガー移行 — 現状はアプリ側+1/-1で十分
- カスタムアニメーションカードのGIFプレビュー — 「使う」ボタンで即確認可能

## 注意事項
- Twitch `user_login` はユーザーが変更可能（許容中）
- **`getToken` は使わない**（fix7.2 で完全排除）— Auth.js v5 の `getToken` は App Router の `NextRequest` と非互換、認証済みユーザーに対しても `null` を返すバグあり。フォロー再 verify は必ず `useSession().update()` + jwt callback の `trigger === "update"` 経路を通す
- **session.user に `access_token` を出さない**（types/auth.ts の Session 拡張）— server-only。client 露出は XSS 経由の token 流出リスク
- **`isPremium=true` 固定・localStorage 認証に戻さない**（R1b）— 解放状態は `useAccess().access.isUnlocked` のみ
- **合言葉 Cookie の検証に DB / Twitch を混ぜない** — Twitch 障害時のバックアップ経路であるため
- **REPORT.md 更新ルール**: feature / bug fix / design 変更は **同 commit で REPORT.md 更新**。entry は changelog 形式、新しいリリースは時系列の上部に追加
