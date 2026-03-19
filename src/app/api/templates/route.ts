import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";
import { TEMPLATE_TAGS } from "@/types/emote";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sort = searchParams.get("sort") ?? "new";
  const tag = searchParams.get("tag");
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));

  let query = getSupabase()
    .from("templates")
    .select("*")
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (sort === "popular") {
    query = query.order("likes_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (tag && TEMPLATE_TAGS.includes(tag as typeof TEMPLATE_TAGS[number])) {
    query = query.contains("tags", [tag]);
  }

  const { data: templates, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If authenticated, compute liked_by_me for each template
  const session = await auth();
  if (session?.user?.id && templates && templates.length > 0) {
    const templateIds = templates.map((t) => t.id);
    const { data: likes } = await getSupabase()
      .from("likes")
      .select("template_id")
      .eq("user_id", session.user.id)
      .in("template_id", templateIds);

    const likedSet = new Set(likes?.map((l) => l.template_id));
    for (const t of templates) {
      t.liked_by_me = likedSet.has(t.id);
    }
  }

  return NextResponse.json(templates ?? []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, tags, config } = body;

  // Validate
  if (!title || typeof title !== "string" || title.trim().length === 0 || title.trim().length > 30) {
    return NextResponse.json({ error: "タイトルは1〜30文字で入力してください" }, { status: 400 });
  }

  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((t: string) => TEMPLATE_TAGS.includes(t as typeof TEMPLATE_TAGS[number]))) {
    return NextResponse.json({ error: "タグを1つ以上選択してください" }, { status: 400 });
  }

  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "Invalid config" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("templates")
    .insert({
      user_id: session.user.id,
      user_name: session.user.name ?? "Unknown",
      user_image: session.user.image ?? null,
      title: title.trim(),
      tags,
      config,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
