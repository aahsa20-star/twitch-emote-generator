import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { passphrase } = await req.json();
  const correct = process.env.PASSPHRASE ?? "";

  if (!correct) {
    return NextResponse.json({ ok: false, error: "サーバー設定エラー" }, { status: 500 });
  }

  if (passphrase.trim().toLowerCase() === correct.trim().toLowerCase()) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
