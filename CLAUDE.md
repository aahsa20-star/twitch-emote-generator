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
PASSPHRASE              # サブスク解除用の合言葉
AUTH_SECRET              # Auth.jsセッション暗号化キー
AUTH_TWITCH_ID           # Twitch OAuthアプリID
AUTH_TWITCH_SECRET       # Twitch OAuthシークレット
SUPABASE_URL             # SupabaseプロジェクトURL
SUPABASE_SERVICE_ROLE_KEY # Supabase service_role JWT
ANTHROPIC_API_KEY        # Claude APIキー
```

## サブスク限定機能（合言葉で解除）
- 限定アニメーション 42種（基本7種 + ログイン限定3種は無料）
- エモートフレーム 7種（星・ハート・ゲーミング等）
- カスタムフチ色（白・黒・影付きは無料）
- 2画像合成（右下重ねる・左下重ねる・左右に並べる）
- サブスクバッジ作成

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
- `POST /api/auth` — 合言葉認証
- `GET/POST /api/templates` — テンプレートCRUD
- `DELETE /api/templates/[id]` — テンプレート削除（本人のみ）
- `POST /api/templates/[id]/like` — いいねトグル
- `GET /api/generate-animation` — 残り生成回数取得
- `POST /api/generate-animation` — AIアニメーション生成
- `GET/POST /api/custom-animations` — カスタムアニメーションCRUD
- `DELETE /api/custom-animations/[id]` — 削除（本人のみ）
- `POST /api/custom-animations/[id]/like` — いいねトグル
- `POST /api/custom-animations/[id]/report` — 通報

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
