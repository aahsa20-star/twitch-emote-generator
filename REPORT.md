# Twitch Emote Generator 開発レポート

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | Twitch Emote Generator |
| 本番URL | https://twitch-emote-generator.vercel.app/ |
| GitHub | https://github.com/aahsa20-star/twitch-emote-generator |
| 技術スタック | Next.js 16.3 (App Router) + TypeScript + Tailwind CSS v3 + Auth.js v5（Twitch OAuth）。DB・外部 AI API なし |
| ホスティング | Vercel（GitHub自動デプロイ） |
| 利用条件 | Twitch で @datsusara_aki をフォロー（Twitch ログイン）または合言葉（署名付き Cookie）。どちらか一方で全機能 |
| アニメーション | 固定 100 種（8 カテゴリ、検索・お気に入り）。AI 生成・共有は 2026-09 に終了 |
| 認証 | Auth.js v5 + Twitch OAuth（JWT 戦略、フォロー確認 24h / 一時障害 48h 猶予） |
| テスト | vitest（`npm test`） |
| 最新の作業 | UI/UX 刷新をブランチ `feat/uiux-refresh`（`~/Developer/twitch-emote-ui`）でローカル実装、レビュー待ち・未 push。本番は main d9706df（Vercel dpl_6SeuTrj1Z3YSuUGeLScVnC4pnXiq）。下の「コア機能」は新しい順の変更履歴 |

過去の記録（Anthropic SDK / Supabase / 52 種 / trial 2 階層 / サブスク合言葉）は履歴として残しており、現行仕様ではない。

## コンセプト

**「1枚の画像をアップロードするだけで、Twitch/Discord仕様に準拠したエモートを自動生成するブラウザ完結ツール」**

- サーバーへの画像送信なし（完全クライアントサイド処理）
- AI背景透過 → ブラシ微調整 → 位置調整 → 2画像合成 → フチ取り → フレーム → テキスト → アニメーション → 3サイズ同時出力 → サブスクバッジ生成
- 技術知識不要、初見で使える

---

## 実装済み機能一覧

### コア機能
- **レビュー 12 対応（feat/uiux-refresh、2026-09-06、ローカル・レビュー待ち・未 push）** — 4 点を再現してから修正した。**§1 保存内容を出力の世代に結び付ける**: `useEmoteProcessor` に `requestedGen`（素材・base canvas・設定・出力先・サブ画像・再試行のいずれかが変わるたびに進む。StrictMode の二重 render で進まないよう前回の依存との同一性で判定）と `outputGen`（生成が成功した世代）/ `failedGen`（失敗した世代）/ `retryRender` を追加。`lib/ui/save-state.ts` の `outputCondition` が current / updating / failed / none を返し、`ExportPanel` / `SaveActions` は current のときだけ保存できる（旧出力は表示されるが「出力を更新中」「出力の更新に失敗しました（もう一度生成する）」）。`savePlanKey`（目的地・用途・形式・世代・ファイルの有無）が iOS の準備済み・完了カード・進行中の権限確認を束ね、API 応答後と ZIP 生成後のダウンロード直前に世代が一致するかを再確認して不一致なら「設定または出力が変わったため中止しました」。全サイズ保存は `canSaveAll`（every）のみ、単体は `canSaveFile`。案内文は「その文が出た時点の計画」に紐付け（古い「準備できました」は設定変更で消え、変更後に出た中止の文は残る）。**再現**: 修正前は同じ 112/56/28 GIF のまま文字や動きを変えても `planKey` が同じで準備済みが残り、`stage==="ready"` だけで保存可だった。**確認**: 動き変更直後に「更新中」→ 約 1 秒後に current と新しい見本、iOS（アプリ内ブラウザのモバイル emulation）で 準備する → 開く → 編集に戻って文字変更 → 保存へ で「準備する」に戻り古い案内文は消える、download-check を 3 秒遅延させて待ち時間中に目的地を変えると「中止しました」で保存されない、出力が揃うと保存が復帰（PC 単体 / ZIP / iOS 順次）、別作品に切り替えると完了カードが消える。**§2 バッジ**: `buildExportPlan` はバッジのとき platform を常に `BADGE_PROFILE.platform`（Twitch）にし、UI の目的地表示と API 送信値を一致させる。エモート用の目的地は `exportMode` に別途保持され「エモート」に戻すと復元。見本は保存と同じ `renderBadge`（72px）から生成し、共有画像もバッジ用。**確認**: Discord から バッジ → 目的地 Twitch（無効化・説明文）、72/36/18 PNG、`/api/download-check` 200、見本の data URL と保存ファイルが同一（3,978 bytes、72×72）、背景透過を有効にすると見本の四隅の alpha が 0、エモートに戻すと Discord 復元。テスト: 全 5 目的地からのバッジ計画を `validateDownloadRequest` に通して許可。**§3 選択中と確定済みの分離**: `lib/ui/source-state.ts` の reducer（confirmed / candidate、select / confirm / cancel / clear、`adjustTarget`）を `EmoteGenerator` が `useReducer` で使う。表示名・種別・元ファイル・調整 draft は確定単位で切り替わる。`canEnterStep` は候補が未確定なら工程 3/4 を理由付きで不可。画像は候補 → 「この範囲で使う / 調整せず使う」で採用、「選び直しをやめて、今の画像に戻る」で復帰。動画はトリミング確定まで `sourceFile` を触らず、`ingestVideoSource(decoded, file)` が素材の切替と採用を一度に行う（hook の source effect が保留中の decode を採用し、park で消さない）。動画の元ファイルを `confirmed.original` に保持し、「切り出し直す」で工程 2 に戻れる。GIF は採用前に `lib/gif/validate.ts`（gifuct-js の parseGIF、コマ数 > 0）で検証し、壊れていれば通知だけ出して今の作品を保持。**確認**: 初回選択直後に工程 3/4 を押すと「「画像を整える」で…選ぶと進めます」、A 編集中 → B 選択 → 「選び直しをやめる」で A の見本・名前・出力（data URL 同一）が復帰、B 確定後は B の出力が揃うまで「出力を更新中」で保存不可、動画選択 → キャンセル と 壊れた GIF（乱数バイト）でも A が残る、動画 確定（32 フレーム）→ 再生タブ → GIF 保存 200 → 切り出し直す → キャンセル で同じ出力。テスト: reducer の select / cancel / confirm / 再調整、工程ガード。**§4 768px 付近**: 編集画面の 2 カラムを `md:grid-cols-[minmax(260px,.82fr)_minmax(0,1.18fr)]`、間隔 16px（lg で 24px）、外側余白 md 24px（lg 40px）に変更。**確認**: 768 / 800 / 820px で `scrollWidth === innerWidth`、カラム幅 289 + 415（768）、保存画面の主ボタンも収まる。**追加の受け入れ確認（ローカル素材）**: 動画（ffmpeg 生成 320×240 2 秒 mp4）の読み込み → トリミング → 編集 → GIF 保存、2 画像合成（右下に重ねる、サブ画像サイズ 60%）→ 見本と保存 PNG の data URL が同一、アニメーション GIF 保存後に「動きなし」→ 保存画面が PNG に切り替わり「（PNG に切り替えました）」と表示して保存可。**結果**: tsc 0、vitest 22 ファイル 168 件（新規 11 件: source-state / save-state / 工程ガード / バッジ計画）、ESLint 6 error / 13 warning（error はすべて未変更ファイルの既存指摘）、`next build` 成功。**未確認（端末・アカウントが必要）**: 実機 iPhone のポップアップ・順次保存・キーボード表示中の dock、実 Twitch ログイン。**方針上の注記**: API の Twitch 専用チェックは緩めていない。ローカル確認のため `.env.local` に一時的に `TRIAL_MODE_ENABLED=false` を入れたが確認後に削除した。
- **UI/UX 刷新（feat/uiux-refresh、2026-09-06、ローカル実装・レビュー待ち・未 push）** — 09 の設計仕様と 10 の実装依頼に従い、入口 → 画像選択 → 調整 → 編集 → 保存を 4 工程に整理した。11 の操作モックは見た目と操作の参考で、モックの JS・CSS アニメは移植していない。作業場所は iCloud 外の worktree `~/Developer/twitch-emote-ui`（origin/main d9706df から分岐）。コミット: U1 f047b21 / U2 0bf2e9e / U3 31e9e50 / U4（本エントリ）。**構成**: `EmoteGenerator` が唯一の常設親として source / config / variants / processing / access を保持し、工程とタブは `hidden` の切替のみ（処理フックの親をアンマウントしない、PC とスマホで別エディタを二重 mount しない）。工程ナビは `lib/ui/steps.ts` の `canEnterStep`（画像なしは理由付きで不可、GIF は調整工程なし）。**入口**: `SiteGate` を「できること / 解放方法」の 2 カラムに。主導線 Twitch ログイン、代替の合言葉は常に操作可、401 は欄の直下に常設（次の送信まで残る）、429 は待ち時間、障害は合言葉への導線。認証処理は既存のまま。**1 画像を選ぶ**: 主ボタン + D&D、対応形式・上限は `lib/upload/accept.ts` の定義から表示（`accept` は明示リスト、`image/*` をやめた）、HEIC/HEIF は変換案内、エラーは再選択か × まで残す、同一ファイルの再選択可、同梱サンプル（`lib/sampleImage.ts` で描画、権利物なし）。GIF・動画は同じ入口から既存処理へ（動画から顔を抽出も残置）。差し替えは新画像の確定まで旧素材・設定を保持。**2 画像を整える**: 切り取り・拡大・位置は draft、確定時のみ反映。再調整は常に元画像（`originalFile`）から（切り取り済みを再切り取りしない）。背景は「そのまま使う / 背景を自動で消す（標準 / 高精度）」の明示選択。「この範囲で使う / 調整せず使う」、再入時は「変更を適用 / 変更せず戻る」。背景除去中は処理名・実進捗・「キャンセルして元画像で続ける」、失敗時は「元画像で続ける / 再試行 / 画像を変更」を常設（`useEmoteProcessor` に `bgRemovalFailed` を追加、自動で消えない）。ブラシ（消しゴム / 復元 / 元に戻す）は編集画面の「背景の仕上げ」として維持。新しい素材の処理中は旧素材の出力を表示しない（`setBgRemovedCanvas(null)`）。**3 編集する**: 左（スマホは上）に「できあがり」= 拡大見本（112px の 2 倍、実寸とは呼ばない）・表示用の背景切替・一時停止・更新中表示・実寸列とチャット行・可読性チェック、見本のドラッグ / ホイール / ピンチで既存の位置調整。右に 動き / 文字 / 飾り / その他 の button + aria-pressed タブ（全パネル hidden 保持）。動き: おすすめ 12（`lib/animations/picker.ts`、順序固定、人気順とは表示しない）→ すべて / お気に入り。おすすめ中の検索・分類は全 100 種を対象にし「検索中は全 100 種類から探しています」と表示、お気に入り内検索はお気に入り限定で 0 件時に「全 100 種類から探す」。「動きなし」は一覧外に常設、速度は選択を保持。再生は選択中 + hover/focus の最大 2 枚、画面外・非表示タブ・prefers-reduced-motion で停止。カタログ id・お気に入りキー（`emote-animation-favorites-v1`）・代表フレーム・pin/release・Worker 所有者キューは不変。GIF・動画入力は「再生」タブ（速さ・ループ）に切替。文字: 入力 → プリセット（+ 文字なし）→ 位置 → 色、詳細にフォント・縁取り・大きさ・自由配置。飾り: 代表 4 スタイル + フレーム 16、詳細に全 12 スタイル・幅・色・余白。その他: 画像を重ねる / バッジ / 位置・背景（再調整・背景やり直し・元画像・見本位置リセット）/ おすすめの仕上がり（開いたときだけ 4 パターン生成）。trial では従来どおり 🔒 と解説モーダル。スマホは下部固定 dock（できあがりを見る / 保存へ）、入力中は非表示、safe-area 確保。**4 保存する**: 目的地 → 形式 → サイズ → 主ボタン（`lib/ui/export-plan.ts`）。サイズは download profiles（サーバーガードと同じ定義）から生成し、この画面に許可リストを複製しない。形式の初期値は動きあり → GIF、なし → PNG、GIF は動きなしだと理由付きで無効、バッジ有効時は「エモート / サブスクバッジ」切替（PNG のみ 72/36/18）。実バイト数は生成済み出力のみ表示（バッジは表示しない）。主ボタン「112px GIF を保存」、副ボタン PC「全サイズをZIPで保存」/ iOS「各サイズを順番に保存」、サイズごとの保存も残置。全経路が `/api/download-check` を通り、403 は FollowGateModal（合言葉入力可）。iOS は「準備する」→「開く」の 2 段階、準備済みは目的地・形式・出力に紐付き変更で解除、同期 `window.open` のみ、ポップアップ拒否時は単体保存の案内。結果は「ダウンロードを開始しました / 新しいタブで開きました」と実際の動作で示し着地を断定しない。認証の確認 / ZIP 作成 / 出力の更新中 を状態として分離し、旧出力を新設定として保存させない。`ShareAfterDownloadModal` の自動割り込みを廃止し、完了カード内の任意ボタン（X シェア・作者 Twitch）に。**その他**: `useIsIOS`（`lib/ui/platform.ts`、useSyncExternalStore）で iOS 判定を hydration 後に反映（旧 `isIOS` 定数は SSR と文言が食い違う）。デザイントークン `--studio-*`（背景 #101114 / 面 #191a20 / 境界 #32333e / 本文 #f4f1eb / 補助 #a6a5b3 / 主操作 #c8b5ff）と共通クラス `components/ui/classes.ts`。撤去: `PreviewCard` / `FloatingMiniPreview` / `ShareAfterDownloadModal` / `ShareButton`（機能は保存画面・完了カードへ集約）。製品名・SEO は変更なし（モックの「Emote Studio」は採用せず）。**単体テスト（新規 23 件）**: `lib/ui/steps`（工程の可否・遷移先）、`lib/upload/accept`（形式・上限・HEIC）、`lib/animations/picker`（おすすめ順・検索の対象拡大・お気に入り限定）、`lib/ui/export-plan`（プロファイル由来のサイズ・形式・バイト数・バッジ）。**結果**: tsc 0、vitest 20 ファイル 157 件合格、ESLint は 6 error / 13 warning（main は 12 / 15。残る 6 error はすべて未変更ファイルの既存指摘: AnimationSheet / FeatureLockHint / ReauthBanner / RecommendedPatterns / VideoTrimmer / ColorPicker。新規・変更ファイルは error 0、warning は `<img>` の推奨のみ）、`next build` 成功、本番 build で `/dev/animations` `/dev/gif-check` 404。**実施した操作確認（ローカル、Chrome + アプリ内ブラウザ、PC 幅と 375px）**: 入口で誤合言葉 → 欄の下に「合言葉が違います」が残る → 正しい合言葉で解放 → 工程 1。サンプル → 調整（そのまま使う）→ 編集 → ハートぷかぷか選択 → 拡大見本が GIF 再生 → 文字 GG → 白フチ → 保存へ → 「112px GIF を保存」で download-check 200・完了カード → PNG に切替で一覧が PNG とバイト数に更新 → Discord に切替で「出力を更新中」→ 128/64/32 → ZIP 保存 200。写真アップロード → 背景を自動で消す → 進捗 → ブラシ「スキップ」→ 新素材のプレビュー（旧素材の出力は消える）。「位置・背景を調整」で元画像から再調整 →「変更せず戻る」でプレビュー保持。GIF 入力 → 工程 3 へ直行、「再生」タブ、工程 2 は理由付きで不可、GIF のみ保存可。おすすめ中の検索 bow → 全件から 2 件、お気に入り ★ → お気に入り 1 件。タブ往復で検索・お気に入り・選択を保持。連続で 8 回選択を切り替えても待機キューは 0 で最後の選択が表示。trial（SITE_LOCK_ENABLED=false をローカルのみで一時設定）: 利用可能 2 / 100、🔒 カードで解説モーダル、フレームはロック表示、保存で 403 → フォロー / 合言葉モーダル。スマホ幅（375）: 横スクロールなし、dock 表示、工程 1〜4 の縦積み。**操作数（同じ入力、初回保存まで）**: 旧 UI = 画像選択 → 確定 → 透過済み PNG をそのまま使う → アニメ選択 → 112px ダウンロード の 5 操作（スマホは DL ボタンまでスクロール）。新 UI = 画像を選ぶ → 背景「そのまま使う」を選び「この範囲で使う」→ 動き選択 → 保存へ → 保存 の 5 操作（スマホは dock から 1 タップで保存画面）。戻り操作は工程ナビ / 編集に戻る の 1 操作。効果の割合は未計測のため書かない。**未確認**: 実機 iPhone（2 段階タップ・順次保存・キーボード表示時の dock）、Twitch 実ログイン → フォロー解放・失効時の再認証、動画入力（トリマー → 顔抽出は既存のまま接続、ブラウザ上の実走は未実施）、2 画像合成とバッジの実出力（設定 UI の表示のみ確認）、prefers-reduced-motion 実環境、文字拡大・縦横回転、スクリーンリーダー。**ローカル確認手順**: `cd ~/Developer/twitch-emote-ui && npm run dev -- -p 3002` → `http://localhost:3002/` → ゲートで合言葉（または Twitch）→ 「サンプルで試す」→「この範囲で使う」→ 動きを選ぶ → 「保存へ進む」→ 「112px GIF を保存」。Google Fonts が取得できない環境は `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` を付ける（.claude/launch.json の `ui-worktree-dev` と同じ）。push・merge・デプロイ・本番設定変更・Supabase 操作は行っていない。
- **再デプロイ後の再確認（2026-09-06）** — PR #2 を main に merge（da03a55）→ Vercel 本番デプロイ `dpl_3sw78XU8639RsuDbAxHSjHLmBXeE`（`twitch-emote-generator-ibpj8wifw-…`、Ready、本番ドメイン反映）。鍵ローテーション後の確認: 旧鍵で発行した合言葉 Cookie を持つブラウザで `/` を開く → ゲート表示、`/api/access` は `locked`（旧 Cookie は署名不一致で拒否）。誤合言葉 → 401 `mismatch`。正しい合言葉（クリップボード経由、値は非記録）→ `unlocked` / `grants:["passphrase"]` → ツール本体表示、ヒーロー文言は「100種アニメ」（カタログ連動）。画像アップロード → 確定 → 透過済み PNG をそのまま使う → 「ハート」検索 → 「ハートぷかぷか」選択 → 112/56/28 のプレビュー GIF 生成（`turbopack-worker` 経由）→ 「112px GIF をダウンロード」→ `/api/download-check` 200 → `~/Downloads/emote_112px (6).gif`（112×112、20 フレーム、50 ms、透明/不透明混在、18 種類の異なるフレーム）。`/dev/*` と廃止 API は 404 のまま。コンソールエラーなし。未確認項目（Twitch 実ログイン、iPhone、100 種の連続目視）は前エントリと同じ。
- **公開後フォロー（2026-09-06）: 文言の件数連動 + 合言葉 Cookie 秘密鍵のローテーション** — (1) `PreviewArea.tsx` のヒーロー文言「52種アニメ」をカタログ定義の `ANIMATION_COUNT`（`src/lib/animations/catalog.ts`、現在 100）から生成する `${ANIMATION_COUNT}種アニメ` に変更。他の表示（ピッカーの「表示 / 利用可能 / 全」、TrialBadge）は既に件数連動だった。tsc 0、vitest 134/134、ESLint は変更前と同じ既存指摘のみ。(2) 初回公開時の `PASSPHRASE_COOKIE_SECRET` は入力操作ログに値が残ったため、`openssl rand -base64 48`（64 文字）で新規生成 → ファイル（600）→ クリップボード → Vercel ダッシュボードの Edit フォームに貼り付け → Save、という経路で Production 値を更新した。値は画面・ログ・チャット・リポジトリのいずれにも出していない（貼り付け後に長さ 64・空白なしだけを確認）。作業ファイルとクリップボードは直後に消去。鍵の更新により、それ以前に発行した合言葉 Cookie（`emote-access-v1`）は署名不一致で無効になり、合言葉の再入力が必要になる（30 日 TTL の cookie も同様）。Preview 環境の同名変数は別値のまま。(3) この変更を PR で main に取り込み、再デプロイ後に合言葉解放と GIF 保存を再確認する（結果は次のエントリ）。Supabase の旧データ・プロジェクトには触れていない。
- **本番公開（2026-09-06）** — PR #1（`release/r2-100-animations` = acca9da）を通常 merge し main を eee0bb2 に更新。Vercel が GitHub 連携で本番デプロイ `dpl_6L2NbVoGZUXF3bQesne9dwrfrKUf`（`twitch-emote-generator-ttmfmilrg-…`、Ready、`https://twitch-emote-generator.vercel.app` に反映）を作成。**本番環境変数（名前のみ）**: 新規 `PASSPHRASE_COOKIE_SECRET`（Production、新規生成 64 文字・ローカル検証値とは別）、新規 `SITE_LOCK_ENABLED=true`（Production）、既存の `FOLLOW_AUTH_ENABLED` / `TRIAL_MODE_ENABLED` / `DOWNLOAD_LOCK_ENABLED` を `true` に更新（Production and Preview）。`PREMIUM_LOCK_ENABLED` はコード上 no-op のため未変更。`PASSPHRASE` / `AUTH_*` / `AUTH_TWITCH_BROADCASTER_ID` は既存値をそのまま使用。Supabase / Anthropic の変数は未参照のため残置（削除していない）。**復旧先の記録**: 直前の本番デプロイは `twitch-emote-generator-ncxhhqi6l-…`（6c4d901、GitHub deployment 5469110185）。戻す場合は署名なし Cookie 等の旧問題も戻る。**公開直後の確認（実施済み）**: 新規ブラウザ状態で `/` がゲート（フォロー / 合言葉）を表示しツール本体の HTML は配信されない。誤合言葉 → `/api/auth` 401 `mismatch`。旧 Cookie `emote-subscriber=1` と偽造 `emote-access-v1` → `/api/access` は `locked`、`/api/download-check` は 403 `access-required`。ロック中は 28px PNG の trial 許可も 403。Origin 不一致 → 403 `origin-mismatch`。正しい合言葉（Vercel の値をクリップボード経由で貼り付け、値はログに残していない）→ 200 → 「合言葉で解放中（10/6 まで）」でツールが開く。画像アップロード → 位置調整「確定」→「透過済み PNG をそのまま使う」→ 3 サイズプレビュー。100 種ピッカー「表示 100 / 利用可能 100 / 全 100」、検索「ハート」で 1 件、お気に入り ★ が 1 件として保持、選択でプレビュー GIF（112/56/28、各 20 フレーム GIF89a）生成、GIF エンコードは `turbopack-worker-…js`（Worker、deploy id 入り）経由。「112px GIF をダウンロード」→ `/api/download-check` 200 → `~/Downloads/emote_112px (5).gif`（112×112、20 フレーム、50 ms、disposal 2、透明/不透明混在、18 種類の異なるフレーム）。PNG（Twitch 112px）と Discord タブ（128/64/32）のダウンロードも `/api/download-check` 200（2 回目以降のファイル保存は Chrome の「複数ダウンロード」確認に止められたため、ファイル着地は GIF 1 本のみ確認）。`/dev/animations` `/dev/gif-check` 404、廃止 API（`/api/templates` `/api/generate-animation` `/api/custom-animations` `/api/account/delete`、GET/POST）404、`/privacy` 200。コンソールエラーなし。**未確認（ユーザー引き継ぎ）**: Twitch 実ログイン → フォロー解放、トークン更新・失効、iPhone Safari の GIF 単体保存と各サイズ順次保存、100 種の連続再生の人の目視。**気づき**: `PreviewArea.tsx` のヒーロー文言「52種アニメ」が旧仕様のまま（100 種に直す軽微な文言修正、未対応）。
- **公開用ブランチの作り直し（2026-09-06）** — 本体ディレクトリ（iCloud 上）の `.git` が、ディスク満杯を契機に iCloud へ退避（dataless）され復元できなくなり、worktree からの push が止まった。作業ファイルは `~/Developer/twitch-emote-r1` に完全に残っていたため、origin/main（6c4d901）を新規クローンした `~/Developer/twitch-emote-release` に作業ツリーをそのまま載せ、1 コミットにまとめてブランチ `release/r2-100-animations` として push した。元の 11 コミット（R1a 2bb3a77 / R1b・R1c ed2f477 / R1s 6819b40 / A 0495831 / B 1a1f3e9 / C 104de3d / D df3a31b / R2 665544c・782bfce / 07 67c50a6 / 最終受け入れ f8c5120）の内容は本エントリより下の変更履歴に残している。iCloud の `.git` が復元できれば元の履歴も参照できる（内容は同一）。ディスク空き確保のため `~/.npm` のキャッシュを削除し、iCloud 同期デーモン（bird）を再起動した。
- **最終受け入れ確認（2026-09-06、機能追加なし）** — **100 種の再生確認**: (a) 生成した 100 本の GIF（顔入力 64px、通常速度）を Chrome 自身のデコーダ（WebCodecs `ImageDecoder`）で読み、全て 20 フレーム・1 周 1000 ms・無限リピート、平均 14.5 種類の異なるフレーム（動きのある GIF）であることを確認。デコード後の「最終→先頭」の差は、v1 の fall / spiralfall / stagger / surprise（意図した先頭復帰）を除き閾値内。`stamp` は 1 ビット透明の境界（α0.5）に最終フレームが乗って段差になっていたため消え際の α を閾値の下へ寄せ、デコード後の差 0 を確認。(b) 100 種 × 全 20 フレームを 40px のフレーム帯 8 枚（カテゴリ別）に描き出して全コマを目視し、動作の意味・保持・退出・先頭への接続を確認（画像はレポートと共に送付）。(c) canvas の `drawImage` は動画像 `<img>` の先頭フレームしか描かないため、ブラウザの再生そのものをプログラムで観測することはできない。人が画面で連続再生を見る確認は `/dev/animations?gif=1` で行える（未実施として残す）。**手順の訂正**: OS 時計の変更を前提にしない、更新は実際のトークン期限（約 4 時間）で確認、iOS は各サイズを順次開いて保存する 2 段階方式、に書き換えた（上の「ユーザー操作が必要な確認の手順（訂正版）」）。
- **ユーザー操作が必要な確認の手順（2026-09-06 訂正版、未実施）** — 自動テストやモックで代替したとは扱わない。OS の時計は変更しない。
  1. **Twitch 実 OAuth・フォロー確認（ローカル）**: `cd ~/Developer/twitch-emote-r1 && npm run dev` → `http://localhost:3000/` を開く。ゲートで「Twitchでログインして確認」→ Twitch の同意画面に「フォロー中のチャンネルを表示」（`user:read:follows`）が含まれる → 戻った直後、@datsusara_aki をフォロー済みならそのままツールが開く。未フォローなら「Twitchでフォローする」で別タブでフォロー →「フォローを確認」→「フォローを確認しました」→ ツールが開く。期待: `http://localhost:3000/api/access` の JSON が `"grants":["follower"]`。編集画面の「Twitchからログアウト」→ 未解放に戻る。合言葉を入れてから再度ログアウトしても `"grants":["passphrase"]` が残る（併用）。
  2. **更新の確認（実際のトークン期限）**: Twitch のユーザーアクセストークンは発行から約 4 時間で期限切れになる。ログインした時刻を控え、4 時間以上経ってから同じブラウザでページを開き直し「フォローを確認」または保存を行う。期待: 再ログインを求められずに成功し、`npm run dev` のターミナルに `Twitch token refresh failed` や `RefreshTokenError` が出ない。**失効の確認**: Twitch の「設定 → 接続」で本アプリの接続を解除してから「フォローを確認」。期待: 「Twitchへの再ログインが必要です」が表示され、合言葉の解放は影響を受けない。
  3. **24 時間 / 48 時間の境界**: 実時間で確認する場合は、フォロー解放から 24 時間以上経ってからページを開き直す。期待: 「フォロー状態を確認中…」が数秒表示され、そのまま解放に戻る（`/api/access` で `followerPending:false`, `grants:["follower"]`）。48 時間の猶予は Twitch 側の障害時のみ働くため実時間で再現できず、境界の挙動はユニットテスト（`src/lib/auth/evaluate-access.test.ts`、24h 直前/直後・48h 直前/直後・障害証拠の有無・偽 update・別ユーザー/配信者・合言葉併用）で確認済み。実時間確認は任意。
  4. **iPhone 実機**: Mac と同じ Wi‑Fi で `http://<Mac の IP>:3000/`（`ipconfig getifaddr en0` で確認）を Safari で開く → 合言葉で解放 → 写真から画像を選ぶ → 位置調整（またはスキップ）→ 透過 → アニメーションを選ぶ。保存は 2 段階: (a) 「112px GIF をダウンロード」を 1 回タップ →「準備できました。もう一度押すと 112px を開きます」→ もう一度タップ → 新規タブで GIF が開く → 長押し →「写真に追加」。(b) 「全サイズを順番に DL（iOS）」を 1 回タップ →「準備できました」→ もう一度タップ → 最初のサイズ（Twitch なら 112px）が開く → 戻って再度タップ → 次のサイズ（56px）→ 同様に 28px まで順に開き、都度長押しで保存。バッジも同じ順次方式（72 → 36 → 18px）。期待: 各サイズが順番に開き、ポップアップが拒否された場合は案内文が出る。
  5. **本番反映後の Worker 動作**: 本番 URL で GIF を 1 つ生成し、DevTools の Network に `turbopack-worker` を含む静的チャンクが 200 で読まれ、生成した GIF をダウンロードして再生できること。

- **07 レビュー対応（Worker 経路）と受け入れ確認（2026-09-06）** — **§1 転送後の Worker 異常で空データを再使用（再現 → 修正）**: モック Worker（structuredClone で transfer してから onerror を発火）で、再試行の RGBA 長が 0 になり `rgba length mismatch` で失敗することを再現。修正: `src/lib/gif/encode.ts` を所有権を明示した設計に変更。Worker 生成失敗と `postMessage` の同期例外（データ未転送）は元のフレームでメインスレッド代替、転送後の異常は呼び出し側が渡す `rebuild()` で元 canvas から RGBA を読み直して代替（`animations/index.ts` と `animatedEncoder.ts` は encode が settle するまで canvas を保持し、`rebuild` を渡す。再試行時だけ一時的に 2 コピー目が存在する。通常経路の追加コピーは無し）。`rebuild` が無い/再取得できない場合は `GifEncodeError`（reason `worker-crashed` / `post-failed`）で明示的に失敗し、編集画面は「GIF の生成に失敗しました。設定を少し変えるか、もう一度お試しください」を出す。Worker 内エンコードエラーは決定的なので再試行せず `encode-failed`。`postMessage` が同期例外を投げたときは pending から除去。**§2 待ち行列の上限（修正）**: ジョブに所有者・AbortSignal を持たせ、同じ所有者は「実行中 1 + 最新待機 1」。新しい要求が来ると未開始の古い要求は `GifEncodeCancelledError` で settle しフレーム参照を即時解放。所有者なし（おすすめパターン等）は FIFO で破棄しない。実行中のエンコードは中断せず完了後に呼び出し側が破棄。`useEmoteProcessor` は世代ごとに AbortController を持ち cleanup で abort、所有者 `editor-preview`。**テスト**（`encode.test.ts` 10 件、モック Worker）: コンストラクタ失敗→元データで代替、転送後 onerror→rebuild で成功/rebuild 無し→worker-crashed で明示失敗→次要求は成功、postMessage 同期例外→pending 0 で代替、Worker 内エラー→encode-failed で rebuild 不使用→次要求成功、同一所有者 5 連投→実行中 1 件と最新 1 件だけがエンコーダへ（2 件 posted、中間 3 件 cancelled）、別所有者/所有者なしは順序どおり、abort で待機ジョブ取消、既 abort は即時拒否、失敗後も詰まらない。**実ブラウザ（dev）**: 編集画面で 20 回の連続設定変更（震える/ぴょこぴょこ/なし/速度 3 種、150 ms 間隔）→ 待ち行列は実行中 1 + 待機 ≤1 の範囲、バースト終了 1 秒後に running=false / waiting=0 / workerBroken=false、最終プレビュー 3 サイズ GIF、エラー無し。ヒープ（Chrome `performance.memory`）は開始 54.8 MB → バースト直後 22.4 → 収束 24.1 → 10 秒放置 20.4 MB で増加なし。Worker の実クラッシュをブラウザで起こす検証は未実施（モックのみ）。**受け入れ確認（ローカル Chrome、`/dev/animations` を URL パラメータで自動実行）**: (1) ループのつなぎ — 各アニメで隣接フレーム差の平均に対する「19→0」差の比を算出。3 倍超かつ 2% 超は、既存 v1 の fall / spiralfall / stagger / surprise / hologram / kaleidoscope（落下・瞬間移動系の意図した先頭復帰）と、v2 の stamp（浮き上がりの終端と先頭の淡い大きな像の差、11.8〜12.8%。終端を先頭と同じ scale 1.7 / alpha 0.25 に揃えて改善済み、残差は半透明の大きな像同士の差）・crown（横長入力で 5.2%、王冠の消え際）のみ。thinking は末尾の傾き・点のフェードを直して一覧から外れた。連続再生の人による目視は未実施（`/dev/animations` で確認可能）。(2) 代表入力の 112px 出力 — 写真状（不透明・多色）: 100 種 × 3 速度すべて 20 フレーム・112px、99〜240KB（256KB 未満）、平均 660 ms/種。文字入り（GG、透明背景）: 100 種すべて成功、31〜84KB。横長・透明: 100 種すべて成功、22〜61KB。顔（透明）64px も 100 種成功。(3) 透明/不透明混在 GIF のブラウザ合成表示 — 生成 GIF の `<img>` を canvas に描いた合成結果で、bounce / page-turn は背景 α0・本体 α255（透明画素数が入力と一致し前フレームの残像なし）、curtain-open は幕が閉じた瞬間は全面不透明、stamp / iris-open / peek-left は空フレームの瞬間は全面透明。GIF は 1 ビット透明のため、stamp 冒頭のような α<0.5 の淡いフェードは GIF では「出現」になる（仕様上の制約、フレーム帯・GIF とも確認）。(4) 静止カードの空白: 写真・文字・横長入力でも 25% 未満は 0 件。(5) **本番 build の Worker 動作**: `next build` → `next start`（port 3001）で編集画面に画像を読み込み「震える」を選択 → 3 サイズのプレビューが GIF blob（先頭 6 バイト `GIF89a`、112px 39.8KB）、`performance` の resource に Turbopack の Worker チャンク `turbopack-worker-*.js` が記録され、アプリ側の JS エラーなし。HTTP 200 だけでなく Worker 経由の生成を確認した。同時に `/api/auth/session` が 500（Auth.js `UntrustedHost`）になったが、これはローカルの `next start` に `VERCEL` / `AUTH_URL` / `AUTH_TRUST_HOST` が無いための想定どおりの挙動で、Vercel 本番では `VERCEL` 環境変数により trustHost が自動で有効になる（コード変更なし。ローカルで本番モードを試すときは起動時に `AUTH_TRUST_HOST=true` を付ける）。
- **R2 レビュー（06）対応（2026-09-06）** — **§1 GIF の透明化が不透明画像を壊す（再現 → 修正）**: レビューの手順で gif.js 0.2.0 の `GIFEncoder` を直接叩き、完全不透明の黒 16×16 は 256 画素すべてが透明インデックス、写真状ノイズでも 15 画素が透明化することを再現。gif.js は `transparent` に「使用済みパレット中の最近色」を割り当てるため、入力に存在しない色を指定しても保証にならない（コミット B の動的センチネルだけでは不十分）。修正: `src/lib/gif/encoder-core.ts` が gif.js の `GIFEncoder` を直接駆動し、量子化・ディザリング後に**インデックス配列をアルファマスクで書き換える**。透明画素の無いフレームは透明フラグなしで書き出し（透明インデックス自体を持たない）。透明のあるフレームは「不透明画素が一つも使っていないパレット項目」を透明インデックス T に選び（センチネル色が集まった項目を優先）、256 項目すべてを不透明画素が使う場合は最少使用の項目を空けて該当画素を次に近い色へ再割当し、透明画素は全て T、不透明画素は必ず T 以外にする。GCE は毎フレーム disposal=2 で書き、透明フレームの穴から前フレームが見えない。エンコードは新 Worker（`encode.worker.ts`、`new Worker(new URL(...))`、ジョブ直列）で実行し、Worker 不可時はメインスレッドで代替。`animations/index.ts` と `gif/animatedEncoder.ts` は `encodeGifFrames()` に置換、gif.js の Worker（`public/gif.worker.js` と postinstall）は撤去。`transparency.ts` の「never collide」記述を「センチネルは量子化を助けるヒューリスティックで、保証はインデックス側」に改めた。**検証**: node テスト `encoder-core.test.ts` 9 件が実出力を gifuct-js でデコードして検査（不透明の黒 1 フレーム → 透明 0 画素・黒維持、>256 色の写真状不透明 → 透明 0・平均色誤差 < 24、黒目 + 透明、不透明→透明→不透明の混在 + disposal 2、全透明、アルファ 127/128、全 256 項目使用時の再割当、20 フレーム・delay・repeat）。ブラウザ `/dev/gif-check` 9 ケース（実パイプライン経由、Worker 実行）合格。**§2 再生中プレビューの LRU 破棄（修正）**: `preview.ts` を参照カウント方式に変更。`acquirePreview()` は再生中エントリを pin し、退避対象は未 pin のみ（上限 12 は未 pin 件数に適用、上限は増やしていない）。`release()` で参照を解放、二重 release は無視。入力画像の差し替え時、pin 中のエントリは stale マークして解放時に破棄、未 pin は即破棄。静止カードは `renderStaticFrame()` で描画後すぐ破棄（キャッシュしない）。カード側は effect の cleanup（停止・アンマウント・入力差し替え・検索/カテゴリでの消滅）で必ず release。ユニットテスト `preview.test.ts` 5 件（12 件超のホバーで pin が生存、上限、共有参照、入力差し替え時の遅延破棄）。ブラウザ実測（1280×900 viewport、選択 1 件 + 別カード 18 件を順次ホバー/フォーカス）: pinned は最大 2、unpinned は 12 で頭打ち、選択カードの描画画素数は 1565→1572 で継続、console 例外なし。検索・カテゴリ切替で選択カードが一覧から消えると release され、戻すと再 pin。画像差し替え後も選択カードは新画像で再描画。**§3 静止カードの空白（修正）**: カタログに `previewFrame`（代表フレーム）を追加し 45 種に設定（登場・変形・記号系は保持中のフレーム）。`/dev/animations` に代表フレームの内容量（入力に対する不透明画素比）を出し、25% 未満は赤枠で警告。100 種で 25% 未満は `peek-left`（約 50%: 半身が出ている状態）と `peek-bottom`（約 40%: 目線まで出た状態）のみで、どちらも動作の性質上の部分表示（内容は見える）。**§4 B06 の追加修正**: `document.fonts.ready` 直後と各サイズの処理開始前に世代判定を追加（古い世代は次サイズへ進まない）。`sharedHiRes` と動画/GIF 経路の `processedFrames` は `try/finally` で途中 return・例外時にも解放。中止できないエンコードは完了後に結果を破棄する（中止と破棄を区別）。メモリ実測は未実施（GC 依存のため恒久リークの有無は断言しない）。**28px 判別性**: `/dev/animations` を 28px で描画し、リアクション・記号装飾・登場・変形の 4 カテゴリ（46 種）のフレーム帯（代表フレーム + 6 コマ、3 倍拡大）を目視。代表フレームは全て内容が見え、✓ / ✗ / ! / ? / 電球 / 王冠 / 吹き出し / 三点は 28px で判別できる。`proud` の星と `sweat` の汗粒は 28px では小さく控えめ（意味は伝わる範囲、調整は任意）。**残る受け入れ確認（未実施）**: 100 種の連続再生を人が目視（`/dev/animations` で可能）、写真・文字入り・横長/縦長の実出力サイズでの画質、Twitch 実 OAuth・失効/更新、iPhone 実機。本番 build（`next build` → `next start`）で `/dev/animations` と `/dev/gif-check` が HTTP 404、`/` `/privacy` `/account` `/api/access` が 200 になることをローカルで確認。
- **回帰検証・最終一覧・公開手順（コミット D、2026-09-05）** — **100 種一覧**（id（表示名）、v2 = 今回追加）:
  - 基本 10: sway（揺れる）、shake（震える）、blink（点滅）、bounce（ぴょこぴょこ）、zoomin（ズームイン）、spin（回転）、float（ふわふわ）、heartbeat（鼓動）、tilt（傾く）、bobbing（浮き沈み）
  - 移動 18: fastspin（高速回転）、drunk（酔っ払い）、earthquake（地震）、spiral（スパイラル）、fall（落下）、ricochet（弾む）、figure8（8の字）、spiralfall（螺旋落下）、randomwarp（ランダムワープ）、stagger（酔い歩き）、orbit（円を描く・v2）、zigzag（ジグザグ・v2）、stairs（階段のぼり・v2）、roll-across（ころころ移動・v2）、swing-rope（ブランコ・v2）、slingshot（ひっぱって発射・v2）、crawl（もぞもぞ・v2）、orbit-pair（分身まわり・v2）
  - エフェクト 16: gaming（ゲーミング）、glitch（グリッチ）、afterimage（残像）、neon（ネオン）、vhs（VHS）、matrix（マトリックス）、hypno（催眠）、tv（ブラウン管）、party（パーティ）、ghost（幽霊）、glitch2（デジタル崩壊）、hologram（ホログラム）、pixelate（ピクセル化）、kaleidoscope（万華鏡）、electric（電流）、static（砂嵐）
  - リアクション 13: angry（怒る）、cry（泣く）、blush（照れる）、surprise（驚く）、sleepy（眠る）、bow（おじぎ・v2）、laugh-burst（大笑い・v2）、sweat（あせあせ・v2）、thinking（考え中・v2）、question（はてな・v2）、idea（ひらめき・v2）、defeated（がっくり・v2）、proud（どやっ・v2）
  - 登場 9: peek-left（横からちらっ・v2）、peek-bottom（下からちらっ・v2）、curtain-open（幕あけ・v2）、iris-open（丸く登場・v2）、diagonal-reveal（ななめ登場・v2）、stamp（ぺたん・v2）、paper-unfold（パタンと開く・v2）、teleport-ring（転送・v2）、brush-reveal（筆で登場・v2）
  - 記号・装飾 11: hearts（ハートぷかぷか）、sparkle（キラキラ）、confetti（紙吹雪）、speech-pop（ふきだし・v2）、applause（拍手・v2）、cheer-rays（応援・v2）、crown（王冠・v2）、checkmark（オッケー・v2）、crossmark（ダメ・v2）、exclamation（注目・v2）、loading-dots（待機中・v2）
  - 情景 10: snow（雪）、fire（炎）、sakura-petals（桜吹雪・v2）、autumn-leaves（木の葉・v2）、underwater（水の中・v2）、rain-umbrella（雨やどり・v2）、sun-rise（日の出・v2）、shooting-star（流れ星・v2）、moon-cloud（月と雲・v2）、flower-bloom（花が咲く・v2）
  - 変形 13: wobble（ぐにゃぐにゃ）、flip（ひっくり返る）、spring（バネ）、jelly（ジェリー）、stretch（伸び縮み）、inflate（膨らむ）、sticker-peel（シールめくり・v2）、contour-trace（ふちを描く・v2）、puzzle-assemble（パズル・v2）、tile-slide（タイル入替・v2）、page-turn（ページめくり・v2）、venetian-blinds（ブラインド・v2）、ripple-ring（波紋・v2）
  **検証（ローカル、Chrome）**: `tsc` 0 / vitest 13 ファイル 109 件合格 / ESLint error 12（すべて R1a 以前からある既存コード起因: `react-hooks/set-state-in-effect` 等 10 ファイル + `public/gif.worker.js`。新規コード由来の error は 0、更新前と同数）/ `next build` 成功。dev サーバーで curl 回帰: 廃止 API 6 経路すべて 404（500 なし・外部通信なし）、合言葉 POST 200 → `/api/access` unlocked、download-check は Twitch / Discord / 7TV / BTTV / FFZ / バッジの許可組合せ 200、不正組合せ（Twitch 128、Discord バッジ、GIF バッジ、空 files）400、旧 body `{size,format}` 200、未解放は Twitch 28px PNG のみ 200 で 112 GIF は 403、旧 Cookie `emote-subscriber=1` は 403、DELETE 後は locked、`/` `/account` `/privacy` 200、dev ページは開発時のみ 200。ブラウザで `/dev/gif-check` 4 ケース合格（黒目・白目・アニメ経路・マゼンタ顔）、`/dev/animations` 100 種フレーム帯目視 + 300 本 GIF エンコード合格、ピッカー UI（表示件数、お気に入り保存 `{"v":1,"ids":["sway"]}`、カテゴリ 13 件、検索「ハート」1 件、trial 時 98 件ロック）を確認。**未実施（実機・実サービス）**: Twitch OAuth 実認証・失効/更新・24h/48h の実時間経過（モックとユニットテストで代替、実サービスでは未確認）、iPhone 実機、連続設定変更・画像差し替え・長時間表示のメモリ実測（B06 はコード上の世代管理とコンパイルで確認、実測は未実施）、`/dev/animations` の連続再生を人が目視。`.env.local` を外した状態（Supabase / Anthropic / 認証系の環境変数なし）でも `next build` が成功することを確認（ネットワーク瞬断による Google Fonts 取得失敗で 1 回失敗し、再実行で成功）。**本番反映手順（未実行・書くだけ）**: (1) Vercel 環境変数: `PASSPHRASE_COOKIE_SECRET`（新規・必須、`openssl rand -base64 48`）、`FOLLOW_AUTH_ENABLED=true`、fix11 の名残（`TRIAL_MODE_ENABLED` / `DOWNLOAD_LOCK_ENABLED` が false なら true か削除）、`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` は削除可（参照されない）。(2) 共有機能終了の告知文と旧データの保持/削除方針を決める（Supabase の復旧・migration は不要。旧プロジェクトの削除も今回の作業に含めない）。(3) ブランチをレビューして push（自動デプロイ）。(4) デプロイ後: 未解放でゲート表示、合言葉で解放、Twitch ログイン → フォロー確認で解放、24h 経過後の「確認中」→ 再確認、Discord / 7TV / バッジの保存、100 種の選択と GIF 保存を本番で確認。(5) 合言葉利用者に再入力を案内（Cookie 方式変更）。(6) 問題時は `FOLLOW_AUTH_ENABLED=false` → `DOWNLOAD_LOCK_ENABLED=false` → `SITE_LOCK_ENABLED=false` の順で戻す。**削除した機能と環境変数**: AI 生成 / 共有掲示板 / いいね / 通報 / アカウント削除 API、`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY`（Vercel から削除してよい。残っていても参照されない）。**旧データ対応の判断事項**（公開前に Aki が決める）: 旧 Supabase プロジェクトの投稿データを保持するか削除するか、バックアップの要否、共有機能終了の告知文と時期、削除請求の受付窓口（現状は PP §10 の X DM / Twitch Whispers）。
- **固定アニメーション 100 種 + 分類・検索・お気に入り・プレビュー制御（コミット C、2026-09-05、04 指示 / 05 設計案）** — **レジストリ**: `src/lib/animations/catalog.ts` が id / 表示名 / カテゴリ（基本・移動・エフェクト・リアクション・登場・記号装飾・情景・変形の 8 分類）/ 検索タグ / trial 可否 / 追加時期を型付きで保持し、`AnimationId` 型をこのリストから導出。`src/lib/animations/index.ts` の `generators` は `Record<AnimationId, FrameGenerator>` なので、定義と実装の不一致は型エラーになる（`registryConsistency()` で実行時にも検査、テスト `registry.test.ts` / `catalog.test.ts` で 100 件・ID 一意・表示名一意・カテゴリ妥当・generator 重複なしを自動確認）。`types/emote.ts` の `AnimationType` / `ANIMATION_OPTIONS` / `TRIAL_ANIMATIONS` はカタログから導出（既存 52 ID はそのまま）。実装コード文字列の保存・評価は使用しない。**新規 48 種**（`v2-reactions` / `v2-entrance` / `v2-motion` / `v2-decor` / `v2-scene` / `v2-transform`）: 05 設計案の 48 ID を全て採用（差し替えなし。既存と見た目が重なる候補の確認: `laugh-burst` は二拍の縦圧縮 + 笑い線で `shake` と区別、`sakura-petals` は切れ込みのある花びらが曲線で横切る形で `snow` と区別、`orbit` は向きを保った円軌道で `spiral` / `figure8` と区別）。共通ヘルパー `helpers.ts`（seed 付き PRNG `prng`、easing、`drawBase`、`contentBounds` / `silhouetteOutline` は入力 canvas ごとに WeakMap キャッシュ = 輪郭抽出は入力変更時のみ）。元画像は読むだけで書き換えない。登場系は「出現→保持→退出」で末尾と先頭を接続。記号は最低線幅 `lineWidth(size, ratio, min)` と縁取り文字で 28px でも読めるようにした。**利用条件**: 100 種すべてフォローまたは合言葉で利用可能、trial は bounce / shake のみ（変更なし）。**UI**（`AnimationSettings.tsx` 全面書き換え）: 検索（NFKC 正規化、表示名・タグ・ID・カテゴリ名）、カテゴリタブ（すべて / お気に入り / 8 分類）、カード 3 列、「表示 N / 利用可能 M / 全 100」は定義から算出。お気に入りは `localStorage`（`emote-animation-favorites-v1`、`favorites.ts`）に保存し、破損 JSON・未知 ID・旧配列形式・上限超過でも落ちない（テスト付き）。**プレビュー**（`preview.ts`）: 初期表示で GIF を一斉エンコードしない。カードは frame 0 の静止画、選択中とホバー/フォーカス中の最大 2 枚だけ 56px の canvas に generator の出力を約 12fps で描く（gif.js 不使用）。フレームは (入力, id) 単位で LRU 12 件までキャッシュし、退避時と入力変更時に canvas を解放。画面外（IntersectionObserver）・タブ非表示・`prefers-reduced-motion` では再生しない。キーボード（フォーカス）でも再生・選択できる。**dev ページ**: `/dev/animations`（本番 404）で 100 種のフレーム帯（0/4/8/12/16/19）と各速度の GIF エンコード + デコード検査、`/dev/gif-check` は B12 用。**性能実測（Chrome / 同一 64px 入力）**: 100 種 × 20 フレーム生成 合計 472 ms（平均 4.7 ms、v2 平均 3.7 ms、最遅は既存の glitch2 50 ms / glitch 49 ms / vhs 45 ms）。GIF エンコード（`/dev/animations`、64px、slow/normal/fast の 3 速度 × 100 種 = 300 本）: 全て成功、各 20 フレーム・64×64、サイズ 22.7〜42.7KB（最大 rain-umbrella / hypno / static）、1 種あたり平均 334 ms（最大 659 ms）。**目視**: 100 種のフレーム帯（6 コマ）を画像として確認し、動作・ループ接続に破綻がないことを確認。連続再生の人による確認は未実施（`/dev/animations` を開けば確認できる）。
- **フォロー再確認の整合 + 描画基盤修正 B06 / B12（コミット B、2026-09-05、次期実装指示 04）** — **権限評価**（`src/lib/auth/evaluate-access.ts`）を厳密化: 成功したフォロー確認は 24h 有効。24h を過ぎた証拠だけでは許可せず、**サーバーが確認した一時障害の証拠**（最後の成功より後に試みた再確認が temporary-error、同じユーザー・同じ配信者）がある場合に限り最後の成功から最大 48h まで許可。障害証拠が無い場合は新状態 `followerPending`（「確認中」）として許可を保留し、`page.tsx` はゲートではなく作成画面を返す（編集中の素材・設定を失わせない）。未フォロー確定・token 失効・対象不一致・ID 欠落・未来時刻の証拠は許可根拠にしない。合言葉が有効なら OR で利用可能（pending も解除）。再確認を呼ばない直接 API（`/api/download-check`）も同じ評価を通るため期限判定を回避できない。**JWT 処理の抽出**: `src/auth.ts` の jwt callback 本体を `src/lib/auth/twitch-session.ts`（`processJwt`、fetch/時刻/env を注入可能）に移し、モックで 14 ケースをテスト: 期限切れ token の手動確認は refresh → 新 token で照会（A11）、照会 401 は refresh 1 回 + 再照会 → 再 401 で ReauthRequired、refresh 400 は永続失敗、503 は一時失敗、一時障害は最後の成功を保持し `followAttemptedAt` だけ更新（猶予証拠）、未フォロー確定は即上書き、偽 update（isFollower / checkedAt / sub）は無視（A12）、未知 trigger は何もしない、TTL は 24h 未満なら照会しない、障害中の TTL は 5 分の backoff、手動は 5 秒スロットル、1 時間ごとの validate で client_id / user_id / scope を照合、FOLLOW_AUTH_ENABLED=false で Twitch 通信ゼロ、別アカウントでのサインインは旧証拠を破棄。Cookie 更新は引き続き `useSession().update()`（サーバーが Twitch へ確認して証拠を作る。クライアント値は trigger 文字列以外読まない）。**クライアント**（`AccessProvider`）: `ensureFollowerFresh()` を単一飛行化し、mount 時・`visibilitychange`（タブ復帰）・60 秒ごとの定期評価で 24h 超過を検出して TTL 再確認。失敗後は 5 分、通常は 60 秒の最短間隔で再試行ループを防止。`AccessStatusPanel` は pending 時に「フォロー状態を確認中…」を表示。`EmoteGenerator.onBeforeDownload` は pending なら再確認を待ってから保存確認へ進み、失敗時は再認証パネルを出す。**B06**（`useEmoteProcessor`）: 描画 effect を世代番号で管理。cleanup が同期的に世代を無効化し、GIF 生成などの開始済み非同期処理は各 await 後に `isStale()` を確認して、古い結果で variants / stage / 読み込み表示を上書きしない（旧コードは cleanup を setTimeout の戻り値として返しており React に登録されていなかった）。**B12**（`src/lib/gif/transparency.ts`）: 原因は gif.js が `copy: true` で描く scratch canvas の塗り（`ctx.setFill` の誤記で未設定＝黒）と `transparent: 0x000000` の組合せで、透明領域が黒になり不透明な純黒（目・輪郭）まで透明化していたこと。修正はアルファをアプリ側で平坦化して ImageData を渡す方式: alpha ≥ 128 は不透明（元の RGB 維持）、alpha < 128 は GIF ごとに選ぶ**センチネル色**（全フレームの不透明画素の 4bit ヒストグラムに存在しない、近傍ビンも空の色。候補 16 色 → 全探索フォールバック）に置換し、その色を `transparent` に指定。固定キー色ではないため任意入力との衝突が無い。半透明の定義: GIF は 1bit 透明のため 128 未満は透明、以上は不透明（マット合成しないので明暗どちらの背景でも同じ見え方）。元画像は読むだけで書き換えない。両エンコーダ（52 種アニメ / GIF・動画入力）に適用。**検証**: `/dev/gif-check`（開発時のみ、本番 404）で 112px の「白顔+黒目」「黒顔+白目」「マゼンタ顔+黒目」を bounce / 動画経路でエンコードし gifuct-js でデコード → 目の画素が不透明で元色、背景 alpha 0、透明インデックス設定あり、マゼンタ入力ではセンチネルが緑に切替、全 4 ケース合格を dev サーバーのブラウザで確認。**B05**: 共有タブ撤去（コミット A）で作成コンポーネントがアンマウントされる元経路は消滅。残る画面遷移は再認証モーダル（オーバーレイ）と `/account`（別ページ、編集中に誘導しない）のみで、モーダルは編集状態を保持する。今回のためだけの永続化基盤は追加していない。テスト: vitest 98 件。実 OAuth・実機は未実施（モック検証のみ）。
- **AI 生成・共有掲示板・Supabase の撤去（コミット A、2026-09-05、次期実装指示 04）** — プロンプトから実行コードを作る AI アニメーション生成、テンプレート共有、みんなのアニメーション（いいね・通報・投稿者表示）、Supabase 依存をアプリから一括撤去し、DB に依存しないエモート編集ツールにした。**削除**: `/api/templates*`・`/api/custom-animations*`・`/api/generate-animation`・`/api/account/delete`（いずれも 404。500 や Supabase 通信は起きない）、`lib/supabase.ts`・`lib/templateUtils.ts`・`lib/animationSandbox.ts`（任意コード実行の iframe を経路ごと撤去。R1s の安全対策だけ外して実行経路を残す中間状態は作っていない）・`lib/auth/api-guards.ts`、`Gallery`・`PopularTemplates`・`PostTemplateModal`・`PublishAnimationModal`・`LoginPromptModal`・`AccountDeleteButton`、`supabase-*.sql` 4 本（旧 migration 指示は廃止・実行不要。`ADMIN_DELETION_SOP.md`・`PRIVACY_AUDIT.md`・`SESSION_HANDOFF.md`・`FOLLOWER_AUTH_RESEARCH.md` に廃止バナー）。依存から `@anthropic-ai/sdk`・`@supabase/supabase-js` を除去し lockfile を整合。環境変数 `SUPABASE_URL`・`SUPABASE_SERVICE_ROLE_KEY`・`ANTHROPIC_API_KEY` はアプリで一切参照しない（`.env.example` から削除）。**旧設定の境界**: `useEmoteProcessor.updateConfig` が `animation.type === "ai-custom"` / `aiAnimationCode` を入力境界で破棄して `none` に正規化し、「AI 生成アニメーションは終了しました」を表示。`AnimationType` から `ai-custom`、`AnimationConfig` から `aiAnimationCode`、`Template` 型・`TEMPLATE_TAGS` を削除。**利用条件**: 旧 `loginOnly`（gaming / glitch / neon）を廃止し、固定アニメーションは全てフォローまたは合言葉で利用可能（`subscriberOnly` に統一）。お試し状態の bounce / shake は維持。**UI**: `HomeClient` のタブ（テンプレート）を撤去して単一画面化（作成コンポーネントがタブ切替でアンマウントされる経路＝分析 B05 の元経路が消滅）、`EmoteGenerator` から投稿ボタン・ログイン誘導・人気テンプレート・テンプレート適用を撤去、`AnimationSettings` を固定アニメーションのみに書き換え、`ShareAfterDownloadModal` のテンプレート表記を削除。`/account` は「サーバー上に削除対象データは無い」「終了前の投稿データはアプリから閲覧・削除できず、削除希望はプライバシーポリシーの連絡先へ」と明記（「過去の投稿も削除しました」とは表示しない）。ログアウト（Twitch セッション Cookie）・合言葉解除（合言葉 Cookie）・ブラウザ内設定消去を区別して説明。**試行制限**: Supabase RPC を外し、インスタンス内メモリのみ（`src/lib/auth/rate-limit.ts`）。10 回 / 15 分 / 送信元・429 + Retry-After は維持。バケットは絶対期限 `expiresAt` を持ち、期限切れは遅延削除、上限 10,000 件で満杯時は期限切れを先に削除し、無ければ最も早く期限切れになるバケットを退避（退避されたキーだけ制限が緩む）。異なる制限期間のバケットが互いを消さないことをテスト。**限界（明記）**: 複数インスタンスをまたぐ全体制限でも再起動後も持続する制限でもない。ホスティング側の追加防御（Vercel Firewall のレート制限等）が必要なら別途判断。**文書**: プライバシーポリシー §1-2 / §2 / §3-2 / §4 / §5 / §6 / §7 / §8 を終了後の実態に更新（残存データの説明、削除請求手順、Anthropic 削除、Supabase は「残存データの保管、アプリからの接続なし」）。README・CLAUDE.md・.env.example を更新。**旧データ対応（公開前の判断事項）**: 旧 Supabase プロジェクト（ref ckeisitbwhcohcxkjofo、停止中）の templates / likes / custom_animations / animation_likes / animation_reports / ai_animation_logs は削除していない。アプリからの接続を外しただけで、バックアップ取得・公開終了の告知・残存データの保持期間または削除の方針は Aki の判断事項として残す。停止中であることを理由に不要とは判断していない。
- **AI サンドボックスの限定的な安全性改善（R1s、2026-09-05）** — `src/lib/animationSandbox.ts`。iframe は `allow-scripts` のみ維持し、srcdoc 先頭に CSP（`default-src 'none'`、`connect-src/img-src/media-src/font-src/style-src/frame-src/child-src/worker-src/object-src/form-action/base-uri/manifest-src 'none'`、`script-src` は nonce + `unsafe-eval`）を設定。`unsafe-eval` は sandbox 内で `new Function` を使うためだけに必要で、親ページの CSP は変更しない。postMessage は親側で `e.source === iframe.contentWindow`（opaque origin なので origin 文字列では認証しない）、iframe 側で `e.source === window.parent` を照合し、`type` / `requestId` / 256×256 の整数寸法 / `pixels.byteLength === w*h*4` / コード長 5000 以内 / frameIndex 範囲を検証。戻り canvas も 256×256 を要求。ready Promise を共有し、初期化 10 秒 timeout で iframe を破棄、`destroySandbox()` は保留リクエストを全て reject。ピクセルは `Array.from` のコピーではなく ArrayBuffer を transfer。**未解決（明示）**: 同期無限ループや巨大 Canvas 確保は Promise が timeout するだけで iframe は動き続ける（停止可能な Worker + 別オリジンは次段階）。CSP は通信制限であり、iframe 自身の navigation 等まで完全に閉じるものではないため「外部流出を完全に防止」とは言わない。隔離試験（外部通信・無限ループ・巨大出力・不正 message）は実ブラウザでの手動確認が必要で、今回は静的検証と型チェックのみ。
- **フォロー解放の復活 + 署名付き合言葉 + 保存経路の統一（R1b / R1c、2026-09-05）** — 仕様書「フォロー解放と合言葉併用」R1 の実装。**解放権限**は `evaluateAccess()`（`src/lib/auth/evaluate-access.ts`、純関数）が `follower OR passphrase OR emergency(TRIAL_MODE_ENABLED=false)` で解決し、公開用 `AccessSnapshot`（`src/types/auth.ts`）を返す。サーバー側の入口は `resolveAccess()`（`src/lib/auth/resolve-access.ts`）で、署名付き合言葉 Cookie を先に（外部通信なしで）評価し、Twitch session は必要時のみ解決（障害時は identityStatus="unavailable" に縮退し合言葉権限は落とさない）。**合言葉 Cookie** は `emote-access-v1`（`base64url(payload).base64url(HMAC-SHA256)`、payload `{v,aud,iat,exp}`、30 日固定・閲覧で延長なし、時計ずれ 60 秒許容）。署名鍵は新環境変数 `PASSPHRASE_COOKIE_SECRET` と正規化済み PASSPHRASE から派生（どちらを変えても旧 Cookie 全失効）。旧固定値 Cookie `emote-subscriber=1` は一切信頼せず自動昇格しない（A05）、`/api/auth` 成功時に削除。**試行制限**: `/api/auth` は送信元 IP の HMAC をキーに 10 回 / 15 分（成功失敗を問わずカウント、429 + Retry-After）。ストアは Supabase RPC `consume_rate_limit`（`supabase-auth-rate-limits.sql`、追加のみ・service_role 限定）、DB 不達/2 秒超過/未適用時はインスタンス内メモリ窓にフォールバック（Aki 判断: Supabase 停止中も合言葉入力を止めない）。**フォロー判定**（`src/auth.ts` 全面書き換え）: 再確認は `useSession().update({trigger:"follower-recheck"|"follower-ttl"})` 経由のみ（Cookie に永続化される唯一の経路）。クライアントが送る値は trigger 以外無視。順序は token 期限切れ→refresh（A11）→ 1 時間ごとの `/oauth2/validate`（client_id / user_id / scope 照合）→ `/helix/channels/followed`。401 は refresh 1 回＋再照会、再度 401 で `ReauthRequired`。429/5xx/timeout は `temporary-error` として最後の成功結果を保持（`followCheckedAt` は成功時のみ更新）。全体 8 秒 deadline、1 fetch 3 秒・最大 2 回（旧 1s/3s/10s 待機は撤廃）。手動再確認は JWT 5 秒スロットル + 共有 RPC（user id キー）。**鮮度**: 成功から 24h 未満は有効、24h〜48h は `followerRecheckDue=true` で猶予（クライアントが mount 時に TTL 再確認）、48h で失効。非フォロー確定は即時失効（猶予なし）、`unauthorized` も猶予なし。RSC（page.tsx）は Cookie を書き戻せないため、ページ描画時には Twitch 照会をしない。**API 権限**（`src/lib/auth/api-guards.ts`）: 投稿・いいね・通報・AI 生成/残数 = 有効な Twitch 本人認証 + 解放権限（401 identity-required / 401 reauth-required / 503 temporarily-unavailable / 403 access-required）。本人の投稿削除・アカウント削除 = 本人認証のみ（フォロー・合言葉不要、A16）。削除 API は DELETE のエラーを 500 で返し所有者条件を DELETE 自体にも付与（B22）。変更系 API 全てに Origin 検証（`src/lib/auth/origin-check.ts`、`APP_ORIGIN` 任意）。**新 API** `GET /api/access`（`auth(handler)` ラッパーで refresh 後の JWT を Cookie に書き戻す、no-store）。**UI**: `AccessProvider`（`src/components/providers/AccessProvider.tsx`）が snapshot の単一の源。`SiteGate` は「フォロー、または合言葉で使えます」— 未ログイン: 「Twitchでログインして確認」+ フォローリンク + 合言葉フォーム、ログイン済み未解放: 「Twitchでフォローする」+「フォローを確認」（未フォロー/再ログイン/一時障害の 3 文言）、合言葉フォームは常に操作可能、フッターに `/account` 導線。`FOLLOW_AUTH_ENABLED=false` ならフォロー CTA と照会を全て停止（A17）。編集画面は `isPremium = access.isUnlocked`（fix11 の固定 true と localStorage 判定を撤去）。`AccessStatusPanel` が「フォローで解放中」「合言葉で解放中（期限）」を表示し、「この端末の合言葉認証を解除」と「Twitchからログアウト」を別操作にし、最後の権限を失う操作の前に「利用には再認証が必要です」を出す（A15）。権限喪失時も作成コンポーネントはアンマウントせず、保存時に `FollowGateModal`（再認証パネル: フォロー確認 / 再ログイン警告 / 合言葉）を出す。新規 `/account`（ゲート外）でログイン・合言葉解除・アカウント削除。**保存（R1c）**: 共通仕様 `src/lib/download/profiles.ts`（Twitch/BTTV 28/56/112、Discord/FFZ 32/64/128、7TV 32/64/96/128、バッジ 18/36/72 PNG のみ）。`POST /api/download-check` は `{platform, assetType, files[]}` を受け、400 invalid-body/invalid-output（入力エラー、フォロー勧誘に変換しない）/ 403 access-required / 403 origin-mismatch。旧 `{size,format}` は 1 リリースだけ互換受付（28/56/112→twitch、32/64/96/128→7tv、**次回撤去予定**）。これで Discord/7TV/FFZ の PC 主保存が 400 で拒否されていた不具合（分析 B04）を解消。全保存入口（PC/モバイル主ボタン、サイズ別プレビュー、ZIP=含む全ファイル、バッジ ZIP/サイズ別、おすすめパターン）が `DownloadGate` を通る。ZIP は `ExportResult` を返し失敗時に共有モーダルを出さない（B24）。iOS は許可確認後にもう一度タップして `window.open` する 2 タップ方式（非同期後の window.open を前提にしない、ポップアップ拒否時は案内）。API 応答待ち中に出力が更新されたら混在させず再操作を求める。**フラグ**: 値は true/1/yes/on・false/0/no/off のみ、それ以外は警告して既定値。`FOLLOW_AUTH_ENABLED` のコード既定値は false のまま（本番で true を明示して段階公開）。`PREMIUM_LOCK_ENABLED` は deprecated（実効なし）。**テスト**: vitest 導入（`npm test`）、72 件（合言葉トークン / 権限評価の 24h・48h 境界 / 出力仕様 / Origin / 試行制限の並列 / フォロー照会の 401・429・5xx・timeout / `/api/auth`・`/api/download-check` の route handler）。dev サーバーでゲート表示・401/403/429・旧 Cookie 拒否・Discord/7TV/バッジ 200・旧 body 互換・DELETE 後ロック・`/account` 公開を curl で確認、ゲート UI の誤入力表示をブラウザで確認。実 Twitch OAuth・実機 iOS・本番 DB は未検証。**旧ユーザーへの影響**: 合言葉で解放していた人は再入力が必要（Cookie 名変更・署名化）。**新環境変数**: `PASSPHRASE_COOKIE_SECRET`（必須、32 文字以上）、`APP_ORIGIN`（任意）。**migration**: `supabase-auth-rate-limits.sql`（未適用 → コミット A で廃止・削除。実行不要）。**残課題**: AI iframe の同期無限ループ停止（R1s では未解決）、R2（B05/B06/B12）、旧 body 互換の撤去。
- **依存のセキュリティ更新（R1a）** — `npm audit` で critical 3 / high 6 / moderate 2（本番依存）が出ていたため、機能更新と切り離して修正版へ更新。Next.js 16.1.6→16.3.4（HTTP request smuggling / Server Actions CSRF null origin / image cache 無制限成長 等 GHSA-ggv3-7p47-pfv8 ほか）、React / react-dom 19.2.3→19.2.8、next-auth 5.0.0-beta.30→beta.32（@auth/core 0.41.0→0.41.3: OAuth state/nonce/PKCE cookie のプロバイダ非束縛 GHSA-x445-f3h2-j279 ほか）、eslint-config-next 16.3.4、@types/react 19.2.18、@anthropic-ai/sdk 0.80.0→0.91.1（Memory Tool のパス検証・権限。本アプリは messages.create のみ使用で該当機能未使用だが修正版に揃えた）。`npm audit fix`（非 force）で sharp / ws / protobufjs / nanoid / postcss / lodash-es の推移的依存も解消し、更新後の audit は 0 件。検証: `tsc --noEmit` 新規エラー 0、`next build` 成功（Turbopack）。既知の注意: `next build` は Google Fonts を取得するため、ネットワーク瞬断で `@vercel/turbopack-next/internal/font/google/font` の解決エラーになることがある（再実行で解消、依存更新とは無関係）。ESLint は eslint-config-next 16.3 で `react-hooks/set-state-in-effect` 等の新ルールが入り既存コードに 12 件の error（更新前 14 件、すべて既存コード起因、ビルドには影響しない）。変更箇所: `package.json`・`package-lock.json` のみ。
- **サイトロックの解放経路を合言葉のみに変更（fix14.1）** — fix14 で併設していた Twitch フォロー解放経路を撤去。`SiteGate` から Twitch ログイン/フォロー確認セクションを削除し合言葉フォームのみに簡素化、`FOLLOW_AUTH_ENABLED` killswitch の default を true→false に反転（env で true を明示すればフォロー解放が復活する可逆設計、既存フォロワーの JWT `isFollower` も evaluateAccess で無視される）。Twitch ログイン自体はテンプレート投稿・AI アニメ生成などログイン必須機能用に残存。変更箇所: `SiteGate.tsx`・`page.tsx`・`feature-flags.ts`・`.env.example`・`CLAUDE.md`。
- **サイト全体ロック（fix14: 合言葉必須化）** — ツール本体の利用に合言葉入力（or Twitch フォロー）を必須化。`app/page.tsx` を Server Component 化し、リクエストごとに `evaluateAccess`（follower OR PASSPHRASE-cookie OR killswitch）をサーバー側で評価。未解放ユーザーには新規 `SiteGate` 画面（合言葉入力メイン + Twitch ログイン/フォロー確認の併用経路）のみを配信し、ツール本体の HTML 自体を届けない（client-only gating より強い）。合言葉成功時は `/api/auth` の HttpOnly cookie set 後 `router.refresh()` で Server Component を再評価、フォロー経路は fix7.2 確定の `useSession().update({ trigger: "follower-recheck" })` フローを流用。旧クライアント UI は `HomeClient.tsx` に移設。新 killswitch `SITE_LOCK_ENABLED`（default true）を追加し、false で旧 trial/premium 2 階層挙動に縮退可能。ロック有効時は `/api/download-check` の trial 許可（28px PNG）も撤廃し `site-locked` 403 を返す（devtools 直叩き対策の defense-in-depth）。合言葉照合は長文フレーズ運用（句読点入り）に耐えるよう正規化を導入: 空白（半角/全角）全除去 + 大文字小文字無視で比較、句読点は一致必須のまま（`/api/auth` の `normalizePassphrase`）。非 string body での 500 も同時にガード。`/privacy` はゲート対象外。fix11 で一時固定した `isPremium=true` はこのゲートにより実態と整合（fix11 コメント推奨の Option A を page.tsx 側で実装）。変更箇所: `page.tsx`（Server Component 化）・`HomeClient.tsx` 新規・`SiteGate.tsx` 新規・`feature-flags.ts`・`types/auth.ts`・`download-check/route.ts`・`EmoteGenerator.tsx`（コメントのみ）・`.env.example`。tsc 新規エラー 0。
- 画像アップロード（PNG/JPG/WEBP、D&D対応、10MB上限）
- **GIFアップロード（Phase 1: 既存GIF→Twitch化）** — gifuct-jsで全フレームをデコードし、各フレームに既存パイプライン（フチ・フレーム・テキスト・位置調整）を適用してgif.jsで3サイズ再エンコード。元のフレーム遅延を保持。最大60フレームに自動サンプリング。1MB超過の警告表示。背景透過は対象外（ML処理が重すぎるため、元GIFの透明度を尊重）。
- **動画→GIF変換（Phase 2: 動画アップロード→アニメGIF出力）** — mp4/mov/webm（最大50MB）をアップロード→VideoTrimmerでトリミング（最大4秒）+ FPS選択（10/15/20、デフォルト15）→ `<video>.currentTime` seek + drawImage でフレーム抽出（最大辺512pxにダウンサイズ）→ Phase 1 のフレームパイプラインに合流して3サイズGIF出力。WebCodecs不採用（mp4/mov/webm全部対応・Firefox対応・iOS Safari対応・実装複雑度半分）。背景透過は対象外。
- **再生設定（GIF/動画モード共通）** — 速度スライダー（0.25x〜2.0x、0.25刻み、プリセット0.5/1.0/1.5/2.0）+ ループ回数選択（無限/1回/2回/3回）。delays配列にspeedを適用し、gif.jsの`repeat`パラメータでループ回数を制御。アニメーションソース（GIF/動画）のときのみSettingsPanel に表示、静止画+既存52種アニメには影響なし。
- **発見性UI/コピー改善** — UploadPanel に画像/GIF/動画の3アイコン＋グループ化説明文（「画像（PNG/JPG/WEBP）/ GIF / 動画（MP4/MOV/WEBM）」）。SampleShowcaseキャッチに「画像でも、GIFでも、動画でも。」を太字1行追加。機能タグを「入力」（画像/GIF/動画）と「処理」（背景自動透過/フチ取り/テキスト/3サイズ出力/52種アニメ）の2グループに再構成。SEOメタディスクリプションも「画像・GIF・動画から〜」に更新。
- **フォント追加（12種→22種）** — 不足分野を補強する10種を追加: 明朝（Shippori Mincho/Hina Mincho）、丸文字（M PLUS Rounded 1c/Yusei Magic）、筆文字・手書き（Yuji Syuku/Klee One）、英字インパクト（Bungee/Bangers）、英字ポップ（Lobster）、ピクセル英字（Press Start 2P）。`next/font/google` でself-hostし、bundle 影響なし。
- **品質監査タスク完了** — 6カテゴリ（オートクロップ/マスター解像度/テキスト/フチ取り/背景透過の縁/アニメ）について現状コードと実出力を分析。詳細は [QUALITY_AUDIT.md](QUALITY_AUDIT.md)、検証用テスト画像は `test-images/`。最大の発見は「28px出力にテキストが焼き込まれない」（意図的なスキップ）と「フチが28pxで実質消える」。優先度A（次セッション実装）/B/Cで6カテゴリ × 修正方針を提示。
- **品質改善・修正1（HI_RES 224→448）** — マスター解像度を倍増し、112px出力で 4倍オーバーサンプリングに（旧2倍）。`processEmote` / `processFrameWithBounds` 内の border/frame/text 描画 anti-alias 精度が向上。GIF アニメ（`GIF_HI_RES=256`）・bg-removal は無影響。静的分析: メモリ peak +1.15 MiB、pipeline 描画コスト ×4、bg-removal がドミナントなため体感処理時間 +5〜20% 想定。最終視覚検証は修正5完了後にまとめて実施。
- **品質改善・修正2（デフォルトpadding 5%→2%）** — 自動クロップ後の余白デフォルトを 0.05 → 0.02 に縮小。被写体の描画領域比率が 81% → 92% に拡大（面積 +13.8%）し、Twitchチャット内でのエモート存在感を改善。変更箇所: `types/emote.ts` JSDoc・`useEmoteProcessor` 初期 state・`RecommendedPatterns` 初期 config・`backgroundRemoval.centerAndResize` デフォルト引数・`pipeline.ts` の3箇所のフォールバック。永続化なし（localStorage 未使用）。性能影響ゼロ。リスク: 人物画像で頭頂・肩がタイトすぎる可能性（最終視覚検証で確認、必要なら 0.03 に再調整）。
- **品質改善・修正3（テキスト28pxスキップ撤廃 + サイズ適応レンダリング）** — `pipeline.ts` の `size > 32` 条件を撤廃し、28px/56px 出力でもテキストが描画されるように。`applyTextOverlay` をサイズ適応化：出力サイズ別に最低 fontSize（28px=14 / 56px=22 / 112px=制限なし）と最低 stroke 幅（28px=2 / 56px=3 / 112px=制限なし）を floor として保証。実装は `userFontSize × (outputSize/112)` で出力px空間に展開 → `max(user, min)` で floor 適用 → `× (canvasSize/outputSize)` で HI_RES に拡大して描画。stroke→fill 順序維持。PreviewArea.tsx は `outputSize` 引数省略で後方互換。変更箇所: `drawing.ts` の `applyTextOverlay` 全面改修・`pipeline.ts` 3箇所の skip 撤廃と引数追加。詳細・自己検証・リスク は QUALITY_AUDIT.md カテゴリ3 / 修正履歴セクション参照。
- **品質改善・修正4（フチ取り最低幅保証 + stamp filter化）** — `applyBorder` を3軸で改修。(1) 出力サイズ別最低border幅（28px=2 / 56px=3 / 112px=制限なし）を fix3 と同じ `max(user, min)` パターンで適用、(2) shadowBlur をサイズ依存減衰（28px=0 で無効化、56=0.5、112=1.0）、(3) 描画技法を shadowBlur 3-pass から **stamp filter** に変更（静止画は 8方向 radial 等距離、`processFrameWithBounds` の per-frame 経路は `isAnimated=true` で 4方向に削減）。drop shadow style は decay 緩めの 0.3/0.6/1.0 で完全消失を回避。HI_RES math: 28px出力・user 3px → output px で 0.75 → floor 2 → canvas 32px → downscale で **2px visible**（floor 発動）。GIF 60フレーム時の per-frame applyBorder コストは 4-dir 削減で約 +126M ops（gif.js エンコードの 12〜25%）、許容範囲。変更箇所: `drawing.ts` 全面改修・`pipeline.ts:284` の `isAnimated=true`。詳細・パフォーマンス分析・リスクは QUALITY_AUDIT.md カテゴリ4 / 修正履歴セクション参照。
- **品質改善・修正5（GIFディザリング有効化）** — gif.js 呼び出し4箇所すべてに `dither: "FloydSteinberg"` を追加し、エッジ AA とグラデーション帯を改善。`@types/gif.js` が `DitherMethod | boolean` を正規型として持つため型キャスト不要。固定 ON（トグルUI 不要）、ファイルサイズ予測 +10〜25% / 書き出し時間 +10〜30% / 視覚品質は明確に向上。serpentine 版でなく標準 FloydSteinberg を選択（アニメフレーム間の誤差パターン揺らぎ回避）。変更箇所: `animations/index.ts` 2箇所・`animationSandbox.ts`・`gif/animatedEncoder.ts`。これで品質監査・優先度A 全5修正完了。最終視覚検証（baseline vs all-fixes-applied）の引き継ぎメモを QUALITY_AUDIT.md 末尾に追加。詳細は QUALITY_AUDIT.md カテゴリ6 / 修正履歴 / 引き継ぎメモ参照。
- **フチスタイル7種追加（修正6）** — `BorderStyle` 型に 7 種（`neon` / `double` / `sticker` / `outline-only` / `gradient` / `chrome` / `dotted`）を追加。すべて無料（サブスク非限定）。`applyBorder` を fix4 の stamp filter ベースのヘルパー関数群（`buildSilhouette` / `stampRing` / `computeBorderWidth` / `pickContrastColor`）に分解し、スタイル別 `compose*Border` 関数にディスパッチ。fix4 の最低幅保証（28px=2 / 56px=3）は全スタイル横断で維持される設計。**ネオン**: 3 段の glow（半径 1.5×/2.5×/4× borderWidth）を additive 合成。デフォルト色は cyan（白指定時のみ自動置換）。**二重フチ**: 外側 1.5×・内側 0.5× の 2 リング、内側色は luminance 自動コントラスト。**ステッカー風**: 1.5× 白フチ + 落ち影（offset/blur は出力サイズ比例）。**輪郭のみ**: stamp ring 後に元画像 composite を省略。**グラデ**: 縦方向リニアグラデの silhouette を stamp。**クロム**: 4-stop 銀グラデ（dark→highlight→silver→light）固定。**点線**: 16方向 stamp の偶数番目のみ採用（45°ごと）+ AA blur 無効化で gap を維持。`STAMP_16` 定数を新規追加。UI: `BORDER_OPTIONS` に 7 エントリ追加、`SettingsPanel` のカラーピッカー表示条件を色を使う 6 スタイルにも拡張（subscriber のみ）。手描き風（perlin noise ベース）は別 fix で後日実装予定（fix6.5 候補）。変更箇所: `drawing.ts`・`types/emote.ts`・`SettingsPanel.tsx`。`tsc --noEmit` クリア。
- **プライバシーポリシー実装（fix8: PP / 削除UI / SOP）** — 日本の個人情報保護法準拠の PP（11セクション・484行 JSX）を `/privacy` で公開。Footer から PP リンク追加。アカウント全データ削除 UI（`AccountDeleteButton` + 警告モーダル）と server-side `/api/account/delete` エンドポイントを追加（ログイン中ユーザー本人の Supabase 6 テーブル全削除、トランザクション風順次削除 + サーバーログに steps 記録）。CASCADE 設定マイグレーション SQL（`supabase-cascades.sql`）を追加（templates → likes に CASCADE 保証、Aki が管理画面で適用予定）。運営者向け削除請求受付 SOP（`ADMIN_DELETION_SOP.md`）を抽象化版で公開し、具体 SQL クエリは `.admin-sop-private.md`（git 管理外）に分離。連絡先は X DM @akiissamurai / Twitch Whispers @datsusara_aki（プラットフォーム別に明確分離）、削除 SLA は 14 日以内。fix7 連動として PP §1-1 の `*` 注釈と §1-3 のキャッシュ情報行を一時保留（fix7 実装時に解除）。ユーザー自身による即時削除手段（ログアウト / 連携解除 / ストレージクリア / 個別投稿削除 / アカウント全データ削除）を §5-1 で網羅開示。詳細は `PRIVACY_AUDIT.md`（Supabase 6 テーブル × 個人情報マッピング） / `ADMIN_DELETION_SOP.md`（運用手順）参照。
- **特典機能セクションの UI コピー更新（fix10）** — fix7 で premium 化が「PASSPHRASE OR Twitch フォロー」の 2 系統になったが、UI 側「サブスク限定機能」セクション文言が古いままで、ユーザーがフォロー解放可能と気づかない問題を修正。`EmoteGenerator.tsx` 6 箇所更新：toast「特典機能が解放されました！」/ 解放済みバッジ「特典 解放済み」/ セクション見出し「特典機能」/ 「限定アニメーション 42 種」（旧「45 種」は fix6 以前の誤記、ANIMATION_OPTIONS 53 - none 1 - free 7 - loginOnly 3 = 42 が実数）/ 「エモートフレーム 16 種」（fix9 で 6→16 になった反映漏れ）/ 解放方法リンクを 2 行構成に拡張（既存 Discord 合言葉リンクの上に「Twitch で @datsusara_aki をフォローして解放（無料）」を追加、Discord は維持）。「サブスクバッジ作成」リスト項目は Twitch サブスクバッジの正式呼称なので維持、`isSubscriber` 変数名も内部表現として維持。UI コピー変更のみロジック変更ゼロ、tsc クリア、1 コミット（3f8a0f1）。production の JS chunk で旧文言 5 件全部消滅 + 新文言 6 件全部到達確認済み。
- **フォロー再認証 no-reload 化（fix7.1 / 7.1.1 / 7.2 連続デバッグ）** — fix7 で発生していた UX バグの修正と、その後の段階的な原因究明・修正の記録。**fix7.1（7c70e78 + 74f810e + bdffda2）**: `FollowGateModal` の「フォロー済み・解除を確認」ボタンが `signIn("twitch")` を同タブで呼んで full page navigation を起こし、画像・brush 補正履歴・`EmoteConfig` 等の React state が消失していた問題（ユーザー報告「最初に戻されて結局機能が使えない」）。専用エンドポイント `/api/follower-recheck` 新規 + `useSession().update({})` で JWT を再評価するフローに置き換え、page reload を回避。jwt callback の `trigger === "update"` 分岐内で `session` 引数（クライアント供給値）を完全に無視し、`token.access_token` を使って Twitch `/helix/channels/followed` を server-side で再 fetch する設計（elevation-of-privilege 不能）。**fix7.1.1（b6d2788 + eb87554）**: production 反映後、ログイン中ユーザーが 401 エラーで「Twitch のログインが切れています」警告を見る現象が発生。原因は `getToken({ req, secret, salt })` の `salt` パラメータが cookie の実際の JWE 暗号化 salt と不一致で、有効な session に対しても `null` を返していたこと。salt 引数を削除して Auth.js v5 のデフォルト解決に委ね、保険として「Twitch で再ログイン」ボタンに `type="button"` + `signIn("twitch", { callbackUrl: "/", redirect: true })` を明示。**fix7.2（8749707 + 1b83f67 + ef1272f）**: salt 削除でも改善せず、シークレットウィンドウ（キャッシュゼロ）でも 401 が再現。真因は **Auth.js v5 の `getToken` が App Router の `NextRequest` と構造的に非互換**で、認証済みでも `null` を返すこと。Plan B として `/api/follower-recheck` エンドポイントを完全撤廃し、`handleReauth` を `useSession().update({ trigger: "follower-recheck" })` 直接呼びに置換。jwt callback の `trigger === "update"` 分岐は元々 `getToken` 不使用（`token.access_token` を直接参照）なので追加修正不要、コメントだけ Plan B 記述に追従。これで `getToken` への依存を完全排除。詳細は `src/auth.ts` の jwt callback コメント参照。3 段階合計 7 コミット、tsc 各 stage クリア、production bundle marker で `propagationLikely` / `/api/follower-recheck` 撤廃 + `follower-recheck` / `FollowCheckError` / `RefreshTokenError` 新出現を確認済み。
- **エモートフレーム10種追加（fix9）** — `FrameType` に 10 種（`neon` / `pixel` / `gold` / `silver` / `comic` / `cat` / `sakura` / `hologram` / `fire` / `coin`）を追加し、既存 6 種（stars/hearts/gaming/sparkles/rainbow/dots）と合わせて **16 種** に拡張。すべて Canvas API のコード描画でアセット追加なし、`size` 比例の相対指定で 28/56/112/224 全解像度に自動対応。全種に `subscriberOnly: true` を付与し fix7 の premium gate（`isFollower OR isSubscribed`）に自動準拠。**Stage 1 シンプル系**: ネオン（cyan/magenta 二重 glow）・レトロ8bit（16分割の正方形ピクセル枠×4色循環）・金枠/銀枠（drawClassicFrame ヘルパで共通化、外側グラデ + 内側細線の額縁構造）・コミック（中心から外周への放射状集中線 16 本）。**Stage 2 装飾系**: 猫耳（上端両側の三角形、頂点を外向きに傾斜、黒輪郭+ピンク内耳）・桜（5枚花びら×8箇所、4色のピンクと回転ランダム）・ホログラム（マゼンタ/シアン/イエロー/グリーンの多色グラデ二重枠 + shadowBlur）。**Stage 3 エフェクト系**: ファイア（canvas 下端から立ち上がる炎 6 本、黄→橙→赤の縦グラデ + quadraticCurve で揺らぎ）・実績（4 隅の金貨 radialGradient + 中心 drawStar5 流用の星）。新規補助関数: `drawClassicFrame` / `drawCatEar` / `drawSakuraPetal` / `drawFlame`。既存 6 種の挙動は完全に非破壊、`SettingsPanel` は変更不要（`FRAME_OPTIONS` 配列駆動なので自動的にグリッドに表示）。`tsc --noEmit` で新規エラー 0、Stage 1〜3 の 3 コミットに分割（a869b37 / 10e6cf4 / a3e16d9）。変更箇所: `types/emote.ts`・`drawing.ts`、合計 +310 行 / -3 行。
- **Twitchフォロワー認証 Phase 1 MVP（fix7）** — fix8 で約束した「Aki チャンネルへのフォロー判定」を本実装。サブスク特典のロック解除条件を `isFollower OR isSubscribed (PASSPHRASE) OR killswitch` の OR 結合で resolve する trial / premium 2 階層モデル。**お試し版（trial）= ログイン不要**: アニメ 2 種（bounce + shake）/ フチは白黒のみ / テキスト色変更不可 / DL は 28px PNG のみ。**スタンダード版（premium）= フォロー or PASSPHRASE**: 全機能解放。Auth.js v5 の Twitch provider に `user:read:follows` scope を追加、JWT に access_token / refresh_token / expires_at / scope / isFollower / followCheckedAt / followedAt を永続化。`/helix/channels/followed` 呼び出しは 1s/3s/10s リトライ + 24h stale-cache フォールバックの純関数ラッパー（`src/lib/twitch/follower-check.ts`）。premium 判定は `evaluateAccess({ session, isSubscribed, flags })`（`src/lib/auth/premium.ts`）に統一。環境変数 killswitch 4 つ（TRIAL_MODE / FOLLOW_AUTH / PREMIUM_LOCK / DOWNLOAD_LOCK）で段階的縮退可能（`src/lib/auth/feature-flags.ts`）。UI 4 種新規追加: `FollowGateModal`（DL クリック誘導、utm 計測 lock_modal/key_icon/onboarding 3 経路）/ `FeatureLockHint`（鍵マーククリック軽量モーダル、5 回まで → tooltip フォールバック）/ `TrialBadge`（4 variant 切替可能、Phase 1 default は数字なし `badge-only`）/ `ReauthBanner`（旧 scope 検出時、初回目立つ → × で控えめアイコン切替）。DL ガードは `/api/download-check` POST で server-side 再検証（trial: 28px PNG のみ通過、56/112 と全 GIF を 403）、PreviewCard / DownloadButton / PreviewArea 各 DL 経路に `onBeforeDownload` async ガードを差し込み。PASSPHRASE 既存ユーザー対応として `/api/auth POST` が HttpOnly cookie `emote-subscriber=1` を設定（30日 maxAge、server 側 evaluateAccess が読む）、解除は `/api/auth DELETE` で cookie クリア。fix8 連動解除として PP §1-1 の `*` 注釈削除と §1-3「アクセス権限に関するキャッシュ情報」行のコメントアウト解除を実施。`AUTH_TWITCH_BROADCASTER_ID` を環境変数化、`.env.example` も新規追加（killswitch 4 つの動作含めて文書化）。変更箇所: `auth.ts` / `types/auth.ts` 新規 / 11 ファイル合計 1,411 行追加。tsc クリア、Stage 1〜8 の 8 コミット独立。詳細は `FOLLOWER_AUTH_DESIGN.md`（設計）/ `FOLLOWER_AUTH_IMPL_PROMPT.md`（Stage 別実装手順）参照。
- 画像トリミング＋位置調整UI（レスポンシブキャンバス[PC:320px/モバイル:適応]、8ハンドル矩形選択、ドラッグ移動、ズーム50%〜200%）
- AI背景透過（@imgly/background-removal、WASM、約30MBモデル、標準/高精度モード切替）
- 背景透過のスキップ／キャンセル／やり直し
- 透過後ブラシ微調整エディタ（消しゴム/復元ブラシ、undo最大20回、レスポンシブキャンバス、紫カード+自動スクロール）
- Twitch向け3サイズ同時生成（28px / 56px / 112px）
- Discord向け3サイズ同時生成（32px / 64px / 128px）
- 7TV向け4サイズ同時生成（32px / 64px / 96px / 128px）
- BTTV向け3サイズ同時生成（28px / 56px / 112px）
- FFZ向け3サイズ同時生成（32px / 64px / 128px）
- Twitch仕様準拠（PNG≤25KB, GIF≤512KB, ≤60frames, blink<3/sec）

### カスタマイズ
- フチ取り5種（なし / 白フチ / 黒フチ / 影付き / カスタム色[限定]）
- 縁の幅スライダー（1〜20px、デフォルト4px）
- カスタムボーダーカラー（ColorPickerで任意の色[限定]）
- エモートフレーム7種（なし / 星 / ハート / ゲーミング / キラキラ / レインボー / ドット）[限定]
  - Canvas API path描画（星・キラキラ）、Bezier曲線（ハート）、グラデーション（ゲーミング・レインボー）、arc（ドット）
  - seeded擬似乱数による決定的なキラキラ配置
- 2画像合成3モード（右下に重ねる / 左下に重ねる / 左右に並べる）[限定]
  - SubImageUploadコンポーネント（D&D対応、64x64サムネイルプレビュー）
  - サブ画像サイズスライダー（20〜100%、デフォルト38%、overlay時のみ表示）
  - 透過済みPNG推奨ヒントテキスト
  - overlay時はshadowBlurによる白フチ付きサブ画像合成
- テキストプリセット8種（草, GG, ないす, RIP, 尊い, えぐい, なんで, 草生える）
- 自由入力テキスト
- フォント12種（日本語8 + 英字2 + 標準2）
- 文字サイズスライダー（8〜72px、デフォルト20px）
- 文字色・縁取り色（カラーピッカー、onChange+200msデバウンスでリアルタイムプレビュー）
- テキスト縁取り幅スライダー（0〜10px、デフォルト3px、0で非表示）
- テキスト・サブ画像の自由配置（ゾーン制約撤廃、canvas全域をドラッグで配置可能）
  - DragPositionCanvasコンポーネント（224px内部解像度、マウス+タッチ対応）
  - テキスト: 中央ベース座標 + オフセット(-56〜56px)、紫破線インジケーター
  - サブ画像: 中央ベース座標 + オフセット(-56〜56px)、緑破線インジケーター
  - 上/中央/下ショートカットボタン（ワンクリックでプリセット位置に移動）
  - スライダー廃止、ドラッグのみで操作

### アニメーション（合計52種）

**通常アニメーション（7種）**
- 揺れる / 震える / 点滅 / ぴょこぴょこ / ズームイン / 回転 / ハートぷかぷか

**ログイン限定アニメーション（3種）[Twitchログイン]**
- ゲーミング / グリッチ / ネオン

**限定アニメーション（42種）[限定]**
- キラキラ / 残像 / 高速回転
- ふわふわ / ぐにゃぐにゃ / VHS / 雪 / 炎 / マトリックス / 酔っ払い / 紙吹雪 / 催眠
- ブラウン管 / 地震 / パーティ / ひっくり返る / 幽霊 / デジタル崩壊 / スパイラル / 鼓動 / バネ / ジェリー
- 伸び縮み / 落下 / 膨らむ / 傾く / 浮き沈み（基本系追加）
- ホログラム / ピクセル化 / 万華鏡 / 電流 / 砂嵐（エフェクト系追加）
- 弾む / 8の字 / 螺旋落下 / ランダムワープ / 酔い歩き（モーション系追加）
- 怒る / 泣く / 照れる / 驚く / 眠る（リアクション系追加）

**アニメーション速度調整**
- 遅い（80ms/フレーム）/ 普通（50ms/フレーム）/ 速い（25ms/フレーム）
- アニメーション選択時のみ速度セレクタ表示

### サブスクバッジ作成 [限定]
- バッジON/OFFトグル（サブスク限定機能）
- 形状3種（円形 / 四角 / 角丸）
- 背景色カスタム（デフォルト: Twitchパープル #9147FF）+ 透過トグル
- 内側余白スライダー（0〜20px、デフォルト8px）
- 輪郭線スライダー（0〜4px）+ 輪郭線色カスタム
- 3サイズ同時プレビュー（72 / 36 / 18px）+ 個別DLボタン
- バッジ一括DL（ZIP、3サイズPNG）
- ソース画像: bgRemovedCanvas（エモート加工前の素の透過画像、テキスト/フチ/フレーム非適用）
- Canvas API: clip → 背景 → centerAndResize → restore → stroke で形状描画

### サブスク限定機能（[限定]）
- 合言葉認証（サーバーサイドAPI認証、Vercel環境変数で管理、localStorage永続化）
- 認証APIルート（`/api/auth`、POST、大文字小文字不問、サーバー設定エラーハンドリング）
- 認証済みUIは控えめな1行サマリ（「サブスク限定 解放済み — 5つの限定機能が利用可能」+解除ボタン）
- 未認証時は特典一覧UI表示（5項目を2カラムgrid + 鍵アイコン + Discord案内 + 合言葉入力）
- 未認証時にDiscordサーバー案内リンク表示（https://discord.gg/CheMXWdj、サブスク限定チャットで合言葉配布）
- ログアウト時にサブスク限定configを自動リセット（25種アニメーション+フレーム+合成+サブ画像サイズ+バッジ設定）
- 動画から顔自動抽出（30秒以内の動画→フレーム抽出→MediaPipe FaceDetector→上位5〜8候補→自動クロップ→既存パイプラインへ）**全ユーザー開放済み**
  - PC: seekベース高速抽出（1秒間隔、960pxダウンスケール、GPU delegate）
  - モバイル: 再生ベースキャプチャ（video.play() 2倍速 + requestAnimationFrame、3秒間隔キャプチャ、CPU delegate）
    - モバイルSafariの video.currentTime シーク不安定問題を回避
    - 30秒動画で約15秒のリアルタイム再生待ち、プログレスバーは再生進捗と連動
    - モバイル処理失敗時にPC利用を促すエラーメッセージ表示
  - 640pxダウンスケール、逐次処理（抽出→検出→即解放）によるメモリ安全化
  - フレーム間イベントループ返却（setTimeout(0)）によるUIフリーズ防止（PC）
  - `@mediapipe/tasks-vision` FaceDetector（CDN遅延ロード、IMAGE mode、minDetectionConfidence 0.3）
  - 顔バウンディングボックス+25%余白で正方形自動クロップ
  - 類似フレーム間引き（64pxダウンスケール全ピクセル差分平均、閾値15未満で除外）
  - ブラウザ完結（動画サーバー送信なし）
  - 対応形式: MP4 / MOV / WEBM、50MB以下
- 特定商取引法表示は不要と判断（サイト上で直接課金なし、合言葉はDiscord経由の外部配布）

### 出力・共有
- Twitch / Discord タブ切り替えUI
- 最大サイズ単体ダウンロード（Twitch: 112px / Discord: 128px）
- ZIP一括ダウンロード（emotes.zip / discord_emotes.zip / badge.zip）
- モバイル個別DLボタン（各サイズ下に常時表示、タッチデバイス対応）
- PCホバーオーバーレイDL（マウスオーバーで表示）
- PC大プレビューモーダル（最大サイズクリックで2倍拡大表示、チェッカーボード背景、ESC/外クリックで閉じる、md:以上のみ）
- Xシェアボタン（112pxエモート画像をクリップボード自動コピー + ツイート画面同時オープン、アクション指向シェアテキスト「30秒で作れた！ブラウザだけで完結」、clipboard API非対応時はコピーをスキップ）
- ダウンロード完了後シェア促進モーダル（ShareAfterDownloadModal、4段階エスカレーション式、佐山サトル氏シューティング合宿オマージュ、X/Twitch/YouTubeフォローボタン付き、スキップするたびに文言がエスカレート）

### UX
- 画像位置調整エディタ（アップロード直後に表示、8ハンドルトリミング+ドラッグ移動+ズーム、確定/スキップ選択可能、ドラッグ中ハンドルをTwitchパープル#9146FFで16pxにハイライト）
- プレビュー直接操作（112pxプレビュー上でドラッグ→位置移動、スクロール→ズーム、モバイルピンチ対応、0.5x〜2.0xスケール、cursor-grab/grabbing、CSS transform即時プレビュー+rAF+150msデバウンスでフルパイプライン実行、再描画中もプレビュー維持でレイアウトシフト防止）
- 位置リセットボタン（ドラッグ/ズーム調整後に「↺ 位置をリセット」で初期位置に戻す、調整がある時のみ表示）
- 位置再調整ボタン（「↔ 位置を調整する」でImageAdjustEditorを再表示、透過やり直しのトースト通知付き）
- おすすめパターン4種（白フチ/黒フチ/影付き/白フチ+揺れ、ワンクリック適用）
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
- フッター作者情報（アイコン画像 + Made by Aki + X/YouTube/Discordリンク横一列、next/image + lucide-react使用）
- フッター開発ストーリー（視聴者の一言きっかけ・開発経験ゼロ・AIと1週間、イタリック強調）
- UI品質一括改善（DownloadButton whitespace-nowrap、SubImageUpload/VideoFaceExtractor min-h-44px、顔選択grid-cols-2レスポンシブ、Footer aria-label、text-[10px]/[11px]→text-xs統一、PreviewCardモーダルmax-w制約）
- ZIP連打防止（exporting中はdisabled + opacity-60で視覚的にも無効化）
- エラートースト表示（背景透過失敗・ZIP書き出し失敗時にユーザー向けメッセージ表示、5秒で自動消去）
- ファビコン稲妻デザイン（Twitchパープル角丸背景 + 白い稲妻、SVG形式）
- ヘッダー開発ストーリー短縮版（1行、初見ユーザー向け離脱防止）
- シェアモーダル4段階エスカレーション（スキップするたび文言がエスカレート、佐山サトル氏シューティング合宿オマージュ、X/Twitch/YouTubeフォローボタン付き）
- モバイルTwitchログインボタン改行防止（whitespace-nowrap）
- モバイルアニメーション設定見切れ修正（overflow-x-hidden + truncate、サブスク解放後45種表示時の横はみ出し防止）
- 左パネル順序最適化（動画顔抽出を認証UIの上に移動、全ユーザー向け機能を優先表示）
- 余白スライダー追加（0%〜15%、centerAndResizeのパディングをUI制御可能に。フチなし時の余白問題を解決）
- UI品質改善一括修正（シェアモーダルボタン縦並び化、おすすめパターンモバイル2列化、キャンセルボタンタップターゲット拡大、FloatingMiniPreview z-40に整理、text-[10px]/[11px]→text-xs統一）

### テンプレートギャラリー（Phase 1）
- テンプレート投稿機能（エモート設定値=EmoteConfigをJSON形式でSupabaseに保存、画像は共有しない）
- テンプレート一覧表示（新着順/人気順ソート、タグ絞り込み: ゲーミング・かわいい・シンプル・面白い・クール・その他）
- ワンクリック適用（ギャラリーから「このテンプレートを使う」→エモート作成タブに切替→設定即時反映+トースト通知）
- いいね機能（ハートボタン、楽観的UI更新、1ユーザー1いいね、未ログイン時はログイン促進モーダル）
- テンプレート削除（自分の投稿のみゴミ箱アイコン表示、確認ダイアログ後に削除、API側でも所有者チェック）
- Twitch OAuthログイン（Auth.js v5 + 組み込みTwitchプロバイダー、JWT戦略、ギャラリータブ内にログイン状態表示）
- テンプレート投稿モーダル（タイトル30文字制限、タグ複数選択、設定サマリー表示）
- ログイン促進モーダル（投稿・いいね時に未ログインユーザーに表示）
- 空状態UI（テンプレートとは何か・できること・投稿方法ステップ表示・CTAボタン）
- テンプレート説明文常時表示（カード一覧上部に1行説明、未ログイン時はログイン案内も追加）
- 設定サマリー自動生成（configToSummary: フチ・アニメーション・テキスト・フレームを日本語要約）
- 投稿者名Twitchリンク（テンプレートカードの投稿者名がtwitch.tv/{user_login}へのリンク、新タブ、ホバー時パープル）
- 投稿者Twitchアイコン表示（投稿時にHelix APIからプロフィール画像URLをDBに保存、カードで24px円形表示、nullの場合はアイコンなし）
- 投稿成功トースト通知（画面上部固定表示、モバイルでも確実に視認可能）
- Auth.js v5 + Twitch Helix API連携（OIDCのclaims指定バグ回避、access_tokenでHelix API直接呼出してlogin/display_name/profile_image_url取得）
- DB: Supabase（templates/likesテーブル、user_image/user_loginカラム追加、service_role keyでRLSバイパス、遅延初期化）
- テンプレート経由の限定設定UI（未認証ユーザーがテンプレートで限定アニメ・カスタムフチ・フレームを適用した場合、紫枠+鍵アイコンで「適用中・変更不可」を明示。サブスク認証後は即座にロック解除）
- 人気テンプレート表示（エモート作成画面のおすすめパターン下に、いいね数上位3件のテンプレートカードを表示。投稿者アイコン・Twitchリンク・設定サマリー・ワンクリック適用。0件時は非表示）
- ログイン限定アニメーション3種（ゲーミング・グリッチ・ネオンをサブスク限定→Twitchログイン限定に変更。ログイン促進+サブスク敷居低下の両立。未ログインは3種ロック表示+ログインモーダル誘導）
- 殿堂入りバッジ（いいね5件以上のテンプレートに🏆殿堂入りバッジ表示。ギャラリーカード+人気テンプレートカードの両方に対応）
- テンプレートクレジット表示（テンプレート適用後のDLモーダルに「○○さんのテンプレートを使用」表示+Twitchリンク。Xシェアテキストにもクレジット含む）
- 既存機能との完全分離（エモート作成・DL・サブスク認証は影響なし）

### AIアニメーション生成（Phase 1: 技術検証）
- AIによるカスタムアニメーション生成（テキスト説明→Anthropic Claude Sonnet→Canvas 2Dコード→iframeサンドボックス実行→20フレームGIFプレビュー）
- iframeサンドボックス実行環境（`sandbox="allow-scripts"` + `srcdoc`、`new Function()`でコード実行、postMessage通信、10秒タイムアウト、リクエストID多重化）
- Anthropic API統合（claude-sonnet-4-20250514、システムプロンプトにFrameGenerator型定義+揺れ/左右バウンド/gamingの3つのfew-shot例、canvas.width/height相対値指針、コード本文のみ返却）
- レート制限（5回/日/ユーザー、Supabase `ai_animation_logs`テーブルで追跡）
- Twitchログイン必須（未ログイン時はログイン促進モーダル表示）
- 256×256 ImageData固定（bgRemovedCanvasから抽出、iframe内でCanvas操作→ImageData返却→gif.jsでGIF化）
- 未ログイン時UX改善（AIパネルは常時開閉可能、インラインでログイン案内+画像消失警告を表示、リダイレクトによる画像消失を事前に防止）
- Phase 1は技術検証のみ（保存・公開機能なし、AnimationSettings内にインラインプレビュー）
- Phase 1完了（動きの改善確認済み）

### AIアニメーション生成（Phase 2: プレビューUI）
- 「このアニメーションを使う」ボタン（AI生成アニメーションを既存GIFパイプラインに即時適用）
- `AnimationType` に `"ai-custom"` 追加、`AnimationConfig.aiAnimationCode` でコード文字列を保持
- `generateGif` に ai-custom 分岐追加（sandbox経由フレーム生成→downscale→gif.jsエンコード、既存50種アニメーション影響なし）
- 残り回数表示（GET `/api/generate-animation` で残り回数取得、ログイン時のみfetch）
- 再生成ボタン（「再生成（残りN回）」でレート制限消費を明示）
- エラー表示改善（429→レート制限超過、401→未認証、iframe失敗→別説明で再試行の案内）
- 「公開する（準備中）」ボタン（disabled表示のみ、Phase 3で有効化）
- AI適用中のハイライト表示（「AIアニメーション適用中」ステータス + ボタンの色変更）
- テンプレート投稿時にaiAnimationCodeを自動除外（API側でdelete、セキュリティ+ストレージ節約）

### AIアニメーション生成（Phase 3: 公開フロー）
- 「公開する」ボタン有効化（Phase 2のdisabled状態を解除、クリックでPublishAnimationModal表示）
- PublishAnimationModal（アニメーション名入力20文字制限、POST /api/custom-animations で保存、成功時トースト通知）
- API: POST /api/custom-animations（Twitchログイン必須、name/description/code バリデーション、code 5000文字制限）
- API: GET /api/custom-animations（認証任意、sort=popular|new、limit/offset ページネーション、is_active=trueのみ、ログイン時liked_by_me付与）
- API: POST /api/custom-animations/[id]/like（トグル方式、アプリ側で likes_count +1/-1、既存テンプレートと同じパターン）
- API: POST /api/custom-animations/[id]/report（通報、1ユーザー1回制限、DB triggerで3件自動非公開）
- 「みんなのアニメーション」セクション（AnimationSettings内、Twitchログイン時のみ表示）
  - 人気順TOP20取得、カード表示（名前・投稿者Twitchリンク・いいね数・いいねボタン・通報ボタン・「使う」ボタン）
  - 「使う」クリックで config.animation を ai-custom + code にセット（既存パイプライン経由でGIF生成）
  - 「もっと見る」ボタン（20件ずつ追加読み込み）
- DB: custom_animations テーブル（code 5000文字制限、通報3件自動非公開trigger）
- DB: animation_likes テーブル（UNIQUE(animation_id, user_id)）
- DB: animation_reports テーブル（UNIQUE(animation_id, user_id)、INSERT trigger で自動非公開）
- 自分の投稿の削除機能（DELETE /api/custom-animations/[id]、所有者チェック、物理削除、削除トースト通知）
- 投稿者Twitchアイコン表示（24px円形、user_image保存済み、投稿者名とアイコンがTwitchリンク）
- 既存50種アニメーション・テンプレートギャラリーに影響なし

### PC UI/UX改善
- 左パネル幅拡大（320px→380px、全体max-w-6xl→max-w-7xl、設定項目の視認性向上）
- アニメーション生成中オーバーレイ（プレビューエリアにスピナー+「アニメーション生成中...」の半透明オーバーレイ表示、GIF再生成時のフィードバック改善）
- 左パネルスクロールバー重なり修正（md:pr-2追加でスライダー・ボタンがスクロールバーに被らないよう対応）

### デザイン・ブランディング
- Interフォント導入（英字はInter、日本語はNoto Sans JPにフォールバック）
- 絵文字全削除（テキスト＋CSSのみのミニマルUI）
- OGP/Twitterカード対応（動的OG画像生成 + summary_large_image）
- 免責事項強化（Twitch/Discord商標表示・AS-IS保証免責・AI精度免責・AI生成コード著作権・投稿者情報公開同意・コンテンツ利用許諾）

### SEO
- Google Search Console verification タグ（metadata.verification.google）
- sitemap.xml 自動生成（MetadataRoute.Sitemap、weekly更新）

### アナリティクス
- Umami Analytics（`next/script` strategy="afterInteractive"でページ読み込みブロックなし）
- IPアドレス非取得の匿名統計のみ（GDPR準拠、Cookie不使用）
- フッターにアクセス解析免責文言を表示

### コード品質
- canvasPipeline.ts分割（812行→4ファイル: canvas/types.ts, canvas/backgroundRemoval.ts, canvas/drawing.ts, canvas/pipeline.ts + barrel re-export）

### 品質最適化
- PNG: 224px高解像度中間キャンバス → multi-step downscale（6段パイプライン: 中心配置→合成→フチ取り→フレーム→テキスト→縮小）
- GIF: 256px高解像度フレーム生成 → フレーム毎にmulti-step downscale → 出力サイズでGIFエンコード（アニメーション輪郭のシャープさ向上）
- USMシャープネス: 28px/56px出力にアンシャープマスク適用（amount=0.6、透過ピクセル境界スキップ）
- shadowBlur方式のフチ取り（アンチエイリアス改善）
- サイズ別フチ幅スケーリング（出力サイズに応じてフチ太さを√比例調整、28px/56px/112pxで均一な見た目に）
- サイズ別パディング補正（小サイズほどパディング比率を低減、余白差を吸収、GIF用processEmoteWithHiResにも適用）
- strokeText方式のテキスト縁取り（幅0〜10px可変、シャープな描画）
- 28px/32pxテキスト自動非表示（視認性確保）
- GIF 20フレーム / 速度可変ディレイ（25ms〜80ms、滑らかなアニメーション）
- カラーピッカー: onChange + 200msデバウンスでリアルタイムプレビュー（macOS浮遊パネル・Windows/Safari対応）
- Canvasメモリ管理: 使い捨てcanvasを`width=0;height=0`で即時解放（パイプライン全段+GIFフレーム60枚対応）

---

## アーキテクチャ

```
src/
├── app/
│   ├── api/auth/route.ts        # 合言葉認証APIルート（Vercel環境変数照合）
│   ├── api/auth/[...nextauth]/route.ts # Auth.js v5ルートハンドラー（Twitch OAuth）
│   ├── api/templates/route.ts   # テンプレートCRUD API（GET一覧/POST投稿）
│   ├── api/templates/[id]/route.ts # テンプレート削除API（DELETE、所有者チェック）
│   ├── api/templates/[id]/like/route.ts # いいねトグルAPI（POST）
│   ├── api/generate-animation/route.ts # AIアニメーション生成API（Anthropic Claude Sonnet、レート制限5回/日）
│   ├── api/custom-animations/route.ts # カスタムアニメーションCRUD API（GET一覧/POST公開）
│   ├── api/custom-animations/[id]/route.ts # カスタムアニメーション削除API（DELETE、所有者チェック）
│   ├── api/custom-animations/[id]/like/route.ts # カスタムアニメーションいいねトグルAPI（POST）
│   ├── api/custom-animations/[id]/report/route.ts # カスタムアニメーション通報API（POST、3件で自動非公開）
│   ├── layout.tsx               # ルートレイアウト（Google Fonts、OGP/Twitterメタデータ、Umami Analytics、AuthProvider）
│   ├── opengraph-image.tsx      # 動的OG画像生成（Edge Runtime、1200x630）
│   ├── globals.css              # グローバルCSS（Inter + Noto Sans JP）
│   └── page.tsx                 # メインページ（タブナビ: エモート作成/テンプレート）
├── auth.ts                      # Auth.js v5設定（Twitch OAuth、JWT戦略）
├── components/
│   ├── EmoteGenerator.tsx       # メインコンテナ（状態管理 + 合言葉認証 + Twitch/Discord切替 + テンプレート投稿）
│   ├── Gallery.tsx              # テンプレートギャラリー（一覧/ソート/フィルタ/いいね/削除 + TemplateCard）
│   ├── LoginPromptModal.tsx     # ログイン促進モーダル（Twitch OAuth）
│   ├── PostTemplateModal.tsx    # テンプレート投稿モーダル（タイトル/タグ入力）
│   ├── PublishAnimationModal.tsx # カスタムアニメーション公開モーダル（名前入力20文字制限）
│   ├── providers/
│   │   └── AuthProvider.tsx     # SessionProviderラッパー（Client Component）
│   ├── UploadPanel.tsx          # 画像アップロード（D&D + click）
│   ├── ImageAdjustEditor.tsx    # 画像位置調整（8ハンドルトリミング + ドラッグ + ズーム、レスポンシブキャンバス）
│   ├── BrushEditor.tsx          # 透過ブラシ微調整（消しゴム/復元、undo、レスポンシブキャンバス）
│   ├── SubImageUpload.tsx       # サブ画像アップロード（D&D + click、64x64サムネイル）
│   ├── VideoFaceExtractor.tsx   # 動画顔抽出UI（アップロード+プログレス+候補グリッド選択、モバイル対応済み）
│   ├── DragPositionCanvas.tsx   # テキスト・サブ画像ドラッグ配置キャンバス（224px内部解像度、マウス+タッチ対応）
│   ├── SettingsPanel.tsx        # 設定コンテナ（フチ取り/フレームを直接描画、他はサブコンポーネントに委譲）
│   ├── settings/
│   │   ├── ColorPicker.tsx      # 共有カラーピッカー（200msデバウンス付き）
│   │   ├── AnimationSettings.tsx # アニメーション選択・速度・限定アニメ
│   │   ├── TextSettings.tsx     # テキスト入力・フォント・サイズ・色・位置・ドラッグ配置
│   │   ├── BadgeSettings.tsx    # バッジ作成トグル・形状・色・余白・輪郭
│   │   └── SubImageSettings.tsx # 2画像合成・サブ画像アップロード・サイズ
│   ├── PreviewArea.tsx          # プレビュー表示 + サンプルショーケース + バッジプレビュー（72/36/18px）
│   ├── PreviewCard.tsx          # 個別プレビュー（ホバーDLオーバーレイ）
│   ├── DownloadButton.tsx       # 最大サイズ単体DL + ZIP一括DL + バッジZIP DLボタン
│   ├── ShareButton.tsx          # Xシェア + クリップボードコピー
│   ├── ShareAfterDownloadModal.tsx # DL完了後Xシェア促進モーダル
│   ├── RecommendedPatterns.tsx  # おすすめ4パターン（白フチ/黒フチ/影付き/白フチ+揺れ）
│   ├── FloatingMiniPreview.tsx  # モバイル専用フローティングプレビュー（90x90px）
│   └── Footer.tsx               # フィードバック導線 + 免責表示 + アクセス解析告知
├── hooks/
│   └── useEmoteProcessor.ts     # 処理パイプライン統合フック（ExportMode対応、subCanvas対応、ブラシ編集ステージ管理、速度パラメータ対応）
├── lib/
│   ├── supabase.ts              # Supabaseクライアント（遅延初期化、service_role key）
│   ├── templateUtils.ts         # configToSummary（設定値→日本語要約）
│   └── animationSandbox.ts      # iframeサンドボックス（AI生成コード実行、postMessage通信、GIF変換）
├── lib/
│   ├── backgroundRemoval.ts     # @imgly/background-removal ラッパー（isnet/isnet_quint8モデル切替）
│   ├── faceExtractor.ts         # 動画フレーム抽出+MediaPipe顔検出+自動クロップパイプライン（640pxダウンスケール+逐次処理）
│   ├── canvasPipeline.ts        # Canvas描画パイプライン（中心配置/合成/フチ取り/フレーム/テキスト/縮小/バッジ描画）
│   ├── gifEncoder.ts            # GIFエンコーダ再エクスポート（実装はanimations/に分割）
│   ├── animations/
│   │   ├── types.ts             # FrameGenerator型定義
│   │   ├── index.ts             # アニメーション登録 + generateGifエントリポイント
│   │   ├── basic.ts             # 基本アニメーション12種（揺れる/震える/点滅/ぴょこぴょこ/ズームイン/回転/ハート/伸び縮み/落下/膨らむ/傾く/浮き沈み）
│   │   ├── effects.ts           # エフェクト系12種（ゲーミング/グリッチ/キラキラ/残像/ネオン/VHS/マトリックス/ホログラム/ピクセル化/万華鏡/電流/砂嵐）
│   │   ├── motion.ts            # モーション系23種（高速回転/ふわふわ/ぐにゃぐにゃ/弾む/8の字/螺旋落下/ランダムワープ/酔い歩き他）
│   │   └── reactions.ts         # リアクション系5種（怒る/泣く/照れる/驚く/眠る）
│   ├── visibilityChecker.ts     # 28px視認性チェック
│   └── zipExporter.ts           # JSZip ZIP書き出し（動的ファイル名対応）
└── types/
    └── emote.ts                 # 型定義 + 定数（EmoteConfig[6グループ]/PartialEmoteConfig/Twitch/Discord/7TVサイズ/フォント/プリセット/速度/バッジ設定等）
```

### 処理パイプライン

```
画像アップロード
  → トリミング＋位置・ズーム調整（ImageAdjustEditor、8ハンドル矩形選択、320x320内部解像度）
    → AI背景透過（標準isnet_quint8/高精度isnetモード or スキップ）
      → ブラシ微調整（BrushEditor、消しゴム/復元、スキップ可能）
        → 224px高解像度キャンバスに中心配置
        → 2画像合成（overlay-br/bl: サブ画像shadowBlurフチ付き+オフセット対応 / sidebyside: 左右等分）
          → フチ取り（shadowBlur方式、カスタム色対応）
            → フレーム装飾（星/ハート/ゲーミング/キラキラ/レインボー/ドット）
              → テキストオーバーレイ（shadow多パス方式、≤32pxはスキップ）
            → multi-step downscale（224→112→56→28 / 224→128→64→32） + USMシャープネス（≤56px）
              → PNG出力 / GIF出力（256px高解像度フレーム→multi-step downscale→20フレーム / 25〜80msディレイ）
    → [バッジ分岐] bgRemovedCanvas → clip(形状) → 背景 → centerAndResize(余白付き) → 輪郭線 → 72/36/18px出力
```

---

## 開発中に修正したバグ・問題

| 問題 | 原因 | 修正 |
|------|------|------|
| Xシェアボタンが何も開かない | async/await後のwindow.openがポップアップブロッカーに弾かれる | window.openを同期呼び出しに変更、clipboard copyは非同期で後実行 |
| カラーピッカーが重い・閉じる | React onChange（=DOM input event）がドラッグ中に毎フレーム発火→150msデバウンスで再描画 | ColorPickerコンポーネント分離、onInputでローカルstate、onChangeで親に反映 |
| フチ取り境界がギザつく | 8方向オフセット描画はアンチエイリアスが効かない | shadowBlur方式に変更 |
| テキスト縁取りがボケる | shadowBlur多パス方式は本質的にぼやける | strokeText方式に変更（lineJoin=round、シャープな描画） |
| 28pxでテキストが潰れる | 28pxキャンバスにテキスト描画は物理的に視認不可 | 28pxではテキスト自動非表示 |
| 小サイズの全体品質が低い | 28px/56pxで直接描画するとフチ・テキストの解像度不足 | 224px高解像度中間キャンバス + multi-step downscale + USMシャープネス（≤56px） |
| GIFアニメーションの輪郭がぼやける | 出力サイズ（28〜112px）で直接フレーム生成していた | 256px高解像度フレーム生成→フレーム毎にmulti-step downscale |
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
| バッジ輪郭線の色変更が一部ブラウザで効かない | onInput（native inputイベント）がSafari等でカラーピッカーダイアログ閉じ時に発火しない | onChange（React合成イベント、クロスブラウザ対応）に変更 |
| Canvas メモリリーク（低スペ端末でクラッシュの可能性） | 使い捨てcanvasのピクセルバッファがGPUメモリに残留。GIF生成時は60canvas同時 | `releaseCanvas()`ヘルパーで`width=0;height=0`を全パイプライン出口に追加 |
| モバイルSafariで動画顔抽出がスタック（14%/19%で停止） | `video.currentTime`シークがモバイルSafariで不安定（seekedイベント未発火、readyState不整合） | モバイルを再生ベースキャプチャに切替（`video.play()` 2x速 + requestAnimationFrame、シーク不要） |
| PreviewCard.tsx でアンマウント後にNotFoundError | visibility check用のimg.onloadがコンポーネント解放後に発火 | cancelledフラグ + try/catchで防御 |
| アニメーションボタン切替時にUIがガタつく | 速度セクションの条件レンダリング+processingスピナー瞬間表示+stickyコンテナのreflow伝播 | 速度セクション常時レンダリング+スピナー300ms遅延+contain:layout style+DLボタン固定幅+GIF URL遅延revoke |
| テキスト入力/バッジON時のレイアウトシフト | 条件レンダリングでセクションが一気にDOM挿入される（TextSettings +200px, BadgeSettings +300px） | max-h + opacity CSS トランジションで展開/折りたたみアニメーション化（DOM常時存在、pointer-events制御） |
| Auth.js v5でTwitchプロフィール画像/ログインIDがセッションに入らない | Auth.js v5のTwitch OIDCプロバイダーはclaims指定を正しく処理しない（既知バグ）、profileオブジェクトにpicture/preferred_usernameが含まれない | OIDCに頼らずaccount.access_tokenでTwitch Helix APIを直接呼出してlogin/display_name/profile_image_urlを取得する方式に変更 |
| Supabase templatesテーブルにINSERTできない（permission denied） | PostgreSQLのテーブル権限がservice_roleに付与されていなかった（RLS DISABLEDでも権限不足） | `GRANT ALL ON public.templates TO service_role` で明示的に権限付与 |
| auth.tsの型エラーでVercelビルド全失敗 | `session.user as Record<string, unknown>` のキャストがTypeScriptに拒否される（AdapterUser & User型との不整合） | `as unknown as Record<string, unknown>` と二段階キャストに変更 |
| モバイルでアニメーション設定ボタンが右に見切れる | サブスク解放後にアニメーション45種のグリッドが画面幅をはみ出す | overflow-x-hidden + truncateで横スクロール防止 |
| PublishAnimationModal/PreviewCardモーダルが画面中央に表示されない | 親要素の`[contain:layout_style]`が`fixed`のcontaining blockを変更し中央配置が効かない | `createPortal(…, document.body)`でbody直下にレンダリング |
| 「透過済みPNGをそのまま使う」が中途半端に改行される | ボタン幅に対してテキストが長く、単語の途中で折り返される | `whitespace-nowrap`+`<br>`で意味的に自然な位置で2行分割 |
| iOSでダウンロードボタンが動作しない | iOS Safariは`<a download>` + blob URLに対応していない | iOS検出（iPadOS 13+対応）→ PNG: `window.open`で新タブ表示+保存ガイドトースト、ZIP/バッジ: ステップ方式で1枚ずつ`window.open` |
| PCでHEICファイルをD&Dするとエラーが不明瞭 | ACCEPTED_TYPESにHEIC/HEIFが含まれておらず汎用エラーが出る | HEIC/HEIFを検出して「JPGまたはPNGに変換してください」の専用エラーメッセージを表示 |
| iOSでXシェア時にクリップボードコピーが無音失敗 | iOS Safariは`navigator.clipboard.write()`非対応 | iOS検出→「スクリーンショットを撮ってツイートに添付してください📸」トーストを表示 |

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

## コミット履歴（149コミット、主要のみ抜粋）

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
f180108 docs: REPORT.md更新（52コミット/4,937行、ジェリー追加で32種・速度調整・カラーピッカー改善・フォントサイズ72px・バグ修正4件反映）
0db7853 feat: ダウンロード完了後にXシェアを促すモーダルを追加
508f712 feat: Umami Analytics を追加（afterInteractive で非ブロッキング読み込み）
2048d71 legal: フッターにUmami Analyticsアクセス解析の告知文を追加
43be036 docs: REPORT.md更新（56コミット/5,005行、シェアモーダル・Umami Analytics・成果記録追加）
7c8aef4 feat: エモートフレーム機能を追加（星/ハート/ゲーミング/キラキラ/レインボー/ドット）
b752751 feat: 2画像合成機能を追加（右下重ね/左下重ね/左右並べ、サブスク限定）
ec0e201 improve: 2画像合成UX改善（SubImageUpload移動・サブ画像サイズスライダー追加）
0ace013 copy: 合言葉UIにDiscordサーバー案内リンクを追加
1107ac6 docs: REPORT.md更新（61コミット/5,502行、フレーム7種・2画像合成・Discord案内リンク反映）
cfcfa38 feat: サブスクバッジ作成機能を追加（円形/四角/角丸、背景色/透過、輪郭線、サブスク限定）
8a58b22 improve: Canvasメモリ最適化・おすすめパターン削減・NotFoundError防止
aaa10f1 feat: テンプレートギャラリー Phase 1 + DLモーダルにSNSフォローボタン追加
cf270ce feat: DLモーダルを4段階のしつこいシェア促進に変更
c59612e fix: DLモーダル4段階の文言を修正（タイトル統一・サブ/フォロー入れ替え）
7eeea08 fix: DLモーダル段階3のサブテキスト文言修正
cb8c31b fix: モバイルでTwitchログインボタンが2行になる問題を修正
913bd3c feat: ギャラリー空状態UIを説明+導線に刷新
b2464b8 feat: ログインボタンをギャラリータブに移動 + 空状態UI改善
e16c230 fix: Supabaseクライアントにauth設定を追加してservice_role keyを正しく使用
7a3016b feat: テンプレート削除機能を追加
cdee7b7 feat: ギャラリーにテンプレート説明文を常時表示
2df1a90 fix: モバイルでアニメーション設定が横に見切れる問題を修正
2d6d532 feat: テンプレート投稿者名をTwitchチャンネルへのリンクに変更
ae656a8 feat: テンプレートカードに投稿者Twitchアイコンを追加
813f0c9 fix: テンプレート投稿トーストを画面上部固定に変更
b8c4e76 fix: Twitchリンクを英語ログインID(user_login)ベースに修正
35e6fc2 fix: auth.tsの型エラーを修正 + Twitch Helix APIでユーザー情報取得
1074171 docs: REPORT.md更新（149コミット/9,500行、Twitch Helix API連携・投稿者アイコン・バグ修正反映）
e11bd41 fix: テンプレートカード「このテンプレートを使う」ボタンの2行折れを修正
9533027 improve: テンプレート投稿トーストを目立つ緑色+絵文字+詳しい文言に変更
b2fe06e fix: 透過中キャンセルボタンの2行折れを修正
72374d2 feat: テンプレート経由の限定設定UIを改善（紫枠+鍵アイコンで適用中表示）
6396615 feat: エモート作成画面に人気テンプレート上位3件を表示
f635164 feat: ログイン限定アニメ・殿堂入りバッジ・テンプレートクレジット追加
5dbdfdc chore: package-lock.json再生成（npm再インストール）
6f921a3 feat: AIアニメーション生成Phase 1完了（iframe sandbox+Anthropic API+プロンプト改善+未ログインUX改善）
xxxxxxx feat: AIアニメーション生成Phase 2完了（プレビューUI+パイプライン統合+残り回数表示）
```

---

## 今後の展望

### 短期（すぐ実装可能）
- AIアニメーション Phase 4: 管理者ダッシュボード（通報一覧・手動非公開・featured選定）
- テンプレートギャラリー Phase 2: サムネイルプレビュー生成（投稿時にブラウザでプレビュー画像生成→Supabase Storage保存）
- テンプレートギャラリー Phase 3: 通報機能（不適切テンプレートの通報→管理者通知）
- likes_count のDB trigger移行（レースコンディション完全排除）

### 中期（次のサイクル）
- ブランドカラープリセット保存（localStorage）
- 月替わり限定テンプレート（サブスク特典）

### 長期（サブスク最上位特典候補）
- バッチ生成（複数画像の一括処理）
- PWA化（オフライン対応）

### やらないと決めたこと

| 機能 | 理由 |
|------|------|
| スーパーシンプルモード | UIが2本になると保守コスト倍。デフォルト設定の改善で代替 |
| テキスト縦書き | Canvas縦書きは1文字ずつ座標計算が必要、コスパ悪い |
| gifEncoder.ts の分割リファクタ | 実施済み（animations/配下にbasic/effects/motionで分割） |
| SettingsPanel.tsx の分割リファクタ | 実施済み（settings/配下にカテゴリ別サブコンポーネントで分割） |
| EmoteConfig フラット型のグループ化 | 実施済み（18フィールド→6ネストグループ、PartialEmoteConfigで1段深いマージ） |
| サーバー処理による長尺動画対応 | 「サーバーに画像を送らない」コンセプトを優先。短尺案で様子見 |

### 最優先事項
**テンプレートギャラリーのシードデータ投稿とユーザーフィードバック収集。** テンプレートギャラリー Phase 1（Supabase + Twitch OAuth + 投稿/閲覧/適用/いいね/削除）が本番稼働。シードデータを数件投稿してギャラリーを賑わせ、ユーザーの反応を見てPhase 2以降の判断をする。

---

## 開発秘話

このエモートメーカーが生まれたきっかけは、配信者として雑談をしている際に「もずくマーメイド」さんというTwitch配信者さんから「画像を渡すだけでスタンプができたら…」という声をいただいたことだった。

生成AIが登場し「すごい」と言われる昨今だが、開発はおろかコードも全くの未経験のど素人でも何かできるのではないか——そう思い立ったのも、このサービスが生まれたもう一つのきっかけだ。

素人ならではの目線、配信者とリスナーの目線、そしてAIの力。この3つが合わさって生まれたのがこのツールである。

配信者やVTuberが使うのもよし、リスナーが推しのスタンプを作るのもよし。とりあえずお試しで使うのも大歓迎。ダツ皿アキ（@akiissamurai）のサブスクライバーになると限定機能も解放されるので、ぜひ検討してみてほしい。

---

## 成果記録

- 2026-03-09: 宣伝ツイートが12,120インプレッション・138リンククリック・エンゲージメント率13%を記録（4時間）
