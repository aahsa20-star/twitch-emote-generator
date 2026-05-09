-- =============================================================================
-- supabase-cascades.sql — CASCADE 制約の補強
-- =============================================================================
--
-- 目的: アカウント削除フロー (POST /api/account/delete) で templates を消した
--       際に、対応する likes が孤児にならないよう CASCADE を保証する。
--
-- 適用方針:
--   - 既存 SQL ファイル (supabase-custom-animations.sql) では
--     animation_likes / animation_reports → custom_animations が
--     ON DELETE CASCADE 済み。
--   - templates / likes はリポジトリに SQL がなく Supabase 管理画面で作成
--     されているため、現状の FK 設定が不明。
--   - 既存設定が CASCADE 済みなら本ファイルの DDL は冪等で no-op に近い
--     （ALTER TABLE で同じ ON DELETE CASCADE を再設定するだけ）。
--   - 既存設定が NO ACTION / RESTRICT なら本ファイルの ALTER で更新される。
--
-- 適用手順:
--   1. Supabase 管理画面 → SQL Editor を開く
--   2. 本ファイルの内容を貼り付けて実行
--   3. 実行後、§検証クエリで CASCADE が効いているか確認
--
-- 安全性:
--   - DDL のみ。既存データには影響しない
--   - ALTER TABLE 中に templates / likes へのアクセスが一時的にブロックされる
--     可能性あり（数秒程度、無人時間帯の実行を推奨）
--
-- 参照:
--   - PRIVACY_AUDIT.md §6.2 (Supabase CASCADE 設定確認タスク)
--   - ADMIN_DELETION_SOP.md 付録 A (CASCADE 関係表)
--   - src/app/api/account/delete/route.ts (CASCADE 未確認時の補完ロジック)
-- =============================================================================


-- ============================================================================
-- §1. 既存 FK 制約の確認（実行前の状態確認）
-- ============================================================================
-- 以下のクエリで現状の制約を確認できる。コピーして個別に実行:
--
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name,
--   rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND tc.table_name IN ('likes', 'animation_likes', 'animation_reports')
-- ORDER BY tc.table_name, kcu.column_name;


-- ============================================================================
-- §2. likes → templates の CASCADE 設定（追加・確実化）
-- ============================================================================
-- likes テーブルが templates.id を参照している前提。
-- 既存制約の名前が不明なので、まず既存制約を取り除いてから追加する。
-- 制約名は環境によって `likes_template_id_fkey` 等の自動命名になっている可能性。

-- 既存 FK 制約を全て削除して再作成する安全な手順:
DO $$
DECLARE
  cons_name text;
BEGIN
  -- likes.template_id を参照している全ての FK 制約名を取得
  FOR cons_name IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'likes'
      AND kcu.column_name = 'template_id'
  LOOP
    EXECUTE format('ALTER TABLE public.likes DROP CONSTRAINT %I', cons_name);
    RAISE NOTICE 'Dropped FK constraint: %', cons_name;
  END LOOP;
END $$;

-- ON DELETE CASCADE 付きで FK を再追加
ALTER TABLE public.likes
  ADD CONSTRAINT likes_template_id_fkey
  FOREIGN KEY (template_id)
  REFERENCES public.templates(id)
  ON DELETE CASCADE;


-- ============================================================================
-- §3. 既存 CASCADE 設定の念のための確認・再設定
-- ============================================================================
-- supabase-custom-animations.sql で以下は既に ON DELETE CASCADE 設定済みだが、
-- 環境差異で消えている可能性に備えて再適用しても安全（冪等）。

-- §3-1. animation_likes → custom_animations
DO $$
DECLARE
  cons_name text;
BEGIN
  FOR cons_name IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'animation_likes'
      AND kcu.column_name = 'animation_id'
  LOOP
    EXECUTE format('ALTER TABLE public.animation_likes DROP CONSTRAINT %I', cons_name);
  END LOOP;
END $$;

ALTER TABLE public.animation_likes
  ADD CONSTRAINT animation_likes_animation_id_fkey
  FOREIGN KEY (animation_id)
  REFERENCES public.custom_animations(id)
  ON DELETE CASCADE;

-- §3-2. animation_reports → custom_animations
DO $$
DECLARE
  cons_name text;
BEGIN
  FOR cons_name IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'animation_reports'
      AND kcu.column_name = 'animation_id'
  LOOP
    EXECUTE format('ALTER TABLE public.animation_reports DROP CONSTRAINT %I', cons_name);
  END LOOP;
END $$;

ALTER TABLE public.animation_reports
  ADD CONSTRAINT animation_reports_animation_id_fkey
  FOREIGN KEY (animation_id)
  REFERENCES public.custom_animations(id)
  ON DELETE CASCADE;


-- ============================================================================
-- §4. 適用後の検証クエリ
-- ============================================================================
-- 以下を実行して、3 件すべてが delete_rule = 'CASCADE' になっていることを確認:

-- SELECT
--   tc.table_name AS child_table,
--   kcu.column_name AS child_column,
--   ccu.table_name AS parent_table,
--   ccu.column_name AS parent_column,
--   rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND tc.table_name IN ('likes', 'animation_likes', 'animation_reports')
-- ORDER BY tc.table_name;

-- 期待される結果:
--   likes              | template_id  | templates         | id | CASCADE
--   animation_likes    | animation_id | custom_animations | id | CASCADE
--   animation_reports  | animation_id | custom_animations | id | CASCADE


-- ============================================================================
-- §5. 適用後のコード簡略化（オプション、Phase β-2 のロジック削減）
-- ============================================================================
-- src/app/api/account/delete/route.ts で「templates 削除前に likes を事前に
-- 削除する」コードがあるが、上記 §2 の CASCADE 設定後は不要になる。
-- ただし即時削除は必要ないので、Phase β の責務外として保留。
-- 本 SQL の適用が確認できた段階で、別 PR で route.ts を簡略化してよい。


-- =============================================================================
-- 注意事項
-- =============================================================================
--
-- 1. ROW LEVEL SECURITY (RLS) は本 SQL では変更しない。エモジェネは
--    service_role key でのアクセスを前提としているため、RLS の影響なし。
--
-- 2. 本 SQL の適用前に Supabase 管理画面でテーブルのバックアップを取ることを
--    推奨。Supabase Pro plan では Point-in-Time Recovery が使える。
--
-- 3. 適用は無人時間帯（深夜等）を推奨。ALTER TABLE 中はテーブルロックがかかる
--    可能性あり（PostgreSQL の制約変更は通常瞬時だが、保険）。
--
-- 4. 適用後、 `src/app/api/account/delete/route.ts` の動作テストを実施し、
--    削除が CASCADE 経由でも問題ないか確認すること。
--
