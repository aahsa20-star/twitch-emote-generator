import { NextRequest, NextResponse } from "next/server";

/**
 * PASSPHRASE 認証エンドポイント。
 *
 * fix7 で server 側からも PASSPHRASE 状態を判別できるよう、認証成功時に
 * HttpOnly cookie `emote-subscriber=1` を設定する。クライアント側は引き続き
 * localStorage `emote-subscriber=true` も使う（SSR 不要な UI gating 用）。
 *
 * Security note: cookie 値は単なるフラグ ("1") で署名なし。攻撃者が手で
 * cookie をセットすれば PASSPHRASE 無しで通る。これは既存の localStorage
 * フラグと同等の名誉システム水準。完全な server-side 検証が必要な高セキュリティ
 * 用途なら Phase 2 で HMAC 署名を追加する。
 */
const COOKIE_NAME = "emote-subscriber";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  const { passphrase } = await req.json();
  const correct = process.env.PASSPHRASE ?? "";

  if (!correct) {
    return NextResponse.json({ ok: false, error: "サーバー設定エラー" }, { status: 500 });
  }

  if (passphrase.trim().toLowerCase() === correct.trim().toLowerCase()) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SEC,
    });
    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}

/**
 * DELETE: PASSPHRASE 解除（cookie をクリア）。
 * 既存の localStorage 解除と並行して呼ぶ想定。
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
