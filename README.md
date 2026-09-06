# Twitch Emote Generator

**エモート制作の面倒を全部省く**

配信者がエモートを作るために必要な工程（背景透過 → 調整 → フチ取り → テキスト → アニメーション → 全サイズ書き出し）をブラウザだけで完結させるツールです。

🔗 **https://twitch-emote-generator.vercel.app/**

## 利用条件

Twitch で @datsusara_aki をフォローする（Twitch ログインが必要）か、配信・Discord で案内している合言葉を入力すると、作成・保存の全機能が使えます。どちらか一方で十分です。合言葉は Twitch ログインなしで使えます。

## 主な機能

| 機能 | 内容 |
|------|------|
| 背景自動透過 | ブラウザ内の推論モデルによる背景除去。高精度モード（VTuber・イラスト向け）あり |
| ブラシ補正 | 消しゴム・復元ブラシで透過を手動調整 |
| 位置調整 | トリミング・ズーム・ドラッグ配置 |
| フチ取り | 白 / 黒 / 影付き / カスタム色 + ネオン・二重・ステッカー等 7 スタイル |
| エモートフレーム | 星 / ハート / ゲーミング / 猫耳 / 桜 など 16 種 |
| テキスト入れ | プリセット + 自由入力、22 フォント、位置・サイズ・色を調整 |
| 2 画像合成 | サブ画像を重ねる / 並べる |
| アニメーション | 固定 100 種（8 カテゴリ、検索、お気に入り）。合言葉またはフォローで全種利用可 |
| GIF / 動画入力 | 既存 GIF や動画（顔の自動抽出）を各サイズの GIF に再エンコード |
| マルチプラットフォーム書き出し | Twitch / Discord / 7TV / BTTV / FFZ の各サイズを PNG / GIF / ZIP で出力 |
| サブスクバッジ作成 | 18 / 36 / 72px の PNG（ZIP） |

テンプレート共有・みんなのアニメーション・AI アニメーション生成は 2026 年 9 月に終了しました。

## 対応プラットフォームと出力サイズ

| プラットフォーム | サイズ | ZIPファイル名 |
|-----------------|--------|--------------|
| Twitch | 28 / 56 / 112px | emotes.zip |
| Discord | 32 / 64 / 128px | discord_emotes.zip |
| 7TV | 32 / 64 / 96 / 128px | 7tv_emotes.zip |
| BTTV | 28 / 56 / 112px | bttv_emotes.zip |
| FFZ | 32 / 64 / 128px | ffz_emotes.zip |
| バッジ | 18 / 36 / 72px | badge.zip |

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS v3
- **認証**: Auth.js v5 + Twitch OAuth（JWT 戦略）。フォロー判定は Twitch Helix
- **合言葉**: HMAC 署名付き Cookie（サーバーのみで検証、DB 不要）
- **背景透過**: @imgly/background-removal（ブラウザ内モデル）
- **顔検出**: @mediapipe/tasks-vision
- **GIF**: gif.js（Web Worker）/ gifuct-js（デコード）
- **ZIP 出力**: JSZip
- **アニメーション**: Canvas API（256px 高解像度処理 → 縮小）
- **解析**: Umami Analytics（IP アドレスなし・匿名）
- **ホスティング**: Vercel
- **テスト**: vitest

データベースと外部 AI API は使用しません。画像処理はすべてブラウザ内で完結し、アップロードした画像はサーバーに送信されません。

## ローカル開発

```bash
git clone https://github.com/aahsa20-star/twitch-emote-generator.git
cd twitch-emote-generator
npm install
npm run dev
```

`.env.local` は `.env.example` を参考に作成します（PASSPHRASE / PASSPHRASE_COOKIE_SECRET / AUTH_* / killswitch）。

```bash
npm test        # vitest
npm run lint    # eslint
npm run build   # next build
```

http://localhost:3000 で確認できます。

## アーキテクチャ概要

```
src/
├── app/
│   ├── page.tsx                 # Server Component: 解放判定 → SiteGate / HomeClient
│   ├── account/                 # ログイン・合言葉認証の状態確認（ゲート外）
│   ├── privacy/                 # プライバシーポリシー
│   └── api/
│       ├── auth/                # 合言葉認証（署名 Cookie）+ Auth.js ルート
│       ├── access/              # 公開 AccessSnapshot
│       └── download-check/      # 保存の権限・出力仕様検証
├── auth.ts                      # Auth.js v5（Twitch OAuth + フォロー再確認）
├── components/
│   ├── EmoteGenerator.tsx       # メインオーケストレーター
│   ├── SiteGate.tsx             # フォロー / 合言葉ゲート
│   ├── settings/                # AnimationSettings, TextSettings 等
│   └── providers/AccessProvider # 解放状態の単一の源
├── hooks/useEmoteProcessor.ts   # 画像処理ロジック
└── lib/
    ├── auth/                    # evaluate-access / resolve-access / passphrase-token / rate-limit
    ├── twitch/follower-check.ts # Helix フォロー照会
    ├── download/                # 出力仕様と保存ゲート
    ├── canvas/, canvasPipeline  # 描画パイプライン
    ├── animations/              # 固定アニメーション
    ├── gif/, video/             # GIF / 動画の入出力
    └── faceExtractor.ts         # MediaPipe による顔検出
```

## このツールについて

> 「画像をアップするだけでスタンプが作れるツールが欲しい」

配信中の視聴者の一言がきっかけでした。
コードが読めない・書けない・開発経験ゼロのAkiが、AIと2人で1週間で作り上げました。（2026年3月）

## 注意事項

- 本サービスはTwitch Interactive, Inc.およびDiscord Inc.とは一切関係ありません
- 第三者の著作物・肖像・映像を無断で使用しないでください
- 背景透過は自動処理のため、結果の精度を保証しません
- 本ツールは現状有姿（AS-IS）で提供されます
