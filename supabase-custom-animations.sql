-- カスタムアニメーション（AI生成アニメーションの公開用）
CREATE TABLE custom_animations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  user_name text NOT NULL,
  user_login text NOT NULL,
  user_image text,
  name text NOT NULL CHECK (char_length(name) <= 20),
  description text NOT NULL,
  code text NOT NULL CHECK (char_length(code) <= 5000),
  likes_count int DEFAULT 0,
  reports_count int DEFAULT 0,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_custom_animations_likes ON custom_animations(likes_count DESC);
CREATE INDEX idx_custom_animations_active ON custom_animations(is_active);

GRANT ALL ON public.custom_animations TO service_role;

-- いいねテーブル
CREATE TABLE animation_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  animation_id uuid REFERENCES custom_animations(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(animation_id, user_id)
);

GRANT ALL ON public.animation_likes TO service_role;

-- 通報テーブル
CREATE TABLE animation_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  animation_id uuid REFERENCES custom_animations(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(animation_id, user_id)
);

GRANT ALL ON public.animation_reports TO service_role;

-- 通報3件で自動非公開
CREATE OR REPLACE FUNCTION check_reports_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE custom_animations
  SET is_active = false
  WHERE id = NEW.animation_id
  AND (SELECT COUNT(*) FROM animation_reports
       WHERE animation_id = NEW.animation_id) >= 3;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_deactivate_on_reports
AFTER INSERT ON animation_reports
FOR EACH ROW EXECUTE FUNCTION check_reports_count();
