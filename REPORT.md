# Twitch Emote Generator 開発レポート

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | Twitch Emote Generator |
| 本番URL | https://twitch-emote-generator.vercel.app/ |
| GitHub | https://github.com/aahsa20-star/twitch-emote-generator |
| 技術スタック | Next.js 16 (App Router) + TypeScript + Tailwind CSS v3 |
| ホスティング | Vercel（GitHub自動デプロイ） |
| コード規模 | 25ファイル / 約4,937行（src/配下） |
| コミット数 | 52 |
| 最新コミット | `2c52e41` improve: フォントサイズ上限を48px→72pxに拡大 + カラーピッカーのデバウンス修正 |

## コンセプト

**「1枚の画像をアップロードするだけで、Twitch/Discord仕様に準拠したエモートを自動生成するブラウザ完結ツール」**

- サーバーへの画像送信なし（完全クライアントサイド処理）
- AI背景透過 → ブラシ微調整 → 位置調整 → フチ取り → テキスト → アニメーション → 3サイズ同時出力
- 技術知識不要、初見で使える

---

## 実装済み機能一覧

### コア機能
- 画像アップロード（PNG/JPG/WEBP、D&D対応、10MB上限）
- 画像トリミング＋位置調整UI（レスポンシブキャンバス[PC:320px/モバイル:適応]、8ハンドル矩形選択、ドラッグ移動、ズーム50%〜200%）
- AI背景透過（@imgly/background-removal、WASM、約30MBモデル、標準/高精度モード切替）
- 背景透過のスキップ／キャンセル／やり直し
- 透過後ブラシ微調整エディタ（消しゴム/復元ブラシ、undo最大20回、レスポンシブキャンバス、紫カード+自動スクロール）
- Twitch向け3サイズ同時生成（28px / 56px / 112px）
- Discord向け3サイズ同時生成（32px / 64px / 128px）
- Twitch仕様準拠（PNG≤25KB, GIF≤512KB, ≤60frames, blink<3/sec）

### カスタマイズ
- フチ取り5種（なし / 白フチ / 黒フチ / 影付き / カスタム色[限定]）
- 縁の幅スライダー（1〜20px、デフォルト4px）
- カスタムボーダーカラー（ColorPickerで任意の色[限定]）
- テキストプリセット8種（草, GG, ないす, RIP, 尊い, えぐい, なんで, 草生える）
- 自由入力テキスト
- フォント9種（日本語5 + 英字2 + 標準2）
- 文字サイズスライダー（8〜72px、デフォルト20px）
- 文字色・縁取り色（カラーピッカー、onInput+200msデバウンスでリアルタイムプレビュー）
- テキスト縁取り幅スライダー（0〜10px、デフォルト3px、0で非表示）
- テキスト位置（上 / 中央 / 下）
- 横位置・縦位置スライダー（-50〜50px、デフォルト0）

### アニメーション（合計32種）

**通常アニメーション（7種）**
- 揺れる / 震える / 点滅 / ぴょこぴょこ / ズームイン / 回転 / ハートぷかぷか

**限定アニメーション（25種）[限定]**
- ゲーミング / グリッチ / キラキラ / 残像 / 高速回転
- ふわふわ / ぐにゃぐにゃ / ネオン / VHS / 雪 / 炎 / マトリックス / 酔っ払い / 紙吹雪 / 催眠
- ブラウン管 / 地震 / パーティ / ひっくり返る / 幽霊 / デジタル崩壊 / スパイラル / 鼓動 / バネ / ジェリー

**アニメーション速度調整**
- 遅い（80ms/フレーム）/ 普通（50ms/フレーム）/ 速い（25ms/フレーム）
- アニメーション選択時のみ速度セレクタ表示

### サブスク限定機能（[限定]）
- 合言葉認証（サーバーサイドAPI認証、Vercel環境変数で管理、localStorage永続化）
- 認証APIルート（`/api/auth`、POST、大文字小文字不問、サーバー設定エラーハンドリング）
- 認証済みUIは控えめな1行バッジに縮小（「AKI限定 解放済み」+解除ボタン）
- 未認証時はロック項目がグレーアウト表示
- ログアウト時にサブスク限定configを自動リセット（25種全アニメーション対応）

### 出力・共有
- Twitch / Discord タブ切り替えUI
- 最大サイズ単体ダウンロード（Twitch: 112px / Discord: 128px）
- ZIP一括ダウンロード（emotes.zip / discord_emotes.zip）
- モバイル個別DLボタン（各サイズ下に常時表示、タッチデバイス対応）
- PCホバーオーバーレイDL（マウスオーバーで表示）
- Xシェアボタン（クリップボードコピー + ツイート画面同時オープン）

### UX
- 画像位置調整エディタ（アップロード直後に表示、8ハンドルトリミング+ドラッグ移動+ズーム、確定/スキップ選択可能、ドラッグ中ハンドルをTwitchパープル#9146FFで16pxにハイライト）
- おすすめパターン8種（ワンクリック適用）
- 28px視認性チェッカー（警告バッジ表示）
- アップロード前のサンプル表示（キャッチコピー + 機能バッジ + Canvas生成サンプル4パターン）
- アップロード前の設定パネル薄表示（opacity-40で全項目がプレビュー可能、操作は画像アップ後に有効化）
- 背景透過スキップトグル（「透過済みPNGをそのまま使う」VTuber・イラスト素材向け文言）
- 背景透過精度モード切替（標準[速い] / 高精度[VTuber・イラスト向け]）
- 透過後ブラシ微調整（消しゴムで不要部分を透明化、復元ブラシで元画像から復元、ブラシサイズ5〜60px、紫カードUI、自動スクロール、説明テキスト付き）
- フローティングミニプレビュー（モバイル専用、90x90px、右下固定、チェッカーボード背景、処理中スピナー、タップでプレビュー領域へスクロール）
- トースト通知（操作フィードバック、5秒で自動消去、画面上部固定表示）
- スケルトンローディング（処理中のプレビュー領域にパルスプレースホルダー表示）
- PC設定パネルsticky追従（スクロールしても設定が常に見える）
- PCプレビューエリアsticky追従（設定をスクロールしてもプレビューが常に見える）
- モバイル最適化表示順（プレビュー→DL→おすすめ→設定の順で優先度順に配置）
- モバイルタップターゲット拡大（全ボタン min-h 44px、WCAG AA準拠）
- モバイル専用テキスト（「タップして画像を選択」「タップして画像を変更」）
- accept="image/*" でモバイルカメラロール全形式対応
- ヒーロー見出しのwhitespace-nowrap（「ブラウザだけで完結」の孤立改行防止）
- フィードバック導線（Google Formリンク、フッターに配置）

### デザイン・ブランディング
- Interフォント導入（英字はInter、日本語はNoto Sans JPにフォールバック）
- 絵文字全削除（テキスト＋CSSのみのミニマルUI）
- OGP/Twitterカード対応（動的OG画像生成 + summary_large_image）
- 免責事項強化（Twitch/Discord商標表示・AS-IS保証免責・AI精度免責）

### 品質最適化
- 224px高解像度中間キャンバス → multi-step downscale
- shadowBlur方式のフチ取り（アンチエイリアス改善）
- shadow多パス方式のテキスト縁取り（幅0〜10px可変）
- 28px/32pxテキスト自動非表示（視認性確保）
- GIF 20フレーム / 速度可変ディレイ（25ms〜80ms、滑らかなアニメーション）
- カラーピッカー: onInput + 200msデバウンスでリアルタイムプレビュー（macOS浮遊パネル対応）

---

## アーキテクチャ

```
src/
├── app/
│   ├── api/auth/route.ts        # 合言葉認証APIルート（Vercel環境変数照合）
│   ├── layout.tsx               # ルートレイアウト（Google Fonts、OGP/Twitterメタデータ）
│   ├── opengraph-image.tsx      # 動的OG画像生成（Edge Runtime、1200x630）
│   ├── globals.css              # グローバルCSS（Inter + Noto Sans JP）
│   └── page.tsx                 # メインページ
├── components/
│   ├── EmoteGenerator.tsx       # メインコンテナ（状態管理 + 合言葉認証 + Twitch/Discord切替）
│   ├── UploadPanel.tsx          # 画像アップロード（D&D + click）
│   ├── ImageAdjustEditor.tsx    # 画像位置調整（8ハンドルトリミング + ドラッグ + ズーム、レスポンシブキャンバス）
│   ├── BrushEditor.tsx          # 透過ブラシ微調整（消しゴム/復元、undo、レスポンシブキャンバス）
│   ├── SettingsPanel.tsx        # 設定UI（フチ取り/テキスト/アニメーション/速度 + 限定ロックUI）
│   ├── PreviewArea.tsx          # プレビュー表示 + サンプルショーケース
│   ├── PreviewCard.tsx          # 個別プレビュー（ホバーDLオーバーレイ）
│   ├── DownloadButton.tsx       # 最大サイズ単体DL + ZIP一括DLボタン
│   ├── ShareButton.tsx          # Xシェア + クリップボードコピー
│   ├── RecommendedPatterns.tsx  # おすすめ8パターン
│   ├── FloatingMiniPreview.tsx  # モバイル専用フローティングプレビュー（90x90px）
│   └── Footer.tsx               # フィードバック導線 + 免責表示
├── hooks/
│   └── useEmoteProcessor.ts     # 処理パイプライン統合フック（ExportMode対応、ブラシ編集ステージ管理、速度パラメータ対応）
├── lib/
│   ├── backgroundRemoval.ts     # @imgly/background-removal ラッパー（isnet/isnet_quint8モデル切替）
│   ├── canvasPipeline.ts        # Canvas描画パイプライン（中心配置/フチ取り/テキスト/縮小）
│   ├── gifEncoder.ts            # gif.js + Web Worker アニメーション生成（32種、速度可変）
│   ├── visibilityChecker.ts     # 28px視認性チェック
│   └── zipExporter.ts           # JSZip ZIP書き出し（動的ファイル名対応）
└── types/
    └── emote.ts                 # 型定義 + 定数（Twitch/Discordサイズ/フォント/プリセット/速度等）
```

### 処理パイプライン

```
画像アップロード
  → トリミング＋位置・ズーム調整（ImageAdjustEditor、8ハンドル矩形選択、320x320内部解像度）
    → AI背景透過（標準isnet_quint8/高精度isnetモード or スキップ）
      → ブラシ微調整（BrushEditor、消しゴム/復元、スキップ可能）
        → 224px高解像度キャンバスに中心配置
        → フチ取り（shadowBlur方式、カスタム色対応）
          → テキストオーバーレイ（shadow多パス方式、≤32pxはスキップ）
            → multi-step downscale（224→112→56→28 / 224→128→64→32）
              → PNG/GIF出力（20フレーム / 25〜80msディレイ）
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
| カラーピッカーがWindowsで背後に隠れる | z-indexの競合（sticky + overflow-y-auto） | z-10追加、overflow-y-autoをmd:のみに限定 |
| VTuber・イラスト素材の透過精度が低い | smallモデルでは複雑なイラストに対応しきれない | 標準/高精度モード切替 + ブラシ微調整エディタ追加 |
| HMR useEffect依存配列サイズ変更エラー | Turbopackが古いモジュールをキャッシュ | devサーバー再起動でキャッシュクリア |
| background-removal v1.7.0のモデル名エラー | `"medium"`/`"small"`はv1.7.0で非対応の型 | `"isnet"`/`"isnet_quint8"`に修正（ビルドエラー解消、全機能デプロイ復旧） |
| 合言葉がフロントエンドソースに平文露出 | クライアントJSに`PASSPHRASE`定数が含まれていた | サーバーサイドAPIルート(`/api/auth`)に移行、Vercel環境変数で管理 |
| おすすめパターンのGIF速度が固定 | RecommendedPatternsのgenerateGif呼び出しにanimationSpeed引数が欠落 | 第4引数にpattern.config.animationSpeedを追加 |
| テキスト未入力でも色・位置UIが表示される | SettingsPanelのhasText条件ガードが不足 | カラーピッカー・位置スライダーをhasText条件で囲む |
| handleLogoutに存在しないプリセットのチェック | 削除済みプリセット3種(howsitgoing等)のリセット処理が残存 | 死んだコードを削除 |
| handleExportの不要依存 | useCallbackの依存配列にsourceFileが不要に含まれていた | 依存配列から削除 |
| カラーピッカーの色変更がプレビューに反映されない | ネイティブchange（ピッカー閉じ時のみ）でしか親を更新しなかった | onInput + 200msデバウンスでリアルタイム反映 |

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

## コミット履歴（52コミット）

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
d8a5cd3 docs: REPORT.mdを現在の実装状態に合わせて完全更新
f76c05b style: 絵文字全削除 + Interフォント追加でUI洗練
58156aa legal: フッター免責文言を強化（商標表示・AS-IS・AI精度免責）
45a7277 improve: OGPメタタグ追加 + シェアトースト改善 + REPORT.md更新
106aac8 improve: フッターにフィードバック導線を追加（Google Form）
b8b0165 feat: Discord向けエクスポート機能を追加（32/64/128px）
3919a39 feat: テキスト縁取り幅スライダーを追加（0〜10px）
53d1ee8 remove: AKI限定テキストプリセット3種を削除
6d934e4 feat: 画像アップロード後にトリミング＋位置調整UIを追加
bbac0f5 docs: REPORT.mdを現在の実装状態に合わせて完全更新（30コミット/3,370行）
0563210 feat: ImageAdjustEditorにトリミングUI（8ハンドル矩形選択）を追加
95d96a4 docs: REPORT.md更新（トリミングUI追加反映、32コミット/3,595行）
5c2ad7c improve: モバイルUX改善（レスポンシブキャンバス・タップターゲット拡大・テキスト最適化）
48e6aa5 docs: REPORT.md更新（モバイルUX改善反映、34コミット/3,627行）
32dff43 fix: カラーピッカーのドラッグ中に再描画が走る問題を修正
3e2da96 fix: カラーピッカーがWindowsで背後に隠れる問題を修正
77f06d9 improve: 透過スキップ導線をVTuber・イラスト素材ユーザー向けに改善
81a669f copy: 背景透過関連の文言をVTuber層向けに改善
22fd0cb feat: 背景透過に「標準/高精度」精度モード切替を追加
c932189 feat: 背景透過後のブラシ微調整エディタを追加
4eef725 docs: REPORT.md更新（ブラシ微調整・透過精度モード反映、41コミット/4,094行）
b0d9c73 feat: 限定アニメーション10種追加（ふわふわ/ぐにゃぐにゃ/ネオン/VHS/雪/炎/マトリックス/酔っ払い/紙吹雪/催眠）
dda2adb security: 合言葉をサーバーサイドAPI認証に移行（平文削除）
deab1fb fix: background-removal v1.7.0のモデル名を正しい型に修正（ビルドエラー解消）
2ce0b9d improve: ブラシエディタの視認性向上（紫カード + 自動スクロール + 説明文追加）
7327761 feat: モバイル用フローティングミニプレビューを追加
25dcb7f feat: アニメーション速度調整 + 限定アニメーション9種追加
14ce374 docs: REPORT.md更新（48コミット/4,874行、アニメ31種+速度調整+セキュリティ強化+ミニプレビュー反映）
4b26acf fix: 4件のバグ修正（generateGif速度引数・テキストUI条件表示・不要チェック削除・依存配列修正）
2722ff2 feat: 限定アニメーション「ジェリー」追加（ぽよんぽよん弾み）
2c52e41 improve: フォントサイズ上限を48px→72pxに拡大 + カラーピッカーのデバウンス修正
```

---

## 今後の展望

### 短期（すぐ実装可能）
- 7TV / BTTV / FFZ 対応サイズ出力
- 限定おすすめパターン（サブスク限定アニメ使用）

### 中期（フィードバック次第）
- ブランドカラープリセット保存（localStorage）
- テンプレートギャラリー
- 月替わり限定テンプレート（サブスク特典）

### 長期（需要があれば）
- バッチ生成（複数画像の一括処理）
- PWA化（オフライン対応）
- OAuth連携（Twitch APIでサブスク自動検証）

### 最優先事項
**ユーザーフィードバックの収集。** 機能はMVP+UX改善+サブスク限定機能+Discord対応+トリミング＋位置調整+背景透過精度改善+ブラシ微調整+セキュリティ強化+アニメーション32種+速度調整+モバイルミニプレビュー+カラーピッカー改善まで完了。実際に使った人の声を聞いてから次の判断をするのが最も効率的。
