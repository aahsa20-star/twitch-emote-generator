# Twitch Emote Generator 開発レポート

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | Twitch Emote Generator |
| 本番URL | https://twitch-emote-generator.vercel.app/ |
| GitHub | https://github.com/aahsa20-star/twitch-emote-generator |
| 技術スタック | Next.js 16 (App Router) + TypeScript + Tailwind CSS v3 |
| ホスティング | Vercel（GitHub自動デプロイ） |
| コード規模 | 19ファイル / 約3,000行（src/配下） |
| コミット数 | 21 |

## コンセプト

**「1枚の画像をアップロードするだけで、Twitch仕様に準拠したエモートを自動生成するブラウザ完結ツール」**

- サーバーへの画像送信なし（完全クライアントサイド処理）
- AI背景透過 → フチ取り → テキスト → アニメーション → 3サイズ同時出力
- 技術知識不要、初見で使える

---

## 実装済み機能一覧

### コア機能
- 画像アップロード（PNG/JPG/WEBP、D&D対応、10MB上限）
- AI背景透過（@imgly/background-removal、WASM、約30MBモデル）
- 背景透過のスキップ／キャンセル／やり直し
- 3サイズ同時生成（28px / 56px / 112px）
- Twitch仕様準拠（PNG≤25KB, GIF≤512KB, ≤60frames, blink<3/sec）

### カスタマイズ
- フチ取り5種（なし / 白フチ / 黒フチ / 影付き / カスタム色🔒）
- 縁の幅スライダー（1〜20px、デフォルト4px）
- カスタムボーダーカラー（ColorPickerで任意の色🔒）
- テキストプリセット8種（草, GG, ないす, RIP, 尊い, えぐい, なんで, 草生える）
- AKI限定テキストプリセット3種🔒（How's it going? / 許せねぇよ / 皿党員）
- 自由入力テキスト
- フォント9種（日本語5 + 英字2 + 標準2）
- 文字サイズスライダー（8〜48px、デフォルト20px）
- 文字色・縁取り色（カラーピッカー）
- テキスト位置（上 / 中央 / 下）
- 横位置・縦位置スライダー（-50〜50px、デフォルト0）
- アニメーション8種（揺れる / 震える / 点滅 / ぴょこぴょこ / ズームイン / 回転 / ハートぷかぷか / なし）
- 限定アニメーション5種🔒（ゲーミング / グリッチ / キラキラ / 残像 / 高速回転）

### サブスク限定機能（🔒）
- 合言葉認証（"saratouin"、localStorage永続化）
- 認証済みUIは控えめな1行バッジに縮小（「✨ AKI限定 解放済み」+解除ボタン）
- 未認証時はロック項目がグレーアウト＋🔒アイコン表示
- ログアウト時にサブスク限定configを自動リセット

### 出力・共有
- 112px単体ダウンロード（紫ボタン、最も使用頻度の高いサイズを優先表示）
- ZIP一括ダウンロード（emotes.zip）
- モバイル個別DLボタン（各サイズ下に常時表示、タッチデバイス対応）
- PCホバーオーバーレイDL（マウスオーバーで表示）
- Xシェアボタン（クリップボードコピー + ツイート画面同時オープン）

### UX
- おすすめパターン8種（ワンクリック適用）
- 28px視認性チェッカー（警告バッジ表示）
- アップロード前のサンプル表示（キャッチコピー + 機能バッジ + Canvas生成サンプル4パターン）
- アップロード前の設定パネル薄表示（opacity-40で全項目がプレビュー可能、操作は画像アップ後に有効化）
- 背景透過スキップトグル
- トースト通知（操作フィードバック、3秒で自動消去）
- スケルトンローディング（処理中のプレビュー領域にパルスプレースホルダー表示）
- PC設定パネルsticky追従（スクロールしても設定が常に見える）
- PCプレビューエリアsticky追従（設定をスクロールしてもプレビューが常に見える）
- モバイル最適化表示順（プレビュー→DL→おすすめ→設定の順で優先度順に配置）
- テキストプリセット3列化（モバイル）
- ヒーロー見出しのwhitespace-nowrap（「ブラウザだけで完結」の孤立改行防止）

### 品質最適化
- 224px高解像度中間キャンバス → multi-step downscale
- shadowBlur方式のフチ取り（アンチエイリアス改善）
- shadow多パス方式のテキスト縁取り
- 28pxテキスト自動非表示（視認性確保）
- GIF 20フレーム / 50msディレイ（滑らかなアニメーション）

---

## アーキテクチャ

```
src/
├── app/
│   ├── layout.tsx          # ルートレイアウト（Google Fonts、COOP/COEP headers）
│   └── page.tsx            # メインページ
├── components/
│   ├── EmoteGenerator.tsx  # メインコンテナ（状態管理統合 + 合言葉認証）
│   ├── UploadPanel.tsx     # 画像アップロード（D&D + click）
│   ├── SettingsPanel.tsx   # 設定UI（フチ取り/テキスト/アニメーション + サブスク限定ロックUI）
│   ├── PreviewArea.tsx     # プレビュー表示 + サンプルショーケース
│   ├── PreviewCard.tsx     # 個別プレビュー（ホバーDLオーバーレイ）
│   ├── DownloadButton.tsx  # 112px単体DL + ZIP一括DLボタン
│   ├── ShareButton.tsx     # Xシェア + クリップボードコピー
│   ├── RecommendedPatterns.tsx  # おすすめ8パターン
│   └── Footer.tsx          # 免責表示
├── hooks/
│   └── useEmoteProcessor.ts  # 処理パイプライン統合フック
├── lib/
│   ├── backgroundRemoval.ts  # @imgly/background-removal ラッパー
│   ├── canvasPipeline.ts     # Canvas描画パイプライン（中心配置/フチ取り/テキスト/縮小）
│   ├── gifEncoder.ts         # gif.js + Web Worker アニメーション生成（12種）
│   ├── visibilityChecker.ts  # 28px視認性チェック
│   └── zipExporter.ts        # JSZip ZIP書き出し
└── types/
    └── emote.ts              # 型定義 + 定数（サイズ/フォント/プリセット/サブスク限定フラグ等）
```

### 処理パイプライン

```
画像アップロード
  → AI背景透過（or スキップ）
    → 224px高解像度キャンバスに中心配置
      → フチ取り（shadowBlur方式、カスタム色対応）
        → テキストオーバーレイ（shadow多パス方式、28pxはスキップ）
          → multi-step downscale（224→112→56→28）
            → PNG/GIF出力（20フレーム/50ms）
```

---

## 開発中に修正したバグ・問題

| 問題 | 原因 | 修正 |
|------|------|------|
| Xシェアボタンが何も開かない | async/await後のwindow.openがポップアップブロッカーに弾かれる | window.openを同期呼び出しに変更、clipboard copyは非同期で後実行 |
| カラーピッカーが重い・閉じる | React onChange（=DOM input event）がドラッグ中に毎フレーム発火→150msデバウンスで再描画 | ColorPickerコンポーネント分離、onInputでローカルstate、onChangeで親に反映 |
| フチ取り境界がギザつく | 8方向オフセット描画はアンチエイリアスが効かない | shadowBlur方式に変更 |
| テキスト縁取りが粗い | strokeTextの標準描画品質の限界 | shadow多パス描画方式に変更 |
| 28pxでテキストが潰れる | 28pxキャンバスにテキスト描画は物理的に視認不可 | 28pxではテキスト自動非表示 |
| 小サイズの全体品質が低い | 28px/56pxで直接描画するとフチ・テキストの解像度不足 | 224px高解像度中間キャンバス + multi-step downscale |
| ZIPファイル名が日本語 | Mac/Windows互換性の問題 | ASCII固定（emote_112px.png等） |
| Vercelでプロジェクト名エラー | 日本語ディレクトリ名がVercel projectに使えない | --name フラグで英字指定 |
| PC版DL/アニメーション重なり | DL+ShareがSettingsの下で重なる（sticky + 別gridアイテム） | DL+ShareをSettings sticky内に移動、モバイル用は別途md:hidden |
| 「完結」だけ孤立改行 | ヒーロー見出しの自然な改行位置がずれる | whitespace-nowrapで「ブラウザだけで完結」を不可分に |

---

## Twitch仕様準拠チェック結果

| 項目 | 仕様 | 実測値 | 判定 |
|------|------|--------|------|
| PNG 28px | ≤25KB | ~0.6KB | OK |
| PNG 56px | ≤25KB | ~1.7KB | OK |
| PNG 112px | ≤25KB | ~5.3KB | OK |
| GIF 28px | ≤512KB | ~25KB | OK |
| GIF 56px | ≤512KB | ~40KB | OK |
| GIF 112px | ≤512KB | ~86KB | OK |
| GIFフレーム数 | ≤60 | 20 | OK |
| 点滅速度 | <3回/秒 | ~1回/秒 | OK |
| ファイル名 | ASCII | emote_XXpx.ext | OK |
| ZIP互換性 | Mac/Win | DEFLATE圧縮 | OK |

---

## コミット履歴

```
d542fba Initial commit from Create Next App
447346a feat: Twitch Emote Generator MVP
a7aebcd fix: Twitch仕様準拠 + シェアボタンUX改善
52a2abe fix: window.openを同期呼び出しに変更してポップアップブロッカー回避
64b4256 fix: カラーピッカーのドラッグ中に再描画が走る問題を修正
66a60c8 improve: 個別DLボタンをホバーオーバーレイ方式に改善
0e3c560 feat: 背景透過のスキップ・キャンセル・やり直し機能を追加
4b12238 feat: アップロード前のサンプル表示を追加
1c1bbdf improve: 高解像度中間キャンバス方式で出力品質を向上
961ec18 improve: フチ取り・テキスト縁取りをshadow方式に改善、28pxテキスト自動非表示
b2872b5 copy: トップページの訴求文を刷新
0e7c69a improve: モバイルレスポンシブ対応 + レイアウトoverflow修正
d096210 improve: alert()をトースト通知に置換 + 処理中スケルトン表示を追加
9868f88 improve: ヒーローテキスト修正 + モバイル個別DLボタン + 112px単体DL追加
b91080a feat: 縁の幅・文字サイズ・文字位置スライダー追加 + モバイル表示順最適化
c963677 fix: PC版DL/アニメーション重なりバグ修正 + GIFフレーム数増加
0f982f2 feat: サブスク限定機能（合言葉認証・限定アニメ5種・限定テキスト3種・カスタムボーダー色）
f2a21de improve: プレビューエリアをstickyに変更（設定スクロール時も常時表示）
b88b803 improve: 認証済みUIを控えめな1行バッジに畳む
afc6d18 fix: ヒーロー見出し「ブラウザだけで完結」の孤立改行を防止
3a0c14a improve: アップロード前でも設定パネルを薄く表示（プレビュー用）
```

---

## 今後の展望

### 短期（すぐ実装可能）
- Discord対応エクスポート（128px/64px/32px）
- 7TV / BTTV / FFZ 対応サイズ出力
- 限定おすすめパターン（サブスク限定アニメ使用）

### 中期（フィードバック次第）
- ブランドカラープリセット保存（localStorage）
- 画像のトリミング/位置調整UI
- テンプレートギャラリー
- 月替わり限定テンプレート（サブスク特典）

### 長期（需要があれば）
- 背景透過の手動調整（消しゴム/ブラシ）
- バッチ生成（複数画像の一括処理）
- PWA化（オフライン対応）
- OAuth連携（Twitch APIでサブスク自動検証）

### 最優先事項
**ユーザーフィードバックの収集。** 機能はMVP+UX改善+サブスク限定機能まで完了。実際に使った人の声を聞いてから次の判断をするのが最も効率的。
