import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: templateId } = await params;
  const userId = session.user.id;

  // Check if like already exists
  const { data: existing } = await getSupabase()
    .from("likes")
    .select("id")
    .eq("template_id", templateId)
    .eq("user_id", userId)
    .maybeSingle();

  let liked: boolean;

  if (existing) {
    // Unlike
    await getSupabase().from("likes").delete().eq("id", existing.id);
    const { data: t } = await getSupabase()
      .from("templates")
      .select("likes_count")
      .eq("id", templateId)
      .single();
    const newCount = Math.max(0, (t?.likes_count ?? 1) - 1);
    await getSupabase().from("templates").update({ likes_count: newCount }).eq("id", templateId);
    liked = false;
  } else {
    // Like
    const { error: likeError } = await getSupabase().from("likes").insert({
      template_id: templateId,
      user_id: userId,
    });
    if (likeError) {
      return NextResponse.json({ error: likeError.message }, { status: 500 });
    }
    const { data: t } = await getSupabase()
      .from("templates")
      .select("likes_count")
      .eq("id", templateId)
      .single();
    const newCount = (t?.likes_count ?? 0) + 1;
    await getSupabase().from("templates").update({ likes_count: newCount }).eq("id", templateId);
    liked = true;
  }

  // Return final state
  const { data: final } = await getSupabase()
    .from("templates")
    .select("likes_count")
    .eq("id", templateId)
    .single();

  return NextResponse.json({
    liked,
    likes_count: final?.likes_count ?? 0,
  });
}
