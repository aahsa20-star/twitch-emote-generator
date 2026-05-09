# ADMIN: 削除請求受付 SOP（管理者向け運用ドキュメント）

**目的**: ユーザーから削除請求を受けた際の対応手順を標準化する。
**対象**: 本サービスの運営者（Aki および将来的な追加運営者）
**SLA**: 削除請求受領から **14 日以内**（プライバシーポリシー §5-2 の確約）
**適用範囲**: Supabase 上の投稿者情報および関連データの一括削除

⚠️ **このドキュメントはリポジトリで管理されますが、ユーザー向けには公開しません。**
（route として置かないため、Vercel ビルドにも含まれません。GitHub リポジトリの可視性に依存します。）

---

## 目次

1. 受付経路と初動
2. 依頼者本人確認
3. user_id の逆引き
4. 削除実行 SQL クエリ集
5. 削除完了の連絡テンプレート
6. 削除実行ログの記録
7. エッジケース対応

---

## 1. 受付経路と初動

### 1.1 受付チャネル（PP §10 で公開）

- **X (Twitter) DM**: [@datsusara_aki](https://x.com/datsusara_aki)
- **Twitch Whispers**: [@datsusara_aki](https://www.twitch.tv/datsusara_aki)

### 1.2 初動（受領 24 時間以内）

依頼受信後、まず**受付返信**を送る。SLA 内対応の意思表示。

```
ご連絡ありがとうございます。
削除請求を受領いたしました。

確認のため、以下の情報をお知らせください：
- Twitch ユーザー名（login、@で始まる名前）
- 削除を希望する範囲（全データ／特定の投稿のみ等）

頂いた情報をもとに、原則として 14 日以内にご対応いたします。
完了後、改めてご連絡いたします。
```

依頼者から情報を受けた段階で、§3 の本人確認に進む。

---

## 2. 依頼者本人確認

### 2.1 確認すべき項目

| 項目 | 必須 | 確認方法 |
|---|---|---|
| Twitch ユーザー名（login） | ✅ | 自己申告 + 連絡元のアカウント名と一致するか確認 |
| 削除範囲 | ✅ | 自己申告（「全データ」または「特定の投稿のみ」） |
| 連絡元アカウントの真正性 | ✅ | X / Twitch のプロフィールが Twitch login と紐付くか目視確認 |

### 2.2 なりすまし対策

- X DM の場合: 連絡元 X アカウントのプロフィールに **Twitch login** が掲載されているか確認
- Twitch Whispers の場合: 連絡元 Twitch アカウント = 申告 login で**自動的に一致**するため強い証跡
- 不審な場合: 「Twitch のログインで連絡をお願いします」と Twitch Whispers ルートに切り替え依頼

---

## 3. user_id の逆引き

Supabase に保存されているのは `user_id`（数値文字列）であり、ユーザーから受け取るのは Twitch login（人間可読名）。**最初に user_id を逆引き**する必要がある。

### 3.1 逆引き SQL（Supabase SQL Editor で実行）

```sql
-- templates テーブルから login で逆引き
SELECT DISTINCT user_id, user_login, user_name
FROM templates
WHERE user_login = 'TWITCH_LOGIN_HERE';

-- custom_animations テーブルからも確認
SELECT DISTINCT user_id, user_login, user_name
FROM custom_animations
WHERE user_login = 'TWITCH_LOGIN_HERE';
```

両方の結果を合わせて user_id を特定。**両方とも 0 件**なら、likes / animation_likes / animation_reports / ai_animation_logs にしかデータがない可能性があるので、Twitch API で外部から user_id を取得する必要あり（§3.2）。

### 3.2 Twitch API 経由での user_id 取得（自己投稿なし時のフォールバック）

```bash
# 1. App access token 取得
TOKEN=$(curl -s -X POST \
  "https://id.twitch.tv/oauth2/token" \
  -d "client_id=$AUTH_TWITCH_ID" \
  -d "client_secret=$AUTH_TWITCH_SECRET" \
  -d "grant_type=client_credentials" \
  | jq -r .access_token)

# 2. Twitch login → user_id 逆引き
curl -s "https://api.twitch.tv/helix/users?login=TWITCH_LOGIN_HERE" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Client-Id: $AUTH_TWITCH_ID" \
  | jq .data[0].id
```

得られた user_id（数値文字列）をもとに §4 の削除フェーズに進む。

### 3.3 user_id が確定したら念のため全テーブルで件数確認

```sql
-- 当該 user_id がどのテーブルにどれだけデータを持つか
SELECT 'templates' AS table_name, COUNT(*) AS cnt FROM templates WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'likes', COUNT(*) FROM likes WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'custom_animations', COUNT(*) FROM custom_animations WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'animation_likes', COUNT(*) FROM animation_likes WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'animation_reports', COUNT(*) FROM animation_reports WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'ai_animation_logs', COUNT(*) FROM ai_animation_logs WHERE user_id = 'USER_ID_HERE';
```

合計 0 件なら「対象データが存在しないため、追加対応の必要はありません」と返信して終了。

---

## 4. 削除実行 SQL クエリ集

### 4.1 全データ一括削除（依頼者が「全削除」を希望した場合）

⚠️ **必ずトランザクションで実行**してください。途中失敗時の部分削除を防ぐため。

```sql
BEGIN;

-- 1. AI生成ログ（永続）の削除
DELETE FROM ai_animation_logs WHERE user_id = 'USER_ID_HERE';

-- 2. 通報レコード（取り消しできないため、本人削除請求でのみ消える）
DELETE FROM animation_reports WHERE user_id = 'USER_ID_HERE';

-- 3. アニメへの「いいね」
DELETE FROM animation_likes WHERE user_id = 'USER_ID_HERE';

-- 4. テンプレートへの「いいね」
DELETE FROM likes WHERE user_id = 'USER_ID_HERE';

-- 5. カスタムアニメ投稿（CASCADE で自身に紐付く animation_likes / animation_reports は連動削除）
DELETE FROM custom_animations WHERE user_id = 'USER_ID_HERE';

-- 6. テンプレート投稿（templates の CASCADE 設定有無に依存。
--    CASCADE 未設定時は事前に WHERE template_id IN (...) で likes を削除する必要）
-- 念のため、削除対象 template_id を事前に取得して likes を別途削除:
DELETE FROM likes
WHERE template_id IN (SELECT id FROM templates WHERE user_id = 'USER_ID_HERE');

DELETE FROM templates WHERE user_id = 'USER_ID_HERE';

COMMIT;
```

### 4.2 削除後の確認

```sql
-- 全テーブルで 0 件になっていることを確認
SELECT 'templates' AS table_name, COUNT(*) AS cnt FROM templates WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'likes', COUNT(*) FROM likes WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'custom_animations', COUNT(*) FROM custom_animations WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'animation_likes', COUNT(*) FROM animation_likes WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'animation_reports', COUNT(*) FROM animation_reports WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'ai_animation_logs', COUNT(*) FROM ai_animation_logs WHERE user_id = 'USER_ID_HERE';
```

すべて 0 を確認したら §5 の完了通知に進む。

### 4.3 部分削除（特定の投稿のみ）

依頼者が「特定のテンプレート ID だけ消したい」「特定のカスタムアニメだけ消したい」と希望した場合：

```sql
-- 特定 template_id の削除（紐付く likes は CASCADE / 手動削除）
DELETE FROM likes WHERE template_id = 'SPECIFIC_TEMPLATE_ID';
DELETE FROM templates
WHERE id = 'SPECIFIC_TEMPLATE_ID' AND user_id = 'USER_ID_HERE';
-- user_id 条件で本人投稿に限定（誤削除防止）

-- 特定 custom_animation_id の削除（CASCADE で likes/reports 連動）
DELETE FROM custom_animations
WHERE id = 'SPECIFIC_ANIMATION_ID' AND user_id = 'USER_ID_HERE';
```

依頼者が一覧から ID を伝えにくい場合、一覧を見せて選んでもらう:

```sql
-- 依頼者の投稿一覧（識別しやすいよう title / name と created_at を表示）
SELECT 'template' AS type, id, title AS name, created_at
FROM templates WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT 'animation', id, name, created_at
FROM custom_animations WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC;
```

---

## 5. 削除完了の連絡テンプレート

### 5.1 全データ削除完了

```
削除作業が完了いたしましたのでご連絡いたします。

【対応内容】
本サービスのデータベース（Supabase）に保存されていた、ご依頼者様の
Twitch アカウント（@TWITCH_LOGIN_HERE）に紐付くすべての投稿者情報・
投稿コンテンツ・操作履歴を削除いたしました。

【補足事項】
- セッショントークン（Cookie）は、ログアウトまたはセッション期限到達時に
  自動削除されます。
- ブラウザのローカルストレージに保存された情報は、ブラウザの設定からご削除
  いただけます。
- Twitch 側でのアプリ連携の解除は、Twitch のアカウント設定から実施いただけます。

ご利用ありがとうございました。
何かご不明な点がございましたら、本連絡先までお問い合わせください。
```

### 5.2 部分削除完了

```
ご依頼の特定投稿の削除が完了いたしましたのでご連絡いたします。

【削除した投稿】
- {投稿タイプ}: {タイトル / アニメ名} (ID: {id})
- ...

引き続き本サービスをご利用いただけます。
他にも削除をご希望の投稿がございましたら、お気軽にお知らせください。
```

### 5.3 対象データなし

```
ご連絡ありがとうございます。
お問い合わせいただいたアカウントについて確認しましたが、本サービスのデータ
ベースに削除対象のデータは見つかりませんでした。

恐れ入りますが、以下をご確認のうえ、再度ご連絡をお願いいたします：
- Twitch ユーザー名（login）が正しいか
- 該当のアカウントで実際に投稿等を行ったか

なお、本サービスのセッション情報（Cookie / ローカルストレージ）はブラウザ
側に保存されており、ブラウザの設定から削除いただけます。
```

---

## 6. 削除実行ログの記録

⚠️ **削除実行は不可逆な操作のため、必ず記録を残すこと**。

### 6.1 ログファイルの場所

ローカル管理（リポジトリにコミットしない、SOP の手元実施記録）:

```
~/Desktop/Twitchエモート作成-admin-logs/deletion-log-YYYY.md
```

または Aki 個人の Notion / Obsidian / Google ドキュメント等。

### 6.2 ログ記録項目

| 項目 | 例 |
|---|---|
| 受領日時 | 2026-MM-DD HH:MM (JST) |
| 受領経路 | X DM / Twitch Whispers |
| 依頼者 Twitch login | `@example_user` |
| 確認した user_id | `123456789` |
| 削除範囲 | 全データ / 部分（template_id: xxx） |
| 削除実行日時 | 2026-MM-DD HH:MM (JST) |
| 削除前件数（テーブル別） | templates: 3, likes: 12, ... |
| 削除後件数 | 全て 0（または部分の件数） |
| 完了連絡日時 | 2026-MM-DD HH:MM (JST) |
| SLA 達成 | ✅（受領 → 完了が 14 日以内） |

### 6.3 統計用集計

四半期ごとに「削除請求件数」「平均応答日数」を集計してプライバシーポリシーの実効性を確認。問題があれば SOP 改訂。

---

## 7. エッジケース対応

### 7.1 Twitch アカウント自体が存在しない / BAN された場合

- user_id の逆引きで Twitch API が 404 を返す
- → 過去に正常な login でデータが入っている可能性は残る → §3.1 の SQL で `user_login` 直接照合
- 削除可能な範囲で実施し、依頼者にその旨を返信

### 7.2 削除中にユーザーが新規投稿してきた場合

- §4.1 の DELETE 実行前後でタイムスタンプを記録
- 実行前に投稿された分のみ削除
- 実行後の新規投稿は別途依頼を受ける形で再実施
- 二度手間を避けるため、§4 実行直後に「ログアウトをお願いします」と明示

### 7.3 個別投稿削除と全削除の混在依頼

- 「特定の 1 件は残したい、それ以外を全削除」のような依頼
- §4.3 の部分削除を最初に行い、次に §4.1 の WHERE 条件に `AND id != '残す ID'` を加える
- 慎重に SQL を組み立てる、不安なら依頼者に「これでよろしいですか」と確認

### 7.4 第三者になりすました削除依頼の疑い

- §2.2 の本人確認で疑義がある場合、Twitch Whispers ルートに誘導
- それでも疑わしい場合、依頼を保留して Aki が個別判断
- なりすましによる誤削除を避けるため、確信が持てるまで実行しない

### 7.5 SLA（14 日）を過ぎそうな場合

- 受領後 7 日経過した時点で進捗確認の中間連絡を入れる
- 個人運営のため遅延の可能性を依頼者に伝え、誠実に対応
- 重大な遅延が発生した場合、原因と対応予定を率直に共有

---

## 付録 A: テーブル一覧（PRIVACY_AUDIT.md §1 抜粋）

| テーブル | 個人情報含有カラム |
|---|---|
| `templates` | user_id, user_name, user_login, user_image |
| `likes` | user_id |
| `custom_animations` | user_id, user_name, user_login, user_image, description |
| `animation_likes` | user_id |
| `animation_reports` | user_id |
| `ai_animation_logs` | user_id, description |

CASCADE 関係（既存 SQL 確認済み）:
- `animation_likes.animation_id → custom_animations.id` ON DELETE CASCADE
- `animation_reports.animation_id → custom_animations.id` ON DELETE CASCADE
- `likes.template_id → templates.id` の CASCADE は **未確認**（§4.1 で念のため事前削除している）

## 付録 B: 関連ドキュメント

- [`PRIVACY_AUDIT.md`](./PRIVACY_AUDIT.md) — Supabase 個人情報の所在分析
- [`src/app/privacy/page.tsx`](./src/app/privacy/page.tsx) — 公開プライバシーポリシー
- [`supabase-cascades.sql`](./supabase-cascades.sql) — CASCADE 設定（fix8-privacy-policy で追加予定）

---

**SOP 完成。最初の削除請求を受けたら本ドキュメントに従って対応する。SOP の改善余地は実運用後に Aki 判断で更新。**
