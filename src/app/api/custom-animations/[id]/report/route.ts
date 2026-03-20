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

  // Check if already reported
  const { data: existing } = await getSupabase()
    .from("animation_reports")
    .select("id")
    .eq("animation_id", animationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "既に通報済みです" }, { status: 409 });
  }

  // Insert report (DB trigger will auto-deactivate at 3 reports)
  const { error } = await getSupabase().from("animation_reports").insert({
    animation_id: animationId,
    user_id: userId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reported: true });
}
