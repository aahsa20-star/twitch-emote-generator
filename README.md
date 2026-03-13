# Twitch Emote Generator

画像1枚から Twitch / Discord / 7TV / BTTV / FFZ 仕様のエモートを自動生成するブラウザ完結ツール。

サーバーへの画像送信なし。AI背景透過からアニメーション GIF 生成、複数サイズ一括書き出しまで、すべてブラウザ内で完結します。

**https://twitch-emote-generator.vercel.app/**

## 主な機能

- **AI 背景透過** — ワンクリックで背景を除去。透過後のブラシ微調整にも対応
- **5 プラットフォーム出力** — Twitch / Discord / 7TV / BTTV / FFZ の各仕様サイズを一括生成
- **52 種のアニメーション** — 揺れ・回転・グリッチ・ネオン・パーティなど、GIF エモートをそのまま生成
- **カスタマイズ** — フチ取り 5 種、フレーム 7 種、テキスト（日本語フォント対応）、2 画像合成
- **動画から顔抽出** — 動画をアップロードすると AI が顔を検出し、エモート素材として切り出し
- **サブスクバッジ作成** — 円形・四角・角丸の 3 形状、3 サイズ同時出力
- **おすすめパターン** — ワンクリックで「白フチ」「影付き」などの定番設定を適用

## 使い方

1. 画像をアップロード（PNG / JPG / WEBP、ドラッグ&ドロップ対応）
2. 背景透過が自動実行（スキップも可能）
3. フチ取り・テキスト・アニメーションなどを設定
4. プレビューを確認してダウンロード（個別 or ZIP 一括）

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) + React 19 + TypeScript |
| スタイリング | Tailwind CSS v3 |
| 背景透過 | @imgly/background-removal (WASM) |
| 顔検出 | MediaPipe FaceDetector |
| GIF 生成 | gif.js (Web Worker) |
| ZIP 書き出し | JSZip |
| ホスティング | Vercel |

## ローカル開発

```bash
npm install
npm run dev
```

http://localhost:3000 で起動します。

## ライセンス

Private
