import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sort = searchParams.get("sort") ?? "popular";
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)), PAGE_SIZE);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  let query = getSupabase()
    .from("custom_animations")
    .select("*")
    .eq("is_active", true)
    .range(offset, offset + limit - 1);

  if (sort === "new") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("likes_count", { ascending: false }).order("created_at", { ascending: false });
  }

  const { data: animations, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If authenticated, add liked_by_me
  const session = await auth();
  if (session?.user?.id && animations && animations.length > 0) {
    const ids = animations.map((a) => a.id);
    const { data: likes } = await getSupabase()
      .from("animation_likes")
      .select("animation_id")
      .eq("user_id", session.user.id)
      .in("animation_id", ids);

    const likedSet = new Set(likes?.map((l) => l.animation_id));
    for (const a of animations) {
      a.liked_by_me = likedSet.has(a.id);
    }
  }

  return NextResponse.json(animations ?? []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, code } = body;

  // Validate name
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 20) {
    return NextResponse.json({ error: "アニメーション名は1〜20文字で入力してください" }, { status: 400 });
  }

  // Validate description
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return NextResponse.json({ error: "説明を入力してください" }, { status: 400 });
  }

  // Validate code
  if (!code || typeof code !== "string" || code.length > 5000) {
    return NextResponse.json({ error: "コードが無効です（5000文字以内）" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("custom_animations")
    .insert({
      user_id: session.user.id,
      user_name: session.user.name ?? "Unknown",
      user_login: (session.user as unknown as Record<string, unknown>).login as string ?? session.user.name ?? "unknown",
      user_image: session.user.image ?? null,
      name: name.trim(),
      description: description.trim(),
      code,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
