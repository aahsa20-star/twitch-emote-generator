import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/account/delete
 *
 * ログイン中ユーザー本人の Supabase 上の全データを削除する。
 * プライバシーポリシー §5-1 で約束した「ユーザー自身による即時削除」の
 * 一括削除版。
 *
 * 削除対象（PRIVACY_AUDIT.md §1.1 全 6 テーブル）:
 *   1. ai_animation_logs (user_id 紐付き)
 *   2. animation_reports (user_id 紐付き、通報レコード)
 *   3. animation_likes (user_id 紐付き、自分のいいね)
 *   4. likes (user_id 紐付き、自分のいいね)
 *   5. custom_animations (user_id 紐付き、CASCADE で animation_likes/reports は連動)
 *   6. templates (user_id 紐付き、CASCADE 未確認のため事前に likes を別途削除)
 *
 * 失敗時のフォールバック方針:
 * - Supabase JS client はトランザクション API を提供しないため、
 *   各 DELETE を順次実行する。途中失敗は部分削除を残す可能性あり
 * - 失敗テーブルをログに記録 + 500 を返す
 * - 部分失敗時は管理者が ADMIN_DELETION_SOP.md に従って手動補完
 *
 * 認証:
 * - session.user.id 必須
 * - 自分以外の user_id は削除不可（session 経由で固定、リクエスト body は不参照）
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const supabase = getSupabase();

  // 削除実行ログ用に各ステップの結果を集める
  const steps: { table: string; ok: boolean; error?: string }[] = [];

  /**
   * 1 テーブルから user_id 紐付きデータを削除する。
   * Supabase の delete().eq() で対象 0 件でもエラーにならない仕様を利用。
   */
  const deleteByUserId = async (table: string) => {
    try {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) {
        steps.push({ table, ok: false, error: error.message });
        return false;
      }
      steps.push({ table, ok: true });
      return true;
    } catch (e) {
      steps.push({
        table,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  };

  // 削除順序: FK 参照される側を最後に削除する。
  //   ai_animation_logs / animation_reports / animation_likes / likes は
  //   どれも親テーブルの FK を持つだけで参照されないので、先に消して問題ない。
  //   custom_animations は animation_likes / animation_reports に CASCADE で
  //   参照されているため、この時点で先に消しても OK（CASCADE で連動削除）。
  //   ただし「自分が他人のアニメに付けたいいね」を消したい場合があるので、
  //   先に animation_likes を消すほうが意味論的に明確。
  await deleteByUserId("ai_animation_logs");
  await deleteByUserId("animation_reports");
  await deleteByUserId("animation_likes");
  await deleteByUserId("likes");

  // custom_animations の削除（自分の投稿）
  // CASCADE 設定済みなので関連 animation_likes / animation_reports は連動削除
  await deleteByUserId("custom_animations");

  // templates の削除前に、自分が投稿した templates に対する全 likes を念のため削除する。
  // (CASCADE 設定が未確認のため、明示的に削除して整合性を保証)
  try {
    const { data: ownTemplates, error: selErr } = await supabase
      .from("templates")
      .select("id")
      .eq("user_id", userId);
    if (selErr) {
      steps.push({
        table: "templates(select for cascade)",
        ok: false,
        error: selErr.message,
      });
    } else if (ownTemplates && ownTemplates.length > 0) {
      const templateIds = ownTemplates.map((t) => t.id);
      const { error: likesDelErr } = await supabase
        .from("likes")
        .delete()
        .in("template_id", templateIds);
      if (likesDelErr) {
        steps.push({
          table: "likes(by template_id, cascade prep)",
          ok: false,
          error: likesDelErr.message,
        });
      } else {
        steps.push({ table: "likes(by template_id, cascade prep)", ok: true });
      }
    } else {
      // 自分の templates が無い場合は cascade 削除も不要
      steps.push({
        table: "likes(by template_id, cascade prep)",
        ok: true,
      });
    }
  } catch (e) {
    steps.push({
      table: "templates(select for cascade)",
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // templates 本体の削除
  await deleteByUserId("templates");

  // 全ステップ成功か判定
  const allOk = steps.every((s) => s.ok);
  if (!allOk) {
    // 部分失敗時はサーバーログに詳細を残す（クライアントには詳細を出さない）
    console.error("[account-delete] partial failure for user", userId, steps);
    return NextResponse.json(
      {
        error: "削除処理の一部に失敗しました",
      },
      { status: 500 },
    );
  }

  // 成功ログ（管理者向け）
  console.log(
    "[account-delete] success",
    userId,
    "tables=",
    steps.map((s) => s.table).join(","),
  );

  return NextResponse.json({ ok: true });
}
