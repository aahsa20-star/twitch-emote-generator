# Twitch Emote Generator 開発レポート

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | Twitch Emote Generator |
| 本番URL | https://twitch-emote-generator.vercel.app/ |
| GitHub | https://github.com/aahsa20-star/twitch-emote-generator |
| 技術スタック | Next.js 16 (App Router) + TypeScript + Tailwind CSS v3 + Anthropic SDK |
| ホスティング | Vercel（GitHub自動デプロイ） |
| コード規模 | 57ファイル / 約9,500行（src/配下） |
| コミット数 | 157+ |
| 最新コミット | feat: AIアニメーション生成Phase 3完了（公開フロー+みんなのアニメーション+いいね+通報） |
| DB | Supabase（templates/likes/ai_animation_logs/custom_animations/animation_likes/animation_reportsテーブル） |
| 認証 | Auth.js v5 + Twitch OAuth |

## コンセプト

**「1枚の画像をアップロードするだけで、Twitch/Discord仕様に準拠したエモートを自動生成するブラウザ完結ツール」**

- サーバーへの画像送信なし（完全クライアントサイド処理）
- AI背景透過 → ブラシ微調整 → 位置調整 → 2画像合成 → フチ取り → フレーム → テキスト → アニメーション → 3サイズ同時出力 → サブスクバッジ生成
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
- shadow多パス方式のテキスト縁取り（幅0〜10px可変）
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
| テキスト縁取りが粗い | strokeTextの標準描画品質の限界 | shadow多パス描画方式に変更 |
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
