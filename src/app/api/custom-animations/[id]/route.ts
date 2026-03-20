import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: animationId } = await params;

  // Verify ownership
  const { data: animation } = await getSupabase()
    .from("custom_animations")
    .select("user_id")
    .eq("id", animationId)
    .single();

  if (!animation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (animation.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete (likes and reports cascade automatically via FK)
  await getSupabase().from("custom_animations").delete().eq("id", animationId);

  return NextResponse.json({ ok: true });
}
