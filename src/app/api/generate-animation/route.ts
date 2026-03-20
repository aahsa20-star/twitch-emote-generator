import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const DAILY_LIMIT = 5;

const SYSTEM_PROMPT = `あなたはTwitchエモートのアニメーションを生成するコード生成AIです。
ユーザーの説明に基づいて、Canvas 2D APIを使った1フレーム生成関数のボディ部分のみを返してください。

## 関数シグネチャ
function(baseCanvas, frameIndex, totalFrames) → Canvas

- baseCanvas: HTMLCanvasElement (256×256、元の画像)
- frameIndex: 0-based フレーム番号
- totalFrames: 総フレーム数 (通常20)
- 戻り値: 新しいHTMLCanvasElement (同サイズ)

## 制約
- document.createElement("canvas") で新しいcanvasを作成し、そこに描画して返すこと
- baseCanvasは読み取り専用として扱うこと (直接変更しない)
- 外部リソース (fetch, import, require) は使用禁止
- DOM操作 (document.body, querySelector等) は禁止
- setTimeout, setInterval, requestAnimationFrame は禁止
- Math, Canvas 2D API のみ使用可能
- アニメーションはループする前提 (frameIndex 0→totalFrames-1 で1サイクル)
- コードのみを返す。説明やマークダウンは不要。\`\`\`も不要。

## 重要: スケール指針
- 座標・サイズ・移動量は必ず canvas.width / canvas.height を基準とした相対値で計算すること
- ハードコードされたピクセル値 (5, 10 等) は使わず、canvas.width * 0.1 のような相対式を使う
- ユーザーの説明に応じた適切なスケールで動かすこと。ただしデフォルトは大きめ・ダイナミックにする
- 「揺れる」→ 回転15〜25度程度、「バウンド」→ 上下に canvas.height * 0.15 程度が目安

## 例1: 揺れるアニメーション（回転20度）
var w = baseCanvas.width;
var h = baseCanvas.height;
var canvas = document.createElement("canvas");
canvas.width = w;
canvas.height = h;
var ctx = canvas.getContext("2d");
var maxAngle = 20 * Math.PI / 180;
var angle = Math.sin((frameIndex / totalFrames) * Math.PI * 2) * maxAngle;
ctx.translate(w / 2, h / 2);
ctx.rotate(angle);
ctx.translate(-w / 2, -h / 2);
ctx.drawImage(baseCanvas, 0, 0);
return canvas;

## 例2: 左右バウンド
var w = baseCanvas.width;
var h = baseCanvas.height;
var canvas = document.createElement("canvas");
canvas.width = w;
canvas.height = h;
var ctx = canvas.getContext("2d");
var amplitude = w * 0.15;
var dx = Math.sin((frameIndex / totalFrames) * Math.PI * 2) * amplitude;
ctx.drawImage(baseCanvas, dx, 0);
return canvas;

## 例3: ゲーミング（色相回転）
var w = baseCanvas.width;
var h = baseCanvas.height;
var canvas = document.createElement("canvas");
canvas.width = w;
canvas.height = h;
var ctx = canvas.getContext("2d");
var angle = (frameIndex / totalFrames) * 360;
ctx.filter = "hue-rotate(" + angle + "deg) saturate(1.3)";
ctx.drawImage(baseCanvas, 0, 0);
ctx.filter = "none";
return canvas;`;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { count, error } = await supabase
    .from("ai_animation_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .gte("created_at", `${today}T00:00:00Z`);

  if (error) {
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }

  return NextResponse.json({ remaining: DAILY_LIMIT - (count ?? 0) });
}

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limit check via Supabase
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { count, error: countError } = await supabase
    .from("ai_animation_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00Z`);

  if (countError) {
    console.error("Rate limit check failed:", countError);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }

  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `1日の生成上限（${DAILY_LIMIT}回）に達しました。明日また試してください。` },
      { status: 429 }
    );
  }

  // Parse request body
  let description: string;
  try {
    const body = await req.json();
    description = String(body.description ?? "").trim();
    if (!description || description.length > 200) {
      return NextResponse.json(
        { error: "説明は1〜200文字で入力してください" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "無効なリクエスト" }, { status: 400 });
  }

  // Call Anthropic API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下の説明に基づいてアニメーションコードを生成してください:\n\n${description}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "コード生成に失敗しました" }, { status: 500 });
    }

    let code = textBlock.text.trim();

    // Strip markdown code fences if present (model sometimes adds them)
    if (code.startsWith("```")) {
      code = code.replace(/^```(?:javascript|js)?\n?/, "").replace(/\n?```$/, "");
    }

    // Log usage to Supabase
    await supabase.from("ai_animation_logs").insert({
      user_id: userId,
      description,
      code_length: code.length,
    });

    return NextResponse.json({ code });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return NextResponse.json(
      { error: "AI APIの呼び出しに失敗しました。しばらく経ってから再度お試しください。" },
      { status: 500 }
    );
  }
}
