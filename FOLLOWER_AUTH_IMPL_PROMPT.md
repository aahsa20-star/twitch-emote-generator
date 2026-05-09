# Twitchフォロワー認証実装プロンプト（Phase 1 MVP）

**目的**: `FOLLOWER_AUTH_DESIGN.md` に基づく実装の単独プロンプト。次セッションで Claude Code にこのファイル全体を投げれば実装が走る粒度で記述。

**前提**:
- `FOLLOWER_AUTH_RESEARCH.md` と `FOLLOWER_AUTH_DESIGN.md` は読み込み済みとする
- 設計書 §12 の「Aki 確認項目」が解消済み（特に A / C / G が確定済み）であること
- 解消されていない場合、実装着手前に Aki に確認

---

## 0. 着手前チェックリスト（実装者が必ず確認）

実装に入る前に以下を全部確認:

```
[ ] FOLLOWER_AUTH_DESIGN.md §12 の確認項目 A (お試し版アニメ2種) が確定
[ ] FOLLOWER_AUTH_DESIGN.md §12 の確認項目 C (broadcaster_id) が取得済みで Vercel 設定済み
[ ] FOLLOWER_AUTH_DESIGN.md §12 の確認項目 G (Aki 3行プロフィール) が確定
[ ] ローカル .env.local に AUTH_TWITCH_BROADCASTER_ID が設定されている
[ ] git の現在ブランチが main 直下から派生したクリーンな状態
[ ] working tree がクリーン（uncommitted 変更なし）
[ ] FOLLOWER_AUTH_RESEARCH.md と FOLLOWER_AUTH_DESIGN.md が読了済み
```

未解消があれば**実装着手せず Aki に確認**。

---

## 1. ブランチ戦略

```bash
git checkout main
git pull origin main
git checkout -b fix7-follower-auth
```

このブランチで全ステージのコミットを積む。最終的に main へ FF マージ。

---

## 2. 実装ステージ（コミット粒度を維持）

各ステージは **1 コミット** にまとめ、ステージ間で `npx tsc --noEmit` クリアを必ず確認。

### Stage 1: 認証層の基盤整備（auth.ts 拡張 + 型定義）

**目的**: scope 追加・JWT 永続化・refresh ロジック・型拡張。UI は手をつけない。

**変更ファイル**:
- `src/auth.ts` — scope `user:read:follows` 追加、access_token / refresh_token / expires_at / scope を JWT 保存、refresh フロー実装
- `src/types/auth.ts` (新規) — `AccessState` / `FeatureFlags` 型定義
- `next-auth/jwt` モジュール拡張（同 `src/types/auth.ts` 内 or 別ファイル）

**実装ポイント**:
- 既存の `/helix/users` 呼び出しは維持
- 追加で `/helix/channels/followed?user_id=X&broadcaster_id=AKI_ID` 呼び出し
- token expiry 検出 + refresh は `FOLLOWER_AUTH_DESIGN.md §3` のパターンに従う
- refresh 失敗時は `token.error = "RefreshTokenError"` を立てる（UI が読み取って再ログイン誘導）
- `AUTH_TWITCH_BROADCASTER_ID` を環境変数で参照、未設定時は `console.error` + `isFollower = false`

**Smoke test**:
- `npx tsc --noEmit` クリア
- `npm run dev` で起動 → Twitch ログインで scope ダイアログに `user:read:follows` 追加表示確認
- ログイン後 `/api/session` (or 適当な debug endpoint) で session に `isFollower` が含まれることを確認

**コミットメッセージ案**:
```
feat: Twitch follower 判定の認証層基盤 (fix7-stage1)

- src/auth.ts に user:read:follows scope 追加
- JWT に access_token / refresh_token / expires_at / scope / isFollower 永続化
- token expiry 検出 + refresh ロジック実装
- /helix/channels/followed 呼び出しでフォロー判定
- AccessState / FeatureFlags 型を src/types/auth.ts に新規定義
- next-auth/jwt モジュール拡張で型安全化

Smoke: tsc --noEmit クリア、ローカルで scope ダイアログに新権限追加表示確認

詳細: FOLLOWER_AUTH_DESIGN.md §1.1, §2.5, §5
```

---

### Stage 2: フォロー判定 API ラッパー + premium 判定統一

**目的**: `follower-check.ts` でリトライ + cache fallback、`premium.ts` で OR 結合判定、`feature-flags.ts` で env 評価。

**変更ファイル**:
- `src/lib/twitch/follower-check.ts` (新規) — `FOLLOWER_AUTH_DESIGN.md §3.1` のコードベースに実装
- `src/lib/auth/premium.ts` (新規) — `evaluateAccess(session, flags) → AccessState`
- `src/lib/auth/feature-flags.ts` (新規) — `getFeatureFlags() → FeatureFlags`（server-only）
- `src/auth.ts` — Stage 1 で書いた fetch を `follower-check.ts` 経由に置換、24h cache 動作

**実装ポイント**:
- `follower-check.ts` は副作用ゼロ純関数（JWT 読み書きしない）
- リトライ 1s / 3s / 10s
- 24h cache fallback の引数は呼び出し側 (auth.ts) が JWT から渡す
- `premium.ts` の判定優先順位: `TRIAL_MODE_ENABLED=false → premium / FOLLOW_AUTH_ENABLED=false → PASSPHRASE のみ / 通常: isFollower OR isSubscribed`
- 旧 scope 検出は `(session.scope ?? "").includes("user:read:follows")` で

**Smoke test**:
- `npx tsc --noEmit` クリア
- 単体での fetch モックは Phase 2 で。Phase 1 は手動確認のみ
- ローカルでフォロー済みアカウントログイン → `isFollower=true`、フォロー無しアカウント → `isFollower=false`

**コミットメッセージ案**:
```
feat: フォロー判定 API ラッパー + premium 統一判定 (fix7-stage2)

- src/lib/twitch/follower-check.ts: 401/429/5xx ハンドル + 1s/3s/10s リトライ +
  24時間 stale-cache フォールバック
- src/lib/auth/premium.ts: evaluateAccess で isFollower || isSubscribed の OR 結合判定
- src/lib/auth/feature-flags.ts: 環境変数 4 つを評価
- src/auth.ts: Stage 1 の fetch を follower-check.ts 経由に置換

Smoke: tsc --noEmit クリア

詳細: FOLLOWER_AUTH_DESIGN.md §1.4, §3, §6
```

---

### Stage 3: UI コンポーネント新規追加（モーダル系）

**目的**: ロック解除モーダル 2 種・お試しバッジ・再ログインバナーを追加。判定ロジックは差し込まず、props で表示制御だけ受け取る純粋表示コンポーネント。

**変更ファイル**:
- `src/components/FollowGateModal.tsx` (新規) — DL クリック時の本格誘導モーダル
- `src/components/FeatureLockHint.tsx` (新規) — 鍵マーククリック時の軽い解説モーダル
- `src/components/TrialBadge.tsx` (新規) — 上部「お試し版で使用中」バッジ
- `src/components/ReauthBanner.tsx` (新規) — 旧 scope ログイン者向け再ログイン誘導

**実装ポイント**:
- `FollowGateModal` は `FOLLOWER_AUTH_DESIGN.md §7.1` のレイアウト
- プレビュー大表示は 28x28 のみ表示、56/112 は「フォローで解放」のプレースホルダ
- inline 展開可能な PASSPHRASE 入力欄（既存の入力 UI ロジックを流用 / 移植）
- Aki 3 行プロフィールは `placeholder` でハードコード、後で Aki 文言に差し替え
- utm パラメータ付き URL: `lock_modal` / `key_icon` / `onboarding`
- `FeatureLockHint` は `featureLockHintCount` を localStorage で記録、5 回超えたら自動的に表示しない
- `TrialBadge` は default で `<TrialBadge variant="badge-only" />` (案 D)、props で文言切替可能に
- `ReauthBanner` は localStorage `reauthBannerDismissed` を見て初回 vs 控えめ切替

**Smoke test**:
- `npx tsc --noEmit` クリア
- Storybook 等は使ってないので、適当な debug page で各モーダルを手動表示確認

**コミットメッセージ案**:
```
feat: フォロー認証 UI コンポーネント群を追加 (fix7-stage3)

- FollowGateModal: DL ロック解除誘導モーダル（プレビュー + 3行プロフィール +
  Twitch フォロー導線 + PASSPHRASE inline 展開）
- FeatureLockHint: 鍵マーククリック時の軽い解説モーダル（5回まで表示・以降tooltip）
- TrialBadge: 上部「お試し版で使用中」バッジ（4 文言案を切替可能）
- ReauthBanner: 旧 scope ログイン者向け再ログイン誘導（初回目立つ→×で控えめ）

utm 計測パラメータ:
- lock_modal / key_icon / onboarding を Twitch URL に付与

判定ロジックは含まず、props で表示制御。Stage 4 で配線。

Smoke: tsc --noEmit クリア

詳細: FOLLOWER_AUTH_DESIGN.md §7
```

---

### Stage 4: 既存サブスク判定の置き換え（OR 結合への移行）

**目的**: `isSubscriber` ベースの判定を `evaluateAccess()` 経由の `isPremium` に置換。ロック対象機能の挙動はこの段階では既存と同等（拡張なし）。

**変更ファイル**:
- `src/components/EmoteGenerator.tsx` — `isSubscriber` state は維持しつつ `useSession()` から `isFollower` を取得して合成判定
- `src/components/SettingsPanel.tsx` — `isSubscriber` prop を `isPremium` に置換 (or 追加)
- `src/components/settings/AnimationSettings.tsx` — 同様
- `src/components/RecommendedPatterns.tsx` — 必要なら同様

**実装ポイント**:
- 既存の localStorage `emote-subscriber=true` ベースの判定は維持
- session の `isFollower` も合成して `isPremium = isSubscribed || isFollower`
- 既存ユーザーの体験は変わらない (合言葉あり = premium のまま)
- 旧 scope ログイン者は `needsReauth` フラグを取得 → ReauthBanner 配置
- TrialBadge 配置（trial の時だけ表示）

**Smoke test**:
- `npx tsc --noEmit` クリア
- 既存の合言葉ユーザーで全機能アクセス可能であることを確認
- 新規ログインユーザー（フォロー済み）で全機能アクセス可能
- 未ログイン or フォロー無しは trial 状態（既存サブスク特典がロック）

**コミットメッセージ案**:
```
feat: 既存サブスク判定を premium OR 結合へ移行 (fix7-stage4)

- EmoteGenerator/SettingsPanel/AnimationSettings 等で isSubscriber を
  evaluateAccess() 経由の isPremium に置換
- isPremium = isFollower OR isSubscribed (PASSPHRASE) で OR 結合
- TrialBadge / ReauthBanner を配置
- 既存サブスク特典の locked 状態は変更なし（拡張は Stage 5 以降）

互換性:
- 既存合言葉ユーザー: 体験変化なし
- 新規フォロー済みユーザー: 既存サブスク特典が全部使える

Smoke: tsc --noEmit クリア、合言葉ユーザー / 新ログインユーザー両方で確認

詳細: FOLLOWER_AUTH_DESIGN.md §2.1, §5
```

---

### Stage 5: お試し版の機能制限を実装

**目的**: trial 状態のユーザーに対して、確定仕様の「お試し版制限」を反映。既存サブスク特典の拡張ロックも同時に。

**変更ファイル**:
- `src/types/emote.ts` — お試し版アニメ 2 種を「常時利用可」、それ以外の基本5種は trial で locked、border の white/black 以外は trial で locked
- `src/components/SettingsPanel.tsx` — フチ・テキスト色の制限実装
- `src/components/settings/AnimationSettings.tsx` — お試し版 2 種以外の基本/login アニメも trial で locked
- `src/hooks/useEmoteProcessor.ts` — テキスト色制限（trial では 1 色のみ）

**実装ポイント**:
- 確定したお試し版 2 種を `TRIAL_ANIMATIONS` として export
- ロック判定: `tier === "trial" && !TRIAL_ANIMATIONS.includes(anim.value)` で locked
- 鍵マーククリック → FeatureLockHint 起動
- フチの「白フチ・黒フチ」だけ trial 利用可、`subscriberOnly` でないが trial で locked のものを区別
- カスタムフチ色は trial で locked
- テキスト色: trial では `fillColor` が白（#ffffff）固定、変更不可

**Smoke test**:
- `npx tsc --noEmit` クリア
- 未ログインで:
  - お試し 2 種のアニメだけ選択可、他は鍵マーク
  - 白フチ・黒フチだけ選択可、他は鍵マーク
  - テキスト色変更不可
- フォロー済みログインで全部選択可

**コミットメッセージ案**:
```
feat: お試し版の機能制限を実装 (fix7-stage5)

- TRIAL_ANIMATIONS 定数で trial 利用可アニメを定義（{選定された 2 種}）
- お試し版で利用不可な機能の鍵マーク表示
- フチスタイル: trial では white/black のみ、他は鍵マーク
- テキスト色: trial では白固定
- AnimationSettings の login/sub アニメも trial で locked
- 鍵マーククリック → FeatureLockHint 起動（5回まで・以降tooltip）

確定仕様 (FOLLOWER_AUTH_DESIGN.md §11):
- 基本アニメ 7 種のうち {2 種} のみ trial で利用可
- 他は鍵マーク表示

Smoke: tsc --noEmit クリア、未ログイン UI で trial 制限が全部動作確認
```

---

### Stage 6: ダウンロードロックの実装

**目的**: 既存の DL ボタンに権限チェックを差し込み、サーバー側再検証 API を追加。

**変更ファイル**:
- `src/app/api/download-check/route.ts` (新規) — `FOLLOWER_AUTH_DESIGN.md §4.2` の実装
- `src/components/PreviewCard.tsx` — handleDownload に `/api/download-check` 経由のガード
- `src/components/PreviewArea.tsx` — バッジ DL も同様にガード
- `src/components/DownloadButton.tsx` — iOS step DL 経路もガード
- `src/components/EmoteGenerator.tsx` — FollowGateModal の open 状態管理

**実装ポイント**:
- DL ボタン押下 → `fetch('/api/download-check', { ... })` → 200 で続行、403 で `setShowFollowGate(true)`
- trial の制限: 28px PNG だけ通過、56/112 と全 GIF は 403
- DOWNLOAD_LOCK_ENABLED=false なら全部 200
- iOS step DL は最初の click 時だけチェックすれば OK（順次実行のため）
- GIF の場合は `format: "gif"` を body に含める

**Smoke test**:
- `npx tsc --noEmit` クリア
- 未ログインで 28px PNG DL → 成功
- 未ログインで 112px PNG DL → FollowGateModal 表示
- 未ログインで GIF DL（任意サイズ）→ FollowGateModal 表示
- フォロー済みログインで全 DL → 成功
- DOWNLOAD_LOCK_ENABLED=false で trial でも全 DL 成功

**コミットメッセージ案**:
```
feat: ダウンロードロック実装 (fix7-stage6)

- /api/download-check エンドポイント新規追加（サーバー側 tier + format + size 検証）
- PreviewCard / PreviewArea / DownloadButton に DL 前ガード差し込み
- trial: 28px PNG のみ通過、56/112 と全 GIF は 403 → FollowGateModal 起動
- DOWNLOAD_LOCK_ENABLED=false で全 DL バイパス

クライアント改竄対策:
- evaluateAccess() のサーバー側再評価で 403
- 完全な迂回は不可能だが対 95% ユーザーで有効

Smoke: tsc --noEmit クリア、未ログイン/フォロー済みの DL 挙動を全パターン確認

詳細: FOLLOWER_AUTH_DESIGN.md §4
```

---

### Stage 7: フォロー再認証ボタン + 旧ユーザー migration の仕上げ

**目的**: 「フォロー済み・解除を確認」ボタンの動作実装、ReauthBanner の挙動完成。

**変更ファイル**:
- `src/components/FollowGateModal.tsx` — 「フォロー済み・解除を確認」ボタン → `signOut() → signIn("twitch")` フロー
- `src/components/ReauthBanner.tsx` — 旧 scope 検出時の挙動完成
- `src/components/EmoteGenerator.tsx` — ReauthBanner の配置位置確定

**実装ポイント**:
- 「フォロー済み・解除を確認」ボタン: 既存の `signIn("twitch")` を呼び出すだけで OK（既ログイン時は scope 不変なら何も変わらず redirect 戻る、scope 変化なら再認可ダイアログ）
- 「フォローしたのに反映されない」UX: signIn 後に再判定 → false なら 30 秒後 retry のヒント表示
- ReauthBanner: `localStorage.reauthBannerDismissed` で初回 vs 控えめ切替
- 「合言葉あり + 旧 scope」ユーザーへの控えめ文言 (`§7.3`)

**Smoke test**:
- `npx tsc --noEmit` クリア
- 旧 scope セッション擬似テスト（手動で localStorage / cookie いじる or 別 Twitch アカウントでテスト）

**コミットメッセージ案**:
```
feat: フォロー再認証ボタン + 旧ユーザー migration 仕上げ (fix7-stage7)

- FollowGateModal の「フォロー済み・解除を確認」ボタンが signIn("twitch") を呼ぶ
- ReauthBanner: 初回1回目立つ表示、× で controlled、以降は控えめバッジ
- 旧 scope + 合言葉ユーザー向けの控えめ文言バリエーション

Smoke: tsc --noEmit クリア、旧 scope セッションシミュレーションで挙動確認

詳細: FOLLOWER_AUTH_DESIGN.md §5, §7.3
```

---

### Stage 8: killswitch 動作確認 + 統合テスト

**目的**: 環境変数による緊急縮退が機能することを確認。code 修正は最小、主に手動テスト。

**変更ファイル**:
- `.env.example` — 新環境変数 4 つ追記（コメント付き）
- 必要なら微修正・コメント追加のみ

**実装ポイント**:
- `.env.local` で各 killswitch を順次 false に切り替え動作確認
- production 用 Vercel 環境変数の事前設定確認（push 前に）

**Smoke test (手動・全件 pass 必須)**:
`FOLLOWER_AUTH_DESIGN.md §8.2` の **17 項目を全件**:

```
[ ] #1 未ログイン状態で 28px PNG DL → 成功
[ ] #2 未ログイン状態で 112px PNG DL → FollowGateModal 表示
[ ] #3 未ログインで「sparkle」(subscriberOnly) クリック → FeatureLockHint 表示
[ ] #4 フォロー無し新ログインで 112px DL → FollowGateModal
[ ] #5 フォロー有り新ログインで 112px DL → 成功
[ ] #6 フォロー有り新ログインで 限定アニメ 全 45 種 → 全部選択可
[ ] #7 旧ログイン (PASSPHRASE 無し) → ReauthBanner + trial UI
[ ] #8 旧ログイン (PASSPHRASE 有り) → ReauthBanner 控えめ + premium UI
[ ] #9 「フォロー済み・解除を確認」ボタン → signOut → signIn → premium 化
[ ] #10 合言葉 inline 展開 → 全機能解放
[ ] #11 DOWNLOAD_LOCK_ENABLED=false → trial でも全 DL 通る
[ ] #12 TRIAL_MODE_ENABLED=false → 全機能解放
[ ] #13 FOLLOW_AUTH_ENABLED=false → API 呼び出し停止、PASSPHRASE のみ
[ ] #14 フォロー後 → アンフォロー → 同セッションで DL → 成功（次回ログインまで猶予）
[ ] #15 フォロー後 → アンフォロー → 再ログイン → DL → ロック復帰
[ ] #16 Twitch API 障害シミュレーション → cache fallback 動作
[ ] #17 devtools で tier 改竄 → サーバー側 403
```

**コミットメッセージ案**:
```
feat: killswitch 動作確認 + 統合テスト完了 (fix7-stage8)

- .env.example に新環境変数 4 つを追記
- §8.2 の 17 項目を全件手動テスト pass

Smoke: ローカル + preview deploy で全シナリオ動作確認

これで Phase 1 MVP 機能完成。次はロールアウト。

詳細: FOLLOWER_AUTH_DESIGN.md §6, §8
```

---

## 3. ロールアウト手順（実装後）

`FOLLOWER_AUTH_DESIGN.md §9` に従う。

```bash
# Step 1: feature branch を push
git push -u origin fix7-follower-auth

# Step 2: Vercel preview deploy 自動生成 → URL を Aki に伝達
# Step 3: Aki が preview URL で 17 項目テスト
# Step 4: Aki OK 後、main へ FF
git checkout main
git pull origin main
git merge --ff-only fix7-follower-auth
git push origin main
# Step 5: production deploy 自動完了確認
# Step 6: 24-48h 監視（FOLLOWER_AUTH_DESIGN.md §10）
```

---

## 4. 完了報告フォーマット

実装完了時、Claude Code が Aki に以下フォーマットで報告:

```markdown
# fix7 (Twitch follower auth) 実装完了

## 完了 Stage 一覧
| Stage | hash | 内容 |
|---|---|---|
| 1 | xxxxxxx | 認証層基盤 |
| 2 | xxxxxxx | 判定ラッパー + premium 統一 |
| 3 | xxxxxxx | UI コンポーネント新規 |
| 4 | xxxxxxx | OR 結合移行 |
| 5 | xxxxxxx | お試し版機能制限 |
| 6 | xxxxxxx | DL ロック |
| 7 | xxxxxxx | 再認証 + migration 仕上げ |
| 8 | xxxxxxx | killswitch + 統合テスト |

## Smoke Test 結果（§8.2）
[全 17 項目の pass/fail]

## 変更ファイル数
新規: N 件
変更: M 件
合計: K lines added / L lines deleted

## 既知の未解決事項
[Aki 確認待ちの項目を再掲]

## 次のアクション (Aki)
1. preview deploy URL を実機テスト
2. SNS / Twitch 配信での告知文準備
3. プライバシーポリシー本文を更新（既存 PP の場所に追記）
4. main FF → production
```

---

## 5. トラブルシューティング指針

### `npx tsc --noEmit` がエラー

- まず該当 stage のコミット直前に戻して再確認
- 既存の `tsc` clean を fix5 / fix6 で確認しているので、新規コードの問題

### Twitch API 401 連発

- AUTH_TWITCH_BROADCASTER_ID の設定漏れ確認
- scope に `user:read:follows` が入っていることを Twitch ダッシュボードで確認
- ローカルの `.env.local` の値が production と一致していることを確認

### preview deploy で挙動が違う

- 環境変数が preview / production それぞれに設定されているか
- Vercel ダッシュボードで「Environment Variables」を再確認

### main FF できない（non-FF）

- main が先に進んでいる場合（他のコミットが入った）→ rebase するか revert + 再 merge
- `--ff-only` を使っているので merge commit は作らない

---

## 6. 実装制約（必読）

- **既存の合言葉機能 (`PASSPHRASE`) は絶対に削除しない**: §J 確認項目で deprecated 期限が決まるまで継続維持
- **画像処理はクライアントサイドで完結原則を守る**: サーバーには blob を送らない (CLAUDE.md 制約)
- **`SUPABASE_SERVICE_ROLE_KEY` をフロントに露出させない**: フォロー判定はサーバー callbacks で完結
- **既存テンプレート (templates テーブル) は破壊しない**: subscriberOnly フィールドの意味は維持、UI 側で OR 結合判定
- **`fix6-border-styles` で追加した 7 スタイル**: trial で locked 対象（white/black 以外）

---

## 7. 想定外シナリオへの対応

実装中に「設計と現実が違う」が発覚した場合:

1. **設計書 §12 確認項目に追加**: 即決できないなら blocker として残す
2. **小さい差分なら Aki に確認**: スプリント中の即決を促す
3. **大きい差分なら設計書 update を提案**: 別 commit で設計書修正 → 実装続行
4. **絶対にやってはいけない**: 設計書を更新せずに勝手に実装方針変更

---

## 8. 完了条件の最終チェック

```
[ ] Stage 1〜8 全部コミット済み
[ ] §8.2 の 17 項目テスト全件 pass
[ ] tsc --noEmit クリア
[ ] preview deploy で Aki が手動確認済み
[ ] main FF マージ済み
[ ] production deploy success
[ ] 環境変数 (Vercel) が production 用に全 5 つ設定済み
[ ] FOLLOWER_AUTH_DESIGN.md §12 の Aki 確認項目（D / E）が解消済み
[ ] CHANGELOG / REPORT.md に fix7 のエントリ追記済み
```

---

**実装プロンプトとしての完成。次セッションでこのファイル全体を Claude Code に渡せば実装走行開始。**
