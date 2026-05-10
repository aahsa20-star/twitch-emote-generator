# プライバシー監査レポート — Supabase 個人情報の所在と取扱い

**目的**: プライバシーポリシー作成の前提として、Supabase に保存している個人情報を正確に特定する。
**スコープ**: 調査のみ・コード変更ゼロ。
**作成者**: Claude (Sonnet)
**日付**: 2026-05-09

---

## エグゼクティブサマリー

エモジェネは「ブラウザ内完結」を売りにしているが、**テンプレート投稿・AIアニメ公開・各種いいね/通報**の機能で Supabase に **Twitch アカウント情報（user_id / user_name / user_login / user_image）**を保存している。**画像データはサーバーに送らない原則は維持されている**が、UI 操作（投稿・いいね・通報）の伴うアカウント識別子は永続保存される。

**6 テーブル × 個人情報 4 種** を扱っている。プライバシーポリシーで明示すべき。

既存 Footer に部分的な開示はあるが、**法的に十分な開示水準には届いていない**（保持期間・削除請求方法・第三者提供有無・カラム単位の特定が未記載）。

---

## §1 Supabase に保存されている個人情報の完全リスト

### 1.1 テーブル一覧

| テーブル | スキーマ定義の所在 | 個人情報含有 | 操作種別 |
|---|---|---|---|
| `templates` | **リポジトリに SQL なし**（Supabase 管理画面で作成と推定） | あり（4 種） | テンプレート投稿 |
| `likes` | **リポジトリに SQL なし**（同上） | あり（user_id のみ） | テンプレートいいね |
| `custom_animations` | `supabase-custom-animations.sql:2-16` | あり（4 種 + 自由テキスト） | AIアニメ公開 |
| `animation_likes` | `supabase-custom-animations.sql:24-30` | あり（user_id のみ） | アニメいいね |
| `animation_reports` | `supabase-custom-animations.sql:35-41` | あり（user_id のみ） | アニメ通報 |
| `ai_animation_logs` | `supabase-ai-animation-logs.sql:4-10` | あり（user_id + 自由テキスト） | AI生成レート制限 |

### 1.2 カラム単位の個人情報マップ

#### `templates`（スキーマは insert payload から逆算）

| カラム | 型 | 個人情報の意味 | nullable | 出典 |
|---|---|---|---|---|
| `id` | uuid | — | NO | 推定 |
| `user_id` | text | **Twitch ユーザー ID（数値文字列）** — 投稿者の永続識別子 | NO | `src/app/api/templates/route.ts:91` |
| `user_name` | text | **Twitch 表示名** — 投稿者が画面に表示する名前 | NO | `:92` |
| `user_login` | text | **Twitch login（小文字 ID）** — Twitch URL に使われる名前 | NO | `:93` |
| `user_image` | text | **Twitch プロフィール画像 URL** — Twitch CDN URL | YES | `:94` |
| `title` | text | テンプレートタイトル（user 入力） | NO | `:95` |
| `tags` | text[] / jsonb | タグ（user 選択） | NO | `:96` |
| `config` | jsonb | エモート設定（フチ・テキスト・アニメ・badge等の構成） | NO | `:97` |
| `likes_count` | int | いいね数 | NO（DEFAULT 0 推定） | 推定 |
| `created_at` | timestamptz | 投稿日時 | NO | 推定 |

⚠️ **個人情報含有カラム: 4 個**（user_id / user_name / user_login / user_image）

#### `likes`（同・逆算）

| カラム | 型 | 個人情報の意味 |
|---|---|---|
| `id` | uuid | — |
| `template_id` | uuid (FK templates) | — |
| `user_id` | text | **Twitch ユーザー ID** — いいねした人の永続識別子 |
| `created_at` | timestamptz | いいね日時 |

UNIQUE 制約: `(template_id, user_id)` — 推定（CLAUDE.md 記載）

⚠️ **個人情報含有カラム: 1 個**（user_id）

#### `custom_animations`（SQL 確認済み）

| カラム | 型 | 個人情報の意味 |
|---|---|---|
| `id` | uuid | — |
| `user_id` | text | **Twitch ユーザー ID** — 投稿者 |
| `user_name` | text | **Twitch 表示名** |
| `user_login` | text | **Twitch login** |
| `user_image` | text NULL | **Twitch プロフィール画像 URL** |
| `name` | text (≤20) | アニメ名（user 入力） |
| `description` | text | **AI への指示プロンプト**（user 自由入力） |
| `code` | text (≤5000) | AI 生成 JS コード |
| `likes_count` | int DEFAULT 0 | — |
| `reports_count` | int DEFAULT 0 | — |
| `is_active` | bool DEFAULT true | — |
| `is_featured` | bool DEFAULT false | — |
| `created_at` | timestamptz | — |

⚠️ **個人情報含有カラム: 5 個**（user_id / user_name / user_login / user_image / description）。description は user の意図や好みが現れる自由テキストで、特定情報を含む可能性あり。

#### `animation_likes`（SQL 確認済み）

| カラム | 個人情報 |
|---|---|
| `id`, `animation_id` (FK), `created_at` | — |
| `user_id` | **Twitch ユーザー ID** |

UNIQUE: `(animation_id, user_id)`

⚠️ **個人情報含有カラム: 1 個**（user_id）

#### `animation_reports`（SQL 確認済み）

| カラム | 個人情報 |
|---|---|
| `id`, `animation_id` (FK), `created_at` | — |
| `user_id` | **Twitch ユーザー ID** — 通報者 |

UNIQUE: `(animation_id, user_id)`
DB trigger: 通報 3 件で `custom_animations.is_active = false` 自動切替

⚠️ **個人情報含有カラム: 1 個**（user_id・通報者として記録、被通報者の特定情報も間接的に紐づく）

#### `ai_animation_logs`（SQL 確認済み）

| カラム | 型 | 個人情報の意味 |
|---|---|---|
| `id` | uuid | — |
| `user_id` | text | **Twitch ユーザー ID** — レート制限対象 |
| `description` | text | **AI への指示プロンプト**（user 自由入力） |
| `code_length` | int | 生成コードの長さ（数値統計のみ） |
| `created_at` | timestamptz | 生成日時 |

⚠️ **個人情報含有カラム: 2 個**（user_id / description）

### 1.3 個人情報の集計

| 個人情報の種類 | 保存テーブル数 | 保存場所 |
|---|---|---|
| Twitch user_id | **6 / 6** | 全テーブルに存在 |
| Twitch user_name (表示名) | 2 | templates, custom_animations |
| Twitch user_login | 2 | templates, custom_animations |
| Twitch user_image (URL) | 2 | templates, custom_animations |
| ユーザー自由入力テキスト | 2 | custom_animations.description, ai_animation_logs.description |

**重要**: 既存 Footer (`src/components/Footer.tsx:32`) で「Twitchユーザー名・プロフィール画像が公開」とは触れているが、**user_id / user_login / description が記録されることは未開示**。

---

## §2 個人情報のライフサイクル

### 2.1 取得タイミング

| イベント | 取得カラム | 経由 |
|---|---|---|
| Twitch OAuth ログイン（初回） | (JWT に保持、Supabase 未保存) | `src/auth.ts:8-29` で `/helix/users` 呼び出し |
| テンプレート投稿 | user_id, user_name, user_login, user_image, title, tags, config | `POST /api/templates` (`route.ts:62-104`) |
| テンプレートいいね | user_id, template_id | `POST /api/templates/[id]/like` (`route.ts:40-43`) |
| AIアニメ生成（成功時のログ） | user_id, description, code_length | `POST /api/generate-animation` (`route.ts:178-182`) |
| AIアニメ公開（投稿） | user_id, user_name, user_login, user_image, name, description, code | `POST /api/custom-animations` (`route.ts:74-86`) |
| AIアニメいいね | user_id, animation_id | `POST /api/custom-animations/[id]/like` (`route.ts:40-43`) |
| AIアニメ通報 | user_id, animation_id | `POST /api/custom-animations/[id]/report` (`route.ts:30-33`) |

### 2.2 保存期間（永続性）

すべてのテーブルが **`created_at` のみで物理削除しない設計**:

| テーブル | 保存期間 | 削除トリガー |
|---|---|---|
| templates | **永続** | 投稿者本人による DELETE のみ (`/api/templates/[id]` `route.ts:32`) |
| likes | **永続** | unlike で本人分削除 (`/api/templates/[id]/like` `route.ts:29`) |
| custom_animations | **永続**（is_active で論理非公開化のみ） | 投稿者本人 DELETE (`/api/custom-animations/[id]` `route.ts:32`) or 通報3件で is_active=false |
| animation_likes | **永続** | unlike で本人分削除 (`/api/custom-animations/[id]/like` `route.ts:29`) |
| animation_reports | **永続** | 削除経路なし（実装上、レポート取り消し不可） |
| ai_animation_logs | **永続** | 削除経路なし（レート制限カウント用） |

⚠️ **「アカウント削除」のフロー自体が存在しない**。ユーザーが Twitch 側で連携解除しても、Supabase の過去データは残る。

### 2.3 削除条件の整理

| 削除可能 | 不可能 |
|---|---|
| 投稿テンプレート（本人のみ） | likes / animation_likes / animation_reports / ai_animation_logs を本人意思で全削除 |
| 投稿カスタムアニメ（本人のみ） | カスケード削除なし（templates DELETE しても likes は残る可能性、要確認） |
| いいねは toggle で削除 | アカウント連動の一括削除フロー |
| 通報は不可（cascade で animation_reports は消える可能性、要確認） | — |

⚠️ `templates` 削除時に対応する `likes` レコードがどうなるか（CASCADE か NO ACTION か）は SQL 不明。custom_animations は SQL に `ON DELETE CASCADE` 明記。

---

## §3 既存規約文の所在と表示位置

### 3.1 Footer に集約された開示文（`src/components/Footer.tsx`）

| 行 | 文言 | 性質 |
|---|---|---|
| 19 | `本サービスはTwitch Interactive, Inc.およびDiscord Inc.とは一切関係がありません。「Twitch」はTwitch Interactive, Inc.の、「Discord」はDiscord Inc.の登録商標です。` | 商標非関連 |
| 22 | `アップロードした画像はサーバーに送信されません。すべての処理はお使いのブラウザ内で完結します。` | プライバシー（画像のみ言及） |
| 25 | `本ツールはTwitchによる承認・審査の通過を保証するものではありません。` | 免責 |
| 26 | `第三者の著作物・肖像・映像を無断で使用しないでください。` | ユーザー責任 |
| 27 | `本ツールは現状有姿（AS-IS）で提供されます。動作・品質・特定目的への適合性について一切保証しません。` | 免責（AS-IS） |
| 28 | `生成物の利用はすべてご自身の責任で行ってください。` | ユーザー責任 |
| 29 | `背景透過はAIによる自動処理のため、結果の精度を保証しません。` | 免責 |
| 30 | `AIが生成したアニメーションコードの著作権は投稿者に帰属しません。不適切なコンテンツは通報機能でご報告ください。` | 著作権 |
| 31 | `第三者の著作物・アニメーションを模倣した内容の投稿は禁止します。` | 投稿規約 |
| **32** | `テンプレート・アニメーションの投稿時にTwitchユーザー名・プロフィール画像が公開されることに同意したものとみなします。` | **個人情報の公開同意（部分開示）** |
| 33 | `投稿されたコンテンツは本サービスの機能改善・表示に使用する場合があります。` | データ二次利用 |
| **36** | `本サービスはサービス改善のためUmami Analyticsによるアクセス解析を行っています。取得するデータはIPアドレスを含まない匿名の統計情報のみです。` | **アクセス解析の開示** |

### 3.2 表示位置

- ファイル: `src/components/Footer.tsx`
- UI 上: **全ページ最下部**（`<Footer />` コンポーネントを各ページから読む構造）
- 表示条件: **常時表示**（モーダル・初回ガード等なし）
- リンク: フッター内に「フィードバックを送る」Google Form がある（line 8-15）

### 3.3 既存開示の不足項目

✅ Footer で開示済み:
- 商標非関連性
- 「アップロード画像はブラウザ内完結」
- AS-IS 免責
- 「Twitch ユーザー名・プロフィール画像が公開される」（テンプレ・アニメ投稿時）
- Umami Analytics 利用

❌ Footer で開示されていない（プライバシー観点で要追加）:
1. **Twitch user_id / user_login の保存**（フッター 32 行は名前・画像のみ言及）
2. **いいね・通報・AIアニメ生成のたびに user_id が記録される**こと
3. **保存先（Supabase）の特定**
4. **保持期間**（永続）
5. **アカウント削除のフロー**（実は存在しない）
6. **第三者提供の有無**（行っていないが、明示なし）
7. **データ転送先**（Supabase US リージョン推定、要確認）
8. **AI への指示プロンプトが永続保存される**こと（custom_animations.description, ai_animation_logs.description）
9. **Twitch OAuth で取得するメールアドレスの扱い**（JWT に乗るが Supabase 保存はしない、ただし開示は必要）
10. **将来的な「フォロー判定結果」の保存有無**（fix7 で追加予定の isFollower）

---

## §4 プライバシーポリシーで開示すべき項目（推奨リスト）

### 4.1 既存規約文と整合させる前提

Footer の既存文言は **法的開示としては不十分**だが、**ユーザーへの一貫したコミュニケーション**として保持すべき。プライバシーポリシーは Footer の補完として、より詳細を提供する位置付け。

### 4.2 開示すべき項目一覧

#### A. 取得する個人情報（カテゴリ別）

```
■ Twitch OAuth ログイン時に取得
- Twitch ユーザー ID（数値）
- Twitch 表示名（display_name）
- Twitch login（小文字ユーザー名）
- メールアドレス（email、JWT セッションのみ）
- プロフィール画像 URL

■ ユーザー操作で取得・保存
- テンプレート投稿時: 上記 4 項目（user_id / user_name / user_login / user_image）+ 投稿内容
- AIアニメ生成時: user_id + AI への指示プロンプト
- AIアニメ公開時: 上記 4 項目 + 説明文・コード
- いいね操作時: user_id + 対象 ID
- 通報操作時: user_id + 対象 ID

■ 自動取得
- Umami Analytics（IP 含まない匿名統計のみ）
- セッション Cookie（Auth.js 暗号化）
```

#### B. 利用目的

```
- アカウント識別と表示（投稿者名・プロフィール画像の表示）
- 機能の利用権限判定（一部機能、Phase 1 では PASSPHRASE のみ、Phase 1+ で Twitch フォロー判定）
- いいね/通報の重複防止
- AI 生成の利用上限制御（5 回/日）
- サービス改善のための匿名アクセス統計
- 不適切コンテンツの自動非公開（通報 3 件で is_active=false）
```

#### C. 保存場所と期間

```
- セッショントークン: Cookie 内（最大 30 日、ブラウザのみ）
- 投稿関連データ: Supabase（PostgreSQL、海外リージョン）
  - templates, likes, custom_animations, animation_likes,
    animation_reports, ai_animation_logs の 6 テーブル
- 保存期間: 永続（ユーザー本人による削除のみ可、それ以外は無期限保持）
```

#### D. 第三者提供

```
- 第三者への提供は行いません
- Twitch（OAuth provider）と Supabase（データベース）以外への送信なし
- 投稿コンテンツ（テンプレート・アニメ）は public ギャラリーで他ユーザーから閲覧可能
```

#### E. 削除請求方法

```
- 投稿テンプレート / カスタムアニメ: 投稿者本人がツール内から削除可能
- いいね・通報: 取り消し操作で削除（通報のみ取り消し不可）
- アカウント全データ削除: 現状フロー無し
  → Discord (https://discord.gg/9ktJgFrYKe) または X (@akiissamurai) で
    削除依頼を受け付けます。Aki が手動で対応します
```

⚠️ **アカウント削除フローが実装上存在しない** ことを明示し、運営者連絡で対応する旨を記載する必要。GDPR 適用ユーザーがいる場合は要対応（合理的期間内の削除義務）。

#### F. Cookie とセッション

```
- next-auth が発行する HttpOnly + Secure cookie でセッション管理
- localStorage:
  - emote-subscriber: PASSPHRASE 認証フラグ（boolean のみ）
  - その他 UI 状態（feature lock hint count 等、Phase 1+ で追加予定）
```

#### G. 海外データ転送

```
- Supabase: 海外リージョン（要確認、推定 US East）
- Vercel: 海外 CDN
- Twitch: US Headquartered
- Anthropic API: US
```

#### H. 子どもの利用

```
- 13 歳未満（GDPR ルートでは 16 歳未満）の利用は推奨しない
- Twitch の年齢制限を準用
```

#### I. ポリシー改定

```
- 重要な変更がある場合、ツール内で告知
- 継続利用をもって同意とみなす
```

#### J. 連絡先

```
- 運営者: Aki（Twitch: datsusara_aki / X: akiissamurai）
- 連絡手段:
  - X: @akiissamurai
  - Discord: https://discord.gg/9ktJgFrYKe
  - フィードバックフォーム: (Footer 既存リンク)
- 運営者は個人。法人ではないことを明示
```

---

## §5 プライバシーポリシー作成上の注意点

### 5.1 既存規約と矛盾しないこと

#### ⚠️ 既存「ブラウザ内完結」と Supabase 保存の両立説明

Footer 22 行目: `アップロードした画像はサーバーに送信されません。すべての処理はお使いのブラウザ内で完結します。`

この文言は **「画像（アップロード写真・GIF・動画）」に限定された主張**。投稿時にサーバー (Supabase) に送られるのは Twitch アカウント情報と config（JSON 設定）のみで、**画像バイナリは送られていない**ので両立する。

**プライバシーポリシーでの説明方針案**:
```
「アップロードした写真・GIF・動画のデータは一切サーバーに送信されません。
背景透過・フチ取り・テキスト追加などの画像処理はすべてお使いのブラウザ内で完結します。

ただし、テンプレートやカスタムアニメを投稿する場合は、画像データ自体は
保存しませんが、設定情報（フチの色・テキストの内容など）と Twitch アカウント
情報をデータベースに保存します。」
```

### 5.2 PASSPHRASE / フォロー認証の扱い

Phase 1 / Phase 1+ で実装予定:
- `localStorage.emote-subscriber` ベースの PASSPHRASE 認証
- Twitch フォロー判定結果（JWT 内、DB 永続化なし予定）

Phase 1 ローンチ時点で開示すべき:
- 「フォロー判定はサーバーに保存しません」（JWT のみ）
- 「合言葉は localStorage に boolean を 1 つ保存するだけです」

### 5.3 「公開ギャラリー」と「個人データ」の境界

custom_animations / templates は public ギャラリーで他ユーザーが閲覧可能 → **「投稿時点で公開に同意」を明示**（Footer 32 行で部分カバー、PP で正式化）。

通報・いいねは public ではないが、user_id は記録される → **「集計目的のみで個別公開しない」と明示**。

### 5.4 「データの集約・統計利用」の余地を残す

将来的に「人気テンプレートランキング」「投稿者別実績」を出すなら、PP に「投稿データを集計・統計目的で利用する場合があります」を予防的に含めておく。

### 5.5 GDPR / 改正個人情報保護法（日本）対応の判断

- 海外ユーザーが含まれる場合 → GDPR 対応推奨（13 歳→16 歳の閾値、削除請求対応の明文化）
- 日本国内のみ想定なら → 改正個人情報保護法準拠（「個人関連情報」「同意取得」の概念）

**Aki 判断項目**: ターゲットを日本のみとするか、グローバルとするか。

### 5.6 PP 公開場所の選定

Footer に既に断片開示があるので、**新規ページ `/privacy` を作成してフルバージョンを置き、Footer から「プライバシーポリシー」リンクを追加**する方針が自然。Footer 既存文は **PP の冒頭サマリ** として位置付け直す。

### 5.7 fix7 (フォロー認証) との接続

fix7 実装時に PP も同時更新する設計：
- フォロー判定 API で Twitch の `/helix/channels/followed` を呼ぶ事実
- 結果を JWT に保存（Supabase 未保存）
- session 切れまで保持（最大 30 日）

これらを PP に追記項目として抑えておく。

### 5.8 Aki 個人運営の責任範囲

法人ではないので **個人運営者として連絡先 + 対応範囲の限界** を明示することを推奨:
- 「24 時間対応はできません」
- 「Aki が個人で運営しています」
- 「重大な問題があれば即対応します」

---

## §6 まとめと次のアクション

### 6.1 重要発見 TOP 3

1. **6 テーブル × 4 種の個人情報を保存**しているが、**Footer の既存開示はカラム単位の特定が無く法的に不十分**
2. **アカウント削除フローが実装されていない**（投稿の個別削除は可能だが、user_id 横断の一括削除手段なし）
3. **`description` カラム（custom_animations / ai_animation_logs）にユーザー自由入力テキストが永続保存**されている事実が Footer 既存開示で触れられていない

### 6.2 PP 起草に向けた優先タスク（Aki 担当）

| 優先度 | タスク |
|---|---|
| 高 | Supabase の保存リージョンを管理画面で確認 |
| 高 | アカウント削除依頼の連絡経路を確定（Discord / X / 専用フォーム） |
| 高 | 削除依頼を受けた時の手動オペレーション SOP を準備（user_id 逆引き → 全テーブル DELETE） |
| 中 | ターゲット地域確定（日本のみ / グローバル） |
| 中 | `/privacy` ページの新設 + Footer リンク追加（コード変更を伴うので別タスク） |
| 中 | templates / likes テーブルの実 SQL を Supabase 管理画面から取得して `supabase-templates.sql` 等としてリポジトリに記録（schema バージョン管理） |
| 低 | カスケード削除設定の確認（templates DELETE → likes も削除されるか） |

### 6.3 fix7 との同時並行作業

fix7 (フォロー認証) 実装中に PP も並行更新する：
- fix7 で `isFollower` を JWT に保存する事実を PP に追記
- フォロー判定 API 呼び出しを PP に追記
- ロックモーダル内に「プライバシーポリシー」リンクを置く

---

## 付録: 主要ファイル

- 既存規約文: `src/components/Footer.tsx`
- Supabase 接続: `src/lib/supabase.ts`
- Auth.js 設定: `src/auth.ts`
- スキーマ定義 (commit 済み): `supabase-custom-animations.sql`, `supabase-ai-animation-logs.sql`
- スキーマ定義 (リポジトリ未含): `templates`, `likes` （Supabase 管理画面で作成）

---

**監査完了。**

このドキュメントを基にプライバシーポリシー本文の起草に進む。本ファイルは PP の元データとして保持し、PP 自体は別ファイル（`/privacy` ページ等）として作成する想定。
