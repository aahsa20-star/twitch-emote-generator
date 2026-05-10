# セッション間引き継ぎメモ

**最終更新**: 2026-05-10（fix7 follower auth Phase 1 MVP 全 8 Stage 実装完了直後）
**用途**: 新しい Claude Code セッションが状況を把握し、Aki の次の指示にスムーズに応答するための short briefing。長期文脈は `CLAUDE.md` / 設計書群を参照。

---

## 現在の状態（一目で）

| ブランチ | HEAD | origin sync | 状態 |
|---|---|---|---|
| **main** | `93888d4` | ✅ same | fix1〜6 + fix8 反映済み（production 稼働中） |
| **fix7-follower-auth** | `e4b555c` | ✅ same | **Phase 1 MVP 全 8 Stage 実装完了 / Aki preview テスト待ち** |
| fix8-privacy-policy | `93888d4` | ✅ main と一致 | main マージ済み（このブランチ自体は不要、削除可） |

**production URL**: https://twitch-emote-generator.vercel.app/
**Aki の運営アカウント**: Twitch=`datsusara_aki` / X=`akiissamurai`

---

## 直近の作業：fix7 Twitchフォロワー認証 Phase 1 MVP

### 何を実装したか

Aki チャンネルへのフォロー判定で **trial / premium** 2 階層 access tier を追加。
- **trial（ログイン無しまたはフォロー無し）**: アニメ 2 種（bounce + shake）/ フチ白黒のみ / テキスト色固定 / DL 28px PNG のみ
- **premium（フォロー済み or PASSPHRASE）**: 全機能解放

### 全 Stage コミット hash

| Stage | hash | 内容 |
|---|---|---|
| 1 | `a76a1c1` | 認証層基盤（auth.ts + 型定義） |
| 2 | `c04eb3e` | follower-check.ts + premium.ts + feature-flags.ts |
| 3 | `98b23fd` | UI 4 種（FollowGateModal / FeatureLockHint / TrialBadge / ReauthBanner） |
| 4 | `edfc0a3` | 既存サブスク → OR 結合移行 (isSubscriber prop → isPremium rename) |
| 5 | `5b13f8d` | お試し版機能制限 + FeatureLockHint 統合 |
| 6 | `b914692` | DL ロック + /api/download-check + 各 DL 経路 gate |
| 7 | `a1f6566` | 再認証 + cookie クリア |
| 8 | `e4b555c` | killswitch + .env.example + fix8 連動解除（PP §1-1 注釈 / §1-3 行） |

### 設計書 / 実装プロンプト

`fix7-follower-auth` ブランチ（main 反映前、fix7 push 済み）に以下が存在：
- `FOLLOWER_AUTH_RESEARCH.md` (583行) — Twitch API / 規約 / Auth.js v5 調査
- `FOLLOWER_AUTH_DESIGN.md` (985行) — Phase 1 MVP 詳細設計
- `FOLLOWER_AUTH_IMPL_PROMPT.md` (550行+) — 実装プロンプト（実装済み、参照価値あり）

main に merge されると上記 3 本も main 入り。

---

## Aki がやるべき残課題（優先順）

### 🔴 production 反映前 blocker

1. **Vercel 環境変数を production scope に投入確認**
   - 必須: `AUTH_TWITCH_BROADCASTER_ID`（`.env.local` には設定済み、Vercel ダッシュボードで production 用にも設定されているか要確認）
   - 任意: `TRIAL_MODE_ENABLED` / `FOLLOW_AUTH_ENABLED` / `PREMIUM_LOCK_ENABLED` / `DOWNLOAD_LOCK_ENABLED`（未設定でも default true で動作。緊急切替したいなら明示追加推奨）

2. **preview deploy で 17 項目テスト**
   - `FOLLOWER_AUTH_DESIGN.md §8.2` および `FOLLOWER_AUTH_IMPL_PROMPT.md` Stage 8 のチェックリスト全件
   - **テスト用副 Twitch アカウント必要**: フォロー済み / フォロー無しの 2 アカ（Aki 自分自身は self-follow 不可）
   - preview URL の DNS 名: `twitch-emote-generator-git-fix7-f-2658d5-aahsa20-stars-projects.vercel.app`（branch alias）または Vercel ダッシュボードからアクセス
   - **Vercel Project Protection ON**: SSO 認証必要、curl では 401 になる

3. **`supabase-cascades.sql` を Supabase 管理画面で適用**（fix8 から保留中）
   - templates → likes の CASCADE 設定
   - 深夜推奨（DDL 実行で一時ロック）
   - 適用手順は `supabase-cascades.sql` 冒頭コメント参照

### 🟡 任意

4. **fix8-privacy-policy ブランチ削除**
   - main に merge 済み、参照不要
   - `git push origin --delete fix8-privacy-policy`

---

## Claude Code が次セッションでやる候補

Aki の指示次第だが、想定される次タスク:

1. **preview deploy 状態の確認** + bundle marker 検証
2. **17 項目テストの結果報告**を Aki が伝えてきたら → 問題箇所のデバッグ or main FF
3. **main FF マージ実行** (Aki の OK 後)
4. **production deploy 確認 + bundle marker 検証**
5. **副アカ設定支援**（テスト用アカウント準備のフロー）
6. **Phase 2 タスク**（修正候補リストは `FOLLOWER_AUTH_DESIGN.md §12` の Phase 2 移行項目）

---

## 重要な技術ノート / 既知の落とし穴

### 1. ローカル `npm run build` は失敗する（Google Fonts flakiness）
- この実行環境のサンドボックスから `fonts.gstatic.com` への接続が落ちている既知問題
- Vercel build 環境では問題なく通る
- **smoke test として `npx tsc --noEmit` を使う**（こちらは確実に動く）

### 2. Vercel preview URL のパターン
- branch 名が DNS ラベル長 63 文字を超えると Vercel が切り詰めて hash を付与
- 例: `fix7-follower-auth` → `fix7-f-2658d5`
- 真の URL は GitHub の Vercel Preview Comments check-runs から取得可能:
  ```bash
  gh api "repos/aahsa20-star/twitch-emote-generator/commits/<hash>/check-runs" \
    | python3 -c "import json,sys; ..." # extract feedback URL
  ```
- Vercel MCP の `get_deployment` は scope 制限で `403 Forbidden` 出る場合あり

### 3. PASSPHRASE は honor system セキュリティ
- /api/auth POST が cookie `emote-subscriber=1` を設定（HttpOnly + 署名なし）
- 攻撃者が手で cookie をセットすれば PASSPHRASE 無しで通る
- これは既存の localStorage フラグと同等水準。既存の security model を維持
- 完全 server 検証が必要なら Phase 2 で HMAC 署名追加

### 4. `.admin-sop-private.md` は git 管理外
- `.gitignore:44` で除外（`.admin-sop-private.md`）
- Aki のローカルにのみ存在、PC 引っ越し時は手動で持ち運び
- 内容は具体 SQL クエリ集（user_id 単位削除手順）
- 本セッション中で誤削除した経歴あり → 復元済み (209 行)

### 5. fix7 ブランチの worktree 操作の注意
- worktree が `/Users/akiranagayama/Desktop/Twitchエモート作成/.claude/worktrees/lucid-jepsen-dc12a1/` 経由
- main は別 worktree（`/Users/akiranagayama/Desktop/Twitchエモート作成/`）にチェックアウト済み
- 同じブランチを 2 つの worktree でチェックアウトできない → main FF は main worktree で実行する
- ブランチ切替時は `.admin-sop-private.md` などの untracked ファイルが checkout を block する場合あり、注意

### 6. コミット粒度ルール
- Aki は「1 機能 = 1 コミット（混ぜない）」を厳守
- 段階的アプローチを好む（Phase A 先行コミット → Phase B が崩れた時のフォールバック確保）
- コミットメッセージは日本語、Co-Authored-By 付与
- main 直接 push でなく feature branch + FF マージ運用

### 7. 設計書 vs 実装プロンプトの分担
- `FOLLOWER_AUTH_DESIGN.md`: アーキテクチャと意思決定の記録
- `FOLLOWER_AUTH_IMPL_PROMPT.md`: Stage 1〜8 の実装手順（次回セッションで実装する場合のレシピ）
- 設計書を勝手に書き換えず、別タスクで明示的に更新

---

## Aki の意思決定の傾向（観察ベース）

- **判断軸を先回りで明示する** タイプ。「Aki の判断軸を共有：xxx」のような構造的説明が好まれる
- **Tier1/2/3 などで実装範囲を絞る** 傾向（Tier 1 必須 / Tier 2 余裕あれば / Tier 3 後回し）
- **n=1 の実測より静的分析を信頼**（ばらつき要因を嫌う）
- **完全クリーン化より「今後追加で公開しない」方針**（git history 改変は避ける）
- **fail-safe（攻撃面ゼロ優先）+ 24h cache fallback** のような UX 配慮を組み合わせる
- **autonomous 進行を許可するパターン**: 「完了したら次の Stage に進みます」と明示された場合のみ自動継続。それ以外は判断ポイントで停止

---

## 関連ドキュメントマップ

```
リポジトリルート/
├── CLAUDE.md                       ← プロジェクト全体の文脈
├── README.md                       ← 一般向け説明
├── REPORT.md                       ← 実装機能の changelog
├── SESSION_HANDOFF.md              ← (this file) セッション間引き継ぎ
│
├── QUALITY_AUDIT.md                ← fix1〜5 の品質改善監査・修正履歴
├── PRIVACY_AUDIT.md                ← fix8 の Supabase 個人情報マッピング
├── ADMIN_DELETION_SOP.md           ← fix8 の削除請求運用 SOP（公開）
├── .admin-sop-private.md           ← 同 SOP の SQL クエリ集（git 管理外）
│
├── FOLLOWER_AUTH_RESEARCH.md       ← fix7 調査
├── FOLLOWER_AUTH_DESIGN.md         ← fix7 詳細設計（Phase 1 MVP）
├── FOLLOWER_AUTH_IMPL_PROMPT.md    ← fix7 実装プロンプト（参照価値あり）
│
├── supabase-custom-animations.sql
├── supabase-ai-animation-logs.sql
└── supabase-cascades.sql           ← fix8 で追加、Aki 適用待ち
```

---

## 直近の累積コミット（fix1〜fix7、新→旧）

```
e4b555c feat: killswitch + 統合テスト + fix8 連動解除 (fix7-stage8)        ← fix7 最新
a1f6566 feat: 再認証ボタン + migration 仕上げ (fix7-stage7)
b914692 feat: ダウンロードロック実装 (fix7-stage6)
5b13f8d feat: お試し版の機能制限を実装 (fix7-stage5)
edfc0a3 feat: 既存サブスク判定を premium OR 結合へ移行 (fix7-stage4)
98b23fd feat: フォロー認証 UI コンポーネント群を追加 (fix7-stage3)
c04eb3e feat: フォロー判定 API ラッパー + premium 統一判定 (fix7-stage2)
a76a1c1 feat: Twitch follower 判定の認証層基盤 (fix7-stage1)
716c4ce docs: fix7 完了条件に PP §1-1 注釈削除を追記
68d5c5c docs: fix7 完了条件に PP §1-3 解除を追記
2bb4477 docs: フォロワー認証 設計書3本追加（fix7着手前準備）
93888d4 docs: PP §5-1 にアカウント削除ボタン項目を追加 ← main HEAD（fix8 最終）
5499f09 chore: 表記揺れ・整合性の最終棚卸し
746d101 fix: X アカウント名を @akiissamurai に修正
06db947 chore: PP §1-3 行を fix7 まで一時コメントアウト
be6b22a docs: ADMIN_DELETION_SOP.md シンプル化、機密 SQL を private へ分離
6dad76b docs: PRIVACY_AUDIT.md を fix8 ブランチに追加
c57ea97 feat: Supabase CASCADE 設定マイグレーション SQL 追加
2e895fa feat: アカウント削除 API エンドポイント実装
00835e8 feat: アカウント削除UI実装
31f3718 docs: 削除請求受付 SOP 作成
59c8185 feat: Footer にプライバシーポリシーリンク追加
ddad78c feat: /privacy ページ新設
b9245ba feat: フチスタイル7種追加 (修正6)
a931d58 feat: GIF Floyd-Steinberg ディザリング有効化 (修正5)
2e2f71e feat: フチ取り最低幅保証 + stamp filter化 (修正4)
7a598f0 feat: テキスト28pxスキップ撤廃 + サイズ適応レンダリング (修正3)
b0f7e67 feat: デフォルトpadding 5%→2% (修正2)
8cc2267 feat: HI_RES 224→448 (修正1)
3888d27 feat: フォント10種追加（12種→22種）         ← fix6 直前の baseline
```

---

## 新セッション開始時の推奨フロー

新しい Claude Code セッションを開いた直後にやるべきこと:

```bash
# 1. 状態確認
cd /Users/akiranagayama/Desktop/Twitchエモート作成/.claude/worktrees/lucid-jepsen-dc12a1
git status
git --no-pager branch -vv
git --no-pager log --oneline -5

# 2. 必要に応じて main の最新に追従（fix7 が rebase 済みかも）
git fetch origin main
git fetch origin fix7-follower-auth

# 3. 現在地を Aki に確認
```

そして以下のどれかを Aki から指示される想定:
- 「preview テストで X 項目が失敗した、デバッグして」
- 「main FF マージしてください」
- 「Phase 2 の Y を実装してください」
- 「別タスクに着手」

各想定の最初のアクションは、本ファイルおよび CLAUDE.md / 各設計書を読んで状態を把握 → Aki の指示に応答。
