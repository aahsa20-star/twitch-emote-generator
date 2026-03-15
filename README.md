# Twitch Emote Generator

**エモート制作の面倒を全部省く**

配信者がエモートを作るために必要な工程（背景透過 → 調整 → フチ取り → テキスト → アニメーション → 全サイズ書き出し）をブラウザだけで完結させるツールです。

🔗 **https://twitch-emote-generator.vercel.app/**

## 主な機能

### 基本機能（全ユーザー無料）

| 機能 | 内容 |
|------|------|
| 背景自動透過 | AIによる背景除去。高精度モード（VTuber・イラスト向け）あり |
| ブラシ補正 | 消しゴム・復元ブラシで透過を手動調整 |
| フチ取り | 白フチ / 黒フチ / 影付き |
| テキスト入れ | 8種プリセット + 自由入力。位置・サイズ・色を調整 |
| アニメーション | 7種の通常アニメーション（揺れる・震える・点滅 等） |
| マルチプラットフォーム書き出し | Twitch / Discord / 7TV / BTTV / FFZ に対応した各サイズでZIP出力 |
| 動画から顔を自動抽出 | MP4 / MOV / WEBM から顔を検出してそのままエモート素材に |
| おすすめパターン | 白フチ / 黒フチ / 影付き / 白フチ+揺れ の4種を1クリック適用 |

### サブスク限定機能

Discordサーバーのサブスク限定チャンネルで配布している合言葉で解放できます。

- ✨ 限定アニメーション 45種（ゲーミング / グリッチ / ホログラム / リアクション系 等）
- 🎞️ エモートフレーム 6種
- 🖼️ 2画像合成（サブ画像を重ねる）
- 🎨 カスタムフチ色
- 🏅 サブスクバッジ作成（18 / 36 / 72px、ZIP出力）

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

- **フレームワーク**: Next.js (App Router) + TypeScript
- **スタイリング**: Tailwind CSS v3
- **背景透過**: @imgly/background-removal（ブラウザ内AIモデル）
- **顔検出**: @mediapipe/tasks-vision
- **GIF生成**: gif.js（Web Worker）
- **ZIP出力**: JSZip
- **アニメーション**: Canvas API（256px高解像度処理 → 縮小）
- **解析**: Umami Analytics（IPアドレスなし・匿名）
- **ホスティング**: Vercel

すべての処理はブラウザ内で完結します。アップロードした画像はサーバーに送信されません。

## ローカル開発

```bash
git clone https://github.com/aahsa20-star/twitch-emote-generator.git
cd twitch-emote-generator
npm install
npm run dev
```

`.env.local` を作成：

```
PASSPHRASE=your_passphrase_here
```

http://localhost:3000 で確認できます。

## アーキテクチャ概要

```
src/
├── app/                    # Next.js App Router
│   └── api/auth/           # 合言葉認証エンドポイント
├── components/
│   ├── EmoteGenerator.tsx  # メインオーケストレーター
│   ├── settings/           # AnimationSettings, TextSettings 等
│   └── ...
├── hooks/
│   └── useEmoteProcessor.ts # 画像処理ロジック
└── lib/
    ├── canvasPipeline.ts   # 描画パイプライン（背景透過・フチ・フレーム・テキスト）
    ├── animations/         # index.ts + basic / effects / motion / reactions
    ├── faceExtractor.ts    # MediaPipeによる顔検出
    └── zipExporter.ts      # マルチプラットフォームZIP生成
```

## このツールについて

> 「画像をアップするだけでスタンプが作れるツールが欲しい」

配信中の視聴者の一言がきっかけでした。
コードが読めない・書けない・開発経験ゼロのAkiが、AIと2人で1週間で作り上げました。（2026年3月）

## 注意事項

- 本サービスはTwitch Interactive, Inc.およびDiscord Inc.とは一切関係ありません
- 第三者の著作物・肖像・映像を無断で使用しないでください
- 背景透過はAIによる自動処理のため、結果の精度を保証しません
- 本ツールは現状有姿（AS-IS）で提供されます
