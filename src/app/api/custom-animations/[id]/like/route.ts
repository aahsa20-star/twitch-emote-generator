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

  const { id: animationId } = await params;
  const userId = session.user.id;

  // Check if like already exists
  const { data: existing } = await getSupabase()
    .from("animation_likes")
    .select("id")
    .eq("animation_id", animationId)
    .eq("user_id", userId)
    .maybeSingle();

  let liked: boolean;

  if (existing) {
    // Unlike
    await getSupabase().from("animation_likes").delete().eq("id", existing.id);
    const { data: a } = await getSupabase()
      .from("custom_animations")
      .select("likes_count")
      .eq("id", animationId)
      .single();
    const newCount = Math.max(0, (a?.likes_count ?? 1) - 1);
    await getSupabase().from("custom_animations").update({ likes_count: newCount }).eq("id", animationId);
    liked = false;
  } else {
    // Like
    const { error: likeError } = await getSupabase().from("animation_likes").insert({
      animation_id: animationId,
      user_id: userId,
    });
    if (likeError) {
      return NextResponse.json({ error: likeError.message }, { status: 500 });
    }
    const { data: a } = await getSupabase()
      .from("custom_animations")
      .select("likes_count")
      .eq("id", animationId)
      .single();
    const newCount = (a?.likes_count ?? 0) + 1;
    await getSupabase().from("custom_animations").update({ likes_count: newCount }).eq("id", animationId);
    liked = true;
  }

  // Return final state
  const { data: final } = await getSupabase()
    .from("custom_animations")
    .select("likes_count")
    .eq("id", animationId)
    .single();

  return NextResponse.json({
    liked,
    likes_count: final?.likes_count ?? 0,
  });
}
